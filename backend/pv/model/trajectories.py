"""Vectorized backward trajectory ensemble integration."""

import math
from dataclasses import dataclass

import numpy as np

from pv.sources.winds import WindSeries


@dataclass
class TrajectoryPoint:
    lat: float
    lon: float
    time_utc: int
    blh: float


@dataclass
class Trajectory:
    receptor_id: str
    arrival_time_utc: int
    level_hpa: int
    member_idx: int
    points: list[TrajectoryPoint]
    is_truncated: bool


class WindFieldInterpolator:
    """Fast linear in time, bilinear in space wind field interpolator."""

    def __init__(self, wind_series: WindSeries):
        self.wind_series = wind_series
        self.times = np.array([p.timestamp_utc for p in wind_series.hourly], dtype=np.int64)
        self.points = wind_series.hourly

    def get_uv_blh(self, lat: float, lon: float, time_utc: int, level_hpa: int) -> tuple[float, float, float]:
        """Interpolate (u, v, blh) at arbitrary (lat, lon, time_utc, level_hpa)."""
        if len(self.times) == 0:
            return 0.0, 0.0, 300.0

        idx = np.searchsorted(self.times, time_utc)
        if idx == 0:
            p = self.points[0]
            u, v = p.uv_at_level(level_hpa)
            return u, v, p.blh
        if idx >= len(self.times):
            p = self.points[-1]
            u, v = p.uv_at_level(level_hpa)
            return u, v, p.blh

        t0 = self.times[idx - 1]
        t1 = self.times[idx]
        frac = (time_utc - t0) / (t1 - t0)

        p0 = self.points[idx - 1]
        p1 = self.points[idx]

        u0, v0 = p0.uv_at_level(level_hpa)
        u1, v1 = p1.uv_at_level(level_hpa)

        u = (1.0 - frac) * u0 + frac * u1
        v = (1.0 - frac) * v0 + frac * v1
        blh = (1.0 - frac) * p0.blh + frac * p1.blh

        return u, v, blh


def run_backward_trajectory(
    receptor_id: str,
    receptor_lat: float,
    receptor_lon: float,
    arrival_time_utc: int,
    level_hpa: int,
    member_idx: int,
    interpolator: WindFieldInterpolator,
    duration_h: int = 60,
    step_min: int = 30,
    speed_factor: float = 1.0,
    angle_rad: float = 0.0,
    domain_bbox: tuple[float, float, float, float] = (73.5, 27.5, 78.5, 32.5),
    rng: np.random.Generator | None = None,
) -> Trajectory:
    """Integrate a single 2nd-order backward trajectory."""
    w, s, e, n = domain_bbox
    dt_sec = step_min * 60.0
    total_steps = int((duration_h * 3600) / dt_sec)

    curr_lat = receptor_lat
    curr_lon = receptor_lon
    curr_t = arrival_time_utc
    is_truncated = False

    cos_ang = math.cos(angle_rad)
    sin_ang = math.sin(angle_rad)

    points: list[TrajectoryPoint] = [
        TrajectoryPoint(curr_lat, curr_lon, curr_t, 300.0)
    ]

    # Pre-generate step noise if rng is present
    noise = rng.normal(0, 0.5, size=(total_steps, 2)) if rng else np.zeros((total_steps, 2))

    for step in range(total_steps):
        # 1. Wind at current position
        u1, v1, blh1 = interpolator.get_uv_blh(curr_lat, curr_lon, curr_t, level_hpa)
        # Apply member perturbations
        u_p1 = speed_factor * (u1 * cos_ang - v1 * sin_ang) + noise[step, 0]
        v_p1 = speed_factor * (u1 * sin_ang + v1 * cos_ang) + noise[step, 1]

        # Convert u (m/s) and v (m/s) to dlon/dt and dlat/dt
        # 1 deg lat approx 111,000 m; 1 deg lon approx 111,000 * cos(lat) m
        meters_per_deg_lat = 111000.0
        meters_per_deg_lon = 111000.0 * max(0.2, math.cos(math.radians(curr_lat)))

        # Backward in time: velocity is subtracted
        mid_lat = curr_lat - 0.5 * (v_p1 * dt_sec) / meters_per_deg_lat
        mid_lon = curr_lon - 0.5 * (u_p1 * dt_sec) / meters_per_deg_lon
        mid_t = int(curr_t - 0.5 * dt_sec)

        # 2. Wind at midpoint (2nd order midpoint method)
        u_mid, v_mid, blh_mid = interpolator.get_uv_blh(mid_lat, mid_lon, mid_t, level_hpa)
        u_pmid = speed_factor * (u_mid * cos_ang - v_mid * sin_ang) + noise[step, 0]
        v_pmid = speed_factor * (u_mid * sin_ang + v_mid * cos_ang) + noise[step, 1]

        next_lat = curr_lat - (v_pmid * dt_sec) / meters_per_deg_lat
        next_lon = curr_lon - (u_pmid * dt_sec) / meters_per_deg_lon
        next_t = int(curr_t - dt_sec)

        # Check bounds
        if not (w <= next_lon <= e and s <= next_lat <= n):
            is_truncated = True
            break

        curr_lat = next_lat
        curr_lon = next_lon
        curr_t = next_t

        points.append(TrajectoryPoint(round(curr_lat, 4), round(curr_lon, 4), curr_t, round(blh_mid, 1)))

    return Trajectory(
        receptor_id=receptor_id,
        arrival_time_utc=arrival_time_utc,
        level_hpa=level_hpa,
        member_idx=member_idx,
        points=points,
        is_truncated=is_truncated,
    )


