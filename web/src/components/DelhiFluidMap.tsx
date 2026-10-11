import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Language } from '../lib/i18n';
import { WindIcon, CompassIcon, LayersIcon, OpenFreeMapLogo, InfoIcon } from './Icons';

export type OpenFreeMapStyle = 'dark' | 'positron' | 'liberty' | 'bright' | 'fiord';

export const OPENFREEMAP_STYLES: Record<OpenFreeMapStyle, { name: string; url: string }> = {
  dark: { name: 'Dark', url: 'https://tiles.openfreemap.org/styles/dark' },
  positron: { name: 'Positron', url: 'https://tiles.openfreemap.org/styles/positron' },
  liberty: { name: 'Liberty', url: 'https://tiles.openfreemap.org/styles/liberty' },
  bright: { name: 'Bright', url: 'https://tiles.openfreemap.org/styles/bright' },
  fiord: { name: 'Fiord', url: 'https://tiles.openfreemap.org/styles/fiord' },
};

export interface HotspotData {
  id: string;
  name_en: string;
  name_hi: string;
  lat: number;
  lon: number;
  pm25: number;
  verdict: 'go' | 'limit' | 'skip';
  category: string;
}

interface DelhiFluidMapProps {
  hotspots: HotspotData[];
  viewMode: 'top' | 'horizontal';
  windDirectionDeg: number; // 0 = North, 90 = East, 180 = South, 270 = West
  windSpeedKmh: number;
  hourOffset: number;
  lang: Language;
  onSelectLocality?: (locId: string) => void;
  onToggleViewMode?: (mode: 'top' | 'horizontal') => void;
  isFullScreen?: boolean;
  onOpenInfoModal?: () => void;
  isSideMenuOpen?: boolean;
}

// Exact Web Mercator tile parameters for Delhi NCR at Zoom 11
const TILE_ZOOM = 11;
const X_MIN = 1461;
const Y_MIN = 852;
const TILES_PER_AXIS = 4;
const PLANE_SIZE = 6.4;

