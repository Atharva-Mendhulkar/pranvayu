/**
 * Continuous Physics-Informed Spatial Field Estimation Engine for Delhi NCR.
 *
 * Implements deterministic spatial evaluation of PM2.5 across the entire
 * geographic basin, matching the backend formulation in pv/model/spatial_field.py.
 */

import { MonitoringStation } from '../types/intelligence';

export interface PaletteTier {
  id: 'very_low' | 'low' | 'moderate' | 'elevated' | 'high' | 'very_high' | 'extreme' | 'missing';
  minPm: number;
  maxPm: number;
  label_en: string;
  label_hi: string;
  hex: string;
  rgb: [number, number, number];
  alpha: number;
  badge: string;
}

export const DELHI_NCR_BOUNDS = {
  south: 28.25,
  north: 28.95,
  west: 76.75,
  east: 77.60,
};

export const PALETTE_TIERS: PaletteTier[] = [
  {
    id: 'very_low',
    minPm: 0.0,
    maxPm: 30.0,
    label_en: 'Very Low',
    label_hi: 'अति निम्न',
    hex: '#18382E',
    rgb: [0.098, 0.280, 0.210],
    alpha: 0.44,
    badge: 'badge-very-low',
  },
  {
    id: 'low',
    minPm: 30.0,
    maxPm: 60.0,
    label_en: 'Low',
    label_hi: 'निम्न',
    hex: '#2F7656',
    rgb: [0.184, 0.495, 0.350],
    alpha: 0.50,
    badge: 'badge-low',
  },
  {
    id: 'moderate',
    minPm: 60.0,
    maxPm: 100.0,
    label_en: 'Moderate',
    label_hi: 'मध्यम',
    hex: '#9AAB55',
    rgb: [0.604, 0.671, 0.333],
    alpha: 0.56,
    badge: 'badge-moderate',
  },
  {
    id: 'elevated',
    minPm: 100.0,
    maxPm: 160.0,
    label_en: 'Elevated',
    label_hi: 'सघन',
    hex: '#D2A34D',
    rgb: [0.824, 0.639, 0.302],
    alpha: 0.62,
    badge: 'badge-elevated',
  },
  {
    id: 'high',
    minPm: 160.0,
    maxPm: 240.0,
    label_en: 'High',
    label_hi: 'उच्च',
    hex: '#E77A43',
    rgb: [0.906, 0.478, 0.263],
    alpha: 0.68,
    badge: 'badge-high',
  },
  {
    id: 'very_high',
    minPm: 240.0,
    maxPm: 320.0,
    label_en: 'Very High',
    label_hi: 'अत्यंत उच्च',
    hex: '#D94E49',
    rgb: [0.851, 0.306, 0.286],
    alpha: 0.74,
    badge: 'badge-very-high',
  },
  {
    id: 'extreme',
    minPm: 320.0,
    maxPm: 9999.0,
    label_en: 'Extreme',
    label_hi: 'गंभीर',
    hex: '#842F43',
    rgb: [0.518, 0.184, 0.263],
    alpha: 0.80,
    badge: 'badge-extreme',
  },
  {
    id: 'missing',
    minPm: -1.0,
    maxPm: -1.0,
    label_en: 'Insufficient Coverage',
    label_hi: 'अपर्याप्त डेटा',
    hex: '#1C242D',
    rgb: [0.110, 0.141, 0.176],
    alpha: 0.52,
    badge: 'badge-missing',
  },
];

export interface InspectedLocation {
  lat: number;
  lon: number;
  estimatedPm25: number | null;
  validity: 'valid' | 'uncertain' | 'missing';
  uncertaintySpread: number | null;
  tier: PaletteTier;
  components: {
    background: number | null;
    smokeAdvection: number | null;
    urbanDispersion: number | null;
  };
  nearestStation: {
    id: string;
    name_en: string;
    name_hi: string;
    agency: string;
    observedPm25: number;
    distanceKm: number;
  };
  provenance: 'direct_obs' | 'physics_estimate' | 'regional_extrapolation' | 'out_of_domain';
  provenanceLabel_en: string;
  provenanceLabel_hi: string;
  isWithinDomain: boolean;
}


export function isWithinDomain(lat: number, lon: number): boolean {
  return (
    lat >= DELHI_NCR_BOUNDS.south &&
    lat <= DELHI_NCR_BOUNDS.north &&
    lon >= DELHI_NCR_BOUNDS.west &&
    lon <= DELHI_NCR_BOUNDS.east
  );
}

