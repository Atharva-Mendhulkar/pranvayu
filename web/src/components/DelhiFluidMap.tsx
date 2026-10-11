import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Language } from '../lib/i18n';
import { WindIcon, LayersIcon, PlayIcon, PauseIcon, RefreshIcon, SchoolIcon, ParticlesIcon } from './Icons';
import { MonitoringStation, School, SchoolPeriodVerdict } from '../types/intelligence';
import {
  InspectedLocation,
  inspectMapCoordinate,
  evaluateContinuousField,
  getPaletteTier,
} from '../lib/continuousField';

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
  stations?: MonitoringStation[];
  schools?: School[];
  selectedHotspotId?: string;
  onSelectHotspot?: (id: string) => void;
  selectedStationId?: string;
  onSelectStation?: (id: string) => void;
  selectedSchoolId?: string;
  onSelectSchool?: (id: string) => void;
  onSelectLocality?: (id: string) => void;
  inspectedLocation?: InspectedLocation | null;
  onInspectLocation?: (loc: InspectedLocation | null) => void;
  hourOffset: number;
  onSeekHourOffset?: (offset: number) => void;
  isPlaying?: boolean;
  onTogglePlay?: () => void;
  windDirectionDeg: number; // Meteorological direction: angle FROM which wind originates
  windSpeedKmh: number;
  advisory?: MapAdvisoryInfo;
  viewMode?: 'top' | 'horizontal';
  onToggleViewMode?: (mode: 'top' | 'horizontal') => void;
  lang: Language;
}

const FORECAST_HORIZONS = [0, 1, 3, 6, 12, 24];

export interface TransportCorridor {
  id: string;
  lat: number;
  lon: number;
  label_en: string;
  label_hi: string;
  tier: 'regional' | 'local';
}

export const TRANSPORT_CORRIDORS: TransportCorridor[] = [
  // 1. REGIONAL UPSTREAM ENTRY CORRIDOR (Punjab/Haryana agricultural inflow)
  {
    id: 'corridor-nw-inflow',
    lat: 28.84,
    lon: 77.04,
    label_en: 'NW Inflow Corridor',
    label_hi: 'उत्तर-पश्चिमी प्रवेश गलियारा',
    tier: 'regional',
  },
  // 2. REGIONAL CENTRAL TRANSECT (Capital urban dispersion & Yamuna crossing)
  {
    id: 'corridor-central-axis',
    lat: 28.61,
    lon: 77.26,
    label_en: 'Capital Trans-Yamuna Flow',
    label_hi: 'केंद्रीय राजधानी प्रवाह',
    tier: 'regional',
  },
  // 3. REGIONAL SOUTHEAST OUTFLOW (Plume exit toward Greater Noida/Faridabad)
  {
    id: 'corridor-se-outflow',
    lat: 28.46,
    lon: 77.38,
    label_en: 'SE Outflow Corridor',
    label_hi: 'दक्षिण-पूर्वी निकास गलियारा',
    tier: 'regional',
  },
  // 4. LOCAL PLUME CORRIDORS (City zoom: downwind of key clusters)
  {
    id: 'corridor-local-anand-vihar',
    lat: 28.62,
    lon: 77.34,
    label_en: 'Anand Vihar Axis',
    label_hi: 'आनंद विहार अक्ष',
    tier: 'local',
  },
  {
    id: 'corridor-local-wazirpur',
    lat: 28.68,
    lon: 77.19,
    label_en: 'North-West Plume Axis',
    label_hi: 'उत्तर-पश्चिम अक्ष',
    tier: 'local',
  },
  {
    id: 'corridor-local-dwarka',
    lat: 28.56,
    lon: 77.08,
    label_en: 'Dwarka Dispersion Axis',
    label_hi: 'द्वारका परिक्षेपण अक्ष',
    tier: 'local',
  },
];

// Internal data structure for geographic advection particles
interface AdvectionParticle {
  lat: number;
  lon: number;
  age: number;
  maxAge: number;
  speedScale: number;
  scaleType: 0 | 1; // 0: fine point, 1: medium filament
  history: Array<[number, number]>;
}

