"""Unit tests for multiscale pollution transport visualization algorithms.

Tests offline the mathematical transformations, direction conversions,
two-component core/halo concentration models, concentration-weighted sampling,
and zoom-adaptive visibility curves.
"""

import math

import pytest


def met_to_transport_deg(met_deg: float) -> float:
    """Convert meteorological wind direction (FROM) to transport direction (TOWARD)."""
    return (met_deg + 180.0) % 360.0


def compute_transport_uv(speed_mps: float, met_deg: float) -> tuple[float, float]:
    """Compute eastward (u) and northward (v) transport velocity in m/s.

    met_deg is meteorological direction wind blows FROM, clockwise from North.
    u is East (+), v is North (+).
    """
    transport_rad = math.radians(met_to_transport_deg(met_deg))
    u = speed_mps * math.sin(transport_rad)
    v = speed_mps * math.cos(transport_rad)
    return u, v


def compute_screen_dx_dy(speed_scale: float, met_deg: float) -> tuple[float, float]:
    """Compute screen-space displacement (dx: right/east, dy: down/south)."""
    transport_rad = math.radians(met_to_transport_deg(met_deg))
    dx = math.sin(transport_rad) * speed_scale
    dy = -math.cos(transport_rad) * speed_scale  # screen y increases downward
    return dx, dy


def evaluate_two_component_hotspot(
    dist_meters: float,
    base_pm: float,
    sigma_core: float = 1200.0,
    sigma_halo: float = 3200.0,
) -> float:
    """Evaluate two-component physical hotspot: localized Core + soft Halo."""
    core_weight = 0.75
    halo_weight = 0.25
    core_val = base_pm * core_weight * math.exp(-0.5 * (dist_meters / sigma_core) ** 2)
    halo_val = base_pm * halo_weight * math.exp(-0.5 * (dist_meters / sigma_halo) ** 2)
    return core_val + halo_val


def compute_hotspot_sampling_weights(pm_values: list[float], power: float = 1.8) -> list[float]:
    """Compute normalized spawn sampling probabilities proportional to f(C(x))."""
    raw_weights = [(pm / 100.0) ** power for pm in pm_values]
    total = sum(raw_weights)
    if total <= 0:
        return [1.0 / len(pm_values)] * len(pm_values)
    return [w / total for w in raw_weights]


def get_regional_arrow_opacity(zoom: float) -> float:
    """Zoom-adaptive opacity curve for regional transport arrows."""
    if zoom <= 10.0:
        return 1.0
    if zoom <= 11.5:
        return 1.0 - (zoom - 10.0) / 1.5 * 0.35  # 1.0 -> 0.65
    if zoom <= 13.5:
        return 0.65 - (zoom - 11.5) / 2.0 * 0.65  # 0.65 -> 0.0
    return 0.0


def get_local_indicator_opacity(zoom: float) -> float:
    """Zoom-adaptive opacity curve for localized corridor indicators."""
    if zoom < 11.5:
        return 0.0
    if zoom <= 12.5:
        return (zoom - 11.5) / 1.0 * 0.90  # 0.0 -> 0.90
    if zoom <= 13.8:
        return 0.90 - (zoom - 12.5) / 1.3 * 0.90  # 0.90 -> 0.0
    return 0.0


def aggregate_regional_transport(
    vectors: list[tuple[float, float, float]],  # (u, v, weight)
) -> tuple[float, float, float]:
    """Compute weighted regional transport vector and directional alignment coherence.

    Returns: (u_mean, v_mean, coherence_score)
    where coherence_score is 1.0 for perfectly aligned flow, and near 0.0 for conflicting flow.
    """
    total_w = sum(w for _, _, w in vectors)
    if total_w <= 0:
        return 0.0, 0.0, 0.0

    u_mean = sum(u * w for u, _, w in vectors) / total_w
    v_mean = sum(v * w for _, v, w in vectors) / total_w

    # Coherence = length of mean unit vectors
    mean_speed = math.hypot(u_mean, v_mean)
    expected_speed = sum(math.hypot(u, v) * w for u, v, w in vectors) / total_w
    coherence = mean_speed / max(expected_speed, 1e-6)

    return u_mean, v_mean, min(1.0, coherence)


# =========================================================================
# TEST SUITE
# =========================================================================

def test_meteorological_to_transport_direction_conversion():
    """Verify that wind FROM converts exactly to transport direction TOWARD."""
    test_cases = [
        (315.0, 135.0),  # NW -> SE (primary Delhi autumn transport)
        (0.0, 180.0),    # N -> S
        (360.0, 180.0),  # N -> S (edge)
        (90.0, 270.0),   # E -> W
        (180.0, 0.0),    # S -> N
        (270.0, 90.0),   # W -> E
        (225.0, 45.0),   # SW -> NE
    ]
    for met_deg, expected_trans_deg in test_cases:
        actual = met_to_transport_deg(met_deg)
        assert pytest.approx(actual, abs=1e-5) == expected_trans_deg


