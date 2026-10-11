import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Language } from '../lib/i18n';
import { WindIcon, CompassIcon, LayersIcon, PlayIcon, PauseIcon, RefreshIcon, InfoIcon } from './Icons';

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

export interface MapAdvisoryInfo {
  status: string;
  situation: string;
  recommendation: string;
  confidence: string;
  updatedAt: string;
}

export interface DelhiFluidMapProps {
  hotspots: HotspotData[];
  selectedHotspotId?: string;
  onSelectHotspot?: (id: string) => void;
  onSelectLocality?: (id: string) => void;
  hourOffset: number;
  onSeekHourOffset?: (offset: number) => void;
  isPlaying?: boolean;
  onTogglePlay?: () => void;
  windDirectionDeg: number; // Meteorological direction: angle FROM which wind originates
  windSpeedKmh: number;
  advisory?: MapAdvisoryInfo;
  viewMode?: 'top' | 'horizontal';
  onToggleViewMode?: (mode: 'top' | 'horizontal') => void;
  isFullScreen?: boolean;
  onOpenInfoModal?: () => void;
  isSideMenuOpen?: boolean;
  lang: Language;
}

const FORECAST_HORIZONS = [0, 1, 3, 6, 12, 24];

export const DelhiFluidMap: React.FC<DelhiFluidMapProps> = ({
  hotspots,
  selectedHotspotId,
  onSelectHotspot,
  onSelectLocality,
  hourOffset,
  onSeekHourOffset,
  isPlaying = false,
  onTogglePlay,
  windDirectionDeg,
  windSpeedKmh,
  advisory,
  lang,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const windCanvasRef = useRef<HTMLCanvasElement>(null);

  // Layer visibility state
  const [layers, setLayers] = useState({
    pollution: true,
    wind: true,
    stations: true,
    hotspots: true,
  });
  const [showLayerMenu, setShowLayerMenu] = useState(false);

  // Active selected pin on map
  const [activePin, setActivePin] = useState<HotspotData | null>(null);
  const [pinScreenCoords, setPinScreenCoords] = useState<Array<{ id: string; sx: number; sy: number; data: HotspotData }>>([]);

  // Three.js instances ref
  const threeRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    material: THREE.ShaderMaterial;
    clock: THREE.Clock;
    reqId: number;
  } | null>(null);

  // Synchronize Leaflet map coordinates with Three.js shader and station pins
  const syncMapCoordinates = useCallback(() => {
    const map = mapInstanceRef.current;
    if (!map || !containerRef.current) return;

    const w = containerRef.current.clientWidth;
    const h = containerRef.current.clientHeight;
    if (w <= 0 || h <= 0) return;

    const screenPositions = new Float32Array(16 * 2);
    const coords = hotspots.slice(0, 16).map((item, i) => {
      const pt = map.latLngToContainerPoint([item.lat, item.lon]);
      screenPositions[i * 2] = pt.x / w;
      screenPositions[i * 2 + 1] = 1.0 - pt.y / h; // In WebGL UV space, y=0 is bottom
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
      threeRef.current.material.uniforms.u_resolution.value.set(w, h);
    }

    setPinScreenCoords(coords);
  }, [hotspots]);

  // Synchronize selectedHotspotId prop from outside (e.g. clicking sidebar row)
  useEffect(() => {
    if (selectedHotspotId) {
      const found = hotspots.find((h) => h.id === selectedHotspotId);
      if (found) {
        setActivePin(found);
        if (mapInstanceRef.current) {
          mapInstanceRef.current.panTo([found.lat, found.lon], { animate: true, duration: 0.8 });
        }
      }
    }
  }, [selectedHotspotId, hotspots]);

  // Initialize interactive Leaflet map with OpenStreetMap tiles
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [28.6139, 77.2090], // Central Delhi
        zoom: 11,
        minZoom: 9,
        maxZoom: 18,
        attributionControl: false,
        zoomControl: false,
      });

      // Fit Delhi NCR geographic extent
      map.fitBounds([
        [28.3044, 76.8164],
        [28.9216, 77.5195],
      ]);

      // OpenStreetMap tile layer
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);

      mapInstanceRef.current = map;

      map.on('move', syncMapCoordinates);
      map.on('zoom', syncMapCoordinates);
      map.on('viewreset', syncMapCoordinates);
      map.on('resize', syncMapCoordinates);

      setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
          syncMapCoordinates();
        }
      }, 100);
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [syncMapCoordinates]);

  // Three.js Atmospheric Physics WebGL Shader Setup
  useEffect(() => {
    if (!containerRef.current || !canvasRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    const scene = new THREE.Scene();
    scene.background = null;

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    camera.position.set(0, 7.8, 0.001);
    camera.lookAt(new THREE.Vector3(0, 0, 0));

    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
      alpha: true,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const hotspotPositions = new Float32Array(16 * 2);
    const hotspotIntensities = new Float32Array(16);

    hotspots.slice(0, 16).forEach((h, i) => {
      hotspotIntensities[i] = h.pm25;
    });

    // Transport vector from meteorological wind angle
    const transportRad = ((windDirectionDeg + 180) % 360 * Math.PI) / 180;
    const windVec = new THREE.Vector2(Math.sin(transportRad), -Math.cos(transportRad));

    const uniforms = {
      u_time: { value: 0.0 },
      u_wind: { value: windVec },
      u_wind_speed: { value: windSpeedKmh / 20.0 },
      u_num_hotspots: { value: Math.min(hotspots.length, 16) },
      u_hotspot_positions: { value: hotspotPositions },
      u_hotspot_screen_positions: { value: new Float32Array(16 * 2) },
      u_hotspot_intensities: { value: hotspotIntensities },
      u_resolution: { value: new THREE.Vector2(width, height) },
      u_map_zoom: { value: 11.0 },
      u_hour_offset: { value: hourOffset },
      u_layer_visible: { value: layers.pollution ? 1.0 : 0.0 },
    };

    const vertexShader = `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;

    const fragmentShader = `
      uniform float u_time;
      uniform vec2 u_wind;
      uniform float u_wind_speed;
      uniform int u_num_hotspots;
      uniform vec2 u_hotspot_screen_positions[16];
      uniform float u_hotspot_intensities[16];
      uniform vec2 u_resolution;
      uniform float u_map_zoom;
      uniform float u_hour_offset;
      uniform float u_layer_visible;

      // Pseudo-random hash
      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }

      // 2D Value noise
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i + vec2(0.0,0.0)), hash(i + vec2(1.0,0.0)), u.x),
                   mix(hash(i + vec2(0.0,1.0)), hash(i + vec2(1.0,1.0)), u.x), u.y);
      }

      // Fractional Brownian Motion
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

      // Scientific PM2.5 Color Scale: #F2CF76 -> #F4A65A -> #F17A46 -> #EF554D -> #A83B45
      vec3 getScientificPollutionColor(float pmNorm) {
        vec3 c0 = vec3(0.949, 0.812, 0.463); // #F2CF76 (Low)
        vec3 c1 = vec3(0.957, 0.651, 0.353); // #F4A65A (Moderate)
        vec3 c2 = vec3(0.945, 0.478, 0.275); // #F17A46 (Poor)
        vec3 c3 = vec3(0.937, 0.333, 0.302); // #EF554D (Very Poor)
        vec3 c4 = vec3(0.659, 0.231, 0.271); // #A83B45 (Severe)

        if (pmNorm <= 0.25) {
          return mix(c0, c1, pmNorm / 0.25);
        } else if (pmNorm <= 0.50) {
          return mix(c1, c2, (pmNorm - 0.25) / 0.25);
        } else if (pmNorm <= 0.75) {
          return mix(c2, c3, (pmNorm - 0.50) / 0.25);
        } else {
          return mix(c3, c4, clamp((pmNorm - 0.75) / 0.25, 0.0, 1.0));
        }
      }

      void main() {
        if (u_layer_visible < 0.5) {
          gl_FragColor = vec4(0.0);
          return;
        }

        vec2 fragUV = gl_FragCoord.xy / u_resolution.xy;
        float aspect = u_resolution.x / u_resolution.y;

        vec2 windDir = normalize(u_wind);
        vec2 windPerp = vec2(-windDir.y, windDir.x);

        float zoomScale = pow(2.0, clamp(u_map_zoom - 11.0, -1.5, 3.5));

        // 1. Multi-source Gaussian plume atmospheric dispersion
        float totalPlume = 0.0;
        float weightedPM = 0.0;
        float totalWeight = 0.0;

        // Forecast modulation curve
        float diurnalMod = 0.9 + 0.25 * sin((u_hour_offset - 8.0) * 0.26);

        for (int i = 0; i < 16; i++) {
          if (i >= u_num_hotspots) break;
          vec2 hScreen = u_hotspot_screen_positions[i];
          float hVal = u_hotspot_intensities[i] * diurnalMod;

          vec2 delta = fragUV - hScreen;
          delta.x *= aspect;

          float downwindDist = dot(delta, windDir);
          float crosswindDist = abs(dot(delta, windPerp));

          float sigma0 = 0.045 * zoomScale;
          float alphaDisp = 0.15 * sqrt(max(0.001, zoomScale));
          float sigmaY = sigma0 + alphaDisp * sqrt(max(0.0, downwindDist));

          float crosswindProfile = exp(- (crosswindDist * crosswindDist) / (2.0 * sigmaY * sigmaY));

          float longitudinalProfile;
          if (downwindDist >= 0.0) {
            longitudinalProfile = exp(- downwindDist / (0.35 * zoomScale));
          } else {
            longitudinalProfile = exp(- (downwindDist * downwindDist) / (0.0035 * zoomScale * zoomScale));
          }

          float plumeContrib = (hVal / 320.0) * crosswindProfile * longitudinalProfile;
          totalPlume += plumeContrib;

          float w = crosswindProfile * longitudinalProfile;
          weightedPM += hVal * w;
          totalWeight += w;
        }

        float localPM = totalWeight > 0.0 ? (weightedPM / totalWeight) : 80.0;
        float pmNorm = clamp(localPM / 320.0, 0.0, 1.2);

        // 2. Advection along wind vector with domain-warped turbulence
        vec2 spaceCoord = fragUV * vec2(aspect, 1.0);
        vec2 advectCoord = spaceCoord - windDir * u_time * (0.035 + u_wind_speed * 0.025);

        vec2 warp1;
        warp1.x = fbm(advectCoord * 5.0);
        warp1.y = fbm(advectCoord * 5.0 + vec2(4.3, 1.7));

        vec2 turbulentCoord = advectCoord + warp1 * 0.06;
        float billow1 = fbm(turbulentCoord * 7.5);
        float billow2 = fbm(turbulentCoord * 14.0 + u_time * 0.02);

        float smokeStructure = billow1 * 0.65 + billow2 * 0.35;
        float rawDensity = totalPlume * (0.45 + 0.95 * smokeStructure);

        // 3. Optical extinction and alpha blending over dark basemap
        float opticalDepth = rawDensity * 2.5;
        float cloudAlpha = clamp(1.0 - exp(-opticalDepth), 0.0, 0.72);

        vec3 cloudColor = getScientificPollutionColor(pmNorm);

        gl_FragColor = vec4(cloudColor, cloudAlpha);
      }
    `;

    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms,
      transparent: true,
      depthWrite: false,
    });

    const geometry = new THREE.PlaneGeometry(6.4, 6.4, 32, 32);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = -Math.PI / 2;
    scene.add(mesh);

    const clock = new THREE.Clock();

    const animate = () => {
      const elapsed = clock.getElapsedTime();
      material.uniforms.u_time.value = elapsed;
      renderer.render(scene, camera);
      threeRef.current!.reqId = requestAnimationFrame(animate);
    };

    threeRef.current = {
      scene,
      camera,
      renderer,
      material,
      clock,
      reqId: requestAnimationFrame(animate),
    };

    syncMapCoordinates();

    return () => {
      if (threeRef.current) {
        cancelAnimationFrame(threeRef.current.reqId);
        renderer.dispose();
        geometry.dispose();
        material.dispose();
      }
    };
  }, [hotspots, syncMapCoordinates]);

  // Update uniforms when dynamic props change
  useEffect(() => {
    if (threeRef.current) {
      const transportRad = ((windDirectionDeg + 180) % 360 * Math.PI) / 180;
      threeRef.current.material.uniforms.u_wind.value.set(Math.sin(transportRad), -Math.cos(transportRad));
      threeRef.current.material.uniforms.u_wind_speed.value = windSpeedKmh / 20.0;
      threeRef.current.material.uniforms.u_hour_offset.value = hourOffset;
      threeRef.current.material.uniforms.u_layer_visible.value = layers.pollution ? 1.0 : 0.0;
    }
  }, [windDirectionDeg, windSpeedKmh, hourOffset, layers.pollution]);

  // 2D Wind Streamlines Animation Canvas
  useEffect(() => {
    const canvas = windCanvasRef.current;
    if (!canvas || !layers.wind) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    const w = canvas.parentElement?.clientWidth || 800;
    const h = canvas.parentElement?.clientHeight || 600;
    canvas.width = w;
    canvas.height = h;

    const numParticles = 180;
    const transportRad = ((windDirectionDeg + 180) % 360 * Math.PI) / 180;
    const dx = Math.sin(transportRad) * (windSpeedKmh / 10.0);
    const dy = -Math.cos(transportRad) * (windSpeedKmh / 10.0);

    const particles: Array<{ x: number; y: number; life: number; maxLife: number }> = [];
    for (let i = 0; i < numParticles; i++) {
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        life: Math.random() * 80,
        maxLife: 60 + Math.random() * 40,
      });
    }

    const renderWind = () => {
      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = '#27D3E2';
      ctx.lineWidth = 1.0;

      for (let i = 0; i < numParticles; i++) {
        const p = particles[i];
        p.life++;
        if (p.life > p.maxLife || p.x < 0 || p.x > w || p.y < 0 || p.y > h) {
          p.x = Math.random() * w;
          p.y = Math.random() * h;
          p.life = 0;
        }

        const alpha = Math.sin((p.life / p.maxLife) * Math.PI) * 0.45;
        ctx.strokeStyle = `rgba(39, 211, 226, ${alpha})`;

        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + dx * 2.2, p.y + dy * 2.2);
        ctx.stroke();

        p.x += dx * 0.6;
        p.y += dy * 0.6;
      }

      animId = requestAnimationFrame(renderWind);
    };

    animId = requestAnimationFrame(renderWind);
    return () => cancelAnimationFrame(animId);
  }, [windDirectionDeg, windSpeedKmh, layers.wind]);

  // Reset to Delhi NCR center
  const handleResetRegion = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.fitBounds([
        [28.3044, 76.8164],
        [28.9216, 77.5195],
      ]);
    }
  };

  const handleZoomIn = () => {
    if (mapInstanceRef.current) mapInstanceRef.current.zoomIn();
  };

  const handleZoomOut = () => {
    if (mapInstanceRef.current) mapInstanceRef.current.zoomOut();
  };

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
      {/* 1. Underlying Leaflet Interactive Map Container */}
      <div ref={mapContainerRef} style={{ width: '100%', height: '100%', zIndex: 1 }} />

      {/* 2. Three.js WebGL Fluid Dispersion Canvas */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 10,
        }}
      />

      {/* 3. Subtle Wind Streamlines 2D Canvas */}
      {layers.wind && (
        <canvas
          ref={windCanvasRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            zIndex: 15,
          }}
        />
      )}

      {/* 4. Geographically Anchored Hotspot Markers */}
      {layers.hotspots && (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 20 }}>
          {pinScreenCoords.map(({ id, sx, sy, data }) => {
            const w = containerRef.current?.clientWidth || 800;
            const h = containerRef.current?.clientHeight || 600;
            if (sx < 10 || sx > w - 10 || sy < 10 || sy > h - 10) return null;

            const isSelected = activePin?.id === id || selectedHotspotId === id;

            let dotColor = '#F2CF76';
            if (data.pm25 > 250) dotColor = '#A83B45';
            else if (data.pm25 > 120) dotColor = '#EF554D';
            else if (data.pm25 > 90) dotColor = '#F17A46';
            else if (data.pm25 > 60) dotColor = '#F4A65A';

            return (
              <div
                key={id}
                className={`hotspot-pill-marker ${isSelected ? 'active' : ''}`}
                style={{ left: `${sx}px`, top: `${sy}px` }}
                onClick={(e) => {
                  e.stopPropagation();
                  setActivePin(data);
                  if (onSelectHotspot) onSelectHotspot(id);
                  if (onSelectLocality) onSelectLocality(id);
                }}
              >
                <span className="hotspot-marker-dot" style={{ background: dotColor }} />
                <span>{lang === 'hi' ? data.name_hi : data.name_en}</span>
                <span className="hotspot-marker-val">{Math.round(data.pm25)}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* 5. FLOATING MAP OVERLAYS */}

      {/* TOP-LEFT: Layers, Wind Toggle, Forecast Horizon Chips */}
      <div className="map-floating-panel map-ctrl-top-left">
        {/* Layer Selector */}
        <div style={{ position: 'relative' }}>
          <button
            className="horizon-chip"
            style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
            onClick={() => setShowLayerMenu(!showLayerMenu)}
            title="Layer Visibility"
          >
            <LayersIcon size={14} />
            <span>Layers</span>
          </button>

          {showLayerMenu && (
            <div
              style={{
                position: 'absolute',
                top: '32px',
                left: 0,
                background: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '6px',
                padding: '8px 12px',
                boxShadow: 'var(--shadow-panel)',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                zIndex: 60,
                minWidth: '150px',
              }}
            >
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px' }}>
                <input
                  type="checkbox"
                  checked={layers.pollution}
                  onChange={(e) => setLayers({ ...layers, pollution: e.target.checked })}
                />
                Pollution Field
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px' }}>
                <input
                  type="checkbox"
                  checked={layers.wind}
                  onChange={(e) => setLayers({ ...layers, wind: e.target.checked })}
                />
                Wind Vectors
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px' }}>
                <input
                  type="checkbox"
                  checked={layers.hotspots}
                  onChange={(e) => setLayers({ ...layers, hotspots: e.target.checked })}
                />
                Hotspot Markers
              </label>
            </div>
          )}
        </div>

        <div style={{ width: '1px', height: '14px', background: 'var(--border-subtle)' }} />

        {/* Wind Toggle */}
        <button
          className={`horizon-chip ${layers.wind ? 'active' : ''}`}
          onClick={() => setLayers({ ...layers, wind: !layers.wind })}
          title="Toggle Wind Streamlines"
        >
          <WindIcon size={13} color={layers.wind ? '#27D3E2' : '#A1ACB8'} />
          <span>Wind</span>
        </button>

        <div style={{ width: '1px', height: '14px', background: 'var(--border-subtle)' }} />

        {/* Forecast Horizon Selector */}
        <div className="horizon-chips">
          {FORECAST_HORIZONS.map((h) => (
            <button
              key={h}
              className={`horizon-chip ${hourOffset === h ? 'active' : ''}`}
              onClick={() => onSeekHourOffset && onSeekHourOffset(h)}
            >
              {h === 0 ? 'Now' : `+${h}h`}
            </button>
          ))}
        </div>
      </div>

      {/* TOP-RIGHT: Reset Region & Zoom Controls */}
      <div className="map-ctrl-top-right">
        <button className="map-icon-btn" onClick={handleResetRegion} title="Reset Delhi NCR Extent">
          <RefreshIcon size={14} />
        </button>
        <button className="map-icon-btn" onClick={handleZoomIn} title="Zoom In">
          +
        </button>
        <button className="map-icon-btn" onClick={handleZoomOut} title="Zoom Out">
          −
        </button>
      </div>

      {/* BOTTOM-LEFT: Floating Air-Quality Advisory Card */}
      <div className="map-floating-panel map-ctrl-bottom-left">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.5px' }}>
            Air Quality Advisory
          </span>
          <span className="severity-badge badge-very-poor" style={{ fontSize: '10px' }}>
            {advisory?.status || 'Severe · High confidence'}
          </span>
        </div>

        <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.35 }}>
          {advisory?.situation || 'Pollution is elevated across Eastern and Central Delhi due to light NW transport.'}
        </p>

        <p style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.35 }}>
          {advisory?.recommendation || 'Sensitive groups should avoid outdoor exertion. School sports should be restricted.'}
        </p>

        <div style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-subtle)', paddingTop: '4px' }}>
          <span>Horizon: +{hourOffset}h</span>
          <span>Updated: {advisory?.updatedAt || 'Oct 2026'}</span>
        </div>
      </div>

      {/* BOTTOM-CENTER: Timeline Playback Scrubber */}
      <div className="map-floating-panel map-ctrl-bottom-center">
        <button
          onClick={onTogglePlay}
          className="map-icon-btn"
          style={{ width: '28px', height: '28px', flexShrink: 0 }}
          title={isPlaying ? 'Pause' : 'Play Timeline'}
        >
          {isPlaying ? <PauseIcon size={13} color="var(--accent-cyan)" /> : <PlayIcon size={13} color="var(--accent-cyan)" />}
        </button>

        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: '4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>
            <span>Forecast Timeline</span>
            <span style={{ color: 'var(--accent-cyan)' }}>+{hourOffset}h Horizon</span>
          </div>

          <input
            type="range"
            min={0}
            max={48}
            value={hourOffset}
            onChange={(e) => onSeekHourOffset && onSeekHourOffset(Number(e.target.value))}
            style={{
              width: '100%',
              accentColor: 'var(--accent-cyan)',
              cursor: 'pointer',
              height: '4px',
            }}
          />

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9.5px', color: 'var(--text-muted)' }}>
            <span>Now</span>
            <span>+6h</span>
            <span>+12h</span>
            <span>+24h</span>
            <span>+48h</span>
          </div>
        </div>
      </div>

      {/* BOTTOM-RIGHT: Scientific PM2.5 Color Legend */}
      <div className="map-floating-panel map-ctrl-bottom-right">
        <div style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-secondary)' }}>
          PM2.5 · µg/m³
        </div>

        <div
          style={{
            width: '180px',
            height: '8px',
            borderRadius: '2px',
            background: 'linear-gradient(to right, #F2CF76 0%, #F4A65A 25%, #F17A46 50%, #EF554D 75%, #A83B45 100%)',
          }}
        />

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: 'var(--text-muted)', width: '180px' }}>
          <span>0</span>
          <span>50</span>
          <span>100</span>
          <span>200</span>
          <span>300</span>
          <span>500</span>
        </div>
      </div>

      {/* Location Detail Popup when pin selected */}
      {activePin && (
        <div
          className="panel-dark"
          style={{
            position: 'absolute',
            top: '70px',
            left: '20px',
            width: '260px',
            padding: '12px 14px',
            boxShadow: 'var(--shadow-popup)',
            zIndex: 45,
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {lang === 'hi' ? activePin.name_hi : activePin.name_en}
            </span>
            <button onClick={() => setActivePin(null)} style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
              ✕
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <span style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)' }}>
              {Math.round(activePin.pm25)}
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>µg/m³ PM2.5</span>
            <span className="severity-badge badge-very-poor" style={{ marginLeft: 'auto', fontSize: '10px' }}>
              {activePin.category}
            </span>
          </div>

          <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)', borderTop: '1px solid var(--border-subtle)', paddingTop: '6px' }}>
            Location: {activePin.lat.toFixed(3)}°N, {activePin.lon.toFixed(3)}°E<br />
            Status: Elevated particulate concentration.
          </div>
        </div>
      )}
    </div>
  );
};