export function geoToPlane(lat: number, lon: number): [number, number] {
  const n = 2.0 ** TILE_ZOOM;
  const xtile = ((lon + 180.0) / 360.0) * n;
  const latRad = (lat * Math.PI) / 180.0;
  const ytile = (1.0 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2.0 * n;

  const u = (xtile - X_MIN) / TILES_PER_AXIS;
  const v = (ytile - Y_MIN) / TILES_PER_AXIS;

  const px = (u - 0.5) * PLANE_SIZE;
  const pz = (v - 0.5) * PLANE_SIZE;
  return [px, pz];
}

export const DelhiFluidMap: React.FC<DelhiFluidMapProps> = ({
  hotspots,
  viewMode,
  windDirectionDeg,
  windSpeedKmh,
  hourOffset,
  lang,
  onSelectLocality,
  onToggleViewMode,
  isFullScreen = false,
  onOpenInfoModal,
  isSideMenuOpen = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<maplibregl.Map | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const windCanvasRef = useRef<HTMLCanvasElement>(null);

  // Dark mode default style
  const [currentStyle, setCurrentStyle] = useState<OpenFreeMapStyle>('dark');
  const [activePin, setActivePin] = useState<HotspotData | null>(null);
  const [pinScreenCoords, setPinScreenCoords] = useState<Array<{ id: string; sx: number; sy: number; data: HotspotData }>>([]);

  // Three.js instances ref
  const threeRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    mesh: THREE.Mesh;
    material: THREE.ShaderMaterial;
    clock: THREE.Clock;
    targetCamPos: THREE.Vector3;
    targetLookAt: THREE.Vector3;
    currentLookAt: THREE.Vector3;
    reqId: number;
  } | null>(null);

  // Synchronize MapLibre vector map projection coordinates with shader and station pins
  const syncMapCoordinates = useCallback(() => {
    const map = mapInstanceRef.current;
    if (!map || !containerRef.current) return;

    const w = containerRef.current.clientWidth;
    const h = isFullScreen ? window.innerHeight : Math.max(containerRef.current.clientHeight, 560);
    if (w <= 0 || h <= 0) return;

    const screenPositions = new Float32Array(16 * 2);
    const coords = hotspots.slice(0, 16).map((item, i) => {
      const pt = map.project([item.lon, item.lat]);
      screenPositions[i * 2] = pt.x / w;
      screenPositions[i * 2 + 1] = 1.0 - (pt.y / h); // In WebGL UV space, y=0 is bottom
      return {
        id: item.id,
        sx: pt.x,
        sy: pt.y,
        data: item,
      };
    });

    if (threeRef.current) {
      threeRef.current.material.uniforms.u_hotspot_screen_positions.value = screenPositions;
      threeRef.current.material.uniforms.u_map_zoom.value = map.getZoom();
      threeRef.current.material.uniforms.u_map_bearing.value = map.getBearing();
      threeRef.current.material.uniforms.u_resolution.value.set(w, h);
    }

    if (viewMode === 'top') {
      setPinScreenCoords(coords);
    }
  }, [hotspots, isFullScreen, viewMode]);

  // Initialize and synchronize OpenFreeMap vector map via MapLibre GL JS
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: OPENFREEMAP_STYLES[currentStyle].url,
      center: [77.168, 28.613],
      zoom: 10.15,
      interactive: true,
      attributionControl: false,
    });

    map.fitBounds(
      [
        [76.8164, 28.3044],
        [77.5195, 28.9216],
      ],
      { padding: 20, animate: false }
    );

    mapInstanceRef.current = map;

    map.on('load', syncMapCoordinates);
    map.on('move', syncMapCoordinates);
    map.on('zoom', syncMapCoordinates);
    map.on('rotate', syncMapCoordinates);
    map.on('resize', syncMapCoordinates);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [currentStyle, syncMapCoordinates]);

  // Load basemap texture for 3D terrain peaks mesh (Carto Dark Matter / OSM)
  const createDelhiBasemapTexture = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    if (!ctx) return new THREE.Texture();

    // Dark canvas background
    ctx.fillStyle = '#090D16';
    ctx.fillRect(0, 0, 1024, 1024);

    // Subtle coordinate grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 1024; i += 64) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 1024);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(1024, i);
      ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.needsUpdate = true;

    // Fetch Carto Dark tiles for the 3D elevation mesh
    const tilePromises: Promise<{ img: HTMLImageElement; x: number; y: number }>[] = [];
    for (let tx = 0; tx < TILES_PER_AXIS; tx++) {
      for (let ty = 0; ty < TILES_PER_AXIS; ty++) {
        const tileX = X_MIN + tx;
        const tileY = Y_MIN + ty;
        const tileUrl = `https://a.basemaps.cartocdn.com/dark_all/${TILE_ZOOM}/${tileX}/${tileY}.png`;

        const p = new Promise<{ img: HTMLImageElement; x: number; y: number }>((resolve) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => resolve({ img, x: tx * 256, y: ty * 256 });
          img.onerror = () => {
            const fallback = new Image();
            fallback.crossOrigin = 'anonymous';
            fallback.onload = () => resolve({ img: fallback, x: tx * 256, y: ty * 256 });
            fallback.src = `https://tile.openstreetmap.org/${TILE_ZOOM}/${tileX}/${tileY}.png`;
          };
          img.src = tileUrl;
        });
        tilePromises.push(p);
      }
    }

    Promise.all(tilePromises).then((loadedTiles) => {
      loadedTiles.forEach(({ img, x, y }) => {
        try {
          ctx.drawImage(img, x, y, 256, 256);
        } catch (_) {}
      });
      texture.needsUpdate = true;
    });

    return texture;
  };

  // Three.js Scene Setup & Atmospheric Physics Simulation Loop
  useEffect(() => {
    if (!containerRef.current || !canvasRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = isFullScreen ? window.innerHeight : Math.max(containerRef.current.clientHeight, 560);

    // 1. Scene & Camera
    const scene = new THREE.Scene();
    scene.background = null; // transparent canvas so MapLibre vector map shows through

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    const initialCamPos = viewMode === 'top' ? new THREE.Vector3(0, 7.8, 0.001) : new THREE.Vector3(0, 3.2, 5.4);
    const initialLookAt = viewMode === 'top' ? new THREE.Vector3(0, 0, 0) : new THREE.Vector3(0, 0.4, 0);
    camera.position.copy(initialCamPos);
    camera.lookAt(initialLookAt);

    // 2. Renderer
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
      alpha: true,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // 3. Basemap Texture
    const basemapTexture = createDelhiBasemapTexture();

    // 4. Custom GLSL Shader with Atmospheric Dispersion Physics
    const hotspotPositions = new Float32Array(16 * 2);
    const hotspotIntensities = new Float32Array(16);

    hotspots.slice(0, 16).forEach((h, i) => {
      const [px, pz] = geoToPlane(h.lat, h.lon);
      hotspotPositions[i * 2] = px;
      hotspotPositions[i * 2 + 1] = pz;
      hotspotIntensities[i] = h.pm25;
    });

    const uniforms = {
      u_time: { value: 0.0 },
      u_view_mode: { value: viewMode === 'top' ? 0.0 : 1.0 },
      u_height_scale: { value: 1.65 },
      u_basemap: { value: basemapTexture },
      u_wind: { value: new THREE.Vector2(-0.707, 0.707) },
      u_wind_speed: { value: 0.5 },
      u_num_hotspots: { value: Math.min(hotspots.length, 16) },
      u_hotspot_positions: { value: hotspotPositions },
      u_hotspot_screen_positions: { value: new Float32Array(16 * 2) },
      u_hotspot_intensities: { value: hotspotIntensities },
      u_resolution: { value: new THREE.Vector2(width, height) },
      u_map_zoom: { value: 10.15 },
      u_map_bearing: { value: 0.0 },
    };

    const vertexShader = `
      uniform float u_time;
      uniform float u_view_mode;
      uniform float u_height_scale;
      uniform int u_num_hotspots;
      uniform vec2 u_hotspot_positions[16];
      uniform float u_hotspot_intensities[16];
      uniform vec2 u_wind;

      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vPosition;
      varying float vElevation;

      void main() {
        vUv = uv;
        vec3 pos = position;

        float elevationAccum = 0.0;

        for (int i = 0; i < 16; i++) {
          if (i >= u_num_hotspots) break;
          vec2 hPos = u_hotspot_positions[i];
          float hVal = u_hotspot_intensities[i];

          float dist = length(pos.xz - hPos);
          float bell = exp(- (dist * dist) / 0.18);
          elevationAccum += bell * (hVal / 320.0);
        }

        // In Top View: strictly flat plane (0.0). In Horizontal View: 3D peaks on Y axis.
        float finalElevation = elevationAccum * u_height_scale * u_view_mode;
        pos.y += finalElevation;

        vElevation = finalElevation;
        vPosition = pos;
        vNormal = normal;

        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `;

    const fragmentShader = `
      uniform float u_time;
      uniform float u_view_mode;
      uniform sampler2D u_basemap;
      uniform vec2 u_wind;
      uniform float u_wind_speed;
      uniform int u_num_hotspots;
      uniform vec2 u_hotspot_positions[16];
      uniform vec2 u_hotspot_screen_positions[16];
      uniform float u_hotspot_intensities[16];
      uniform vec2 u_resolution;
      uniform float u_map_zoom;
      uniform float u_map_bearing;

      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vPosition;
      varying float vElevation;

      // Pseudo-random hash
      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }

      // Value noise
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i + vec2(0.0,0.0)), hash(i + vec2(1.0,0.0)), u.x),
                   mix(hash(i + vec2(0.0,1.0)), hash(i + vec2(1.0,1.0)), u.x), u.y);
      }

      // Multi-octave Fractional Brownian Motion (fBm) for turbulent smoke billows
      float fbm(vec2 p) {
        float val = 0.0;
        float amp = 0.5;
        for (int i = 0; i < 4; i++) {
          val += amp * noise(p);
          p *= 2.15;
          amp *= 0.48;
        }
        return val;
      }

      // Fine micro-particulate noise
      float fbmFine(vec2 p) {
        float val = 0.0;
        float amp = 0.5;
        for (int i = 0; i < 5; i++) {
          val += amp * noise(p);
          p *= 2.22;
          amp *= 0.46;
        }
        return val;
      }

      // Physics-grounded CPCB Smog & Particulate Spectrum
      // Incorporates chemical aerosol tones: dark soot cores, toxic crimson, sulfuric amber, emerald fringes
      vec3 getAtmosphericSmogColor(float pmNorm) {
        vec3 colGood     = vec3(0.06, 0.72, 0.51); // #10B981 (Emerald green fringe)
        vec3 colModerate = vec3(0.96, 0.62, 0.04); // #F59E0B (Sulfuric amber haze)
        vec3 colPoor     = vec3(0.98, 0.45, 0.09); // #F97316 (Burnt orange smog)
        vec3 colVeryPoor = vec3(0.94, 0.27, 0.27); // #EF4444 (Toxic crimson)
        vec3 colSevere   = vec3(0.48, 0.06, 0.10); // #7F1D1D (Hazardous particulate soot core)

        if (pmNorm < 0.22) {
          return mix(colGood, colModerate, pmNorm / 0.22);
        } else if (pmNorm < 0.48) {
          return mix(colModerate, colPoor, (pmNorm - 0.22) / 0.26);
        } else if (pmNorm < 0.76) {
          return mix(colPoor, colVeryPoor, (pmNorm - 0.48) / 0.28);
        } else {
          return mix(colVeryPoor, colSevere, clamp((pmNorm - 0.76) / 0.24, 0.0, 1.0));
        }
      }

      void main() {
        vec4 baseMapColor = texture2D(u_basemap, vUv);

        vec2 windDir = normalize(u_wind);
        vec2 windPerp = vec2(-windDir.y, windDir.x);

        // ========================================================
        // CASE A: TOP VIEW (Aligned dynamically to MapLibre GL JS vector map)
        // ========================================================
        if (u_view_mode <= 0.05) {
          vec2 fragUV = gl_FragCoord.xy / u_resolution.xy;
          float aspect = u_resolution.x / u_resolution.y;

          // Account for bearing / rotation of the map
          float bearingRad = - u_map_bearing * 0.0174532925;
          mat2 rotBearing = mat2(cos(bearingRad), -sin(bearingRad), sin(bearingRad), cos(bearingRad));
          vec2 effWindDir = rotBearing * windDir;
          vec2 effWindPerp = vec2(-effWindDir.y, effWindDir.x);

          // Zoom scale factor (adjusts dispersion radius with map zoom)
          float zoomScale = pow(2.0, clamp(u_map_zoom - 10.15, -1.5, 3.5));

          // 1. GAUSSIAN PLUME ATMOSPHERIC DISPERSION
          float totalPlume = 0.0;
          float weightedPM = 0.0;
          float totalWeight = 0.0;

          for (int i = 0; i < 16; i++) {
            if (i >= u_num_hotspots) break;
            vec2 hScreen = u_hotspot_screen_positions[i];
            float hVal = u_hotspot_intensities[i];

            vec2 delta = fragUV - hScreen;
            delta.x *= aspect; // Normalize to isotropic metric space

            float downwindDist = dot(delta, effWindDir);
            float crosswindDist = abs(dot(delta, effWindPerp));

            // Pasquill-Gifford dispersion parameter sigma_y(x)
            float sigma0 = 0.040 * zoomScale;
            float alphaDisp = 0.14 * sqrt(max(0.001, zoomScale));
            float sigmaY = sigma0 + alphaDisp * sqrt(max(0.0, downwindDist));

            // Crosswind Gaussian profile
            float crosswindProfile = exp(- (crosswindDist * crosswindDist) / (2.0 * sigmaY * sigmaY));

            // Longitudinal profile: exponential decay downwind, sharp upwind boundary
            float longitudinalProfile;
            if (downwindDist >= 0.0) {
              longitudinalProfile = exp(- downwindDist / (0.34 * zoomScale));
            } else {
              longitudinalProfile = exp(- (downwindDist * downwindDist) / (0.0030 * zoomScale * zoomScale));
            }

            float plumeContrib = (hVal / 320.0) * crosswindProfile * longitudinalProfile;
            totalPlume += plumeContrib;

            float w = crosswindProfile * longitudinalProfile;
            weightedPM += hVal * w;
            totalWeight += w;
          }

          float localPM = totalWeight > 0.0 ? (weightedPM / totalWeight) : 80.0;
          float pmNorm = clamp(localPM / 320.0, 0.0, 1.2);

          // 2. KELVIN-HELMHOLTZ VORTICITY & DUAL DOMAIN WARPING TURBULENCE
          vec2 spaceCoord = fragUV * vec2(aspect, 1.0);
          vec2 advectCoord = spaceCoord - effWindDir * u_time * (0.04 + u_wind_speed * 0.03);

          // Vector domain warping (curling shear vortices)
          vec2 warp1;
          warp1.x = fbm(advectCoord * 5.2 + vec2(0.0, 0.0));
          warp1.y = fbm(advectCoord * 5.2 + vec2(4.3, 1.7));

          vec2 warp2;
          warp2.x = fbm(advectCoord * 10.4 + warp1 * 0.85 + vec2(1.2, 5.4) + u_time * 0.02);
          warp2.y = fbm(advectCoord * 10.4 + warp1 * 0.85 + vec2(3.1, 2.9) - u_time * 0.02);

          vec2 turbulentCoord = advectCoord + warp1 * 0.07 + warp2 * 0.035;

          float billow1 = fbm(turbulentCoord * 7.5);
          float billow2 = fbm(turbulentCoord * 15.0 + u_time * 0.03);
          float microDust = fbmFine(turbulentCoord * 28.0);

          float smokeStructure = billow1 * 0.52 + billow2 * 0.33 + microDust * 0.15;

          // Modulate physical plume concentration with turbulent billow eddies
          float rawDensity = totalPlume * (0.42 + 1.05 * smokeStructure);

          // 3. BEER-LAMBERT OPTICAL DENSITY & EXTINCTION
          float opticalDepth = rawDensity * 2.7;
          float transmittance = exp(-opticalDepth);
          float cloudAlpha = clamp(1.0 - transmittance, 0.0, 0.82);

          // Volumetric self-shadowing (directional sunlight attenuation inside soot clusters)
          float sootShadow = clamp(1.0 - rawDensity * 0.36 + (billow1 - 0.5) * 0.22, 0.58, 1.15);
          vec3 cloudColor = getAtmosphericSmogColor(pmNorm) * sootShadow;

          // 4. MOVING STREAMLINE PARTICLES & CYAN HIGHLIGHTS
          float streamBand = sin(dot(spaceCoord, effWindPerp) * 22.0);
          float streamFlow = sin(dot(spaceCoord, effWindDir) * 6.0 - u_time * (1.8 + u_wind_speed * 1.4));
          float windStreak = smoothstep(0.82, 0.99, streamBand * streamFlow);
          vec3 windStreakColor = vec3(0.06, 0.71, 0.95);

          vec3 topCompositeColor = mix(cloudColor, windStreakColor, windStreak * 0.35);
          float topCompositeAlpha = clamp(cloudAlpha * 0.85 + windStreak * 0.30, 0.0, 0.86);

          gl_FragColor = vec4(topCompositeColor, topCompositeAlpha);
          return;
        }

        // ========================================================
        // CASE B: 3D HORIZONTAL VIEW (World Plane Space)
        // ========================================================
        float totalPlume = 0.0;
        float weightedPM = 0.0;
        float totalWeight = 0.0;

        for (int i = 0; i < 16; i++) {
          if (i >= u_num_hotspots) break;
          vec2 hPos = u_hotspot_positions[i];
          float hVal = u_hotspot_intensities[i];

          vec2 delta = vPosition.xz - hPos;
          float downwindDist = dot(delta, windDir);
          float crosswindDist = abs(dot(delta, windPerp));

          float sigmaY = 0.18 + 0.35 * sqrt(max(0.0, downwindDist));
          float crosswindProfile = exp(- (crosswindDist * crosswindDist) / (2.0 * sigmaY * sigmaY));

          float longitudinalProfile;
          if (downwindDist >= 0.0) {
            longitudinalProfile = exp(- downwindDist / 1.55);
          } else {
            longitudinalProfile = exp(- (downwindDist * downwindDist) / 0.08);
          }

          float plumeContrib = (hVal / 320.0) * crosswindProfile * longitudinalProfile;
          totalPlume += plumeContrib;

          float w = crosswindProfile * longitudinalProfile;
          weightedPM += hVal * w;
          totalWeight += w;
        }

        float localPM = totalWeight > 0.0 ? (weightedPM / totalWeight) : 100.0;
        float pmNorm = clamp(localPM / 320.0, 0.0, 1.2);

        vec2 advectCoord = vPosition.xz - windDir * u_time * (0.20 + u_wind_speed * 0.15);
        vec2 warp;
        warp.x = fbm(advectCoord * 2.2);
        warp.y = fbm(advectCoord * 2.2 + vec2(4.3, 1.7));

        vec2 warpedCoord = advectCoord + warp * 0.28;
        float billowNoise1 = fbm(warpedCoord * 3.8);
        float billowNoise2 = fbm(warpedCoord * 7.5 + u_time * 0.04);
        float smokeStructure = (billowNoise1 * 0.65 + billowNoise2 * 0.35);

        float rawDensity = totalPlume * (0.50 + 0.90 * smokeStructure);
        float opticalDepth = rawDensity * 2.6;
        float transmittance = exp(-opticalDepth);
        float cloudAlpha = clamp(1.0 - transmittance, 0.0, 0.85);

        vec3 cloudColor = getAtmosphericSmogColor(pmNorm);

        // 3D Hillshading & Contour Isolines
        vec3 lightDir = normalize(vec3(0.4, 1.2, 0.6));
        float diff = max(dot(vNormal, lightDir), 0.3);
        cloudColor *= (0.7 + 0.4 * diff);

        float contour = fract(vElevation * 7.0);
        if (contour < 0.07 && vElevation > 0.08) {
          cloudColor = mix(cloudColor, vec3(1.0, 1.0, 1.0), 0.45);
        }

        vec3 hComposite = mix(baseMapColor.rgb, cloudColor, cloudAlpha * 0.88);
        gl_FragColor = vec4(hComposite, 1.0);
      }
    `;

    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms,
      wireframe: false,
      side: THREE.DoubleSide,
      transparent: true,
    });

    const geometry = new THREE.PlaneGeometry(PLANE_SIZE, PLANE_SIZE, 128, 128);
    geometry.rotateX(-Math.PI / 2);

    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    const clock = new THREE.Clock();
    threeRef.current = {
      scene,
      camera,
      renderer,
      mesh,
      material,
      clock,
      targetCamPos: initialCamPos.clone(),
      targetLookAt: initialLookAt.clone(),
      currentLookAt: initialLookAt.clone(),
      reqId: 0,
    };

    // Trigger initial map coordinate sync
    syncMapCoordinates();

    let animId = 0;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      if (!threeRef.current) return;

      const { renderer, scene, camera, material, clock, targetCamPos, targetLookAt, currentLookAt } = threeRef.current;
      const elapsedTime = clock.getElapsedTime();

      material.uniforms.u_time.value = elapsedTime;

      camera.position.lerp(targetCamPos, 0.08);
      currentLookAt.lerp(targetLookAt, 0.08);
      camera.lookAt(currentLookAt);

      const targetViewModeVal = viewMode === 'top' ? 0.0 : 1.0;
      material.uniforms.u_view_mode.value = THREE.MathUtils.lerp(
        material.uniforms.u_view_mode.value,
        targetViewModeVal,
        0.08
      );

      renderer.render(scene, camera);

      // In 3D Horizontal View: Project 3D station pins from Three.js camera
      if (viewMode === 'horizontal') {
        const coords = hotspots.map((h) => {
          const [px, pz] = geoToPlane(h.lat, h.lon);
          const py = (h.pm25 / 320.0) * 1.65;
          const v = new THREE.Vector3(px, py, pz);
          v.project(camera);

          const currentW = isFullScreen ? window.innerWidth : (containerRef.current?.clientWidth || 800);
          const currentH = isFullScreen ? window.innerHeight : (containerRef.current?.clientHeight || 560);
          const sx = ((v.x + 1) * currentW) / 2;
          const sy = ((-v.y + 1) * currentH) / 2;

          return { id: h.id, sx, sy, data: h };
        });
        setPinScreenCoords(coords);
      }
    };
    animate();

    // Mouse / Touch Interaction for 3D Camera Orbit
    let isDragging = false;
    let prevMouseX = 0;
    let prevMouseY = 0;

    const canvasElem = canvasRef.current;
    const onPointerDown = (e: PointerEvent) => {
      if (viewMode !== 'horizontal') return;
      isDragging = true;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
      canvasElem.setPointerCapture(e.pointerId);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isDragging || !threeRef.current || viewMode !== 'horizontal') return;
      const deltaX = e.clientX - prevMouseX;
      const deltaY = e.clientY - prevMouseY;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;

      const cam = threeRef.current.targetCamPos;
      const radius = Math.sqrt(cam.x * cam.x + cam.z * cam.z);
      let angle = Math.atan2(cam.z, cam.x);
      angle -= deltaX * 0.008;

      cam.x = radius * Math.cos(angle);
      cam.z = radius * Math.sin(angle);
      cam.y = Math.max(1.2, Math.min(6.5, cam.y + deltaY * 0.01));
    };

    const onPointerUp = (e: PointerEvent) => {
      isDragging = false;
      try {
        canvasElem.releasePointerCapture(e.pointerId);
      } catch (_) {}
    };

    canvasElem.addEventListener('pointerdown', onPointerDown);
    canvasElem.addEventListener('pointermove', onPointerMove);
    canvasElem.addEventListener('pointerup', onPointerUp);
    canvasElem.addEventListener('pointercancel', onPointerUp);

    const handleResize = () => {
      if (!containerRef.current || !threeRef.current) return;
      const w = isFullScreen ? window.innerWidth : containerRef.current.clientWidth;
      const h = isFullScreen ? window.innerHeight : Math.max(containerRef.current.clientHeight, 560);
      threeRef.current.camera.aspect = w / h;
      threeRef.current.camera.updateProjectionMatrix();
      threeRef.current.renderer.setSize(w, h);
      threeRef.current.material.uniforms.u_resolution.value.set(w, h);
      syncMapCoordinates();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      canvasElem.removeEventListener('pointerdown', onPointerDown);
      canvasElem.removeEventListener('pointermove', onPointerMove);
      canvasElem.removeEventListener('pointerup', onPointerUp);
      canvasElem.removeEventListener('pointercancel', onPointerUp);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      geometry.dispose();
      material.dispose();
      basemapTexture.dispose();
      threeRef.current = null;
    };
  }, [isFullScreen, hotspots, syncMapCoordinates, viewMode]);

  // Moving Aerodynamic Wind Direction Arrows Loop
  useEffect(() => {
    const windCanvas = windCanvasRef.current;
    if (!windCanvas || !containerRef.current) return;
    const ctx = windCanvas.getContext('2d');
    if (!ctx) return;

    const w = isFullScreen ? window.innerWidth : containerRef.current.clientWidth;
    const h = isFullScreen ? window.innerHeight : containerRef.current.clientHeight;
    windCanvas.width = w;
    windCanvas.height = h;

    const travelAngleRad = ((windDirectionDeg + 180) % 360) * (Math.PI / 180);
    const dx = Math.sin(travelAngleRad);
    const dy = -Math.cos(travelAngleRad);
    const speedMultiplier = Math.max(windSpeedKmh / 9, 1.2);

    const numArrows = 36;
    const arrows = Array.from({ length: numArrows }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      speed: (1.2 + Math.random() * 1.8) * speedMultiplier,
      length: 18 + Math.random() * 12,
      life: Math.random(),
    }));

    let windAnimId = 0;
    const renderWind = () => {
      windAnimId = requestAnimationFrame(renderWind);
      ctx.clearRect(0, 0, windCanvas.width, windCanvas.height);

      arrows.forEach((a) => {
        a.x += dx * a.speed;
        a.y += dy * a.speed;
        a.life += 0.007;

        if (a.x < -40 || a.x > windCanvas.width + 40 || a.y < -40 || a.y > windCanvas.height + 40 || a.life > 1.0) {
          a.x = Math.random() * windCanvas.width - dx * 80;
          a.y = Math.random() * windCanvas.height - dy * 80;
          a.life = 0.0;
        }

        const alpha = Math.sin(a.life * Math.PI) * 0.75;
        ctx.save();
        ctx.translate(a.x, a.y);
        ctx.rotate(travelAngleRad - Math.PI / 2);

        // Luminous cyan aerodynamic wind arrow
        ctx.strokeStyle = `rgba(56, 189, 248, ${alpha})`;
        ctx.lineWidth = 1.8;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-a.length / 2, 0);
        ctx.lineTo(a.length / 2, 0);
        ctx.lineTo(a.length / 2 - 6, -4.5);
        ctx.moveTo(a.length / 2, 0);
        ctx.lineTo(a.length / 2 - 6, 4.5);
        ctx.stroke();

        ctx.restore();
      });
    };
    renderWind();

    const handleWindResize = () => {
      if (!windCanvas || !containerRef.current) return;
      windCanvas.width = isFullScreen ? window.innerWidth : containerRef.current.clientWidth;
      windCanvas.height = isFullScreen ? window.innerHeight : containerRef.current.clientHeight;
    };
    window.addEventListener('resize', handleWindResize);

    return () => {
      cancelAnimationFrame(windAnimId);
      window.removeEventListener('resize', handleWindResize);
    };
  }, [windDirectionDeg, windSpeedKmh, isFullScreen]);

  // Update camera targets & uniforms when viewMode, winds, or hourOffset changes
  useEffect(() => {
    if (!threeRef.current) return;

    if (viewMode === 'top') {
      threeRef.current.targetCamPos.set(0, 7.8, 0.001);
      threeRef.current.targetLookAt.set(0, 0, 0);
      syncMapCoordinates();
    } else {
      threeRef.current.targetCamPos.set(0, 3.2, 5.4);
      threeRef.current.targetLookAt.set(0, 0.4, 0);
    }

    const rad = (windDirectionDeg * Math.PI) / 180;
    threeRef.current.material.uniforms.u_wind.value.set(Math.sin(rad), -Math.cos(rad));
    threeRef.current.material.uniforms.u_wind_speed.value = windSpeedKmh / 20;

    const dynamicIntensities = new Float32Array(16);
    hotspots.slice(0, 16).forEach((h, i) => {
      const diurnalFactor = 1.0 + 0.35 * Math.sin(((hourOffset + 6) / 24) * Math.PI * 2);
      dynamicIntensities[i] = h.pm25 * diurnalFactor;
    });
    threeRef.current.material.uniforms.u_hotspot_intensities.value = dynamicIntensities;
  }, [viewMode, windDirectionDeg, windSpeedKmh, hourOffset, hotspots, syncMapCoordinates]);

  return (
    <div
      ref={containerRef}
      style={
        isFullScreen
          ? {
              position: 'fixed',
              inset: 0,
              width: '100vw',
              height: '100vh',
              background: '#090D16',
              overflow: 'hidden',
              zIndex: 0,
            }
          : {
              position: 'relative',
              width: '100%',
              height: '560px',
              background: '#090D16',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-glass)',
              overflow: 'hidden',
              boxShadow: 'var(--shadow-glass)',
            }
      }
    >
      {/* Layer 1: Real MapLibre GL Vector Basemap (True Geography of Delhi NCR) */}
      <div
        ref={mapContainerRef}
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 1,
          opacity: viewMode === 'top' ? 1.0 : 0.0,
          transition: 'opacity 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
          pointerEvents: viewMode === 'top' ? 'auto' : 'none',
        }}
      />

      {/* Layer 2: Three.js Atmospheric Dispersion Physics Canvas (Transparent Fluid Overlay) */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 2,
          width: '100%',
          height: '100%',
          display: 'block',
          pointerEvents: viewMode === 'horizontal' ? 'auto' : 'none',
        }}
      />

      {/* Layer 3: Moving Wind Direction Arrows Overlay Canvas */}
      <canvas
        ref={windCanvasRef}
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 3,
          width: '100%',
          height: '100%',
          display: 'block',
          pointerEvents: 'none',
        }}
      />

      {/* Floating Dark Glass Control Bar (Top Left) */}
      <div
        style={{
          position: 'absolute',
          top: isFullScreen ? '84px' : '16px',
          left: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'rgba(15, 23, 42, 0.90)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '12px',
          padding: '5px 8px',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.45)',
          zIndex: 25,
        }}
      >
        <button
          onClick={() => onToggleViewMode && onToggleViewMode('top')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            fontSize: '12px',
            fontWeight: 600,
            borderRadius: '8px',
            background: viewMode === 'top' ? 'var(--accent-indigo)' : 'transparent',
            color: viewMode === 'top' ? '#FFFFFF' : 'var(--text-secondary)',
          }}
        >
          <LayersIcon size={14} />
          <span>{lang === 'hi' ? 'शीर्ष दृश्य (मानचित्र व बादल)' : 'Top View (Map & Clouds)'}</span>
        </button>

        <button
          onClick={() => onToggleViewMode && onToggleViewMode('horizontal')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            fontSize: '12px',
            fontWeight: 600,
            borderRadius: '8px',
            background: viewMode === 'horizontal' ? 'var(--accent-indigo)' : 'transparent',
            color: viewMode === 'horizontal' ? '#FFFFFF' : 'var(--text-secondary)',
          }}
        >
          <CompassIcon size={14} />
          <span>{lang === 'hi' ? '3D क्षैतिज चोटियाँ' : '3D Horizontal Peaks'}</span>
        </button>

        <div style={{ width: '1px', height: '16px', background: 'rgba(255, 255, 255, 0.12)', margin: '0 2px' }} />

        {/* Styles Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
          {(['dark', 'positron', 'liberty', 'bright', 'fiord'] as OpenFreeMapStyle[]).map((styleKey) => (
            <button
              key={styleKey}
              onClick={() => setCurrentStyle(styleKey)}
              title={`${OPENFREEMAP_STYLES[styleKey].name} Style`}
              style={{
                padding: '4px 8px',
                fontSize: '11px',
                fontWeight: currentStyle === styleKey ? 700 : 500,
                borderRadius: '6px',
                background: currentStyle === styleKey ? 'rgba(99, 102, 241, 0.25)' : 'transparent',
                border: currentStyle === styleKey ? '1px solid var(--accent-indigo)' : '1px solid transparent',
                color: currentStyle === styleKey ? '#818CF8' : 'var(--text-muted)',
                cursor: 'pointer',
                textTransform: 'capitalize',
                transition: 'all 0.15s ease',
              }}
            >
              {styleKey}
            </button>
          ))}
        </div>
      </div>

      {/* Atmospheric Wind HUD (Dynamically moves when side menu toggles) */}
      <div
        style={{
          position: 'absolute',
          top: isFullScreen ? '84px' : '16px',
          right: isFullScreen ? (isSideMenuOpen ? '476px' : '20px') : '16px',
          transition: 'right 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          background: 'rgba(15, 23, 42, 0.90)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '12px',
          padding: '6px 14px',
          fontSize: '12px',
          color: '#F8FAFC',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.45)',
          zIndex: 25,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent-cyan)' }}>
          <WindIcon size={14} color="var(--accent-cyan)" />
          <span style={{ fontWeight: 700 }}>{windSpeedKmh} km/h</span>
          <span style={{ color: 'var(--text-muted)' }}>({windDirectionDeg}°) NW → SE</span>
        </div>

        <div style={{ width: '1px', height: '14px', background: 'rgba(255, 255, 255, 0.12)' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: '#06B6D4',
              boxShadow: '0 0 8px #06B6D4',
            }}
          />
          <span style={{ fontSize: '11px', fontWeight: 600, color: '#94A3B8' }}>
            {lang === 'hi' ? 'वायुमंडलीय प्रकीर्णन भौतिकी' : 'Dispersion Physics Active'}
          </span>
        </div>
      </div>

      {/* Real Ground Monitoring Station Markers */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 20,
        }}
      >
        {pinScreenCoords.map(({ id, sx, sy, data }) => {
          if (sx < 20 || sx > (containerRef.current?.clientWidth || 800) - 20 || sy < 20 || sy > (containerRef.current?.clientHeight || 560) - 20) {
            return null;
          }

          const isSelected = activePin?.id === id;

          // Official CPCB category colors
          let badgeBg = '#10B981';
          if (data.pm25 > 250) badgeBg = '#B91C1C';
          else if (data.pm25 > 120) badgeBg = '#EF4444';
          else if (data.pm25 > 90) badgeBg = '#F97316';
          else if (data.pm25 > 60) badgeBg = '#FBBF24';
          else if (data.pm25 > 30) badgeBg = '#34D399';

          return (
            <div
              key={id}
              onClick={(e) => {
                e.stopPropagation();
                setActivePin(data);
              }}
              style={{
                position: 'absolute',
                left: `${sx}px`,
                top: `${sy}px`,
                transform: 'translate(-50%, -100%)',
                pointerEvents: 'auto',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                transition: 'transform 0.15s ease',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  background: 'rgba(15, 23, 42, 0.94)',
                  backdropFilter: 'blur(8px)',
                  border: isSelected ? '2px solid var(--accent-indigo)' : '1px solid rgba(255, 255, 255, 0.14)',
                  borderRadius: '20px',
                  padding: '3px 8px',
                  boxShadow: '0 4px 14px rgba(0, 0, 0, 0.5)',
                  whiteSpace: 'nowrap',
                }}
              >
                <span
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: badgeBg,
                    boxShadow: `0 0 6px ${badgeBg}`,
                  }}
                />
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#F8FAFC' }}>
                  {lang === 'hi' ? data.name_hi : data.name_en}
                </span>
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    padding: '1px 5px',
                    borderRadius: '4px',
                    background: badgeBg,
                    color: '#FFFFFF',
                  }}
                >
                  {Math.round(data.pm25)}
                </span>
              </div>

              {/* Pin Pointer Stem */}
              <div
                style={{
                  width: '2px',
                  height: '8px',
                  background: 'rgba(255, 255, 255, 0.4)',
                }}
              />
            </div>
          );
        })}
      </div>

      {/* Selected Station Card Overlay (Positioned safely above Clean Window card) */}
      {activePin && (
        <div
          style={{
            position: 'absolute',
            bottom: '180px',
            left: '24px',
            background: 'rgba(15, 23, 42, 0.95)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: '1px solid rgba(255, 255, 255, 0.14)',
            borderRadius: '16px',
            padding: '16px 20px',
            width: '320px',
            boxShadow: '0 20px 48px rgba(0, 0, 0, 0.65)',
            zIndex: 40,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#FFFFFF' }}>
              {lang === 'hi' ? activePin.name_hi : activePin.name_en}
            </h3>
            <button
              onClick={() => setActivePin(null)}
              style={{
                color: 'var(--text-muted)',
                padding: '4px',
                cursor: 'pointer',
              }}
            >
              ✕
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '8px' }}>
            <span style={{ fontSize: '28px', fontWeight: 800, color: '#FFFFFF' }}>
              {Math.round(activePin.pm25)}
            </span>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>µg/m³ PM2.5</span>
            <span
              style={{
                marginLeft: 'auto',
                fontSize: '11px',
                fontWeight: 700,
                padding: '3px 8px',
                borderRadius: '6px',
                background:
                  activePin.pm25 > 250
                    ? '#B91C1C'
                    : activePin.pm25 > 120
                    ? '#EF4444'
                    : activePin.pm25 > 90
                    ? '#F97316'
                    : '#FBBF24',
                color: '#FFFFFF',
              }}
            >
              {activePin.category}
            </span>
          </div>

          {onSelectLocality && (
            <button
              onClick={() => {
                onSelectLocality(activePin.id);
                setActivePin(null);
              }}
              style={{
                width: '100%',
                marginTop: '6px',
                padding: '8px 12px',
                fontSize: '12px',
                fontWeight: 600,
                background: 'var(--accent-indigo)',
                color: '#FFFFFF',
                borderRadius: '8px',
                boxShadow: '0 2px 10px rgba(99, 102, 241, 0.4)',
              }}
            >
              {lang === 'hi' ? 'स्थान विवरण देखें →' : 'Select Locality & View Timetable →'}
            </button>
          )}
        </div>
      )}

      {/* Attribution Badge (Bottom Right, dynamically moves when side menu toggles) */}
      <div
        style={{
          position: 'absolute',
          bottom: '12px',
          right: isFullScreen ? (isSideMenuOpen ? '476px' : '20px') : '16px',
          transition: 'right 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'rgba(15, 23, 42, 0.88)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '8px',
          padding: '4px 10px',
          fontSize: '11px',
          color: 'var(--text-muted)',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.35)',
          zIndex: 25,
        }}
      >
        <OpenFreeMapLogo size={14} />
        <span>
          <strong style={{ color: '#F8FAFC' }}>OpenFreeMap</strong>
          {' © '}
          <a
            href="https://www.openmaptiles.org/"
            target="_blank"
            rel="noreferrer"
            style={{ color: 'var(--accent-cyan)', textDecoration: 'none' }}
          >
            OpenMapTiles
          </a>
          {' · '}
          <a
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noreferrer"
            style={{ color: 'var(--accent-cyan)', textDecoration: 'none' }}
          >
            OpenStreetMap
          </a>
        </span>

        {onOpenInfoModal && (
          <button
            onClick={onOpenInfoModal}
            title="What is OpenFreeMap?"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 6px',
              borderRadius: '4px',
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: 'var(--text-secondary)',
              fontSize: '10.5px',
              fontWeight: 600,
              cursor: 'pointer',
              marginLeft: '4px',
            }}
          >
            <InfoIcon size={11} color="var(--accent-cyan)" />
            <span>Info</span>
          </button>
        )}
      </div>
    </div>
  );
};
