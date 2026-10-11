"""
Continuous Physics-Informed Spatial Field Estimation for Delhi NCR.

This module provides deterministic spatial evaluation of PM2.5 concentrations
across the entire Delhi NCR geographic basin, synthesizing:
1. Base regional background ventilation
2. Upstream biomass advection tongue from the northwest
3. Localized urban hotspot emissions and dispersion
4. Distance-to-sensor spatial uncertainty scaling
"""

import math
from typing import Any, Dict, List, Optional, Tuple

# Official PranVayu Delhi NCR Geographic Modeling Domain
DELHI_NCR_BOUNDS = {
    "south": 28.25,
    "north": 28.95,
    "west": 76.75,
    "east": 77.60,
}

# 7-Tier Dark-Map Scientific Palette
PALETTE_TIERS = [
    {
        "id": "very_low",
        "min_pm": 0.0,
        "max_pm": 30.0,
        "label_en": "Very Low",
        "label_hi": "अति निम्न",
        "hex": "#18382E",
        "rgb": (0.094, 0.220, 0.180),
        "alpha": 0.28,
        "badge": "badge-very-low",
    },
    {
        "id": "low",
        "min_pm": 30.0,
        "max_pm": 60.0,
        "label_en": "Low",
        "label_hi": "निम्न",
        "hex": "#2F7656",
        "rgb": (0.184, 0.463, 0.337),
        "alpha": 0.34,
        "badge": "badge-low",
    },
    {
        "id": "moderate",
        "min_pm": 60.0,
        "max_pm": 100.0,
        "label_en": "Moderate",
        "label_hi": "मध्यम",
        "hex": "#9AAB55",
        "rgb": (0.604, 0.671, 0.333),
        "alpha": 0.42,
        "badge": "badge-moderate",
    },
    {
        "id": "elevated",
        "min_pm": 100.0,
        "max_pm": 160.0,
        "label_en": "Elevated",
        "label_hi": "सघन",
        "hex": "#D2A34D",
        "rgb": (0.824, 0.639, 0.302),
        "alpha": 0.50,
        "badge": "badge-elevated",
    },
    {
        "id": "high",
        "min_pm": 160.0,
        "max_pm": 240.0,
        "label_en": "High",
        "label_hi": "उच्च",
        "hex": "#E77A43",
        "rgb": (0.906, 0.478, 0.263),
        "alpha": 0.58,
        "badge": "badge-high",
    },
    {
        "id": "very_high",
        "min_pm": 240.0,
        "max_pm": 320.0,
        "label_en": "Very High",
        "label_hi": "अत्यंत उच्च",
        "hex": "#D94E49",
        "rgb": (0.851, 0.306, 0.286),
        "alpha": 0.65,
        "badge": "badge-very-high",
    },
    {
        "id": "extreme",
        "min_pm": 320.0,
        "max_pm": 9999.0,
        "label_en": "Extreme",
        "label_hi": "गंभीर",
        "hex": "#842F43",
        "rgb": (0.518, 0.184, 0.263),
        "alpha": 0.72,
        "badge": "badge-extreme",
    },
]


def is_within_domain(lat: float, lon: float) -> bool:
    """Returns True if the coordinates are within the Delhi NCR modeling domain."""
    return (
        DELHI_NCR_BOUNDS["south"] <= lat <= DELHI_NCR_BOUNDS["north"]
        and DELHI_NCR_BOUNDS["west"] <= lon <= DELHI_NCR_BOUNDS["east"]
    )


def get_continuous_palette_tier(pm25: float) -> Dict[str, Any]:
    """Returns the matching 7-tier palette entry for a given PM2.5 value."""
    clamped = max(0.0, pm25)
    for tier in PALETTE_TIERS:
        if clamped <= tier["max_pm"]:
            return tier
    return PALETTE_TIERS[-1]


