import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Language } from '../lib/i18n';
import { WindIcon, LayersIcon, PlayIcon, PauseIcon, RefreshIcon } from './Icons';

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

  // Visualization mode: Mode A: 'hotspots' (default) vs Mode B: 'continuous'
  const [visMode, setVisMode] = useState<'hotspots' | 'continuous'>('hotspots');

  // Layer visibility state
  const [layers, setLayers] = useState({
    pollution: true,
    wind: true,
    hotspots: true,
  });
  const [showLayerMenu, setShowLayerMenu] = useState(false);

  // Current zoom level for zoom-dependent detail
  const [currentZoom, setCurrentZoom] = useState<number>(11);

  // Active selected pin on map
  const [activePin, setActivePin] = useState<HotspotData | null>(null);
  const [pinScreenCoords, setPinScreenCoords] = useState<Array<{ id: string; sx: number; sy: number; data: HotspotData }>>([]);

  // Three.js instances ref
  const threeRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.OrthographicCamera;
    renderer: THREE.WebGLRenderer;
    material: THREE.ShaderMaterial;
    clock: THREE.Clock;
    reqId: number;
  } | null>(null);

  // Helper: Diurnal curve forecast modulation
  const getHotspotForecastVal = useCallback((basePm: number, offset: number) => {
    const diurnalMod = 0.92 + 0.22 * Math.sin((offset - 8.0) * 0.26);
    return Math.round(basePm * diurnalMod);
  }, []);

  // Helper: Scientific palette category & color
  const getCategoryForPm = useCallback((pm: number) => {
    if (pm <= 30) return { label: 'Good', color: '#E7C86F', badge: 'badge-low' };
    if (pm <= 60) return { label: 'Satisfactory', color: '#E9A45C', badge: 'badge-moderate' };
    if (pm <= 90) return { label: 'Moderate', color: '#E9A45C', badge: 'badge-moderate' };
    if (pm <= 120) return { label: 'Poor', color: '#E87849', badge: 'badge-poor' };
    if (pm <= 250) return { label: 'Very Poor', color: '#E9564E', badge: 'badge-very-poor' };
    return { label: 'Severe', color: '#A83B45', badge: 'badge-severe' };
  }, []);

  // Synchronize Leaflet map coordinates with Three.js shader and station pins
  const syncMapCoordinates = useCallback(() => {
    const map = mapInstanceRef.current;
    if (!map || !containerRef.current) return;

    const w = containerRef.current.clientWidth;
    const h = containerRef.current.clientHeight;
    if (w <= 0 || h <= 0) return;

    const zoom = map.getZoom();
    setCurrentZoom(zoom);

    // Exact meters per pixel at Delhi latitude (28.61° N) in Web Mercator
    const metersPerPixel = (40075016.686 * Math.cos((28.61 * Math.PI) / 180)) / (256 * Math.pow(2, zoom));

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
      threeRef.current.material.uniforms.u_map_zoom.value = zoom;
      threeRef.current.material.uniforms.u_meters_per_pixel.value = metersPerPixel;
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

      // OpenStreetMap tile layer (dark cartographic filter applied via CSS)
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

    // Screen-space 2D orthographic camera for sub-pixel precision
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

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
    const transportRad = (((windDirectionDeg + 180) % 360) * Math.PI) / 180;
    const windVec = new THREE.Vector2(Math.sin(transportRad), -Math.cos(transportRad));

    const initialZoom = mapInstanceRef.current ? mapInstanceRef.current.getZoom() : 11.0;
    const initialMpp = (40075016.686 * Math.cos((28.61 * Math.PI) / 180)) / (256 * Math.pow(2, initialZoom));

    const uniforms = {
      u_time: { value: 0.0 },
      u_wind: { value: windVec },
      u_wind_speed: { value: windSpeedKmh / 20.0 },
      u_num_hotspots: { value: Math.min(hotspots.length, 16) },
      u_hotspot_positions: { value: hotspotPositions },
      u_hotspot_screen_positions: { value: new Float32Array(16 * 2) },
      u_hotspot_intensities: { value: hotspotIntensities },
      u_resolution: { value: new THREE.Vector2(width, height) },
      u_map_zoom: { value: initialZoom },
      u_meters_per_pixel: { value: initialMpp },
      u_hour_offset: { value: hourOffset },
      u_layer_visible: { value: layers.pollution ? 1.0 : 0.0 },
      u_vis_mode: { value: visMode === 'hotspots' ? 0.0 : 1.0 },
    };

    const vertexShader = `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
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
      uniform float u_meters_per_pixel;
      uniform float u_hour_offset;
      uniform float u_layer_visible;
      uniform float u_vis_mode;

      varying vec2 vUv;

      // Scientific PM2.5 Concentration Color Ramp:
      // Maps exact PM2.5 in µg/m³:
      // < 25 µg/m³: Clean / transparent (Alpha = 0.0)
      // 25 - 60 µg/m³: LOW (#E7C86F) - Barely visible translucent golden yellow
      // 60 - 120 µg/m³: MODERATE (#E9A45C) - Gentle warm amber
      // 120 - 180 µg/m³: HIGH (#E87849) - Distinct warm orange
      // 180 - 260 µg/m³: VERY HIGH (#E9564E) - Rich crimson
      // > 260 µg/m³: EXTREME (#A83B45) - Deep intense maroon core
      vec4 evaluatePollutionColorAndAlpha(float pmVal) {
        if (pmVal < 25.0) {
          return vec4(0.0);
        }

        vec3 cLow    = vec3(0.906, 0.784, 0.435); // #E7C86F (Low / Good)
        vec3 cMod    = vec3(0.914, 0.643, 0.361); // #E9A45C (Moderate)
        vec3 cHigh   = vec3(0.910, 0.471, 0.286); // #E87849 (High / Poor)
        vec3 cVHigh  = vec3(0.914, 0.337, 0.306); // #E9564E (Very High)
        vec3 cExt    = vec3(0.659, 0.231, 0.271); // #A83B45 (Extreme / Severe)

        vec3 rgb;
        float alpha;

        if (pmVal <= 60.0) {
          float t = (pmVal - 25.0) / 35.0;
          rgb = mix(cLow * 0.9, cLow, t);
          alpha = mix(0.02, 0.14, t);
        } else if (pmVal <= 120.0) {
          float t = (pmVal - 60.0) / 60.0;
          rgb = mix(cLow, cMod, t);
          alpha = mix(0.14, 0.30, t);
        } else if (pmVal <= 180.0) {
          float t = (pmVal - 120.0) / 60.0;
          rgb = mix(cMod, cHigh, t);
          alpha = mix(0.30, 0.48, t);
        } else if (pmVal <= 260.0) {
          float t = (pmVal - 180.0) / 80.0;
          rgb = mix(cHigh, cVHigh, t);
          alpha = mix(0.48, 0.64, t);
        } else {
          float t = clamp((pmVal - 260.0) / 100.0, 0.0, 1.0);
          rgb = mix(cVHigh, cExt, t);
          alpha = mix(0.64, 0.76, t);
        }

        return vec4(rgb, alpha);
      }

      void main() {
        if (u_layer_visible < 0.5) {
          gl_FragColor = vec4(0.0);
          return;
        }

        // Screen-space pixel position (0,0 is top-left)
        vec2 fragPix = vec2(vUv.x * u_resolution.x, (1.0 - vUv.y) * u_resolution.y);

        // Normalized wind transport vector (direction toward which pollutants drift)
        vec2 wDir = normalize(u_wind);
        // Crosswind perpendicular vector
        vec2 wPerp = vec2(-wDir.y, wDir.x);

        // Diurnal forecast curve modulation
        float diurnalMod = 0.92 + 0.22 * sin((u_hour_offset - 8.0) * 0.26);

        if (u_vis_mode < 0.5) {
          // =========================================================================
          // MODE A: INDIVIDUAL HOTSPOTS (DEFAULT)
          // Spatially distinct, geographically anchored hotspots with localized cores
          // =========================================================================

          float maxConcentration = 0.0;
          float sumConcentration = 0.0;

          // Localized core radius on the ground: ~2.2 kilometers
          // Clamped in screen pixels so it remains stable and clearly visible across zooms
          float sigmaCoreMeters = clamp(2200.0, 16.0 * u_meters_per_pixel, 320.0 * u_meters_per_pixel);

          // Atmospheric dispersion downwind expansion
          float sigmaDownMeters = sigmaCoreMeters * (1.0 + 0.35 * clamp(u_wind_speed, 0.0, 1.2));
          float sigmaUpMeters   = sigmaCoreMeters * 0.60;
          float sigmaCrossMeters = sigmaCoreMeters * 0.80;

          for (int i = 0; i < 16; i++) {
            if (i >= u_num_hotspots) break;

            // Hotspot anchor position in screen pixels
            vec2 hPix = vec2(
              u_hotspot_screen_positions[i].x * u_resolution.x,
              (1.0 - u_hotspot_screen_positions[i].y) * u_resolution.y
            );
            float basePm = u_hotspot_intensities[i] * diurnalMod;

            // Distance in screen pixels
            vec2 deltaPix = fragPix - hPix;

            // Convert to physical ground coordinates in meters (dx: East, dy: North)
            float dx = deltaPix.x * u_meters_per_pixel;
            float dy = -deltaPix.y * u_meters_per_pixel;
            vec2 rMeters = vec2(dx, dy);

            // Project along transport vector and crosswind
            float downwind = dot(rMeters, wDir);
            float crosswind = abs(dot(rMeters, wPerp));

            float sDown = (downwind >= 0.0) ? sigmaDownMeters : sigmaUpMeters;
            float sCross = sigmaCrossMeters;

            // Mahalanobis distance squared
            float q = (downwind * downwind) / (2.0 * sDown * sDown) +
                      (crosswind * crosswind) / (2.0 * sCross * sCross);

            // Strict cutoff at ~3 sigma: beyond 4.5, contribution is zero
            if (q < 4.5) {
              float kernel = exp(-q) * smoothstep(4.5, 2.6, q);
              float C_i = basePm * kernel;

              maxConcentration = max(maxConcentration, C_i);
              sumConcentration += C_i;
            }
          }

          // Combined concentration: preserves peak hotspot cores without runaway summation
          float localPM = maxConcentration + 0.25 * (sumConcentration - maxConcentration);

          // Fast rejection: clean areas are completely transparent black
          if (localPM < 25.0) {
            gl_FragColor = vec4(0.0);
            return;
          }

          vec4 col = evaluatePollutionColorAndAlpha(localPM);

          // Subtle physical micro-vorticity at plume boundaries
          float microEdge = 0.96 + 0.04 * sin(fragPix.x * 0.05 + u_time * 0.4) * cos(fragPix.y * 0.05 + u_time * 0.4);
          col.a *= microEdge;

          gl_FragColor = col;

        } else {
          // =========================================================================
          // MODE B: CONTINUOUS CONCENTRATION FIELD
          // Broader regional concentration field showing metropolitan transport patterns
          // =========================================================================

          float fieldWeightedPM = 0.0;
          float fieldTotalWeight = 0.0;
          float sigmaRegional = clamp(9000.0, 40.0 * u_meters_per_pixel, 600.0 * u_meters_per_pixel);

          for (int i = 0; i < 16; i++) {
            if (i >= u_num_hotspots) break;

            vec2 hPix = vec2(
              u_hotspot_screen_positions[i].x * u_resolution.x,
              (1.0 - u_hotspot_screen_positions[i].y) * u_resolution.y
            );
            float basePm = u_hotspot_intensities[i] * diurnalMod;

            vec2 deltaPix = fragPix - hPix;
            float dx = deltaPix.x * u_meters_per_pixel;
            float dy = -deltaPix.y * u_meters_per_pixel;
            vec2 rMeters = vec2(dx, dy);

            float distSq = dot(rMeters, rMeters);
            float q = distSq / (2.0 * sigmaRegional * sigmaRegional);

            if (q < 5.0) {
              float w = exp(-q);
              fieldWeightedPM += basePm * w;
              fieldTotalWeight += w;
            }
          }

          if (fieldTotalWeight < 0.01) {
            gl_FragColor = vec4(0.0);
            return;
          }

          float regionalPM = fieldWeightedPM / fieldTotalWeight;
          if (regionalPM < 25.0) {
            gl_FragColor = vec4(0.0);
            return;
          }

          vec4 col = evaluatePollutionColorAndAlpha(regionalPM);
          col.a = min(col.a, 0.45); // Restrained regional alpha keeps basemap dark and readable

          gl_FragColor = col;
        }
      }
    `;

    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms,
      transparent: true,
      depthWrite: false,
    });

    const geometry = new THREE.PlaneGeometry(2, 2);
    const mesh = new THREE.Mesh(geometry, material);
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
      const transportRad = (((windDirectionDeg + 180) % 360) * Math.PI) / 180;
      threeRef.current.material.uniforms.u_wind.value.set(Math.sin(transportRad), -Math.cos(transportRad));
      threeRef.current.material.uniforms.u_wind_speed.value = windSpeedKmh / 20.0;
      threeRef.current.material.uniforms.u_hour_offset.value = hourOffset;
      threeRef.current.material.uniforms.u_layer_visible.value = layers.pollution ? 1.0 : 0.0;
      threeRef.current.material.uniforms.u_vis_mode.value = visMode === 'hotspots' ? 0.0 : 1.0;
    }
  }, [windDirectionDeg, windSpeedKmh, hourOffset, layers.pollution, visMode]);

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

    const numParticles = 140;
    const transportRad = (((windDirectionDeg + 180) % 360) * Math.PI) / 180;
    const speedFactor = Math.max(windSpeedKmh / 12.0, 0.6);
    const dx = Math.sin(transportRad) * speedFactor * 1.4;
    const dy = -Math.cos(transportRad) * speedFactor * 1.4;

    const particles: Array<{ x: number; y: number; life: number; maxLife: number }> = [];
    for (let i = 0; i < numParticles; i++) {
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        life: Math.random() * 90,
        maxLife: 70 + Math.random() * 50,
      });
    }

    const renderWind = () => {
      ctx.clearRect(0, 0, w, h);
      ctx.lineWidth = 1.0;

      for (let i = 0; i < numParticles; i++) {
        const p = particles[i];
        p.life++;
        if (p.life > p.maxLife || p.x < 0 || p.x > w || p.y < 0 || p.y > h) {
          p.x = Math.random() * w;
          p.y = Math.random() * h;
          p.life = 0;
        }

        const alpha = Math.sin((p.life / p.maxLife) * Math.PI) * 0.38;
        ctx.strokeStyle = `rgba(39, 211, 226, ${alpha})`;

        const headX = p.x + dx * 2.4;
        const headY = p.y + dy * 2.4;

        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(headX, headY);
        ctx.stroke();

        // Directional arrowhead at streamline head
        if (p.life > 15 && p.life < p.maxLife - 10) {
          const angle = Math.atan2(dy, dx);
          const arrowSize = 3.5;
          ctx.beginPath();
          ctx.moveTo(headX, headY);
          ctx.lineTo(
            headX - arrowSize * Math.cos(angle - Math.PI / 6),
            headY - arrowSize * Math.sin(angle - Math.PI / 6)
          );
          ctx.moveTo(headX, headY);
          ctx.lineTo(
            headX - arrowSize * Math.cos(angle + Math.PI / 6),
            headY - arrowSize * Math.sin(angle + Math.PI / 6)
          );
          ctx.stroke();
        }

        p.x += dx * 0.7;
        p.y += dy * 0.7;
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

      {/* 2. WebGL Pollution Concentration Layer (Mode A: Hotspots / Mode B: Continuous) */}
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
          opacity: layers.pollution ? 0.95 : 0,
        }}
      />

      {/* 3. Subtle Cyan Wind Streamlines 2D Canvas */}
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

      {/* 4. Geographically Anchored Hotspot Markers with Zoom-Dependent Detail */}
      {layers.hotspots && (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 20 }}>
          {pinScreenCoords.map(({ id, sx, sy, data }) => {
            const w = containerRef.current?.clientWidth || 800;
            const h = containerRef.current?.clientHeight || 600;
            if (sx < 10 || sx > w - 10 || sy < 10 || sy > h - 10) return null;

            // Zoom-dependent detail filtering
            const isMajorNode = ['anand_vihar', 'bawana', 'punjabi_bagh', 'okhla', 'dwarka'].includes(id);
            const isSelected = activePin?.id === id || selectedHotspotId === id;
            if (currentZoom < 11 && !isMajorNode && !isSelected) {
              return null; // Keep regional view clean and decluttered
            }

            const forecastVal = getHotspotForecastVal(data.pm25, hourOffset);
            const catInfo = getCategoryForPm(forecastVal);

            return (
              <div
                key={id}
                className={`hotspot-pill-marker ${isSelected ? 'active' : ''}`}
                style={{ left: `${sx}px`, top: `${sy}px`, pointerEvents: 'auto' }}
                onClick={(e) => {
                  e.stopPropagation();
                  setActivePin(data);
                  if (onSelectHotspot) onSelectHotspot(id);
                  if (onSelectLocality) onSelectLocality(id);
                  if (mapInstanceRef.current) {
                    mapInstanceRef.current.panTo([data.lat, data.lon], { animate: true, duration: 0.6 });
                  }
                }}
              >
                <span className="hotspot-marker-dot" style={{ background: catInfo.color }} />
                <span>{lang === 'hi' ? data.name_hi : data.name_en}</span>
                {currentZoom >= 11 && (
                  <span className="hotspot-marker-val">{forecastVal}</span>
                )}
                {currentZoom >= 13 && (
                  <span style={{ fontSize: '9px', color: catInfo.color, fontWeight: 700, marginLeft: '2px' }}>
                    {catInfo.label}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 5. FLOATING MAP OVERLAYS */}

      {/* TOP-LEFT: Layers, Mode Toggle, Wind Toggle, Forecast Horizon Chips */}
      <div className="map-floating-panel map-ctrl-top-left">
        {/* Layer Selector */}
        <div style={{ position: 'relative' }}>
          <button
            className="horizon-chip"
            style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
            onClick={() => setShowLayerMenu(!showLayerMenu)}
            title="Layer Visibility & Mode"
          >
            <LayersIcon size={14} />
            <span>Layers</span>
          </button>

          {showLayerMenu && (
            <div
              style={{
                position: 'absolute',
                top: '36px',
                left: 0,
                background: 'var(--surface-elevated)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding: '10px 14px',
                boxShadow: 'var(--shadow-panel)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                zIndex: 60,
                minWidth: '190px',
              }}
            >
              <div style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                Visualization Mode
              </div>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button
                  type="button"
                  className={`segmented-pill-btn ${visMode === 'hotspots' ? 'active' : ''}`}
                  style={{ flex: 1, padding: '4px 6px', fontSize: '11px', textAlign: 'center' }}
                  onClick={() => setVisMode('hotspots')}
                >
                  Hotspots
                </button>
                <button
                  type="button"
                  className={`segmented-pill-btn ${visMode === 'continuous' ? 'active' : ''}`}
                  style={{ flex: 1, padding: '4px 6px', fontSize: '11px', textAlign: 'center' }}
                  onClick={() => setVisMode('continuous')}
                >
                  Continuous
                </button>
              </div>

              <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '2px 0' }} />

              <div style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                Active Layers
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px', color: 'var(--text-secondary)' }}>
                <input
                  type="checkbox"
                  checked={layers.pollution}
                  onChange={(e) => setLayers({ ...layers, pollution: e.target.checked })}
                  style={{ accentColor: 'var(--accent)' }}
                />
                Pollution Layer
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px', color: 'var(--text-secondary)' }}>
                <input
                  type="checkbox"
                  checked={layers.wind}
                  onChange={(e) => setLayers({ ...layers, wind: e.target.checked })}
                  style={{ accentColor: 'var(--accent)' }}
                />
                Wind Streamlines
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px', color: 'var(--text-secondary)' }}>
                <input
                  type="checkbox"
                  checked={layers.hotspots}
                  onChange={(e) => setLayers({ ...layers, hotspots: e.target.checked })}
                  style={{ accentColor: 'var(--accent)' }}
                />
                Station Markers
              </label>
            </div>
          )}
        </div>

        {/* Quick Mode Toggle */}
        <button
          className={`horizon-chip ${visMode === 'hotspots' ? 'active' : ''}`}
          onClick={() => setVisMode(visMode === 'hotspots' ? 'continuous' : 'hotspots')}
          title="Toggle between Individual Hotspots and Continuous Concentration Field"
        >
          <span>{visMode === 'hotspots' ? 'Hotspots' : 'Continuous'}</span>
        </button>

        <div style={{ width: '1px', height: '14px', background: 'var(--border-subtle)' }} />

        {/* Quick Wind Toggle */}
        <button
          className={`horizon-chip ${layers.wind ? 'active' : ''}`}
          onClick={() => setLayers({ ...layers, wind: !layers.wind })}
          title="Toggle Wind Streamlines"
        >
          <WindIcon size={13} color={layers.wind ? 'var(--accent)' : 'var(--text-secondary)'} />
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-secondary)' }}>
            PM2.5 · µg/m³
          </span>
          <span style={{ fontSize: '9.5px', color: 'var(--accent-cyan)', fontWeight: 600 }}>
            {visMode === 'hotspots' ? 'Hotspots' : 'Continuous'}
          </span>
        </div>

        <div
          style={{
            width: '180px',
            height: '8px',
            borderRadius: '2px',
            background: 'linear-gradient(to right, #E7C86F 0%, #E9A45C 25%, #E87849 50%, #E9564E 75%, #A83B45 100%)',
          }}
        />

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: 'var(--text-muted)', width: '180px' }}>
          <span>0</span>
          <span>60</span>
          <span>120</span>
          <span>180</span>
          <span>250</span>
          <span>350+</span>
        </div>
      </div>

      {/* Location Detail Popup when pin selected */}
      {activePin && (
        <div
          className="panel-dark"
          style={{
            position: 'absolute',
            bottom: '185px',
            left: '20px',
            width: '270px',
            padding: '12px 14px',
            boxShadow: 'var(--shadow-popup)',
            zIndex: 45,
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            background: 'var(--surface-elevated)',
            border: '1px solid var(--border)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {lang === 'hi' ? activePin.name_hi : activePin.name_en}
            </span>
            <button
              onClick={() => setActivePin(null)}
              style={{ color: 'var(--text-muted)', fontSize: '14px', cursor: 'pointer' }}
              aria-label="Close popup"
            >
              ✕
            </button>
          </div>

          {(() => {
            const fVal = getHotspotForecastVal(activePin.pm25, hourOffset);
            const cat = getCategoryForPm(fVal);
            return (
              <>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                  <span style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {fVal}
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>µg/m³ PM2.5</span>
                  <span className={`severity-badge ${cat.badge}`} style={{ marginLeft: 'auto', fontSize: '10px' }}>
                    {cat.label}
                  </span>
                </div>

                <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)', borderTop: '1px solid var(--border-subtle)', paddingTop: '6px', lineHeight: 1.4 }}>
                  <div><strong>Coordinates:</strong> {activePin.lat.toFixed(3)}°N, {activePin.lon.toFixed(3)}°E</div>
                  <div><strong>Horizon:</strong> +{hourOffset}h forecast</div>
                  <div style={{ color: 'var(--text-muted)', marginTop: '2px' }}>
                    Real CPCB/DPCC monitoring station. Localized concentration core.
                  </div>
                </div>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
};