export function getPaletteTier(pm25: number | null): PaletteTier {
  if (pm25 === null || isNaN(pm25)) {
    return PALETTE_TIERS.find((t) => t.id === 'missing') || PALETTE_TIERS[PALETTE_TIERS.length - 1];
  }
  const clamped = Math.max(0, pm25);
  for (let i = 0; i < PALETTE_TIERS.length; i++) {
    if (PALETTE_TIERS[i].id === 'missing') continue;
    if (clamped <= PALETTE_TIERS[i].maxPm) {
      return PALETTE_TIERS[i];
    }
  }
  return PALETTE_TIERS[PALETTE_TIERS.length - 2];
}

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const rEarth = 6371.0;
  const phi1 = (lat1 * Math.PI) / 180.0;
  const phi2 = (lat2 * Math.PI) / 180.0;
  const dphi = ((lat2 - lat1) * Math.PI) / 180.0;
  const dlambda = ((lon2 - lon1) * Math.PI) / 180.0;
  const a =
    Math.sin(dphi / 2.0) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dlambda / 2.0) ** 2;
  const c = 2.0 * Math.atan2(Math.sqrt(a), Math.sqrt(1.0 - a));
  return rEarth * c;
}

export function computeSpatialUncertainty(
  lat: number,
  lon: number,
  nearestStationDistKm: number
): number {
  if (!isWithinDomain(lat, lon)) return 45;
  const baseSigma = 12.0;
  const distPenalty = 1.8 * Math.min(nearestStationDistKm, 25.0);
  return Math.round(baseSigma + distPenalty);
}

export function evaluateContinuousField(
  lat: number,
  lon: number,
  hourOffset: number = 0,
  windSpeedKmh: number = 14,
  windDirDeg: number = 315,
  hotspots: Array<{ lat: number; lon: number; pm25: number }> = []
): {
  pm25: number | null;
  components: { background: number | null; smokeAdvection: number | null; urbanDispersion: number | null };
  isWithin: boolean;
  validity: 'valid' | 'uncertain' | 'missing';
} {
  if (!isWithinDomain(lat, lon)) {
    return {
      pm25: null,
      components: { background: null, smokeAdvection: null, urbanDispersion: null },
      isWithin: false,
      validity: 'missing',
    };
  }

  // 1. Diurnal modulation factor
  const diurnalMod = 0.92 + 0.22 * Math.sin((hourOffset - 8.0) * 0.26);

  // 2. Regional background ventilation (Aravalli SW ridge is cleaner; North is hazier)
  const latSpan = DELHI_NCR_BOUNDS.north - DELHI_NCR_BOUNDS.south;
  const etaLat = (lat - DELHI_NCR_BOUNDS.south) / Math.max(latSpan, 0.01);
  const bgCleanBase = 26.0 + 14.0 * etaLat;
  const background = bgCleanBase * diurnalMod;

  // 3. Meteorological wind transport vectors
  const transportDeg = (windDirDeg + 180.0) % 360.0;
  const transportRad = (transportDeg * Math.PI) / 180.0;
  const uDir = Math.sin(transportRad);
  const vDir = Math.cos(transportRad);

  // 4. Upstream Biomass Advection Tongue (NW agricultural entry corridor)
  const nwEntryLat = 28.85;
  const nwEntryLon = 77.02;
  const dyMeters = (lat - nwEntryLat) * 111139.0;
  const dxMeters = (lon - nwEntryLon) * 111139.0 * Math.cos((lat * Math.PI) / 180.0);

  const dDownwind = dxMeters * uDir + dyMeters * vDir;
  const dCrosswind = -dxMeters * vDir + dyMeters * uDir;

  const sigmaCrosswind = 9500.0 + 0.18 * Math.max(dDownwind, 0.0);
  const crossDecay = Math.exp(-0.5 * (dCrosswind / Math.max(sigmaCrosswind, 500.0)) ** 2);

  const longDecay =
    dDownwind < 0.0
      ? Math.exp(-0.5 * (dDownwind / 6000.0) ** 2)
      : 1.0 / (1.0 + dDownwind / 45000.0);

  const smokeAmplitude = 65.0 * diurnalMod * (windSpeedKmh / 14.0);
  const smokeAdvection = smokeAmplitude * crossDecay * longDecay;

  // 5. Localized Urban Hotspot Plumes
  let urbanDispersion = 0;
  if (hotspots && hotspots.length > 0) {
    let maxC = 0;
    let sumC = 0;

    for (let i = 0; i < hotspots.length; i++) {
      const h = hotspots[i];
      const basePm = h.pm25 * diurnalMod;

      const dyH = (lat - h.lat) * 111139.0;
      const dxH = (lon - h.lon) * 111139.0 * Math.cos((lat * Math.PI) / 180.0);

      const dDownH = dxH * uDir + dyH * vDir;
      const dCrossH = -dxH * vDir + dyH * uDir;

      // Two-component: Core (1350m) + Halo (3200m)
      const sigmaCoreDown =
        dDownH > 0 ? 1350.0 + (windSpeedKmh / 20.0) * 1200.0 * 0.30 : 1350.0 * 0.65;
      const distSqCore =
        (dDownH / Math.max(sigmaCoreDown, 80.0)) ** 2 + (dCrossH / 900.0) ** 2;

      const sigmaHaloDown =
        dDownH > 0 ? 3200.0 + (windSpeedKmh / 20.0) * 1800.0 * 0.55 : 3200.0 * 0.60;
      const sigmaHaloCross = 2200.0 + (dDownH > 0 ? dDownH * 0.14 : 0);
      const distSqHalo =
        (dDownH / Math.max(sigmaHaloDown, 120.0)) ** 2 +
        (dCrossH / Math.max(sigmaHaloCross, 120.0)) ** 2;

      if (distSqCore > 9.0 && distSqHalo > 9.0) continue;

      const cCore = distSqCore <= 9.0 ? basePm * 0.75 * Math.exp(-0.5 * distSqCore) : 0;
      const cHalo = distSqHalo <= 9.0 ? basePm * 0.25 * Math.exp(-0.5 * distSqHalo) : 0;
      const cPoint = cCore + cHalo;

      if (cPoint > maxC) maxC = cPoint;
      sumC += cPoint;
    }

    urbanDispersion = maxC + 0.22 * (sumC - maxC);
  }

  const totalPm = Math.round(background + smokeAdvection + urbanDispersion);

  return {
    pm25: totalPm,
    components: {
      background: Math.round(background),
      smokeAdvection: Math.round(smokeAdvection),
      urbanDispersion: Math.round(urbanDispersion),
    },
    isWithin: true,
    validity: 'valid',
  };
}

