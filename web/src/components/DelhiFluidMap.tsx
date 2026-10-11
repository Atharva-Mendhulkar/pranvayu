import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Language } from '../lib/i18n';
import { WindIcon, CompassIcon, LayersIcon, MapIcon, OpenFreeMapLogo, InfoIcon } from './Icons';

export type OpenFreeMapStyle = 'positron' | 'bright' | 'liberty' | 'dark' | 'fiord';

export const OPENFREEMAP_STYLES: Record<OpenFreeMapStyle, { name: string; url: string }> = {
  positron: { name: 'Positron', url: 'https://tiles.openfreemap.org/styles/positron' },
  bright: { name: 'Bright', url: 'https://tiles.openfreemap.org/styles/bright' },
  liberty: { name: 'Liberty', url: 'https://tiles.openfreemap.org/styles/liberty' },
  dark: { name: 'Dark', url: 'https://tiles.openfreemap.org/styles/dark' },
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
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<maplibregl.Map | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const windCanvasRef = useRef<HTMLCanvasElement>(null);

  const [currentStyle, setCurrentStyle] = useState<OpenFreeMapStyle>('positron');
  const [activePin, setActivePin] = useState<HotspotData | null>(null);
  const [pinScreenCoords, setPinScreenCoords] = useState<Array<{ id: string; sx: number; sy: number; data: HotspotData }>>([]);
  const [mapTilesLoaded, setMapTilesLoaded] = useState<boolean>(false);

  // Initialize and synchronize OpenFreeMap via MapLibre GL JS
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

    map.on('load', () => {
      setMapTilesLoaded(true);
    });

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [currentStyle]);

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

  // Load basemap texture for 3D terrain peaks mesh (Carto / OSM)
  const createDelhiBasemapTexture = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    if (!ctx) return new THREE.Texture();

    // Responsive light grey-white canvas background & grid
    ctx.fillStyle = '#F1F5F9';
    ctx.fillRect(0, 0, 1024, 1024);

    // Subtle coordinate grid
    ctx.strokeStyle = 'rgba(203, 213, 225, 0.4)';
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

    // Async fetch OSM raster tiles for 3D mesh texture
    const tilePromises: Promise<{ img: HTMLImageElement; x: number; y: number }>[] = [];
    for (let tx = 0; tx < TILES_PER_AXIS; tx++) {
      for (let ty = 0; ty < TILES_PER_AXIS; ty++) {
        const tileX = X_MIN + tx;
        const tileY = Y_MIN + ty;
        const tileUrl = `https://a.basemaps.cartocdn.com/light_all/${TILE_ZOOM}/${tileX}/${tileY}.png`;

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

  // Three.js Scene Setup & Animation Loop
  useEffect(() => {
    if (!containerRef.current || !canvasRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = isFullScreen ? window.innerHeight : Math.max(containerRef.current.clientHeight, 560);

    // 1. Scene & Camera
    const scene = new THREE.Scene();
    scene.background = null; // transparent canvas so OpenFreeMap shows through

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

    // 4. Custom GLSL Shader Material
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
      u_wind: { value: new THREE.Vector2(-0.7, 0.5) },
      u_wind_speed: { value: 0.5 },
      u_num_hotspots: { value: Math.min(hotspots.length, 16) },
      u_hotspot_positions: { value: hotspotPositions },
      u_hotspot_intensities: { value: hotspotIntensities },
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
      varying float vSmokeDensity;

      void main() {
        vUv = uv;
        vec3 pos = position;

        float totalWeight = 0.0;
        float weightedPM = 0.0;
        float elevationAccum = 0.0;

        for (int i = 0; i < 16; i++) {
          if (i >= u_num_hotspots) break;
          vec2 hPos = u_hotspot_positions[i];
          float hVal = u_hotspot_intensities[i];

          float dist = length(pos.xz - hPos);
          float rad = 0.95;
          float w = max(0.0, 1.0 - (dist / rad));
          w = w * w * (3.0 - 2.0 * w);

          totalWeight += w;
          weightedPM += hVal * w;

          float bell = exp(- (dist * dist) / 0.18);
          elevationAccum += bell * (hVal / 320.0);
        }

        vSmokeDensity = totalWeight > 0.0 ? clamp((weightedPM / totalWeight) / 300.0, 0.0, 1.5) : 0.0;

        // IN TOP VIEW (u_view_mode == 0.0): Elevation is zero (strictly flat)
        // IN HORIZONTAL VIEW (u_view_mode == 1.0): 3D peaks extrude along Y axis
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
      uniform float u_hotspot_intensities[16];

      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vPosition;
      varying float vElevation;
      varying float vSmokeDensity;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i + vec2(0.0,0.0)), hash(i + vec2(1.0,0.0)), u.x),
                   mix(hash(i + vec2(0.0,1.0)), hash(i + vec2(1.0,1.0)), u.x), u.y);
      }

      float fbm(vec2 p) {
        float val = 0.0;
        float amp = 0.5;
        for (int i = 0; i < 3; i++) {
          val += amp * noise(p);
          p *= 2.1;
          amp *= 0.5;
        }
        return val;
      }

      // Official CPCB air quality color mapping for PM2.5 pollution clouds
      vec3 getCPCBColor(float normVal) {
        vec3 colGood   = vec3(0.02, 0.59, 0.41); // 0-30 Good (Emerald #059669)
        vec3 colSat    = vec3(0.06, 0.72, 0.51); // 31-60 Satisfactory (#10B981)
        vec3 colMod    = vec3(0.85, 0.47, 0.02); // 61-90 Moderate (#D97706 Amber)
        vec3 colPoor   = vec3(0.92, 0.35, 0.05); // 91-120 Poor (#EA580C Orange)
        vec3 colVPoor  = vec3(0.86, 0.15, 0.15); // 121-250 Very Poor (#DC2626 Crimson)
        vec3 colSevere = vec3(0.60, 0.11, 0.11); // >250 Severe (#991B1B Maroon)

        if (normVal < 0.15) return mix(colGood, colSat, normVal / 0.15);
        if (normVal < 0.35) return mix(colSat, colMod, (normVal - 0.15) / 0.20);
        if (normVal < 0.55) return mix(colMod, colPoor, (normVal - 0.35) / 0.20);
        if (normVal < 0.75) return mix(colPoor, colVPoor, (normVal - 0.55) / 0.20);
        return mix(colVPoor, colSevere, clamp((normVal - 0.75) / 0.25, 0.0, 1.0));
      }

      void main() {
        vec4 baseMapColor = texture2D(u_basemap, vUv);

        // Fluid advection storm clouds flowing with wind vector
        vec2 advectCoord = vPosition.xz - u_wind * u_time * (0.24 + u_wind_speed * 0.14);
        float cloudTurb1 = fbm(advectCoord * 2.2);
        float cloudTurb2 = fbm(advectCoord * 5.0 + u_time * 0.06);

        // Composite atmospheric pollution cloud field
        float cloudField = vSmokeDensity * (0.64 + 0.58 * cloudTurb1 + 0.24 * cloudTurb2);
        float cloudAlpha = smoothstep(0.08, 0.64, cloudField);
        vec3 cloudColor = getCPCBColor(clamp(cloudField * 1.15, 0.0, 1.0));

        // Dynamic wind streamlines gliding across Delhi terrain
        vec2 windDir = normalize(u_wind);
        vec2 windPerp = vec2(-windDir.y, windDir.x);
        float streamBand = sin(dot(vPosition.xz, windPerp) * 14.0);
        float streamFlow = sin(dot(vPosition.xz, windDir) * 4.5 - u_time * (1.8 + u_wind_speed * 1.2));
        float windStreak = smoothstep(0.72, 0.98, streamBand * streamFlow);
        vec3 windStreamColor = vec3(0.02, 0.52, 0.78); // Atmospheric cyan streamline

        // 3D Hillshading & Contour lines in 3D horizontal view
        if (u_view_mode > 0.1) {
          vec3 lightDir = normalize(vec3(0.3, 1.2, 0.7));
          float diff = max(dot(vNormal, lightDir), 0.35);
          cloudColor *= (0.75 + 0.35 * diff);

          float contour = fract(vElevation * 7.5);
          if (contour < 0.08 && vElevation > 0.08) {
            cloudColor = mix(cloudColor, vec3(1.0, 1.0, 1.0), 0.45 * u_view_mode);
          }
        }

        // Declare final cloud alpha
        float finalCloudAlpha = clamp(cloudAlpha * 0.72, 0.0, 0.85);

        // Top View vs 3D Horizontal View compositing
        if (u_view_mode <= 0.05) {
          vec3 topColor = mix(cloudColor, windStreamColor, windStreak * 0.45);
          float topAlpha = clamp(finalCloudAlpha * 0.82 + windStreak * 0.40, 0.0, 0.90);
          gl_FragColor = vec4(topColor, topAlpha);
        } else {
          vec3 composited = mix(baseMapColor.rgb, cloudColor, finalCloudAlpha);
          composited = mix(composited, windStreamColor, windStreak * 0.32);
          gl_FragColor = vec4(composited, 1.0);
        }
      }
    `;

    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms,
      wireframe: false,
      side: THREE.DoubleSide,
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

      // Project 3D station pins to 2D screen coordinates
      const coords = hotspots.map((h) => {
        const [px, pz] = geoToPlane(h.lat, h.lon);
        let py = 0.0;
        if (viewMode === 'horizontal') {
          py = (h.pm25 / 320.0) * 1.65;
        }

        const v = new THREE.Vector3(px, py, pz);
        v.project(camera);

        const currentW = isFullScreen ? window.innerWidth : (containerRef.current?.clientWidth || 800);
        const currentH = isFullScreen ? window.innerHeight : (containerRef.current?.clientHeight || 560);
        const sx = ((v.x + 1) * currentW) / 2;
        const sy = ((-v.y + 1) * currentH) / 2;

        return { id: h.id, sx, sy, data: h };
      });

      setPinScreenCoords(coords);
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
  }, [isFullScreen]);

  // Moving Wind Direction Arrows Loop
  useEffect(() => {
    const windCanvas = windCanvasRef.current;
    if (!windCanvas || !containerRef.current) return;
    const ctx = windCanvas.getContext('2d');
    if (!ctx) return;

    const w = isFullScreen ? window.innerWidth : containerRef.current.clientWidth;
    const h = isFullScreen ? window.innerHeight : containerRef.current.clientHeight;
    windCanvas.width = w;
    windCanvas.height = h;

    // Wind blowing FROM windDirectionDeg travels TOWARDS (windDirectionDeg + 180)
    const travelAngleRad = ((windDirectionDeg + 180) % 360) * (Math.PI / 180);
    const dx = Math.sin(travelAngleRad);
    const dy = -Math.cos(travelAngleRad);
    const speedMultiplier = Math.max(windSpeedKmh / 9, 1.2);

    const numArrows = 36;
    const arrows = Array.from({ length: numArrows }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      speed: (1.2 + Math.random() * 1.8) * speedMultiplier,
      length: 16 + Math.random() * 12,
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

        const alpha = Math.sin(a.life * Math.PI) * 0.72;
        ctx.save();
        ctx.translate(a.x, a.y);
        ctx.rotate(travelAngleRad - Math.PI / 2);

        ctx.strokeStyle = `rgba(2, 132, 199, ${alpha})`;
        ctx.lineWidth = 1.8;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-a.length / 2, 0);
        ctx.lineTo(a.length / 2, 0);
        ctx.lineTo(a.length / 2 - 5, -4);
        ctx.moveTo(a.length / 2, 0);
        ctx.lineTo(a.length / 2 - 5, 4);
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
  }, [viewMode, windDirectionDeg, windSpeedKmh, hourOffset, hotspots]);

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
              background: '#F1F5F9',
              overflow: 'hidden',
              zIndex: 0,
            }
          : {
              position: 'relative',
              width: '100%',
              height: '560px',
              background: '#F1F5F9',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-glass)',
              overflow: 'hidden',
              boxShadow: 'var(--shadow-glass)',
            }
      }
    >
      {/* Layer 1: OpenFreeMap Vector Basemap (MapLibre GL JS) */}
      <div
        ref={mapContainerRef}
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 1,
          opacity: viewMode === 'top' ? 1.0 : 0.15,
          transition: 'opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
          pointerEvents: viewMode === 'top' ? 'auto' : 'none',
        }}
      />

      {/* Layer 2: Three.js Atmospheric Fluid & 3D Peaks Overlay Canvas */}
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

      {/* Floating Glass Control Bar (Top Left / below header) */}
      <div
        style={{
          position: 'absolute',
          top: isFullScreen ? '84px' : '16px',
          left: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'rgba(255, 255, 255, 0.90)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid #CBD5E1',
          borderRadius: '12px',
          padding: '5px 8px',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.08)',
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
            background: viewMode === 'top' ? '#2563EB' : 'transparent',
            color: viewMode === 'top' ? '#FFFFFF' : '#475569',
          }}
        >
          <LayersIcon size={14} />
          <span>{lang === 'hi' ? 'शीर्ष दृश्य (मानचित्र और बादल)' : 'Top View (Map & Clouds)'}</span>
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
            background: viewMode === 'horizontal' ? '#2563EB' : 'transparent',
            color: viewMode === 'horizontal' ? '#FFFFFF' : '#475569',
          }}
        >
          <CompassIcon size={14} />
          <span>{lang === 'hi' ? '3D क्षैतिज चोटियाँ' : '3D Horizontal Peaks'}</span>
        </button>

        <div style={{ width: '1px', height: '16px', background: '#CBD5E1', margin: '0 2px' }} />

        {/* OpenFreeMap Styles Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
          {(['positron', 'bright', 'liberty', 'dark', 'fiord'] as OpenFreeMapStyle[]).map((styleKey) => (
            <button
              key={styleKey}
              onClick={() => setCurrentStyle(styleKey)}
              title={`OpenFreeMap ${OPENFREEMAP_STYLES[styleKey].name} Style`}
              style={{
                padding: '4px 8px',
                fontSize: '11px',
                fontWeight: currentStyle === styleKey ? 700 : 500,
                borderRadius: '6px',
                background: currentStyle === styleKey ? '#0284C7' : 'transparent',
                color: currentStyle === styleKey ? '#FFFFFF' : '#64748B',
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

      {/* Wind & Atmospheric HUD (Top Right / below header) */}
      <div
        style={{
          position: 'absolute',
          top: isFullScreen ? '84px' : '16px',
          right: isFullScreen ? '16px' : '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          background: 'rgba(255, 255, 255, 0.90)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid #CBD5E1',
          borderRadius: '12px',
          padding: '6px 14px',
          fontSize: '12px',
          color: '#334155',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.08)',
          zIndex: 25,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#0284C7' }}>
          <WindIcon size={14} color="#0284C7" />
          <span style={{ fontWeight: 700 }}>{windSpeedKmh} km/h</span>
          <span style={{ color: '#64748B' }}>({windDirectionDeg}°) NW → SE</span>
        </div>

        <div style={{ width: '1px', height: '14px', background: '#CBD5E1' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: '#0284C7',
              boxShadow: '0 0 6px rgba(2, 132, 199, 0.6)',
            }}
          />
          <span style={{ fontSize: '11px', fontWeight: 600, color: '#334155' }}>
            {lang === 'hi' ? 'हवा की धाराएँ सक्रिय' : 'Wind Arrows Active'}
          </span>
        </div>
      </div>

      {/* Collision-free Station Markers */}
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

          const isHotspot = data.pm25 > 250;
          const isSelected = activePin?.id === id;

          // Official CPCB category colors
          let badgeBg = '#059669';
          if (data.pm25 > 250) badgeBg = '#991B1B';
          else if (data.pm25 > 120) badgeBg = '#DC2626';
          else if (data.pm25 > 90) badgeBg = '#EA580C';
          else if (data.pm25 > 60) badgeBg = '#D97706';
          else if (data.pm25 > 30) badgeBg = '#10B981';

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
                  background: 'rgba(255, 255, 255, 0.95)',
                  backdropFilter: 'blur(8px)',
                  border: isSelected ? '2px solid #2563EB' : '1px solid #CBD5E1',
                  borderRadius: '20px',
                  padding: '3px 8px',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.12)',
                  whiteSpace: 'nowrap',
                }}
              >
                <span
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: badgeBg,
                  }}
                />
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#0F172A' }}>
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
                  background: '#64748B',
                }}
              />
            </div>
          );
        })}
      </div>

      {/* Selected Station Card Overlay */}
      {activePin && (
        <div
          style={{
            position: 'absolute',
            bottom: '56px',
            left: '16px',
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid #CBD5E1',
            borderRadius: '16px',
            padding: '16px 20px',
            width: '290px',
            boxShadow: '0 16px 36px rgba(0, 0, 0, 0.12)',
            zIndex: 30,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A' }}>
              {lang === 'hi' ? activePin.name_hi : activePin.name_en}
            </h3>
            <button
              onClick={() => setActivePin(null)}
              style={{
                color: '#64748B',
                padding: '4px',
                cursor: 'pointer',
              }}
            >
              ✕
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '8px' }}>
            <span style={{ fontSize: '28px', fontWeight: 800, color: '#0F172A' }}>
              {Math.round(activePin.pm25)}
            </span>
            <span style={{ fontSize: '12px', color: '#64748B' }}>µg/m³ PM2.5</span>
            <span
              style={{
                marginLeft: 'auto',
                fontSize: '11px',
                fontWeight: 700,
                padding: '3px 8px',
                borderRadius: '6px',
                background:
                  activePin.pm25 > 250
                    ? '#991B1B'
                    : activePin.pm25 > 120
                    ? '#DC2626'
                    : activePin.pm25 > 90
                    ? '#EA580C'
                    : '#D97706',
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
                background: '#2563EB',
                color: '#FFFFFF',
                borderRadius: '8px',
                boxShadow: '0 2px 8px rgba(37, 99, 235, 0.3)',
              }}
            >
              {lang === 'hi' ? 'स्थान विवरण देखें →' : 'Select Locality & View Timetable →'}
            </button>
          )}
        </div>
      )}

      {/* OpenFreeMap Official Attribution Badge (Bottom Right) */}
      <div
        style={{
          position: 'absolute',
          bottom: '12px',
          right: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'rgba(255, 255, 255, 0.92)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid #CBD5E1',
          borderRadius: '8px',
          padding: '5px 12px',
          fontSize: '11.5px',
          color: '#475569',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
          zIndex: 25,
        }}
      >
        <OpenFreeMapLogo size={16} />
        <span>
          <strong style={{ color: '#0F172A' }}>OpenFreeMap</strong>
          {' © '}
          <a
            href="https://www.openmaptiles.org/"
            target="_blank"
            rel="noreferrer"
            style={{ color: '#2563EB', textDecoration: 'none' }}
          >
            OpenMapTiles
          </a>
          {' · '}
          <a
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noreferrer"
            style={{ color: '#2563EB', textDecoration: 'none' }}
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
              padding: '2px 8px',
              borderRadius: '6px',
              background: '#F1F5F9',
              border: '1px solid #CBD5E1',
              color: '#0F172A',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              marginLeft: '4px',
            }}
          >
            <InfoIcon size={12} color="#2563EB" />
            <span>Info</span>
          </button>
        )}
      </div>
    </div>
  );
};
