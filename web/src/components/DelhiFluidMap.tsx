import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Language } from '../lib/i18n';
import { WindIcon, CompassIcon, LayersIcon, EyeIcon } from './Icons';

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
}

// Convert geographic coordinates to normalized 3D plane coords [-3, 3]
const CENTER_LAT = 28.625;
const CENTER_LON = 77.175;
const COORD_SPAN = 0.45; // ~50km span
const PLANE_SIZE = 6.2;

function geoToPlane(lat: number, lon: number): [number, number] {
  const x = ((lon - CENTER_LON) / COORD_SPAN) * PLANE_SIZE;
  const z = -((lat - CENTER_LAT) / COORD_SPAN) * PLANE_SIZE;
  return [x, z];
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
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [activePin, setActivePin] = useState<HotspotData | null>(null);
  const [pinScreenCoords, setPinScreenCoords] = useState<Array<{ id: string; sx: number; sy: number; data: HotspotData }>>([]);
  const [showWindArrows, setShowWindArrows] = useState<boolean>(true);

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

  // Generate sleek dark basemap canvas texture (Delhi border, Yamuna river, Ring road)
  const createDelhiBasemapTexture = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    if (!ctx) return new THREE.Texture();

    // Dark sleek slate background
    ctx.fillStyle = '#0B1120';
    ctx.fillRect(0, 0, 1024, 1024);

    // Subtle dark grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 1024; i += 64) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 1024);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(1024, i);
      ctx.stroke();
    }

    const p2c = (px: number, pz: number): [number, number] => {
      const cx = ((px + PLANE_SIZE / 2) / PLANE_SIZE) * 1024;
      const cy = ((pz + PLANE_SIZE / 2) / PLANE_SIZE) * 1024;
      return [cx, cy];
    };

    // Delhi NCT boundary polygon
    const borderPointsGeo = [
      [28.84, 77.08], [28.82, 77.16], [28.78, 77.24], [28.72, 77.29],
      [28.66, 77.34], [28.58, 77.34], [28.50, 77.32], [28.43, 77.24],
      [28.42, 77.12], [28.46, 76.99], [28.55, 76.92], [28.67, 76.92],
      [28.78, 76.99], [28.84, 77.08]
    ];
    ctx.beginPath();
    borderPointsGeo.forEach(([lat, lon], idx) => {
      const [px, pz] = geoToPlane(lat, lon);
      const [cx, cy] = p2c(px, pz);
      if (idx === 0) ctx.moveTo(cx, cy);
      else ctx.lineTo(cx, cy);
    });
    ctx.closePath();
    ctx.fillStyle = 'rgba(30, 41, 59, 0.35)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([8, 6]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Yamuna River curve with subtle cyan glow
    const yamunaGeo = [
      [28.86, 77.22], [28.76, 77.23], [28.70, 77.22], [28.64, 77.25],
      [28.60, 77.27], [28.54, 77.31], [28.45, 77.34]
    ];
    ctx.beginPath();
    yamunaGeo.forEach(([lat, lon], idx) => {
      const [px, pz] = geoToPlane(lat, lon);
      const [cx, cy] = p2c(px, pz);
      if (idx === 0) ctx.moveTo(cx, cy);
      else ctx.lineTo(cx, cy);
    });
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Inner & Outer Ring Roads
    const [cpx, cpz] = geoToPlane(28.63, 77.21);
    const [ccx, ccy] = p2c(cpx, cpz);
    
    // Outer Ring Road
    ctx.beginPath();
    ctx.ellipse(ccx, ccy, 180, 160, -0.1, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Inner Ring Road
    ctx.beginPath();
    ctx.ellipse(ccx, ccy, 110, 95, -0.1, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Subtle sleek labels
    ctx.font = '600 12px sans-serif';
    ctx.fillStyle = 'rgba(148, 163, 184, 0.6)';
    ctx.fillText('Yamuna River', ccx + 40, ccy - 30);
    ctx.fillText('National Capital Territory (Delhi)', ccx - 220, ccy - 180);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    return texture;
  };

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = Math.max(containerRef.current.clientHeight, 520);

    // 1. Scene & Camera
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#090D16');

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    // When top view: position above at (0, 7.5, 0.8) so peaks are visible in 3D relief!
    const initialCamPos = viewMode === 'top' 
      ? new THREE.Vector3(0, 7.2, 0.8) 
      : new THREE.Vector3(0, 3.2, 5.4);
    const initialLookAt = new THREE.Vector3(0, 0.2, 0);
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
      u_view_mode: { value: viewMode === 'top' ? 0.65 : 1.0 }, // Both views show peaks!
      u_height_scale: { value: 1.35 },
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
          p *= 2.0;
          amp *= 0.5;
        }
        return val;
      }

      void main() {
        vUv = uv;
        vec3 pos = position;

        // Calculate pollution intensity accumulation from all hotspots
        float totalIntensity = 0.0;
        for (int i = 0; i < 16; i++) {
          if (i >= u_num_hotspots) break;
          vec2 hPos = u_hotspot_positions[i];
          float hVal = u_hotspot_intensities[i];
          float dist = distance(pos.xz, hPos);
          float radius = 0.72;
          float falloff = exp(- (dist * dist) / (2.0 * radius * radius));
          totalIntensity += (hVal / 320.0) * falloff;
        }

        // Animated wind advection turbulence
        vec2 noiseCoord = pos.xz * 2.2 - u_wind * u_time * 0.18;
        float turb = fbm(noiseCoord) * 0.28;

        // Height displacement: Top view shows elevated peaks, horizontal view shows full peaks
        float elevation = (totalIntensity + turb * totalIntensity) * u_height_scale * u_view_mode;
        pos.y = elevation;

        vElevation = elevation;
        vSmokeDensity = totalIntensity;
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

      // Modern glowing CPCB dark palette
      vec3 getCPCBColor(float normVal) {
        vec3 colGood = vec3(0.06, 0.72, 0.51);        // #10B981 (Emerald)
        vec3 colMod  = vec3(0.96, 0.75, 0.14);        // #FBBF24 (Amber)
        vec3 colPoor = vec3(0.97, 0.45, 0.08);        // #F97316 (Orange)
        vec3 colVPoor= vec3(0.93, 0.27, 0.27);        // #EF4444 (Crimson)
        vec3 colSev  = vec3(0.72, 0.11, 0.11);        // #B91C1C (Maroon)

        if (normVal < 0.2) return mix(colGood, colMod, normVal / 0.2);
        if (normVal < 0.45) return mix(colMod, colPoor, (normVal - 0.2) / 0.25);
        if (normVal < 0.75) return mix(colPoor, colVPoor, (normVal - 0.45) / 0.3);
        return mix(colVPoor, colSev, clamp((normVal - 0.75) / 0.25, 0.0, 1.0));
      }

      void main() {
        vec4 baseMapColor = texture2D(u_basemap, vUv);

        // Fluid advection storm clouds flowing with wind vector
        vec2 advectCoord = vPosition.xz - u_wind * u_time * (0.2 + u_wind_speed * 0.12);
        float cloudTurb = fbm(advectCoord * 2.2);
        float fineTurb  = fbm(advectCoord * 5.5 + u_time * 0.08);

        // Composite pollution cloud billows
        float cloudField = vSmokeDensity * (0.68 + 0.55 * cloudTurb + 0.22 * fineTurb);
        float cloudAlpha = smoothstep(0.06, 0.60, cloudField);

        vec3 smokeColor = getCPCBColor(clamp(cloudField * 1.15, 0.0, 1.0));

        // 3D Hillshading & Light Direction
        vec3 lightDir = normalize(vec3(0.3, 1.2, 0.7));
        float diff = max(dot(vNormal, lightDir), 0.35);
        smokeColor *= (0.75 + 0.35 * diff);

        // Luminous Topographic Contour lines (prominent in both Top & Horizontal views)
        float contour = fract(vElevation * 7.5);
        if (contour < 0.075 && vElevation > 0.1) {
          smokeColor = mix(smokeColor, vec3(1.0, 1.0, 1.0), 0.45);
        }

        // Sleek blending: dark basemap + glowing clouds & peaks
        float finalAlpha = clamp(cloudAlpha * 0.88, 0.0, 0.95);
        vec3 finalColor = mix(baseMapColor.rgb, smokeColor, finalAlpha);

        gl_FragColor = vec4(finalColor, 1.0);
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

      // Both views show peaks! Top view = 0.65 height relief, Horizontal = 1.0 full peaks
      const targetViewModeVal = viewMode === 'top' ? 0.65 : 1.0;
      material.uniforms.u_view_mode.value = THREE.MathUtils.lerp(
        material.uniforms.u_view_mode.value,
        targetViewModeVal,
        0.08
      );

      renderer.render(scene, camera);

      // Project 3D station pins to 2D screen coordinates
      const coords = hotspots.map((h) => {
        const [px, pz] = geoToPlane(h.lat, h.lon);
        const pinElevation = material.uniforms.u_view_mode.value * (h.pm25 / 320.0) * 1.35;
        const v3 = new THREE.Vector3(px, pinElevation + 0.16, pz);
        v3.project(camera);

        const sx = ((v3.x + 1) / 2) * width;
        const sy = ((-v3.y + 1) / 2) * height;
        return { id: h.id, sx, sy, data: h };
      });

      // Pin collision avoidance: stagger overlapping pins slightly
      for (let i = 0; i < coords.length; i++) {
        for (let j = i + 1; j < coords.length; j++) {
          const dist = Math.hypot(coords[i].sx - coords[j].sx, coords[i].sy - coords[j].sy);
          if (dist < 44) {
            coords[j].sy += 22;
          }
        }
      }
      setPinScreenCoords(coords);
    };

    animate();

    // Interactive pointer orbit controls
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    const canvasElem = canvasRef.current;

    const onPointerDown = (e: PointerEvent) => {
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      canvasElem.setPointerCapture(e.pointerId);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isDragging || !threeRef.current) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      startX = e.clientX;
      startY = e.clientY;

      const cam = threeRef.current.camera;
      const lookAt = threeRef.current.currentLookAt;
      const offset = cam.position.clone().sub(lookAt);
      const spherical = new THREE.Spherical().setFromVector3(offset);

      spherical.theta -= dx * 0.005;
      spherical.phi = Math.max(0.12, Math.min(Math.PI / 2 - 0.05, spherical.phi - dy * 0.005));
      threeRef.current.targetCamPos.setFromSpherical(spherical).add(lookAt);
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
      const w = containerRef.current.clientWidth;
      const h = Math.max(containerRef.current.clientHeight, 520);
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
  }, []);

  // Update camera targets & uniforms when viewMode, winds, or hourOffset changes
  useEffect(() => {
    if (!threeRef.current) return;

    if (viewMode === 'top') {
      // Top view camera: high angle showing both peaks and moving cloud field
      threeRef.current.targetCamPos.set(0, 7.2, 0.8);
      threeRef.current.targetLookAt.set(0, 0.2, 0);
    } else {
      // Horizontal perspective camera
      threeRef.current.targetCamPos.set(0, 3.2, 5.4);
      threeRef.current.targetLookAt.set(0, 0.4, 0);
    }

    const rad = (windDirectionDeg * Math.PI) / 180;
    const windVecX = -Math.sin(rad);
    const windVecZ = Math.cos(rad);

    threeRef.current.material.uniforms.u_wind.value.set(windVecX, windVecZ);
    threeRef.current.material.uniforms.u_wind_speed.value = Math.max(windSpeedKmh / 20.0, 0.2);

    const updatedIntensities = new Float32Array(16);
    hotspots.slice(0, 16).forEach((h, i) => {
      const diurnalFactor = 1.0 + 0.25 * Math.sin(((hourOffset % 24) / 24) * Math.PI * 2);
      updatedIntensities[i] = h.pm25 * diurnalFactor;
    });
    threeRef.current.material.uniforms.u_hotspot_intensities.value = updatedIntensities;
  }, [viewMode, windDirectionDeg, windSpeedKmh, hourOffset, hotspots]);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: '560px',
        background: '#090D16',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-glass)',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-glass)',
      }}
    >
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />

      {/* Floating Glass Control Bar (Top Left) */}
      <div
        style={{
          position: 'absolute',
          top: '16px',
          left: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid var(--border-glass)',
          borderRadius: 'var(--radius-md)',
          padding: '4px',
          zIndex: 15,
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
            borderRadius: 'var(--radius-sm)',
            background: viewMode === 'top' ? 'var(--accent-indigo)' : 'transparent',
            color: viewMode === 'top' ? '#FFFFFF' : 'var(--text-secondary)',
          }}
        >
          <LayersIcon size={14} />
          <span>{lang === 'hi' ? 'शीर्ष दृश्य (चोटियाँ और बादल)' : 'Top View (Peaks & Radar)'}</span>
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
            borderRadius: 'var(--radius-sm)',
            background: viewMode === 'horizontal' ? 'var(--accent-indigo)' : 'transparent',
            color: viewMode === 'horizontal' ? '#FFFFFF' : 'var(--text-secondary)',
          }}
        >
          <CompassIcon size={14} />
          <span>{lang === 'hi' ? '3D क्षैतिज चोटियाँ' : '3D Horizontal Peaks'}</span>
        </button>
      </div>

      {/* Wind & Atmospheric HUD (Top Right) */}
      <div
        style={{
          position: 'absolute',
          top: '16px',
          right: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid var(--border-glass)',
          borderRadius: 'var(--radius-md)',
          padding: '8px 14px',
          fontSize: '12px',
          color: 'var(--text-secondary)',
          zIndex: 15,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-highlight)' }}>
          <WindIcon size={14} />
          <span style={{ fontWeight: 600 }}>{windSpeedKmh} km/h</span>
          <span style={{ color: 'var(--text-muted)' }}>({windDirectionDeg}°) NW</span>
        </div>

        <div style={{ width: '1px', height: '14px', background: 'var(--border-glass)' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: 'var(--accent-cyan)',
              boxShadow: '0 0 8px var(--accent-cyan)',
            }}
          />
          <span>{lang === 'hi' ? 'पंजाब से धुआँ प्रवाह' : 'Plume Advection Active'}</span>
        </div>
      </div>

      {/* 2D Station Pins Overlay */}
      {pinScreenCoords.map(({ id, sx, sy, data }) => {
        if (sx < 20 || sx > (containerRef.current?.clientWidth || 800) - 20 || sy < 20 || sy > 540) {
          return null;
        }

        const isSelected = activePin?.id === id;
        const verdictColor =
          data.verdict === 'go' ? 'var(--cat-good)' : data.verdict === 'limit' ? 'var(--cat-poor)' : 'var(--cat-severe)';

        return (
          <div
            key={id}
            style={{
              position: 'absolute',
              left: `${sx}px`,
              top: `${sy}px`,
              transform: 'translate(-50%, -100%)',
              cursor: 'pointer',
              zIndex: isSelected ? 30 : 20,
              pointerEvents: 'auto',
            }}
            onClick={() => {
              setActivePin(isSelected ? null : data);
            }}
          >
            {/* Sleek Glass Station Marker Dot */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '3px 8px',
                background: 'rgba(15, 23, 42, 0.85)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                border: `1px solid ${verdictColor}`,
                borderRadius: 'var(--radius-sm)',
                boxShadow: isSelected ? `0 0 16px ${verdictColor}66` : '0 2px 8px rgba(0,0,0,0.5)',
                whiteSpace: 'nowrap',
                fontSize: '11px',
                fontWeight: 600,
                color: '#FFFFFF',
              }}
            >
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: verdictColor,
                  boxShadow: `0 0 6px ${verdictColor}`,
                }}
              />
              <span>{lang === 'hi' ? data.name_hi : data.name_en}</span>
              <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{Math.round(data.pm25)}</span>
            </div>

            {/* Pin Anchor Arrow */}
            <div
              style={{
                width: 0,
                height: 0,
                borderLeft: '4px solid transparent',
                borderRight: '4px solid transparent',
                borderTop: `5px solid ${verdictColor}`,
                margin: '0 auto',
              }}
            />
          </div>
        );
      })}

      {/* Selected Station Popover Card */}
      {activePin && (
        <div
          style={{
            position: 'absolute',
            bottom: '20px',
            left: '20px',
            background: 'rgba(15, 23, 42, 0.90)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid var(--border-glass-light)',
            borderRadius: 'var(--radius-md)',
            padding: '16px',
            maxWidth: '300px',
            zIndex: 35,
            boxShadow: 'var(--shadow-glass)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontWeight: 700, fontSize: '15px', color: '#FFFFFF' }}>
              {lang === 'hi' ? activePin.name_hi : activePin.name_en}
            </span>
            <button
              onClick={() => setActivePin(null)}
              style={{ fontSize: '18px', color: 'var(--text-muted)', lineHeight: 1 }}
              aria-label="Close"
            >
              ×
            </button>
          </div>

          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px', lineHeight: '20px' }}>
            <div>
              {lang === 'hi' ? 'पूर्वानुमान' : 'Forecast'}:{' '}
              <strong style={{ color: '#FFFFFF' }}>{Math.round(activePin.pm25)} µg/m³</strong> ({activePin.category})
            </div>
            <div>
              {lang === 'hi' ? 'स्कूल परामर्श' : 'Outdoor Verdict'}:{' '}
              <span
                style={{
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color:
                    activePin.verdict === 'go'
                      ? 'var(--cat-good)'
                      : activePin.verdict === 'limit'
                      ? 'var(--cat-poor)'
                      : 'var(--cat-severe)',
                }}
              >
                {activePin.verdict}
              </span>
            </div>
          </div>

          {onSelectLocality && (
            <button
              onClick={() => onSelectLocality(activePin.id)}
              style={{
                width: '100%',
                padding: '8px 12px',
                fontSize: '12px',
                fontWeight: 600,
                background: 'var(--accent-indigo)',
                color: '#FFFFFF',
                borderRadius: 'var(--radius-sm)',
                boxShadow: '0 2px 8px rgba(99, 102, 241, 0.4)',
              }}
            >
              {lang === 'hi' ? 'स्थान विवरण देखें →' : 'Select Locality & View Timetable →'}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
