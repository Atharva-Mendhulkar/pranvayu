"""Smoke influence index (SII), trajectory scoring, and arrival window estimation."""

import math
from dataclasses import dataclass
from datetime import datetime, timezone

import numpy as np

from pv.model.trajectories import Trajectory
from pv.sources.fires import FireDetection


@dataclass
class AggregatedFireSource:
    lat: float
    lon: float
    timestamp_utc: int
    frp: float


@dataclass
class SmokeInfluenceSummary:
    receptor_id: str
    present_now: bool
    arrival_window: dict[str, str] | None  # from, to (ISO strings)
    peak_probability: float
    current_level: str  # "low" | "moderate" | "high"
    level_series: list[dict]  # t, p, level
    sample_paths: list[dict]
    top_fires: list[dict]
    fire_clusters_count: int
    is_calibrated: bool


def aggregate_fires(
    detections: list[FireDetection],
    grid_deg: float = 0.1,
    window_h: int = 6,
    max_sources: int = 1500,
) -> list[AggregatedFireSource]:
    """Bin detections to 0.1 degree cells and 6-hour bins; sum FRP; keep top sources."""
    if not detections:
        return []

    clusters: dict[tuple[float, float, int], float] = {}

    for d in detections:
        # Round to cell center
        c_lat = round(math.floor(d.latitude / grid_deg) * grid_deg + (grid_deg / 2.0), 3)
        c_lon = round(math.floor(d.longitude / grid_deg) * grid_deg + (grid_deg / 2.0), 3)

        ts = int(d.acq_datetime_utc.timestamp())
        bin_ts = (ts // (window_h * 3600)) * (window_h * 3600)

        key = (c_lat, c_lon, bin_ts)
        clusters[key] = clusters.get(key, 0.0) + d.frp

    sources = [
        AggregatedFireSource(lat=k[0], lon=k[1], timestamp_utc=k[2], frp=round(frp, 1))
        for k, frp in clusters.items()
    ]

    sources.sort(key=lambda s: s.frp, reverse=True)
    return sources[:max_sources]


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance in kilometers between two coordinates."""
    r = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)

    a = math.sin(dphi / 2.0) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2.0) ** 2
    return 2.0 * r * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))


def score_trajectory_influence(
    trajectory: Trajectory,
    sources: list[AggregatedFireSource],
    sigma0_km: float = 20.0,
    sigma_growth: float = 1.0,
    blh_ref_m: float = 400.0,
    decay_h: float = 72.0,
) -> float:
    """Compute the Smoke Influence Index (SII) for a single backward trajectory."""
    if not trajectory.points or not sources:
        return 0.0

    total_sii = 0.0
    arr_t = trajectory.arrival_time_utc

    for src in sources:
        f_lat = src.lat
        f_lon = src.lon
        f_t = src.timestamp_utc
        f_frp = src.frp

        best_contrib = 0.0

        for pt in trajectory.points:
            # age in hours: parcel time minus fire time
            age = (pt.time_utc - f_t) / 3600.0
            if age < -6.0 or age > 36.0:
                continue

            # Time weight H
            if age <= 12.0:
                h_weight = 1.0
            else:
                h_weight = max(0.0, 1.0 - (age - 12.0) / 24.0)

            # Spatial weight G
            d_km = haversine_km(pt.lat, pt.lon, f_lat, f_lon)
            sigma = sigma0_km + sigma_growth * max(age, 0.0)
            g_weight = math.exp(-0.5 * (d_km / sigma) ** 2)

            # Boundary layer mixing factor M
            m_factor = float(np.clip(pt.blh / blh_ref_m, 0.25, 1.0))

            # Travel decay D
            travel_h = max(0.0, (arr_t - pt.time_utc) / 3600.0)
            d_decay = math.exp(-travel_h / decay_h)

            step_contrib = g_weight * h_weight * m_factor * d_decay
            best_contrib = max(best_contrib, step_contrib)

        total_sii += f_frp * best_contrib

    return total_sii


def evaluate_smoke_influence(
    trajectories: list[Trajectory],
    detections: list[FireDetection],
    smoke_levels_cfg: dict | None = None,
) -> SmokeInfluenceSummary:
    """Score ensemble trajectories against fire sources and calculate probability and arrival window."""
    sources = aggregate_fires(detections)
    is_calibrated = smoke_levels_cfg is not None

    q50 = smoke_levels_cfg.get("q50", 15.0) if smoke_levels_cfg else 15.0
    q85 = smoke_levels_cfg.get("q85", 45.0) if smoke_levels_cfg else 45.0

    if not trajectories:
        return SmokeInfluenceSummary(
            receptor_id="unknown",
            present_now=False,
            arrival_window=None,
            peak_probability=0.0,
            current_level="low",
            level_series=[],
            sample_paths=[],
            top_fires=[],
            fire_clusters_count=0,
            is_calibrated=is_calibrated,
        )

    r_id = trajectories[0].receptor_id

    # Group trajectories by arrival time
    by_arr_time: dict[int, list[Trajectory]] = {}
    for t in trajectories:
        by_arr_time.setdefault(t.arrival_time_utc, []).append(t)

    sorted_arr_times = sorted(by_arr_time.keys())
    level_series: list[dict] = []
    p_by_time: dict[int, float] = {}

    for arr_t in sorted_arr_times:
        trajs_at_t = by_arr_time[arr_t]
        sii_vals = [
            score_trajectory_influence(tr, sources)
            for tr in trajs_at_t
        ]

        if sii_vals:
            med_sii = float(np.median(sii_vals))
            # Fraction of members >= moderate threshold q50
            prob = float(np.mean([1.0 if s >= q50 else 0.0 for s in sii_vals]))
        else:
            med_sii = 0.0
            prob = 0.0

        p_by_time[arr_t] = prob

        # Determine level
        if med_sii >= q85:
            lvl = "high"
        elif med_sii >= q50:
            lvl = "moderate"
        else:
            lvl = "low"

        dt_iso = datetime.fromtimestamp(arr_t, tz=timezone.utc).isoformat()
        level_series.append({
            "t": dt_iso,
            "p": round(prob, 2),
            "level": lvl,
            "median_sii": round(med_sii, 1),
        })

    # Arrival window logic (04-ALGORITHMS section 4)
    now_ts = sorted_arr_times[0] if sorted_arr_times else 0
    p_now = p_by_time.get(now_ts, 0.0)
    present_now = p_now >= 0.5
    peak_p = max(p_by_time.values()) if p_by_time else 0.0

    arrival_window: dict[str, str] | None = None

    if present_now:
        # Already present, report window until p falls below 0.25
        end_t = None
        for t in sorted_arr_times:
            if p_by_time[t] < 0.25:
                end_t = t
                break
        if end_t:
            arrival_window = {
                "from": datetime.fromtimestamp(now_ts, tz=timezone.utc).isoformat(),
                "to": datetime.fromtimestamp(end_t, tz=timezone.utc).isoformat(),
            }
        else:
            arrival_window = {
                "from": datetime.fromtimestamp(now_ts, tz=timezone.utc).isoformat(),
                "to": datetime.fromtimestamp(sorted_arr_times[-1], tz=timezone.utc).isoformat(),
            }
    elif peak_p >= 0.25:
        first_ge_25 = next((t for t in sorted_arr_times if p_by_time[t] >= 0.25), None)
        first_ge_75 = next((t for t in sorted_arr_times if p_by_time[t] >= 0.75), None)
        if not first_ge_75:
            # If 0.75 is never reached, use time of peak probability
            first_ge_75 = max(sorted_arr_times, key=lambda t: p_by_time[t])

        if first_ge_25:
            arrival_window = {
                "from": datetime.fromtimestamp(first_ge_25, tz=timezone.utc).isoformat(),
                "to": datetime.fromtimestamp(max(first_ge_25, first_ge_75), tz=timezone.utc).isoformat(),
            }

    # Extract 3 sample paths (one per release level: 975, 950, 925 hPa)
    sample_paths = []
    for lvl in (975, 950, 925):
        lvl_trajs = [t for t in trajectories if t.level_hpa == lvl and t.arrival_time_utc == sorted_arr_times[min(4, len(sorted_arr_times)-1)]]
        if lvl_trajs:
            # Choose median length / median trajectory
            chosen = lvl_trajs[len(lvl_trajs) // 2]
            coords = [[pt.lat, pt.lon] for pt in chosen.points[:60]]
            sample_paths.append({
                "level_hpa": lvl,
                "points": coords,
                "tick_hours": 12,
            })

    # Top fires for display (at most 800)
    top_fires = [
        {
            "lat": s.lat,
            "lon": s.lon,
            "frp": s.frp,
            "t": datetime.fromtimestamp(s.timestamp_utc, tz=timezone.utc).isoformat(),
        }
        for s in sources[:800]
    ]

    curr_lvl = level_series[0]["level"] if level_series else "low"

    return SmokeInfluenceSummary(
        receptor_id=r_id,
        present_now=present_now,
        arrival_window=arrival_window,
        peak_probability=round(peak_p, 2),
        current_level=curr_lvl,
        level_series=level_series,
        sample_paths=sample_paths,
        top_fires=top_fires,
        fire_clusters_count=len(sources),
        is_calibrated=is_calibrated,
    )
