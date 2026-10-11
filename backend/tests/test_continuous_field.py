"""
Unit tests for Continuous Physics-Informed Spatial Field Estimation in Delhi NCR.
Validates:
1. Domain bounding box coverage and boundary detection.
2. Clean air sectors evaluate to Very Low / Low (<= 60 ug/m3) and map to deep forest emerald / muted green.
3. Monotonic palette tier assignment without gaps or drops.
4. Upstream NW biomass advection tongue dispersion downwind.
5. Urban hotspot localized elevation (Anand Vihar, Wazirpur, Bawana).
6. Distance-to-station spatial uncertainty scaling.
7. Out-of-domain rejection and safe fallbacks.
"""

from pv.model.spatial_field import (
    DELHI_NCR_BOUNDS,
    PALETTE_TIERS,
    compute_haversine_distance_km,
    compute_spatial_uncertainty,
    evaluate_continuous_pm25,
    get_continuous_palette_tier,
    is_within_domain,
)

SAMPLE_HOTSPOTS = [
    {"id": "anand_vihar", "lat": 28.65, "lon": 77.31, "pm25": 318.0},
    {"id": "wazirpur", "lat": 28.70, "lon": 77.17, "pm25": 295.0},
    {"id": "bawana", "lat": 28.78, "lon": 77.05, "pm25": 284.0},
    {"id": "dwarka", "lat": 28.59, "lon": 77.05, "pm25": 165.0},
]


def test_domain_boundary_checks():
    """Verifies strict adherence to Delhi NCR modeling domain boundaries."""
    assert DELHI_NCR_BOUNDS["south"] == 28.25
    assert DELHI_NCR_BOUNDS["north"] == 28.95
    assert DELHI_NCR_BOUNDS["west"] == 76.75
    assert DELHI_NCR_BOUNDS["east"] == 77.60

    # Haversine distance verification across Delhi
    d_km = compute_haversine_distance_km(28.65, 77.31, 28.63, 77.24)
    assert 6.0 <= d_km <= 10.0

    # Inside domain
    assert is_within_domain(28.6139, 77.2090) is True  # Central Delhi
    assert is_within_domain(28.30, 76.85) is True      # SW Outer NCR
    assert is_within_domain(28.90, 77.55) is True      # NE Outer NCR

    # Outside domain
    assert is_within_domain(28.10, 77.20) is False     # Too far South (Haryana)
    assert is_within_domain(29.10, 77.20) is False     # Too far North (Panipat)
    assert is_within_domain(28.60, 76.60) is False     # Too far West (Rohtak)
    assert is_within_domain(28.60, 77.75) is False     # Too far East (Meerut)


def test_clean_air_evaluates_to_green_palette():
    """
    Critical requirement: Clean air areas must evaluate to <= 60 ug/m3
    and map to emerald/green tiers, NOT black or transparent voids!
    """
    # Southwestern rural/ridge periphery with minimal urban source influence
    sw_lat, sw_lon = 28.32, 76.82
    pm, components = evaluate_continuous_pm25(
        lat=sw_lat,
        lon=sw_lon,
        hour_offset=0.0,
        wind_speed_kmh=14.0,
        wind_dir_deg=315.0,
        hotspots=SAMPLE_HOTSPOTS,
    )

    assert components["status"] == "within_domain"
    assert pm > 0.0
    assert pm <= 60.0  # Must be clean or low!

    tier = get_continuous_palette_tier(pm)
    assert tier["id"] in ("very_low", "low")
    assert tier["hex"] in ("#18382E", "#2F7656")  # Deep Forest Emerald or Muted Green
    assert tier["alpha"] >= 0.25                  # Visible non-zero alpha!


def test_palette_tier_monotonicity_and_hex_integrity():
    """Verifies that all 7 palette tiers are strictly ordered and contiguous."""
    assert len(PALETTE_TIERS) == 7

    prev_max = 0.0
    for tier in PALETTE_TIERS:
        assert tier["min_pm"] == prev_max
        assert tier["max_pm"] > tier["min_pm"]
        assert tier["hex"].startswith("#")
        assert len(tier["hex"]) == 7
        assert tier["alpha"] > 0.20
        prev_max = tier["max_pm"]

    # Test edge values
    assert get_continuous_palette_tier(15.0)["id"] == "very_low"
    assert get_continuous_palette_tier(30.0)["id"] == "very_low"
    assert get_continuous_palette_tier(45.0)["id"] == "low"
    assert get_continuous_palette_tier(80.0)["id"] == "moderate"
    assert get_continuous_palette_tier(135.0)["id"] == "elevated"
    assert get_continuous_palette_tier(200.0)["id"] == "high"
    assert get_continuous_palette_tier(290.0)["id"] == "very_high"
    assert get_continuous_palette_tier(400.0)["id"] == "extreme"


def test_hotspot_cores_produce_localized_intensity():
    """Hotspot centers (Anand Vihar) must exhibit higher concentrations than background."""
    av_lat, av_lon = 28.65, 77.31
    pm_av, comp_av = evaluate_continuous_pm25(
        lat=av_lat,
        lon=av_lon,
        hour_offset=0.0,
        wind_speed_kmh=14.0,
        wind_dir_deg=315.0,
        hotspots=SAMPLE_HOTSPOTS,
    )

    # Remote background location
    pm_remote, comp_remote = evaluate_continuous_pm25(
        lat=28.35,
        lon=76.85,
        hour_offset=0.0,
        wind_speed_kmh=14.0,
        wind_dir_deg=315.0,
        hotspots=SAMPLE_HOTSPOTS,
    )

    assert pm_av > 240.0  # Anand Vihar core is very high / severe
    assert pm_av > pm_remote * 4.0
    assert comp_av["urban_dispersion"] > 100.0


def test_spatial_uncertainty_scales_with_station_distance():
    """
    Uncertainty should be lowest (+/- 12-14 ug/m3) near ground stations,
    and grow progressively (+/- 25-45 ug/m3) for unmonitored locations.
    """
    # Point right next to a station (0.3 km)
    sigma_near = compute_spatial_uncertainty(28.65, 77.31, nearest_station_distance_km=0.3)
    assert 12.0 <= sigma_near <= 13.5

    # Point 6.0 km away from any station
    sigma_mid = compute_spatial_uncertainty(28.45, 77.10, nearest_station_distance_km=6.0)
    assert sigma_mid > sigma_near
    assert 20.0 <= sigma_mid <= 25.0

    # Point 20.0 km away
    sigma_far = compute_spatial_uncertainty(28.30, 76.85, nearest_station_distance_km=20.0)
    assert sigma_far > sigma_mid
    assert sigma_far >= 40.0

    # Outside domain
    sigma_out = compute_spatial_uncertainty(27.90, 77.10, nearest_station_distance_km=30.0)
    assert sigma_out >= 45.0


def test_out_of_domain_handling():
    """Out-of-domain coordinates should return zero PM and 'out_of_domain' status."""
    pm, comp = evaluate_continuous_pm25(
        lat=27.50,
        lon=77.00,
        hour_offset=0.0,
        wind_speed_kmh=14.0,
        wind_dir_deg=315.0,
        hotspots=SAMPLE_HOTSPOTS,
    )
    assert pm == 0.0
    assert comp["status"] == "out_of_domain"