export const DelhiFluidMap: React.FC<DelhiFluidMapProps> = ({
  hotspots,
  stations = [],
  schools = [],
  selectedHotspotId,
  onSelectHotspot,
  selectedStationId,
  onSelectStation,
  selectedSchoolId,
  onSelectSchool,
  onSelectLocality,
  inspectedLocation: propsInspectedLocation,
  onInspectLocation,
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
  const particleCanvasRef = useRef<HTMLCanvasElement>(null);
  const windCanvasRef = useRef<HTMLCanvasElement>(null);

  // Visualization mode: Mode A: 'hotspots' vs Mode B: 'continuous' (Default: Continuous physics field)
  const [visMode, setVisMode] = useState<'hotspots' | 'continuous'>('continuous');

  // Arbitrary coordinate inspection state
  const [localInspected, setLocalInspected] = useState<InspectedLocation | null>(null);
  const [inspectedScreenPos, setInspectedScreenPos] = useState<{ sx: number; sy: number } | null>(null);

  // Layer visibility state (6 distinct independent layers)
  const [layers, setLayers] = useState({
    pollution: true,  // Layer 2: WebGL concentration field
    particles: true,  // Layer 5: Fine-grained atmospheric particle advection
    wind: true,       // Layer 4: Cyan wind streamlines & directional vectors
    hotspots: true,   // Layer 3: Model-inferred plume cores
    stations: true,   // Layer 6a: CPCB/DPCC monitoring stations
    schools: true,    // Layer 6b: Delhi schools & academies
  });
  const [particleDensity, setParticleDensity] = useState<'auto' | 'low' | 'medium' | 'high'>('auto');
  const [showLayerMenu, setShowLayerMenu] = useState(false);

  // Current zoom level for zoom-dependent detail
  const [currentZoom, setCurrentZoom] = useState<number>(11);

  // Active selected entities on map
  const [activePin, setActivePin] = useState<HotspotData | null>(null);
  const [activeStationData, setActiveStationData] = useState<MonitoringStation | null>(null);
  const [activeSchoolData, setActiveSchoolData] = useState<School | null>(null);

  // Screen projected coordinates
  const [pinScreenCoords, setPinScreenCoords] = useState<Array<{ id: string; sx: number; sy: number; data: HotspotData }>>([]);
  const [stationScreenCoords, setStationScreenCoords] = useState<Array<{ id: string; sx: number; sy: number; data: MonitoringStation }>>([]);
  const [schoolScreenCoords, setSchoolScreenCoords] = useState<Array<{ id: string; sx: number; sy: number; data: School }>>([]);

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

  // Helper: Scientific palette category & color (7-Tier standard)
  const getCategoryForPm = useCallback((pm: number) => {
    const tier = getPaletteTier(pm);
    return {
      label: tier.label_en,
      label_hi: tier.label_hi,
      color: tier.hex,
      badge: tier.badge,
    };
  }, []);

  // Synchronize Leaflet map coordinates with Three.js shader and pins
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
    const bounds = map.getBounds();

    // Hotspot positions
    const screenPositions = new Float32Array(16 * 2);
    const coords = hotspots.slice(0, 16).map((item, i) => {
      const pt = map.latLngToContainerPoint([item.lat, item.lon]);
      screenPositions[i * 2] = pt.x / w;
      screenPositions[i * 2 + 1] = 1.0 - pt.y / h;
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
      threeRef.current.material.uniforms.u_map_bounds.value.set(
        bounds.getSouth(),
        bounds.getWest(),
        bounds.getNorth(),
        bounds.getEast()
      );
    }
    setPinScreenCoords(coords);

    // Update screen pos of inspected location if present
    const activeInsp = propsInspectedLocation || localInspected;
    if (activeInsp) {
      const pt = map.latLngToContainerPoint([activeInsp.lat, activeInsp.lon]);
      setInspectedScreenPos({ sx: pt.x, sy: pt.y });
    } else {
      setInspectedScreenPos(null);
    }

    // Stations positions
    if (stations && stations.length > 0) {
      const stCoords = stations.map((st) => {
        const pt = map.latLngToContainerPoint([st.lat, st.lon]);
        return {
          id: st.id,
          sx: pt.x,
          sy: pt.y,
          data: st,
        };
      });
      setStationScreenCoords(stCoords);
    }

    // Schools positions
    if (schools && schools.length > 0) {
      const scCoords = schools.map((sc) => {
        const pt = map.latLngToContainerPoint([sc.lat, sc.lon]);
        return {
          id: sc.id,
          sx: pt.x,
          sy: pt.y,
          data: sc,
        };
      });
      setSchoolScreenCoords(scCoords);
    }
  }, [hotspots, stations, schools]);

  const initialMountRef = useRef<boolean>(true);

  // Synchronize selection from outside
  useEffect(() => {
    if (selectedHotspotId) {
      const found = hotspots.find((h) => h.id === selectedHotspotId);
      if (found) {
        setActivePin(found);
        setActiveStationData(null);
        setActiveSchoolData(null);
        if (!initialMountRef.current && mapInstanceRef.current) {
          const targetZoom = Math.max(mapInstanceRef.current.getZoom(), 13);
          mapInstanceRef.current.flyTo([found.lat, found.lon], targetZoom, { duration: 0.8 });
        }
      }
    }
  }, [selectedHotspotId, hotspots]);

  useEffect(() => {
    if (selectedStationId) {
      const found = stations.find((s) => s.id === selectedStationId);
      if (found) {
        setActiveStationData(found);
        setActivePin(null);
        setActiveSchoolData(null);
        if (!initialMountRef.current && mapInstanceRef.current) {
          const targetZoom = Math.max(mapInstanceRef.current.getZoom(), 13);
          mapInstanceRef.current.flyTo([found.lat, found.lon], targetZoom, { duration: 0.8 });
        }
      }
    }
  }, [selectedStationId, stations]);

  useEffect(() => {
    if (selectedSchoolId) {
      const found = schools.find((s) => s.id === selectedSchoolId);
      if (found) {
        setActiveSchoolData(found);
        setActivePin(null);
        setActiveStationData(null);
        if (!initialMountRef.current && mapInstanceRef.current) {
          const targetZoom = Math.max(mapInstanceRef.current.getZoom(), 13);
          mapInstanceRef.current.flyTo([found.lat, found.lon], targetZoom, { duration: 0.8 });
        }
      }
    }
  }, [selectedSchoolId, schools]);

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

      const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
      const urlZoom = urlParams?.get('zoom');
      const urlLocParam = urlParams?.get('locality');
      const urlLat = urlParams?.get('lat');
      const urlLon = urlParams?.get('lon');

      let initialSet = false;
      if (urlLat && urlLon) {
        const parsedLat = parseFloat(urlLat);
        const parsedLon = parseFloat(urlLon);
        const parsedZoom = urlZoom ? parseInt(urlZoom, 10) : 14;
        map.setView([parsedLat, parsedLon], parsedZoom);
        initialSet = true;
      } else if (urlLocParam) {
        const found = hotspots.find((h) => h.id === urlLocParam)
          || stations?.find((s) => s.id === urlLocParam)
          || schools?.find((sc) => sc.id === urlLocParam);
        if (found) {
          const parsedZoom = urlZoom ? parseInt(urlZoom, 10) : 14;
          map.setView([found.lat, found.lon], parsedZoom);
          initialSet = true;
        }
      } else if (urlZoom) {
        const parsedZoom = parseInt(urlZoom, 10);
        map.setView([28.6139, 77.2090], parsedZoom);
        initialSet = true;
      }

      if (!initialSet) {
        map.fitBounds([
          [28.3044, 76.8164],
          [28.9216, 77.5195],
        ]);
      }

      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap',
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
          initialMountRef.current = false;
        }
      }, 100);
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [syncMapCoordinates, hotspots, stations, schools]);

  // Synchronize externally provided inspectedLocation
  useEffect(() => {
    if (propsInspectedLocation !== undefined) {
      setLocalInspected(propsInspectedLocation);
      if (propsInspectedLocation && mapInstanceRef.current) {
        const pt = mapInstanceRef.current.latLngToContainerPoint([
          propsInspectedLocation.lat,
          propsInspectedLocation.lon,
        ]);
        setInspectedScreenPos({ sx: pt.x, sy: pt.y });
      } else if (!propsInspectedLocation) {
        setInspectedScreenPos(null);
      }
    }
  }, [propsInspectedLocation]);

  // Interactive Map Click: Evaluate physics-informed spatial estimate anywhere in Delhi NCR
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const handleMapClick = (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      const inspected = inspectMapCoordinate(
        lat,
        lng,
        hourOffset,
        windSpeedKmh,
        windDirectionDeg,
        hotspots,
        stations
      );
      setLocalInspected(inspected);
      if (onInspectLocation) {
        onInspectLocation(inspected);
      }
      setActivePin(null);
      setActiveStationData(null);
      setActiveSchoolData(null);

      const pt = map.latLngToContainerPoint([inspected.lat, inspected.lon]);
      setInspectedScreenPos({ sx: pt.x, sy: pt.y });
    };

    map.on('click', handleMapClick);
    return () => {
      map.off('click', handleMapClick);
    };
  }, [hourOffset, windSpeedKmh, windDirectionDeg, hotspots, stations, onInspectLocation]);

  // Three.js Atmospheric Physics WebGL Shader Setup (Layer 2)
  useEffect(() => {
    if (!containerRef.current || !canvasRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    const scene = new THREE.Scene();
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

    const transportRad = (((windDirectionDeg + 180) % 360) * Math.PI) / 180;
    const windVec = new THREE.Vector2(Math.sin(transportRad), -Math.cos(transportRad));

    const initialZoom = mapInstanceRef.current ? mapInstanceRef.current.getZoom() : 11.0;
    const initialMpp = (40075016.686 * Math.cos((28.61 * Math.PI) / 180)) / (256 * Math.pow(2, initialZoom));
    const initialBounds = mapInstanceRef.current
      ? mapInstanceRef.current.getBounds()
      : L.latLngBounds([28.25, 76.75], [28.95, 77.60]);

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
      u_map_bounds: {
        value: new THREE.Vector4(
          initialBounds.getSouth(),
          initialBounds.getWest(),
          initialBounds.getNorth(),
          initialBounds.getEast()
        ),
      },
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
      uniform vec4 u_map_bounds;

      varying vec2 vUv;

      // 7-Tier Scientific Dark-Map Palette
      vec4 evaluateContinuousPollutionColor(float pmVal) {
        vec3 cVLow  = vec3(0.098, 0.280, 0.210); // #18382E Deep Forest Emerald (enhanced visibility)
        vec3 cLow   = vec3(0.184, 0.495, 0.350); // #2F7656 Muted Green (enhanced visibility)
        vec3 cMod   = vec3(0.604, 0.671, 0.333); // #9AAB55 Muted Olive / Sage
        vec3 cElev  = vec3(0.824, 0.639, 0.302); // #D2A34D Muted Amber
        vec3 cHigh  = vec3(0.906, 0.478, 0.263); // #E77A43 Rust Orange
        vec3 cVHigh = vec3(0.851, 0.306, 0.286); // #D94E49 Crimson / Coral
        vec3 cExt   = vec3(0.518, 0.184, 0.263); // #842F43 Dark Burgundy / Plum

        vec3 rgb;
        float alpha;

        if (pmVal <= 30.0) {
          float t = clamp(pmVal / 30.0, 0.0, 1.0);
          rgb = mix(cVLow * 0.95, cVLow, t);
          alpha = mix(0.44, 0.48, t);
        } else if (pmVal <= 60.0) {
          float t = (pmVal - 30.0) / 30.0;
          rgb = mix(cVLow, cLow, t);
          alpha = mix(0.48, 0.54, t);
        } else if (pmVal <= 100.0) {
          float t = (pmVal - 60.0) / 40.0;
          rgb = mix(cLow, cMod, t);
          alpha = mix(0.54, 0.60, t);
        } else if (pmVal <= 160.0) {
          float t = (pmVal - 100.0) / 60.0;
          rgb = mix(cMod, cElev, t);
          alpha = mix(0.60, 0.66, t);
        } else if (pmVal <= 240.0) {
          float t = (pmVal - 160.0) / 80.0;
          rgb = mix(cElev, cHigh, t);
          alpha = mix(0.66, 0.72, t);
        } else if (pmVal <= 320.0) {
          float t = (pmVal - 240.0) / 80.0;
          rgb = mix(cHigh, cVHigh, t);
          alpha = mix(0.72, 0.78, t);
        } else {
          float t = clamp((pmVal - 320.0) / 100.0, 0.0, 1.0);
          rgb = mix(cVHigh, cExt, t);
          alpha = mix(0.78, 0.84, t);
        }

        return vec4(rgb, alpha);
      }

      void main() {
        if (u_layer_visible < 0.5) {
          gl_FragColor = vec4(0.0);
          return;
        }

        // 1. Recover Geographic Coordinates from Mercator UV and Bounds
        float fragLat = mix(u_map_bounds.x, u_map_bounds.z, vUv.y);
        float fragLon = mix(u_map_bounds.y, u_map_bounds.w, vUv.x);
        vec2 fragPix = vec2(vUv.x * u_resolution.x, (1.0 - vUv.y) * u_resolution.y);

        // 2. Delhi NCR Domain Bounds [28.25 - 28.95] x [76.75 - 77.60]
        bool isInsideDomain = (fragLat >= 28.25 && fragLat <= 28.95 && fragLon >= 76.75 && fragLon <= 77.60);

        if (!isInsideDomain) {
          // MISSING / INSUFFICIENT MODEL COVERAGE:
          // Subtle neutral charcoal with fine diagonal hatching pattern
          float hatchCoord = (fragPix.x + fragPix.y) * 0.16;
          float hatchPattern = step(0.70, fract(hatchCoord));
          vec3 bgNoData = vec3(0.045, 0.055, 0.070);     // Neutral charcoal background
          vec3 hatchColor = vec3(0.095, 0.115, 0.145);   // Subtle lighter charcoal diagonal hatch
          vec3 finalNoDataColor = mix(bgNoData, hatchColor, hatchPattern);
          gl_FragColor = vec4(finalNoDataColor, 0.52);
          return;
        }

        vec2 fragPix = vec2(vUv.x * u_resolution.x, (1.0 - vUv.y) * u_resolution.y);
        vec2 wDir = normalize(u_wind);
        vec2 wPerp = vec2(-wDir.y, wDir.x);

        float diurnalMod = 0.92 + 0.22 * sin((u_hour_offset - 8.0) * 0.26);

        // 3. Regional Background Ventilation (cleaner in SW, hazier in North)
        float etaLat = clamp((fragLat - 28.25) / 0.70, 0.0, 1.0);
        float bgConcentration = (26.0 + 14.0 * etaLat) * diurnalMod;

        // 4. Upstream NW Biomass Advection Tongue (entry: 28.85°N, 77.02°E)
        float nwLat = 28.85;
        float nwLon = 77.02;
        float dyEntryM = (fragLat - nwLat) * 111139.0;
        float dxEntryM = (fragLon - nwLon) * 111139.0 * cos(radians(fragLat));

        float dDownSmoke = dxEntryM * wDir.x + dyEntryM * wDir.y;
        float dCrossSmoke = -dxEntryM * wDir.y + dyEntryM * wDir.x;

        float sigmaCrossSmoke = 9500.0 + 0.18 * max(dDownSmoke, 0.0);
        float crossDecay = exp(-0.5 * (dCrossSmoke / max(sigmaCrossSmoke, 500.0)) * (dCrossSmoke / max(sigmaCrossSmoke, 500.0)));

        float longDecay = 1.0;
        if (dDownSmoke < 0.0) {
          longDecay = exp(-0.5 * (dDownSmoke / 6000.0) * (dDownSmoke / 6000.0));
        } else {
          longDecay = 1.0 / (1.0 + dDownSmoke / 45000.0);
        }

        float smokeAmplitude = 65.0 * diurnalMod * max(u_wind_speed, 0.5);
        float smokeConcentration = smokeAmplitude * crossDecay * longDecay;

        // 5. Urban Hotspot Plumes
        float maxUrban = 0.0;
        float sumUrban = 0.0;

        for (int i = 0; i < 16; i++) {
          if (i >= u_num_hotspots) break;

          vec2 hScreen = vec2(
            u_hotspot_screen_positions[i].x * u_resolution.x,
            (1.0 - u_hotspot_screen_positions[i].y) * u_resolution.y
          );

          vec2 dPix = fragPix - hScreen;
          vec2 dMeters = dPix * u_meters_per_pixel;

          float dDownwind = dot(dMeters, wDir);
          float dCrosswind = dot(dMeters, wPerp);

          // Core (1350m)
          float sigmaCoreDown = 1350.0;
          float sigmaCoreCross = 900.0;
          if (dDownwind > 0.0) {
            sigmaCoreDown += u_wind_speed * 1200.0 * 0.30;
          } else {
            sigmaCoreDown *= 0.65;
          }
          float rCoreDown = dDownwind / max(sigmaCoreDown, 80.0);
          float rCoreCross = dCrosswind / max(sigmaCoreCross, 80.0);
          float distSqCore = rCoreDown * rCoreDown + rCoreCross * rCoreCross;

          // Halo (3200m)
          float sigmaHaloDown = 3200.0;
          float sigmaHaloCross = 2200.0;
          if (dDownwind > 0.0) {
            sigmaHaloDown += u_wind_speed * 1800.0 * 0.55;
            sigmaHaloCross += dDownwind * 0.14;
          } else {
            sigmaHaloDown *= 0.60;
          }
          float rHaloDown = dDownwind / max(sigmaHaloDown, 120.0);
          float rHaloCross = dCrosswind / max(sigmaHaloCross, 120.0);
          float distSqHalo = rHaloDown * rHaloDown + rHaloCross * rHaloCross;

          if (distSqCore > 9.0 && distSqHalo > 9.0) continue;

          float basePm = u_hotspot_intensities[i] * diurnalMod;
          float cCore = basePm * 0.75 * exp(-0.5 * distSqCore);
          float cHalo = basePm * 0.25 * exp(-0.5 * distSqHalo);
          float cPoint = cCore + cHalo;

          maxUrban = max(maxUrban, cPoint);
          sumUrban += cPoint;
        }

        float urbanConcentration = maxUrban + 0.22 * (sumUrban - maxUrban);

        float finalConcentration = 0.0;
        if (u_vis_mode > 0.5) {
          finalConcentration = bgConcentration + smokeConcentration + urbanConcentration;
        } else {
          finalConcentration = urbanConcentration + 0.35 * (bgConcentration + smokeConcentration);
        }

        gl_FragColor = evaluateContinuousPollutionColor(finalConcentration);
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
    const quad = new THREE.Mesh(geometry, material);
    scene.add(quad);

    const clock = new THREE.Clock();

    const animate = () => {
      if (threeRef.current) {
        material.uniforms.u_time.value = clock.getElapsedTime();
        renderer.render(scene, camera);
        threeRef.current.reqId = requestAnimationFrame(animate);
      }
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
      if (mapInstanceRef.current) {
        const bounds = mapInstanceRef.current.getBounds();
        threeRef.current.material.uniforms.u_map_bounds.value.set(
          bounds.getSouth(),
          bounds.getWest(),
          bounds.getNorth(),
          bounds.getEast()
        );
      }
    }
  }, [windDirectionDeg, windSpeedKmh, hourOffset, layers.pollution, visMode]);

  // =========================================================================
  // LAYER 5: GEOGRAPHIC ATMOSPHERIC PARTICLE ADVECTION ENGINE
  // =========================================================================
  useEffect(() => {
    const canvas = particleCanvasRef.current;
    if (!canvas || !layers.particles) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let lastTime = performance.now();
    let isPaused = false;

    // Determine target particle budget based on zoom and density setting
    const getTargetCount = (zoom: number, density: 'auto' | 'low' | 'medium' | 'high'): number => {
      let base = 750;
      if (zoom <= 10) base = 420;
      else if (zoom <= 12) base = 850;
      else if (zoom <= 14) base = 1350;
      else base = 1800;

      if (density === 'low') return Math.round(base * 0.55);
      if (density === 'high') return Math.round(base * 1.45);
      return base;
    };

    // Meteorological wind transport direction
    const transportRad = (((windDirectionDeg + 180) % 360) * Math.PI) / 180;
    const speedMps = Math.max((windSpeedKmh * 1000) / 3600, 1.2);
    const uBase = speedMps * Math.sin(transportRad);
    const vBase = speedMps * Math.cos(transportRad);
    const unitWDirX = Math.sin(transportRad);
    const unitWDirY = Math.cos(transportRad);

    // Evaluates local concentration at any geographic coordinate using continuous physics engine
    const sampleConcentration = (lat: number, lon: number): number => {
      const res = evaluateContinuousField(
        lat,
        lon,
        hourOffset,
        windSpeedKmh,
        windDirectionDeg,
        hotspots
      );
      return res.pm25 ?? 0;
    };

    // Precompute roulette sampling weights for hotspots: W_i = (pm25 / 100)^1.8
    const hotspotWeights = hotspots.map((h) => Math.pow(Math.max(h.pm25, 30) / 100.0, 1.8));
    const totalHotspotWeight = hotspotWeights.reduce((a, b) => a + b, 0);

    const pickWeightedHotspot = (): HotspotData => {
      let r = Math.random() * totalHotspotWeight;
      for (let i = 0; i < hotspots.length; i++) {
        if (r < hotspotWeights[i]) return hotspots[i];
        r -= hotspotWeights[i];
      }
      return hotspots[0];
    };

    // Color mapper for atmospheric particulate matter (aligned with 7-tier scientific palette)
    const getParticleColor = (pmVal: number, alpha: number) => {
      if (pmVal <= 30) {
        // Very low: deep forest emerald
        return {
          stroke: `rgba(47, 118, 86, ${alpha * 0.45})`,
          fill: `rgba(47, 118, 86, ${alpha * 0.60})`,
        };
      } else if (pmVal <= 60) {
        // Low: muted green
        return {
          stroke: `rgba(91, 197, 152, ${alpha * 0.45})`,
          fill: `rgba(91, 197, 152, ${alpha * 0.60})`,
        };
      } else if (pmVal <= 100) {
        // Moderate: olive / sage
        return {
          stroke: `rgba(181, 199, 104, ${alpha * 0.55})`,
          fill: `rgba(181, 199, 104, ${alpha * 0.70})`,
        };
      } else if (pmVal <= 160) {
        // Elevated: muted amber
        return {
          stroke: `rgba(229, 184, 99, ${alpha * 0.65})`,
          fill: `rgba(229, 184, 99, ${alpha * 0.80})`,
        };
      } else if (pmVal <= 240) {
        // High: rust orange
        return {
          stroke: `rgba(240, 142, 88, ${alpha * 0.75})`,
          fill: `rgba(240, 142, 88, ${alpha * 0.88})`,
        };
      } else if (pmVal <= 320) {
        // Very High: crimson
        return {
          stroke: `rgba(230, 99, 95, ${alpha * 0.82})`,
          fill: `rgba(230, 99, 95, ${alpha * 0.95})`,
        };
      } else {
        // Extreme: dark burgundy
        return {
          stroke: `rgba(178, 69, 95, ${alpha * 0.90})`,
          fill: `rgba(178, 69, 95, ${alpha * 0.98})`,
        };
      }
    };

    // Spawn a particle either accumulating inside a hotspot core or within current bounds
    const spawnParticle = (p: AdvectionParticle, mapBounds?: L.LatLngBounds) => {
      let lat = 28.6139;
      let lon = 77.2090;

      // 78% probability: sample from elevated pollution regions proportional to f(C(x))
      if (Math.random() < 0.78 && hotspots.length > 0) {
        const targetHotspot = pickWeightedHotspot();
        const isCoreInflow = Math.random() < 0.72;

        let dxM = 0;
        let dyM = 0;

        if (isCoreInflow) {
          // Particles spawn slightly upstream of the core and traverse directly through the center
          const upwindDist = 180.0 + Math.random() * 820.0;
          const crossDist = (Math.random() - 0.5) * 1100.0;
          dxM = -unitWDirX * upwindDist + (-unitWDirY) * crossDist;
          dyM = -unitWDirY * upwindDist + unitWDirX * crossDist;
        } else {
          // Particles spawn along the downwind halo plume tail
          const downwindDist = 750.0 + Math.random() * 3200.0;
          const crossDist = (Math.random() - 0.5) * 2000.0;
          dxM = unitWDirX * downwindDist + (-unitWDirY) * crossDist;
          dyM = unitWDirY * downwindDist + unitWDirX * crossDist;
        }

        lat = targetHotspot.lat + dyM / 111139.0;
        lon = targetHotspot.lon + dxM / (111139.0 * Math.cos((targetHotspot.lat * Math.PI) / 180.0));
      } else if (mapBounds) {
        // 22% probability: sample uniformly across viewport bounds for atmospheric context
        const south = mapBounds.getSouth();
        const north = mapBounds.getNorth();
        const west = mapBounds.getWest();
        const east = mapBounds.getEast();

        lat = south + Math.random() * (north - south);
        lon = west + Math.random() * (east - west);
      }

      p.lat = lat;
      p.lon = lon;
      p.age = 0;
      p.maxAge = 1.8 + Math.random() * 2.8;
      p.speedScale = 0.85 + Math.random() * 0.30;
      p.scaleType = Math.random() < 0.28 ? 1 : 0; // 28% medium filaments, 72% fine points
      p.history = [[lat, lon]];
    };

    // Pre-allocate particle pool
    const targetCount = getTargetCount(currentZoom, particleDensity);
    const particles: AdvectionParticle[] = [];
    const initialBounds = mapInstanceRef.current ? mapInstanceRef.current.getBounds() : undefined;

    for (let i = 0; i < targetCount; i++) {
      const p: AdvectionParticle = {
        lat: 28.61,
        lon: 77.21,
        age: 0,
        maxAge: 2.0,
        speedScale: 1.0,
        scaleType: 0,
        history: [],
      };
      spawnParticle(p, initialBounds);
      // Stagger initial ages so particles do not respawn in sync
      p.age = Math.random() * p.maxAge;
      particles.push(p);
    }

    // Check for user reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Listen to tab visibility to prevent jumps
    const handleVisibility = () => {
      if (document.hidden) {
        isPaused = true;
      } else {
        isPaused = false;
        lastTime = performance.now();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    // Main particle advection rendering loop
    const renderParticles = (now: number) => {
      const map = mapInstanceRef.current;
      if (!map || isPaused) {
        animId = requestAnimationFrame(renderParticles);
        return;
      }

      const w = canvas.parentElement?.clientWidth || 800;
      const h = canvas.parentElement?.clientHeight || 600;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }

      // Delta time in seconds (clamped to max 50ms)
      const dt = Math.min((now - lastTime) / 1000.0, 0.05);
      lastTime = now;

      ctx.clearRect(0, 0, w, h);

      const mapBounds = map.getBounds();
      const zoom = map.getZoom();
      const currentTargetCount = getTargetCount(zoom, particleDensity);

      // Adjust particle pool dynamically if zoom changed
      while (particles.length < currentTargetCount) {
        const p: AdvectionParticle = {
          lat: 28.61,
          lon: 77.21,
          age: 0,
          maxAge: 2.0,
          speedScale: 1.0,
          scaleType: 0,
          history: [],
        };
        spawnParticle(p, mapBounds);
        particles.push(p);
      }
      if (particles.length > currentTargetCount) {
        particles.length = currentTargetCount;
      }

      // Maximum history points based on zoom
      const maxHistory = zoom >= 14 ? 8 : zoom >= 12 ? 6 : 4;
      // Advection visual multiplier (meters/second in animation time)
      const visualSpeedMultiplier = 110.0;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        if (!prefersReducedMotion) {
          // Local wind with topographic deflection
          const uLocal = uBase * (1.0 + 0.12 * Math.cos((p.lon - 77.22) * 15.0));
          const vLocal = vBase * (1.0 + 0.08 * Math.sin((p.lat - 28.61) * 12.0));

          // Physical advection in geodesic space (meters -> degrees)
          const dxM = uLocal * dt * p.speedScale * visualSpeedMultiplier;
          const dyM = vLocal * dt * p.speedScale * visualSpeedMultiplier;

          const dLat = (dyM / 6371000.0) * (180.0 / Math.PI);
          const dLon = (dxM / (6371000.0 * Math.cos((p.lat * Math.PI) / 180.0))) * (180.0 / Math.PI);

          p.lat += dLat;
          p.lon += dLon;
          p.age += dt;

          // History trail accumulation
          p.history.push([p.lat, p.lon]);
          if (p.history.length > maxHistory) {
            p.history.shift();
          }

          // Respawn expired or out-of-bounds particles
          if (p.age >= p.maxAge || !mapBounds.pad(0.3).contains([p.lat, p.lon])) {
            spawnParticle(p, mapBounds);
            continue;
          }
        }

        // Project particle head to container pixel space
        const headPt = map.latLngToContainerPoint([p.lat, p.lon]);
        if (headPt.x < -40 || headPt.x > w + 40 || headPt.y < -40 || headPt.y > h + 40) {
          continue;
        }

        // Evaluate local concentration for scientific opacity and palette
        const localPm = sampleConcentration(p.lat, p.lon);
        const lifeEnvelope = Math.sin((p.age / p.maxAge) * Math.PI);
        const baseAlpha = lifeEnvelope * (localPm >= 30 ? 0.75 : 0.35);
        const color = getParticleColor(localPm, baseAlpha);

        // Render Trail
        if (p.history.length >= 2) {
          ctx.beginPath();
          const firstPt = map.latLngToContainerPoint(p.history[0]);
          ctx.moveTo(firstPt.x, firstPt.y);

          for (let hIdx = 1; hIdx < p.history.length; hIdx++) {
            const hPt = map.latLngToContainerPoint(p.history[hIdx]);
            ctx.lineTo(hPt.x, hPt.y);
          }

          ctx.lineWidth = p.scaleType === 1 ? (zoom >= 13 ? 1.4 : 1.1) : (zoom >= 13 ? 0.9 : 0.7);
          ctx.strokeStyle = color.stroke;
          ctx.stroke();
        }

        // Render Particle Head
        const headRadius = p.scaleType === 1
          ? (zoom >= 14 ? 1.9 : zoom >= 12 ? 1.4 : 1.1)
          : (zoom >= 14 ? 1.4 : zoom >= 12 ? 1.0 : 0.8);

        ctx.beginPath();
        ctx.arc(headPt.x, headPt.y, headRadius, 0, Math.PI * 2);
        ctx.fillStyle = color.fill;
        ctx.fill();
      }

      animId = requestAnimationFrame(renderParticles);
    };

    animId = requestAnimationFrame(renderParticles);

    return () => {
      cancelAnimationFrame(animId);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [hotspots, windDirectionDeg, windSpeedKmh, hourOffset, layers.particles, particleDensity, currentZoom]);

  // =========================================================================
  // LAYER 4: 2D WIND STREAMLINES (Cyan directional lines)
  // =========================================================================
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
    const speedFactor = Math.max(windSpeedKmh / 10.0, 0.7);
    const dx = Math.sin(transportRad) * speedFactor * 1.5;
    const dy = -Math.cos(transportRad) * speedFactor * 1.5;

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
      ctx.lineWidth = 1.2;

      for (let i = 0; i < numParticles; i++) {
        const p = particles[i];
        p.life++;
        if (p.life > p.maxLife || p.x < 0 || p.x > w || p.y < 0 || p.y > h) {
          p.x = Math.random() * w;
          p.y = Math.random() * h;
          p.life = 0;
        }

        const alpha = Math.sin((p.life / p.maxLife) * Math.PI) * 0.40;
        ctx.strokeStyle = `rgba(39, 211, 226, ${alpha})`;
        ctx.fillStyle = `rgba(39, 211, 226, ${alpha})`;

        const headX = p.x + dx * 2.8;
        const headY = p.y + dy * 2.8;

        // Draw streamline
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(headX, headY);
        ctx.stroke();

        // Visible moving directional arrowhead at streamline head
        if (p.life > 12 && p.life < p.maxLife - 8) {
          const angle = Math.atan2(dy, dx);
          const arrowSize = 4.8;
          ctx.beginPath();
          ctx.moveTo(headX, headY);
          ctx.lineTo(
            headX - arrowSize * Math.cos(angle - Math.PI / 5.5),
            headY - arrowSize * Math.sin(angle - Math.PI / 5.5)
          );
          ctx.lineTo(
            headX - arrowSize * Math.cos(angle + Math.PI / 5.5),
            headY - arrowSize * Math.sin(angle + Math.PI / 5.5)
          );
          ctx.closePath();
          ctx.fill();
        }

        p.x += dx * 0.75;
        p.y += dy * 0.75;
      }

      // =====================================================================
      // ZOOM-ADAPTIVE TRANSPORT ARROWS (Dominant Regional & Local Corridors)
      // =====================================================================
      const currentMapZoom = mapInstanceRef.current ? mapInstanceRef.current.getZoom() : currentZoom;
      const transDeg = ((windDirectionDeg + 180) % 360);
      const transRad = (transDeg * Math.PI) / 180;
      // Screen-space displacement unit vector (dx East/right, dy South/down)
      const uDir = Math.sin(transRad);
      const vDir = -Math.cos(transRad);
      const arrowPhi = Math.atan2(vDir, uDir);
      const now = performance.now();

      TRANSPORT_CORRIDORS.forEach((corridor) => {
        let opacity = 0;
        let shaftLen = 0;
        let shaftWidth = 0;
        let headSize = 0;

        if (corridor.tier === 'regional') {
          // Regional arrows: dominant at zoom <= 10.5, fade out by zoom 12.8
          if (currentMapZoom <= 10.5) {
            opacity = 0.95;
            shaftLen = 88;
            shaftWidth = 3.6;
            headSize = 19;
          } else if (currentMapZoom <= 11.5) {
            const t = (currentMapZoom - 10.5) / 1.0;
            opacity = 0.95 - t * 0.35; // 0.95 -> 0.60
            shaftLen = 88 - t * 26;    // 88 -> 62
            shaftWidth = 3.6 - t * 0.8;
            headSize = 19 - t * 5;
          } else if (currentMapZoom <= 12.8) {
            const t = (currentMapZoom - 11.5) / 1.3;
            opacity = 0.60 - t * 0.60; // 0.60 -> 0.0
            shaftLen = 62 - t * 20;
            shaftWidth = 2.8 - t * 0.8;
            headSize = 14 - t * 4;
          } else {
            opacity = 0;
          }
        } else {
          // Local corridors: active at city zoom (11.5 - 13.8), fade out by zoom 14
          if (currentMapZoom < 11.5) {
            opacity = 0;
          } else if (currentMapZoom <= 12.5) {
            const t = (currentMapZoom - 11.5) / 1.0;
            opacity = t * 0.85;        // 0 -> 0.85
            shaftLen = 42 + t * 14;    // 42 -> 56
            shaftWidth = 2.4;
            headSize = 12;
          } else if (currentMapZoom <= 13.8) {
            const t = (currentMapZoom - 12.5) / 1.3;
            opacity = 0.85 - t * 0.85; // 0.85 -> 0.0
            shaftLen = 56 - t * 18;
            shaftWidth = 2.4 - t * 0.6;
            headSize = 12 - t * 3;
          } else {
            opacity = 0;
          }
        }

        if (opacity <= 0.02 || !mapInstanceRef.current) return;

        // Project geographically anchored coordinates
        const cPt = mapInstanceRef.current.latLngToContainerPoint([corridor.lat, corridor.lon]);
        if (cPt.x < -120 || cPt.x > w + 120 || cPt.y < -120 || cPt.y > h + 120) {
          return;
        }

        const halfLen = shaftLen / 2;
        const startX = cPt.x - uDir * halfLen;
        const startY = cPt.y - vDir * halfLen;
        const endX = cPt.x + uDir * halfLen;
        const endY = cPt.y + vDir * halfLen;

        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // 1. Dark high-contrast halo under shaft & arrowhead
        ctx.strokeStyle = `rgba(8, 11, 15, ${opacity * 0.95})`;
        ctx.lineWidth = shaftWidth + 4.5;
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();

        ctx.fillStyle = `rgba(8, 11, 15, ${opacity * 0.95})`;
        ctx.beginPath();
        ctx.moveTo(endX + uDir * 3, endY + vDir * 3);
        ctx.lineTo(
          endX - headSize * Math.cos(arrowPhi - Math.PI / 5.2),
          endY - headSize * Math.sin(arrowPhi - Math.PI / 5.2)
        );
        ctx.lineTo(
          endX - headSize * 0.52 * Math.cos(arrowPhi),
          endY - headSize * 0.52 * Math.sin(arrowPhi)
        );
        ctx.lineTo(
          endX - headSize * Math.cos(arrowPhi + Math.PI / 5.2),
          endY - headSize * Math.sin(arrowPhi + Math.PI / 5.2)
        );
        ctx.closePath();
        ctx.fill();

        // 2. Luminous Cyan Shaft
        ctx.strokeStyle = `rgba(39, 211, 226, ${opacity * 0.92})`;
        ctx.lineWidth = shaftWidth;
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();

        // 3. Traveling Light Pulse along shaft
        const pulseCycle = ((now * 0.0016) % 1.0);
        const pulseX = startX + (endX - startX) * pulseCycle;
        const pulseY = startY + (endY - startY) * pulseCycle;
        ctx.strokeStyle = `rgba(255, 255, 255, ${opacity * 0.88})`;
        ctx.lineWidth = shaftWidth * 1.3;
        ctx.beginPath();
        ctx.moveTo(pulseX - uDir * 7, pulseY - vDir * 7);
        ctx.lineTo(pulseX + uDir * 7, pulseY + vDir * 7);
        ctx.stroke();

        // 4. Sharp Aerodynamic Arrowhead
        ctx.fillStyle = `rgba(39, 211, 226, ${opacity * 0.95})`;
        ctx.beginPath();
        ctx.moveTo(endX, endY);
        ctx.lineTo(
          endX - (headSize - 1) * Math.cos(arrowPhi - Math.PI / 5.5),
          endY - (headSize - 1) * Math.sin(arrowPhi - Math.PI / 5.5)
        );
        ctx.lineTo(
          endX - (headSize - 1) * 0.52 * Math.cos(arrowPhi),
          endY - (headSize - 1) * 0.52 * Math.sin(arrowPhi)
        );
        ctx.lineTo(
          endX - (headSize - 1) * Math.cos(arrowPhi + Math.PI / 5.5),
          endY - (headSize - 1) * Math.sin(arrowPhi + Math.PI / 5.5)
        );
        ctx.closePath();
        ctx.fill();

        // 5. Regional Metadata Badge (zoom <= 11.2)
        if (corridor.tier === 'regional' && currentMapZoom <= 11.2 && opacity > 0.35) {
          const badgeText = `${lang === 'hi' ? corridor.label_hi : corridor.label_en} · ${Math.round(windSpeedKmh)} km/h → SE`;
          ctx.font = '600 9px Mukta, sans-serif';
          const tm = ctx.measureText(badgeText);
          const bW = tm.width + 14;
          const bH = 17;
          const bX = cPt.x - bW / 2;
          const bY = cPt.y - 22;

          ctx.fillStyle = `rgba(11, 15, 20, ${opacity * 0.88})`;
          ctx.strokeStyle = `rgba(39, 211, 226, ${opacity * 0.45})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          if (ctx.roundRect) {
            ctx.roundRect(bX, bY, bW, bH, 3);
          } else {
            ctx.rect(bX, bY, bW, bH);
          }
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = `rgba(241, 245, 249, ${opacity * 0.95})`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(badgeText, cPt.x, bY + bH / 2);
        }

        ctx.restore();
      });

      animId = requestAnimationFrame(renderWind);
    };

    animId = requestAnimationFrame(renderWind);
    return () => cancelAnimationFrame(animId);
  }, [windDirectionDeg, windSpeedKmh, layers.wind, currentZoom, lang]);

  // Reset to Delhi NCR extent
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

  // Helper: compute periods for selected school popup
  const computePopupPeriods = (sc: School): SchoolPeriodVerdict[] => {
    const schoolBasePm = (() => {
      const match = stations.find((s) => s.id === sc.nearest_station_id);
      return match ? match.current_obs_pm25 : 200;
    })();

    const periods = [
      { id: 'arrival', time: '07:30 - 08:30', name_en: 'Morning Arrival', name_hi: 'सुबह आगमन', factor: 1.18 },
      { id: 'assembly', time: '08:30 - 09:00', name_en: 'Assembly', name_hi: 'प्रार्थना सभा', factor: 1.12 },
      { id: 'pe', time: '10:30 - 12:00', name_en: 'Recess / PE', name_hi: 'खेल कूद', factor: 0.92 },
      { id: 'dispersal', time: '14:00 - 15:00', name_en: 'Dispersal', name_hi: 'छुट्टी', factor: 0.85 },
    ];

    return periods.map((p) => {
      const fVal = Math.round(schoolBasePm * p.factor * (1 + (hourOffset / 48) * 0.15));
      const v: 'go' | 'limit' | 'skip' = fVal > 220 ? 'skip' : fVal > 110 ? 'limit' : 'go';
      const cat = getCategoryForPm(fVal);
      return {
        period_id: p.id,
        time: p.time,
        name_en: p.name_en,
        name_hi: p.name_hi,
        forecast_pm25: fVal,
        verdict: v,
        category: cat.label,
      };
    });
  };

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
      {/* 1. Underlying Leaflet Interactive Map Container (Layer 1) */}
      <div ref={mapContainerRef} style={{ width: '100%', height: '100%', zIndex: 1 }} />

      {/* 2. WebGL Pollution Concentration Field (Layer 2) */}
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

      {/* 3. Fine-Grained Atmospheric Particle Advection Canvas (Layer 5) */}
      {layers.particles && (
        <canvas
          ref={particleCanvasRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            zIndex: 14,
          }}
        />
      )}

      {/* 4. Cyan Directional Wind Streamlines Canvas (Layer 4) */}
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
            zIndex: 16,
          }}
        />
      )}

      {/* 5. Real CPCB / DPCC Monitoring Stations Layer (Layer 6a) */}
      {layers.stations && (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 22 }}>
          {stationScreenCoords.map(({ id, sx, sy, data }) => {
            const w = containerRef.current?.clientWidth || 800;
            const h = containerRef.current?.clientHeight || 600;
            if (sx < 10 || sx > w - 10 || sy < 10 || sy > h - 10) return null;

            const isSelected = selectedStationId === id || activeStationData?.id === id;
            const catInfo = getCategoryForPm(data.current_obs_pm25);

            return (
              <div
                key={`st-${id}`}
                className={`station-marker ${isSelected ? 'active' : ''}`}
                style={{ left: `${sx}px`, top: `${sy}px` }}
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveStationData(data);
                  setActivePin(null);
                  setActiveSchoolData(null);
                  setLocalInspected(null);
                  setInspectedScreenPos(null);
                  if (onInspectLocation) onInspectLocation(null);
                  if (onSelectStation) onSelectStation(id);
                  if (onSelectLocality) onSelectLocality(id);
                  if (mapInstanceRef.current) {
                    const targetZoom = Math.max(mapInstanceRef.current.getZoom(), 13);
                    mapInstanceRef.current.flyTo([data.lat, data.lon], targetZoom, { duration: 0.8 });
                  }
                }}
                title={`${data.station_name} · Measured: ${data.current_obs_pm25} µg/m³`}
              >
                <div className="station-marker-ring">
                  <div className="station-marker-dot" style={{ background: catInfo.color }} />
                </div>
                {currentZoom >= 11 && (
                  <span className="station-marker-label">
                    {data.agency}: {data.current_obs_pm25}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 6. Authentic Delhi Schools Layer (Layer 6b) */}
      {layers.schools && (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 24 }}>
          {schoolScreenCoords.map(({ id, sx, sy, data }) => {
            const w = containerRef.current?.clientWidth || 800;
            const h = containerRef.current?.clientHeight || 600;
            if (sx < 10 || sx > w - 10 || sy < 10 || sy > h - 10) return null;

            const isSelected = selectedSchoolId === id || activeSchoolData?.id === id;

            // Zoom filter: Show all at zoom >= 12, major institutions at lower zoom
            const isMajor = ['dps_rk_puram', 'modern_school_barakhamba', 'sanskriti_chanakyapuri', 'dps_dwarka', 'dav_shreshtha_vihar'].includes(id);
            if (currentZoom < 11 && !isMajor && !isSelected) return null;

            return (
              <div
                key={`sc-${id}`}
                className={`school-marker ${isSelected ? 'active' : ''}`}
                style={{ left: `${sx}px`, top: `${sy}px` }}
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveSchoolData(data);
                  setActivePin(null);
                  setActiveStationData(null);
                  setLocalInspected(null);
                  setInspectedScreenPos(null);
                  if (onInspectLocation) onInspectLocation(null);
                  if (onSelectSchool) onSelectSchool(id);
                  if (mapInstanceRef.current) {
                    const targetZoom = Math.max(mapInstanceRef.current.getZoom(), 13);
                    mapInstanceRef.current.flyTo([data.lat, data.lon], targetZoom, { duration: 0.8 });
                  }
                }}
                title={`${data.name_en} (${data.student_count.toLocaleString()} students)`}
              >
                <div className="school-marker-box">
                  <SchoolIcon size={11} color="var(--accent-cyan)" />
                </div>
                {currentZoom >= 12 && (
                  <span className="school-marker-label">
                    {lang === 'hi' ? data.name_hi : data.name_en.split(',')[0]}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 7. Inferred Model Hotspot Plumes Layer (Layer 3) */}
      {layers.hotspots && (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 26 }}>
          {pinScreenCoords.map(({ id, sx, sy, data }) => {
            const w = containerRef.current?.clientWidth || 800;
            const h = containerRef.current?.clientHeight || 600;
            if (sx < 10 || sx > w - 10 || sy < 10 || sy > h - 10) return null;

            const isMajorNode = ['anand_vihar', 'bawana', 'punjabi_bagh', 'okhla', 'dwarka'].includes(id);
            const isSelected = activePin?.id === id || selectedHotspotId === id;
            if (currentZoom < 11 && !isMajorNode && !isSelected) {
              return null;
            }

            const forecastVal = getHotspotForecastVal(data.pm25, hourOffset);
            const catInfo = getCategoryForPm(forecastVal);

            return (
              <div
                key={`hp-${id}`}
                className={`hotspot-pill-marker ${isSelected ? 'active' : ''}`}
                style={{ left: `${sx}px`, top: `${sy}px` }}
                onClick={(e) => {
                  e.stopPropagation();
                  setActivePin(data);
                  setActiveStationData(null);
                  setActiveSchoolData(null);
                  setLocalInspected(null);
                  setInspectedScreenPos(null);
                  if (onInspectLocation) onInspectLocation(null);
                  if (onSelectHotspot) onSelectHotspot(id);
                  if (onSelectLocality) onSelectLocality(id);
                  if (mapInstanceRef.current) {
                    const targetZoom = Math.max(mapInstanceRef.current.getZoom(), 13);
                    mapInstanceRef.current.flyTo([data.lat, data.lon], targetZoom, { duration: 0.8 });
                  }
                }}
              >
                <span className="hotspot-marker-dot" style={{ background: catInfo.color }} />
                <span>{lang === 'hi' ? data.name_hi : data.name_en}</span>
                {currentZoom >= 11 && (
                  <span className="hotspot-marker-val">{forecastVal}</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 8. FLOATING MAP OVERLAYS */}

      {/* TOP-LEFT: Layers, Mode Toggle, Wind Toggle, Particles Toggle, Forecast Horizon Chips */}
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
                background: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                padding: '10px 14px',
                boxShadow: 'var(--shadow-panel)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                zIndex: 60,
                minWidth: '220px',
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
                Geospatial Layers
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px', color: 'var(--text-secondary)' }}>
                <input
                  type="checkbox"
                  checked={layers.pollution}
                  onChange={(e) => setLayers({ ...layers, pollution: e.target.checked })}
                  style={{ accentColor: 'var(--accent-cyan)' }}
                />
                Concentration Field (Heatmap)
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px', color: 'var(--text-secondary)' }}>
                <input
                  type="checkbox"
                  checked={layers.particles}
                  onChange={(e) => setLayers({ ...layers, particles: e.target.checked })}
                  style={{ accentColor: 'var(--accent-cyan)' }}
                />
                Particle Transport (Advection)
              </label>

              {layers.particles && (
                <div style={{ marginLeft: '22px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>
                    Particle Density:
                  </div>
                  <div style={{ display: 'flex', gap: '3px' }}>
                    {(['auto', 'low', 'medium', 'high'] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        className={`segmented-pill-btn ${particleDensity === mode ? 'active' : ''}`}
                        style={{ flex: 1, padding: '2px 4px', fontSize: '9.5px', textAlign: 'center' }}
                        onClick={() => setParticleDensity(mode)}
                      >
                        {mode === 'auto' ? 'Auto' : mode.slice(0, 3)}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px', color: 'var(--text-secondary)' }}>
                <input
                  type="checkbox"
                  checked={layers.wind}
                  onChange={(e) => setLayers({ ...layers, wind: e.target.checked })}
                  style={{ accentColor: 'var(--accent-cyan)' }}
                />
                Wind Vectors & Transport Arrows
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px', color: 'var(--text-secondary)' }}>
                <input
                  type="checkbox"
                  checked={layers.hotspots}
                  onChange={(e) => setLayers({ ...layers, hotspots: e.target.checked })}
                  style={{ accentColor: 'var(--accent-cyan)' }}
                />
                Inferred Hotspot Cores
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px', color: 'var(--text-secondary)' }}>
                <input
                  type="checkbox"
                  checked={layers.stations}
                  onChange={(e) => setLayers({ ...layers, stations: e.target.checked })}
                  style={{ accentColor: 'var(--accent-cyan)' }}
                />
                CPCB / DPCC Stations
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px', color: 'var(--text-secondary)' }}>
                <input
                  type="checkbox"
                  checked={layers.schools}
                  onChange={(e) => setLayers({ ...layers, schools: e.target.checked })}
                  style={{ accentColor: 'var(--accent-cyan)' }}
                />
                Delhi Schools & Academies
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

        {/* Quick Particle Advection Toggle */}
        <button
          className={`horizon-chip ${layers.particles ? 'active' : ''}`}
          onClick={() => setLayers({ ...layers, particles: !layers.particles })}
          title="Toggle Atmospheric Particle Advection"
        >
          <ParticlesIcon size={13} color={layers.particles ? 'var(--accent-cyan)' : 'var(--text-secondary)'} />
          <span>Particles</span>
        </button>

        {/* Quick Wind Toggle */}
        <button
          className={`horizon-chip ${layers.wind ? 'active' : ''}`}
          onClick={() => setLayers({ ...layers, wind: !layers.wind })}
          title="Toggle Wind Streamlines"
        >
          <WindIcon size={13} color={layers.wind ? 'var(--accent-cyan)' : 'var(--text-secondary)'} />
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
          <span style={{ fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.5px' }}>
            Air Quality Advisory
          </span>
          <span className="severity-badge badge-very-poor" style={{ fontSize: '9.5px' }}>
            {advisory?.status || 'Severe · High confidence'}
          </span>
        </div>

        <p style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.35 }}>
          {advisory?.situation || 'Pollution is elevated across Eastern and Central Delhi due to light NW transport.'}
        </p>

        <p style={{ fontSize: '10.5px', color: 'var(--text-secondary)', lineHeight: 1.35 }}>
          {advisory?.recommendation || 'Sensitive groups should avoid outdoor exertion. School sports should be restricted.'}
        </p>

        <div style={{ fontSize: '9.5px', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-subtle)', paddingTop: '4px' }}>
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

      {/* BOTTOM-RIGHT: Multiscale Transport & Concentration Legend */}
      <div className="map-floating-panel map-ctrl-bottom-right" style={{ padding: '9px 12px', minWidth: '220px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
          <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.4px', textTransform: 'uppercase' }}>
            Air Intelligence Key
          </span>
          <span style={{ fontSize: '9px', color: 'var(--accent-cyan)', fontWeight: 600 }}>
            {visMode === 'hotspots' ? 'Hotspot Cores' : 'Continuous Field'}
          </span>
        </div>

        {/* 1. Concentration Scale: 7-Tier Scientific Dark-Map Palette */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          <div
            style={{
              width: '100%',
              height: '7px',
              borderRadius: '2px',
              background: 'linear-gradient(to right, #18382E 0%, #2F7656 16%, #9AAB55 33%, #D2A34D 50%, #E77A43 67%, #D94E49 84%, #842F43 100%)',
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8.5px', color: 'var(--text-muted)' }}>
            <span style={{ color: '#4EBA89' }}>0 Clean</span>
            <span style={{ color: '#B5C768' }}>60 Mod</span>
            <span style={{ color: '#E5B863' }}>100 Elev</span>
            <span style={{ color: '#F08E58' }}>160 High</span>
            <span style={{ color: '#B2455F' }}>320+ Sev</span>
          </div>
        </div>

        <div style={{ fontSize: '8.5px', color: 'var(--text-muted)', lineHeight: 1.25, marginTop: '2px' }}>
          Continuous basin field: Green represents verified clean air.
        </div>

        <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '4px 0 3px 0' }} />

        {/* 2. Flow & Transport Symbology */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '9px', color: 'var(--text-secondary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#842F43', border: '1.5px solid #D94E49', flexShrink: 0 }} />
            <span>Hotspot Core & Dispersion Halo</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', border: '2px solid #27D3E2', background: 'transparent', flexShrink: 0 }} />
            <span>CPCB / DPCC Ground Sensor Station</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              style={{
                width: '10px',
                height: '8px',
                borderRadius: '1px',
                background: 'repeating-linear-gradient(45deg, #1C242D, #1C242D 2px, #2A3644 2px, #2A3644 4px)',
                border: '1px solid #334155',
                flexShrink: 0,
              }}
            />
            <span>{lang === 'hi' ? 'अपर्याप्त मॉडल कवरेज (डोमेन बाहर)' : 'Insufficient model coverage'}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '2px', flexShrink: 0 }}>
              <span style={{ width: '3px', height: '3px', borderRadius: '50%', background: '#5BC598' }} />
              <span style={{ width: '3px', height: '3px', borderRadius: '50%', background: '#E5B863' }} />
              <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#E6635F' }} />
            </div>
            <span>Particle Transport (Mass Advection)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <svg width="14" height="8" viewBox="0 0 14 8" fill="none" style={{ flexShrink: 0 }}>
              <line x1="0" y1="4" x2="10" y2="4" stroke="#27D3E2" strokeWidth="1.8" />
              <polygon points="9,1 14,4 9,7" fill="#27D3E2" />
            </svg>
            <span>{currentZoom <= 12 ? 'Dominant NW Transport Corridor (SE)' : 'Local Wind Vectors'}</span>
          </div>
        </div>
      </div>

      {/* Inspected Location Target Reticle on Map */}
      {inspectedScreenPos && (
        <div
          className="inspector-reticle"
          style={{ left: `${inspectedScreenPos.sx}px`, top: `${inspectedScreenPos.sy}px` }}
        >
          <div className="inspector-reticle-pulse" />
          <div className="inspector-reticle-center" />
        </div>
      )}

      {/* POPUP 0: Physics-Informed Spatial Estimate HUD */}
      {localInspected && (
        <div
          className="map-floating-panel"
          style={{
            bottom: '180px',
            left: '20px',
            width: '320px',
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            zIndex: 55,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div
                style={{
                  fontSize: '10.5px',
                  fontWeight: 700,
                  color: localInspected.validity === 'missing' ? 'var(--text-muted)' : 'var(--accent-cyan)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                {localInspected.validity === 'missing'
                  ? (lang === 'hi' ? 'अपर्याप्त मॉडल कवरेज' : 'Insufficient model coverage')
                  : localInspected.validity === 'uncertain'
                  ? (lang === 'hi' ? 'उच्च स्थानिक अनिश्चितता' : 'Elevated Spatial Uncertainty')
                  : (lang === 'hi' ? 'भौतिकी-आधारित स्थानिक अनुमान' : 'Physics-Informed Spatial Estimate')}
              </div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '1px' }}>
                {localInspected.lat.toFixed(4)}°N, {localInspected.lon.toFixed(4)}°E
              </div>
            </div>
            <button
              onClick={() => {
                setLocalInspected(null);
                setInspectedScreenPos(null);
                if (onInspectLocation) onInspectLocation(null);
              }}
              style={{ color: 'var(--text-muted)', fontSize: '14px', cursor: 'pointer', background: 'transparent', border: 'none', padding: '2px' }}
              aria-label="Close inspector"
            >
              ✕
            </button>
          </div>

          {localInspected.validity === 'missing' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                <span style={{ fontSize: '26px', fontWeight: 800, color: 'var(--text-muted)' }}>--</span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>µg/m³ PM2.5</span>
                <span className="severity-badge badge-missing" style={{ marginLeft: 'auto', fontSize: '9.5px' }}>
                  {lang === 'hi' ? 'उपलब्ध नहीं' : 'Unavailable'}
                </span>
              </div>
              <div
                style={{
                  fontSize: '11px',
                  color: '#CBD5E1',
                  background: 'rgba(28, 36, 45, 0.7)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '3px',
                  padding: '8px',
                  lineHeight: 1.4,
                }}
              >
                <strong>{lang === 'hi' ? 'चयनित समय क्षितिज के लिए इस स्थान पर अनुमान उपलब्ध नहीं है।' : 'An estimate is unavailable at this location for the selected horizon.'}</strong>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  {lang === 'hi'
                    ? 'यह निर्देशांक दिल्ली एनसीआर मॉडल बेसिन (28.25°N–28.95°N, 76.75°E–77.60°E) से बाहर है। कोई कृत्रिम संख्या उत्पन्न नहीं की गई है।'
                    : 'Location is outside the supported Delhi NCR modeling domain (28.25°N–28.95°N, 76.75°E–77.60°E). No concentration values are fabricated.'}
                </div>
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                Nearest ground monitor: {localInspected.nearestStation.name_en} ({localInspected.nearestStation.distanceKm} km away)
              </div>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                <span style={{ fontSize: '26px', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {localInspected.estimatedPm25}
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>µg/m³ PM2.5</span>
                <span className={`severity-badge ${localInspected.tier.badge}`} style={{ marginLeft: 'auto', fontSize: '9.5px' }}>
                  {lang === 'hi' ? localInspected.tier.label_hi : localInspected.tier.label_en}
                </span>
              </div>

              {/* Uncertainty & Provenance Details */}
              <div
                style={{
                  fontSize: '10.5px',
                  padding: '6px 8px',
                  borderRadius: '3px',
                  background: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '3px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Spatial Uncertainty:</span>
                  <strong style={{ color: 'var(--accent-cyan)' }}>±{localInspected.uncertaintySpread} µg/m³</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Nearest Ground Sensor:</span>
                  <span style={{ color: 'var(--text-secondary)' }}>
                    {localInspected.nearestStation.name_en} ({localInspected.nearestStation.distanceKm} km)
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Sensor Observation:</span>
                  <span style={{ color: 'var(--text-secondary)' }}>
                    {localInspected.nearestStation.observedPm25} µg/m³ ({localInspected.nearestStation.agency})
                  </span>
                </div>
              </div>

              {/* Model Component Breakdown */}
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', borderTop: '1px solid var(--border-subtle)', paddingTop: '5px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                  <span>Regional Background:</span>
                  <span style={{ color: 'var(--text-secondary)' }}>{localInspected.components.background} µg/m³</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                  <span>NW Biomass Advection:</span>
                  <span style={{ color: 'var(--text-secondary)' }}>{localInspected.components.smokeAdvection} µg/m³</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Urban Plume Dispersion:</span>
                  <span style={{ color: 'var(--text-secondary)' }}>{localInspected.components.urbanDispersion} µg/m³</span>
                </div>
              </div>

              <div style={{ fontSize: '9.5px', color: 'var(--text-muted)', lineHeight: 1.35, fontStyle: 'italic' }}>
                * Continuous estimate derived via physics-informed advection-dispersion with distance-to-station uncertainty.
              </div>
            </>
          )}
        </div>
      )}

      {/* POPUP 1: Inferred Hotspot Core Detail */}
      {activePin && (
        <div
          className="map-floating-panel"
          style={{
            bottom: '180px',
            left: '20px',
            width: '270px',
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {lang === 'hi' ? activePin.name_hi : activePin.name_en}
            </span>
            <button
              onClick={() => setActivePin(null)}
              style={{ color: 'var(--text-muted)', fontSize: '14px', cursor: 'pointer', background: 'transparent', border: 'none' }}
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
                  <span className={`severity-badge ${cat.badge}`} style={{ marginLeft: 'auto', fontSize: '9.5px' }}>
                    {cat.label}
                  </span>
                </div>

                <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)', borderTop: '1px solid var(--border-subtle)', paddingTop: '6px', lineHeight: 1.4 }}>
                  <div><strong>Type:</strong> Inferred Hotspot Concentration Core</div>
                  <div><strong>Coordinates:</strong> {activePin.lat.toFixed(3)}°N, {activePin.lon.toFixed(3)}°E</div>
                  <div><strong>Horizon:</strong> +{hourOffset}h forecast</div>
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* POPUP 2: Real CPCB/DPCC Monitoring Station Detail */}
      {activeStationData && (
        <div
          className="map-floating-panel"
          style={{
            bottom: '180px',
            left: '20px',
            width: '290px',
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                {activeStationData.station_name}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                OpenAQ ID: {activeStationData.openaq_location_id} · Elevation: {activeStationData.elevation_m}m
              </div>
            </div>
            <button
              onClick={() => setActiveStationData(null)}
              style={{ color: 'var(--text-muted)', fontSize: '14px', cursor: 'pointer', background: 'transparent', border: 'none' }}
              aria-label="Close popup"
            >
              ✕
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <span style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)' }}>
              {activeStationData.current_obs_pm25}
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>µg/m³ PM2.5</span>
            <span
              style={{
                marginLeft: 'auto',
                fontSize: '10px',
                fontWeight: 700,
                padding: '2px 6px',
                borderRadius: '2px',
                background: activeStationData.agency === 'CPCB' ? 'rgba(39, 211, 226, 0.15)' : 'rgba(161, 172, 184, 0.12)',
                color: activeStationData.agency === 'CPCB' ? 'var(--accent-cyan)' : 'var(--text-secondary)',
              }}
            >
              {activeStationData.agency} VERIFIED
            </span>
          </div>

          <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)', borderTop: '1px solid var(--border-subtle)', paddingTop: '6px', lineHeight: 1.4 }}>
            <div><strong>Location:</strong> {activeStationData.lat.toFixed(4)}°N, {activeStationData.lon.toFixed(4)}°E</div>
            <div><strong>Status:</strong> Live Ground Sensor (Continuous BAM/TEOM)</div>
            <div style={{ color: 'var(--text-muted)', marginTop: '2px' }}>
              Direct observation point used to constrain atmospheric transport model.
            </div>
          </div>
        </div>
      )}

      {/* POPUP 3: Authentic Delhi School Activity Assessment */}
      {activeSchoolData && (
        <div
          className="map-floating-panel"
          style={{
            bottom: '180px',
            left: '20px',
            width: '310px',
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                {lang === 'hi' ? activeSchoolData.name_hi : activeSchoolData.name_en}
              </div>
              <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                {activeSchoolData.school_type} · ~{activeSchoolData.student_count.toLocaleString()} students
              </div>
            </div>
            <button
              onClick={() => setActiveSchoolData(null)}
              style={{ color: 'var(--text-muted)', fontSize: '14px', cursor: 'pointer', background: 'transparent', border: 'none' }}
              aria-label="Close popup"
            >
              ✕
            </button>
          </div>

          {/* Exposure & Station provenance */}
          <div
            style={{
              fontSize: '10px',
              padding: '4px 6px',
              borderRadius: '2px',
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-secondary)',
            }}
          >
            {activeSchoolData.station_distance_km <= 3.5 ? (
              <span>Nearest CPCB/DPCC: {activeSchoolData.nearest_station_id} ({activeSchoolData.station_distance_km} km)</span>
            ) : (
              <span>Model field estimate at school coordinates ({activeSchoolData.lat.toFixed(3)}°N, {activeSchoolData.lon.toFixed(3)}°E)</span>
            )}
          </div>

          {/* School Day Periods */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            {computePopupPeriods(activeSchoolData).map((p) => {
              const badgeClass = p.verdict === 'skip' ? 'badge-severe' : p.verdict === 'limit' ? 'badge-poor' : 'badge-low';
              const label = p.verdict === 'skip' ? 'SKIP' : p.verdict === 'limit' ? 'LIMIT' : 'GO';
              return (
                <div
                  key={p.period_id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '10.5px',
                    padding: '3px 0',
                    borderBottom: '1px solid rgba(39, 49, 61, 0.3)',
                  }}
                >
                  <div>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                      {lang === 'hi' ? p.name_hi : p.name_en}
                    </span>
                    <span style={{ fontSize: '9px', color: 'var(--text-muted)', marginLeft: '4px' }}>{p.time}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{p.forecast_pm25} µg</span>
                    <span className={`severity-badge ${badgeClass}`} style={{ fontSize: '9px', padding: '1px 5px' }}>
                      {label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ fontSize: '10px', color: 'var(--accent-cyan)', lineHeight: 1.35, borderTop: '1px solid var(--border-subtle)', paddingTop: '4px' }}>
            Action: Move outdoor assembly indoors. Advise N95 masks during arrival and dispersal.
          </div>
        </div>
      )}
    </div>
  );
};