def test_geodesic_and_screen_velocity_components():
    """Verify u, v and screen dx, dy signs for Northwesterly wind."""
    speed_mps = 3.888  # ~14 km/h
    met_nw = 315.0     # Wind blowing from Northwest

    # Geodesic transport components
    u, v = compute_transport_uv(speed_mps, met_nw)
    # SE transport means Eastward (u > 0) and Southward (v < 0)
    assert u > 0.0
    assert v < 0.0
    assert pytest.approx(u, abs=1e-3) == speed_mps * math.sin(math.radians(135.0))
    assert pytest.approx(v, abs=1e-3) == speed_mps * math.cos(math.radians(135.0))

    # Screen coordinates (dx right, dy down)
    dx, dy = compute_screen_dx_dy(1.0, met_nw)
    assert dx > 0.0  # Rightward
    assert dy > 0.0  # Downward
    assert pytest.approx(dx, abs=1e-3) == math.sin(math.radians(135.0))
    assert pytest.approx(dy, abs=1e-3) == -math.cos(math.radians(135.0))


def test_two_component_hotspot_core_and_halo_separation():
    """Verify distinct Core (1200m) and Halo (3200m) without diffuse background blowout."""
    base_pm = 318.0  # Anand Vihar

    # Peak concentration at epicenter
    c_center = evaluate_two_component_hotspot(0.0, base_pm)
    assert pytest.approx(c_center, rel=1e-3) == base_pm

    # Near-core boundary (1500m): core has dropped significantly
    c_1500 = evaluate_two_component_hotspot(1500.0, base_pm)
    assert c_1500 < 0.60 * base_pm
    assert c_1500 > 0.25 * base_pm  # halo still provides recognizable presence

    # Outer perimeter (4000m): core is gone, halo is minimal
    c_4000 = evaluate_two_component_hotspot(4000.0, base_pm)
    assert c_4000 < 0.20 * base_pm

    # Distant background (7000m): concentration decays to negligible level (<5%)
    c_7000 = evaluate_two_component_hotspot(7000.0, base_pm)
    assert c_7000 < 0.05 * base_pm


def test_concentration_weighted_particle_sampling():
    """Verify that particles accumulate visibly into severe hotspots."""
    # Hotspots: Anand Vihar (318), Wazirpur (295), Bawana (284), Siri Fort (148), Mandir Marg (135)
    pm_list = [318.0, 295.0, 284.0, 148.0, 135.0]
    weights = compute_hotspot_sampling_weights(pm_list, power=1.8)

    assert len(weights) == 5
    assert pytest.approx(sum(weights), abs=1e-5) == 1.0

    # Anand Vihar should receive substantially higher sampling probability than Mandir Marg
    p_anand = weights[0]
    p_mandir = weights[4]
    ratio = p_anand / p_mandir

    # (3.18 / 1.35)^1.8 ~ 2.35^1.8 ~ 4.67
    assert 4.0 <= ratio <= 5.5
    assert p_anand > 0.30  # gets >30% of total particles across the 5 nodes


def test_zoom_adaptive_arrow_visibility_regimes():
    """Verify smooth zoom transitions for regional and local transport arrows."""
    # Regional view (z <= 10): full prominence
    assert get_regional_arrow_opacity(9.0) == 1.0
    assert get_regional_arrow_opacity(10.0) == 1.0
    assert get_local_indicator_opacity(10.0) == 0.0

    # City view (z = 12): regional arrows reduced, local indicators prominent
    reg_z12 = get_regional_arrow_opacity(12.0)
    loc_z12 = get_local_indicator_opacity(12.0)
    assert 0.35 <= reg_z12 <= 0.60
    assert 0.40 <= loc_z12 <= 0.90

    # Neighborhood view (z >= 14): both regional arrows and local corridor indicators hidden
    assert get_regional_arrow_opacity(14.0) == 0.0
    assert get_regional_arrow_opacity(15.0) == 0.0
    assert get_local_indicator_opacity(14.0) == 0.0


def test_regional_transport_vector_aggregation_and_coherence():
    """Verify dominant regional vector aggregation and conflicting flow handling."""
    # Case 1: Coherent Northwesterly flow across 3 regional stations
    u_nw, v_nw = compute_transport_uv(3.88, 315.0)
    coherent_vectors = [
        (u_nw, v_nw, 1.0),
        (u_nw * 1.05, v_nw * 0.95, 1.2),
        (u_nw * 0.95, v_nw * 1.05, 0.8),
    ]
    u_res, v_res, coherence = aggregate_regional_transport(coherent_vectors)
    assert u_res > 0.0 and v_res < 0.0
    assert coherence > 0.98  # Highly aligned flow

    # Case 2: Strongly conflicting flow (e.g. terrain shear or convergence)
    conflicting_vectors = [
        (3.0, 0.0, 1.0),   # Eastward
        (-3.0, 0.0, 1.0),  # Westward (canceling out)
    ]
    u_conf, v_conf, conf_coherence = aggregate_regional_transport(conflicting_vectors)
    assert pytest.approx(u_conf, abs=1e-5) == 0.0
    assert conf_coherence < 0.05  # Detected conflict, avoids forcing misleading arrow


def test_calm_and_missing_wind_fallback():
    """Verify graceful fallback under zero or calm wind."""
    u_calm, v_calm = compute_transport_uv(0.0, 315.0)
    assert u_calm == 0.0
    assert v_calm == 0.0
    dx_calm, dy_calm = compute_screen_dx_dy(0.0, 315.0)
    assert dx_calm == 0.0
    assert dy_calm == 0.0