def compute_haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Computes great-circle distance between two points in kilometers."""
    r_earth = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = (
        math.sin(dphi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return r_earth * c


def compute_spatial_uncertainty(lat: float, lon: float, nearest_station_distance_km: float) -> float:
    """
    Computes model uncertainty (+/- sigma) at an unmonitored point.
    Uncertainty scales with distance from physical ground truth monitoring stations.
    """
    if not is_within_domain(lat, lon):
        return 45.0  # High uncertainty outside domain boundary
    base_sigma = 12.0
    dist_penalty = 1.8 * min(nearest_station_distance_km, 25.0)
    return round(base_sigma + dist_penalty, 1)


def evaluate_continuous_pm25(
    lat: float,
    lon: float,
    hour_offset: float = 0.0,
    wind_speed_kmh: float = 14.0,
    wind_dir_deg: float = 315.0,
    hotspots: Optional[List[Dict[str, Any]]] = None,
) -> Tuple[float, Dict[str, Any]]:
    """
    Evaluates the continuous physics-informed PM2.5 concentration at an arbitrary coordinate.
    Returns (total_pm25, component_breakdown).
    """
    if not is_within_domain(lat, lon):
        return 0.0, {
            "status": "out_of_domain",
            "background": 0.0,
            "smoke_advection": 0.0,
            "urban_dispersion": 0.0,
        }

    # 1. Diurnal modulation factor
    diurnal_mod = 0.92 + 0.22 * math.sin((hour_offset - 8.0) * 0.26)

    # 2. Regional background ventilation (Aravalli SW ridge is cleaner; North is hazier)
    lat_span = DELHI_NCR_BOUNDS["north"] - DELHI_NCR_BOUNDS["south"]
    eta_lat = (lat - DELHI_NCR_BOUNDS["south"]) / max(lat_span, 0.01)
    bg_clean_base = 26.0 + 14.0 * eta_lat
    background_pm = bg_clean_base * diurnal_mod

    # 3. Meteorological wind transport vectors
    transport_deg = (wind_dir_deg + 180.0) % 360.0
    transport_rad = math.radians(transport_deg)
    u_dir = math.sin(transport_rad)
    v_dir = math.cos(transport_rad)

    # 4. Upstream Biomass Advection Tongue (Entering from NW agricultural corridor)
    # Entry anchor: 28.85°N, 77.02°E
    nw_entry_lat, nw_entry_lon = 28.85, 77.02
    dy_meters = (lat - nw_entry_lat) * 111139.0
    dx_meters = (lon - nw_entry_lon) * 111139.0 * math.cos(math.radians(lat))

    d_downwind = dx_meters * u_dir + dy_meters * v_dir
    d_crosswind = -dx_meters * v_dir + dy_meters * u_dir

    sigma_crosswind = 9500.0 + 0.18 * max(d_downwind, 0.0)
    cross_decay = math.exp(-0.5 * (d_crosswind / max(sigma_crosswind, 500.0)) ** 2)

    # Longitudinal profile: peaks downwind of entry, gradually dilutes across the basin
    if d_downwind < 0.0:
        long_decay = math.exp(-0.5 * (d_downwind / 6000.0) ** 2)
    else:
        long_decay = 1.0 / (1.0 + d_downwind / 45000.0)

    smoke_amplitude = 65.0 * diurnal_mod * (wind_speed_kmh / 14.0)
    smoke_pm = smoke_amplitude * cross_decay * long_decay

    # 5. Localized Urban Hotspot Plumes
    urban_pm = 0.0
    if hotspots:
        max_c = 0.0
        sum_c = 0.0
        for h in hotspots:
            h_lat = h.get("lat", 28.61)
            h_lon = h.get("lon", 77.21)
            base_pm = h.get("pm25", 150.0) * diurnal_mod

            dy_h = (lat - h_lat) * 111139.0
            dx_h = (lon - h_lon) * 111139.0 * math.cos(math.radians(lat))

            d_down_h = dx_h * u_dir + dy_h * v_dir
            d_cross_h = -dx_h * v_dir + dy_h * u_dir

            # Two-component: Core (1350m) + Halo (3200m)
            sigma_core_down = (
                1350.0 + (wind_speed_kmh / 20.0) * 1200.0 * 0.30
                if d_down_h > 0
                else 1350.0 * 0.65
            )
            dist_sq_core = (d_down_h / max(sigma_core_down, 80.0)) ** 2 + (
                d_cross_h / 900.0
            ) ** 2

            sigma_halo_down = (
                3200.0 + (wind_speed_kmh / 20.0) * 1800.0 * 0.55
                if d_down_h > 0
                else 3200.0 * 0.60
            )
            sigma_halo_cross = 2200.0 + (d_down_h * 0.14 if d_down_h > 0 else 0.0)
            dist_sq_halo = (d_down_h / max(sigma_halo_down, 120.0)) ** 2 + (
                d_cross_h / max(sigma_halo_cross, 120.0)
            ) ** 2

            if dist_sq_core > 9.0 and dist_sq_halo > 9.0:
                continue

            c_core = base_pm * 0.75 * math.exp(-0.5 * dist_sq_core) if dist_sq_core <= 9.0 else 0.0
            c_halo = base_pm * 0.25 * math.exp(-0.5 * dist_sq_halo) if dist_sq_halo <= 9.0 else 0.0
            c_point = c_core + c_halo

            if c_point > max_c:
                max_c = c_point
            sum_c += c_point

        urban_pm = max_c + 0.22 * (sum_c - max_c)

    total_pm = round(background_pm + smoke_pm + urban_pm, 1)

    return total_pm, {
        "status": "within_domain",
        "background": round(background_pm, 1),
        "smoke_advection": round(smoke_pm, 1),
        "urban_dispersion": round(urban_pm, 1),
    }
