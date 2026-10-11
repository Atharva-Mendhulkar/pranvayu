"""CAMS PM2.5 bias correction against station observations with uncertainty bands."""

import math
from dataclasses import dataclass

import numpy as np

from pv.sources.cams import CamsSeries
from pv.sources.obs import StationObsSeries


@dataclass
class CorrectedSeriesPoint:
    timestamp_utc: int
    p10: float
    p50: float
    p90: float
    observed: float | None = None
    is_forecast: bool = True


@dataclass
class CorrectionResult:
    locality_id: str
    series: list[CorrectedSeriesPoint]
    rho: float
    matched_hours_count: int
    is_calibrated: bool
    flags: list[str]


def compute_bias_ratio(
    cams: CamsSeries,
    obs: StationObsSeries,
    min_matched_hours: int = 12,
    window_h: int = 24,
    min_cams_val: float = 10.0,
    ratio_clip: tuple[float, float] = (0.5, 3.0),
) -> tuple[float, int, list[str]]:
    """Compute the bias ratio rho = median(obs / cams) over the matched window."""
    flags: list[str] = []
    if obs.is_stale:
        flags.append("stale_obs")
        return 1.0, 0, flags

    if not obs.latest_at:
        flags.append("missing_obs")
        return 1.0, 0, flags

    obs_dict = {
        r.timestamp_utc: r.pm2_5
        for r in obs.readings
        if r.pm2_5 is not None
    }
    cams_dict = {
        p.timestamp_utc: p.pm2_5
        for p in cams.hourly
        if p.pm2_5 >= min_cams_val
    }

    latest_t = obs.latest_at
    start_t = latest_t - (window_h * 3600)

    ratios = []
    for t, o_val in obs_dict.items():
        if start_t <= t <= latest_t and t in cams_dict:
            c_val = cams_dict[t]
            if c_val > 0:
                ratios.append(o_val / c_val)

    matched_count = len(ratios)
    if matched_count < min_matched_hours:
        flags.append("insufficient_matched_hours")
        return 1.0, matched_count, flags

    raw_rho = float(np.median(ratios))
    clipped_rho = float(np.clip(raw_rho, ratio_clip[0], ratio_clip[1]))
    return clipped_rho, matched_count, flags


def apply_cams_correction(
    cams: CamsSeries,
    obs: StationObsSeries,
    bands_config: dict | None = None,
    tau_b_h: float = 24.0,
) -> CorrectionResult:
    """Correct CAMS hourly series using observations and compute p10-p90 uncertainty bands."""
    flags: list[str] = []
    is_calibrated = bands_config is not None

    bands = bands_config or {
        "lead_buckets": {
            "0_6": {"p10": 0.70, "p90": 1.40},
            "6_24": {"p10": 0.70, "p90": 1.40},
            "24_48": {"p10": 0.70, "p90": 1.40},
        }
    }
    if not is_calibrated:
        flags.append("uncalibrated")

    rho, matched_count, bias_flags = compute_bias_ratio(cams, obs)
    flags.extend(bias_flags)

    obs_dict = {r.timestamp_utc: r.pm2_5 for r in obs.readings}
    latest_obs_t = obs.latest_at or (cams.hourly[0].timestamp_utc if cams.hourly else 0)
    last_obs_val = obs_dict.get(latest_obs_t)

    series_points: list[CorrectedSeriesPoint] = []

    for point in cams.hourly:
        t = point.timestamp_utc
        c_val = point.pm2_5
        obs_val = obs_dict.get(t)

        if t <= latest_obs_t:
            # Past hour: show observed value if present, else CAMS
            p50 = obs_val if obs_val is not None else c_val
            series_points.append(
                CorrectedSeriesPoint(
                    timestamp_utc=t,
                    p10=p50,
                    p50=p50,
                    p90=p50,
                    observed=obs_val,
                    is_forecast=False,
                )
            )
        else:
            # Forecast hour: compute lead h
            h = (t - latest_obs_t) / 3600.0

            if "stale_obs" in flags or "missing_obs" in flags or matched_count < 12:
                # Fallback to raw CAMS
                m = c_val
            else:
                rho_eff = 1.0 + (rho - 1.0) * math.exp(-h / tau_b_h)
                m = rho_eff * c_val

                # Near-term blend for h up to 6 hours
                if h <= 6.0 and last_obs_val is not None:
                    w = math.exp(-h / 3.0)
                    m = (w * last_obs_val) + ((1.0 - w) * m)

            # Band assignment by lead bucket
            if h <= 6.0:
                b = bands["lead_buckets"].get("0_6", {"p10": 0.7, "p90": 1.4})
            elif h <= 24.0:
                b = bands["lead_buckets"].get("6_24", {"p10": 0.7, "p90": 1.4})
            else:
                b = bands["lead_buckets"].get("24_48", {"p10": 0.6, "p90": 1.6})

            p10 = max(0.0, m * b["p10"])
            p90 = max(p10, m * b["p90"])

            series_points.append(
                CorrectedSeriesPoint(
                    timestamp_utc=t,
                    p10=round(p10, 1),
                    p50=round(m, 1),
                    p90=round(p90, 1),
                    observed=None,
                    is_forecast=True,
                )
            )

    return CorrectionResult(
        locality_id=obs.locality_id,
        series=series_points,
        rho=round(rho, 3),
        matched_hours_count=matched_count,
        is_calibrated=is_calibrated,
        flags=list(set(flags)),
    )


def apply_bias_correction(
    cams: CamsSeries,
    obs: StationObsSeries,
    model_cfg: dict | None = None,
    bands_cfg: dict | None = None,
) -> CorrectionResult:
    """Convenience wrapper for apply_cams_correction respecting model_cfg."""
    tau_b = 24.0
    if model_cfg and "bias_correction" in model_cfg:
        tau_b = model_cfg["bias_correction"].get("tau_b_hours", 24.0)
    return apply_cams_correction(cams, obs, bands_config=bands_cfg, tau_b_h=tau_b)