export function inspectMapCoordinate(
  lat: number,
  lon: number,
  hourOffset: number,
  windSpeedKmh: number,
  windDirDeg: number,
  hotspots: Array<{ lat: number; lon: number; pm25: number; name_en?: string }>,
  stations: MonitoringStation[]
): InspectedLocation {
  const isWithin = isWithinDomain(lat, lon);
  const evalResult = evaluateContinuousField(
    lat,
    lon,
    hourOffset,
    windSpeedKmh,
    windDirDeg,
    hotspots
  );

  // Find nearest monitoring station
  let nearestStation = stations[0];
  let minDistanceKm = 9999;

  for (let i = 0; i < stations.length; i++) {
    const d = haversineKm(lat, lon, stations[i].lat, stations[i].lon);
    if (d < minDistanceKm) {
      minDistanceKm = d;
      nearestStation = stations[i];
    }
  }

  const distKm = Math.round(minDistanceKm * 10) / 10;
  const uncertainty = isWithin ? computeSpatialUncertainty(lat, lon, distKm) : null;
  const tier = getPaletteTier(evalResult.pm25);

  let validity: 'valid' | 'uncertain' | 'missing' = 'valid';
  let provenance: 'direct_obs' | 'physics_estimate' | 'regional_extrapolation' | 'out_of_domain' =
    'physics_estimate';
  let provenanceLabel_en = 'Physics-Informed Spatial Estimate (1.2 km PINN)';
  let provenanceLabel_hi = 'भौतिकी-आधारित स्थानिक अनुमान (1.2 किमी ग्रिड)';

  if (!isWithin) {
    validity = 'missing';
    provenance = 'out_of_domain';
    provenanceLabel_en = 'An estimate is unavailable at this location for the selected horizon.';
    provenanceLabel_hi = 'चयनित समय क्षितिज के लिए इस स्थान पर अनुमान उपलब्ध नहीं है।';
  } else if (distKm <= 1.2) {
    validity = 'valid';
    provenance = 'direct_obs';
    provenanceLabel_en = `Proximate Ground Observation Anchor (${distKm} km)`;
    provenanceLabel_hi = `निकटतम भूतल अवलोकन आधार (${distKm} किमी)`;
  } else if (distKm > 18.0) {
    validity = 'uncertain';
    provenance = 'regional_extrapolation';
    provenanceLabel_en = `Elevated Spatial Uncertainty (${distKm} km from sensor)`;
    provenanceLabel_hi = `उच्च स्थानिक अनिश्चितता (सेंसर से ${distKm} किमी)`;
  } else {
    validity = 'valid';
  }

  return {
    lat: Math.round(lat * 10000) / 10000,
    lon: Math.round(lon * 10000) / 10000,
    estimatedPm25: evalResult.pm25,
    validity,
    uncertaintySpread: uncertainty,
    tier,
    components: evalResult.components,
    nearestStation: {
      id: nearestStation.id,
      name_en: nearestStation.name_en,
      name_hi: nearestStation.name_hi,
      agency: nearestStation.agency,
      observedPm25: nearestStation.current_obs_pm25,
      distanceKm: distKm,
    },
    provenance,
    provenanceLabel_en,
    provenanceLabel_hi,
    isWithinDomain: isWithin,
  };
}