def generate_ensemble_trajectories(
    receptors: list[dict],
    start_time_utc: int,
    wind_series: WindSeries,
    k_members: int = 24,
    horizon_hours: int = 48,
    interval_hours: int = 3,
    levels: list[int] = (975, 950, 925),
    seed: int = 42,
) -> list[Trajectory]:
    """Generate the full ensemble of backward trajectories."""
    interpolator = WindFieldInterpolator(wind_series)
    rng = np.random.default_rng(seed)

    arrival_times = [
        start_time_utc + (h * 3600)
        for h in range(0, horizon_hours + 1, interval_hours)
    ]

    all_trajectories: list[Trajectory] = []

    # Member perturbations
    speed_factors = 1.0 + rng.normal(0, 0.15, size=k_members)
    angle_rads = np.radians(rng.normal(0, 10.0, size=k_members))

    for rec in receptors:
        r_id = rec["id"]
        r_lat = rec["lat"]
        r_lon = rec["lon"]

        for arr_t in arrival_times:
            for lvl in levels:
                for k in range(k_members):
                    traj = run_backward_trajectory(
                        receptor_id=r_id,
                        receptor_lat=r_lat,
                        receptor_lon=r_lon,
                        arrival_time_utc=arr_t,
                        level_hpa=lvl,
                        member_idx=k,
                        interpolator=interpolator,
                        speed_factor=float(speed_factors[k]),
                        angle_rad=float(angle_rads[k]),
                        rng=rng,
                    )
                    all_trajectories.append(traj)

    return all_trajectories


def compute_trajectory_ensemble(
    rec_lat: float,
    rec_lon: float,
    winds: WindSeries,
    model_cfg: dict | None = None,
    receptor_id: str = "loc",
) -> list[Trajectory]:
    """Convenience wrapper for single receptor ensemble computation."""
    import time
    start_t = winds.hourly[0].timestamp_utc if winds.hourly else int(time.time())
    k = 24
    if model_cfg and "trajectories" in model_cfg:
        k = model_cfg["trajectories"].get("k_members", 24)
    receptors = [{"id": receptor_id, "lat": rec_lat, "lon": rec_lon}]
    return generate_ensemble_trajectories(
        receptors=receptors,
        start_time_utc=start_t,
        wind_series=winds,
        k_members=k,
    )
