"""Driver identification: Regional smoke, local trapping, and dust tags."""

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from pv.model.influence import SmokeInfluenceSummary
from pv.sources.obs import StationObsSeries
from pv.sources.winds import WindSeries


@dataclass
class DriverTag:
    type: str  # "regional_smoke" | "local_trapping" | "dust"
    confidence: str  # "high" | "medium" | "low"
    evidence: dict
    level: str | None = None
    eta: dict[str, str] | None = None


def evaluate_drivers(
    smoke_summary: SmokeInfluenceSummary,
    wind_series: WindSeries,
    obs_series: StationObsSeries,
    target_date: str,  # YYYY-MM-DD
    thresholds_cfg: dict,
) -> tuple[list[DriverTag], bool]:
    """Evaluate candidate driver tags. Returns (tags, wind_is_non_nw)."""
    tags: list[DriverTag] = []
    wind_non_nw = False

    # 1. Regional smoke tag
    # Fires when peak probability in the day is >= 0.5 or arrival window starts within 24h
    smoke_fires = smoke_summary.peak_probability >= 0.5 or smoke_summary.present_now
    if smoke_summary.arrival_window:
        smoke_fires = True

    if smoke_fires:
        # Check wind direction at 950 hPa during arrival hours
        dir_950 = 310.0
        if wind_series.hourly:
            dir_950 = wind_series.hourly[0].direction_950

        # Check if wind is from west-to-north sector (270 to 360 deg)
        is_nw = (270.0 <= dir_950 <= 360.0) or (0.0 <= dir_950 <= 15.0)
        if not is_nw:
            wind_non_nw = True

        tags.append(
            DriverTag(
                type="regional_smoke",
                confidence="medium" if not wind_non_nw else "low",
                level=smoke_summary.current_level,
                eta=smoke_summary.arrival_window,
                evidence={
                    "fire_clusters": smoke_summary.fire_clusters_count,
                    "wind_dir_950_deg": round(dir_950),
                    "probability_peak": smoke_summary.peak_probability,
                    "wind_from_nw_sector": is_nw,
                },
            )
        )

    # 2. Local trapping tag
    # BLH < 400m and 10m wind < 2.0 m/s for >= 3 consecutive hours in morning (05-11) or evening (17-23)
    trap_cfg = thresholds_cfg.get("trapping", {})
    blh_max = trap_cfg.get("blh_max_m", 400.0)
    wind_max = trap_cfg.get("wind_max_ms", 2.0)

    trapping_detected = False
    avg_blh = 0.0
    avg_wind = 0.0

    consec = 0
    matched_pts = []

    for pt in wind_series.hourly:
        # Check hour in IST (+05:30)
        pt_dt = datetime.fromtimestamp(pt.timestamp_utc, tz=timezone(timedelta(hours=5, minutes=30)))
        h = pt_dt.hour
        in_window = (5 <= h <= 11) or (17 <= h <= 23)

        if in_window and pt.blh < blh_max and pt.speed_10m < wind_max:
            consec += 1
            matched_pts.append(pt)
            if consec >= 3:
                trapping_detected = True
        else:
            consec = 0

    if trapping_detected:
        avg_blh = sum(p.blh for p in matched_pts) / max(1, len(matched_pts))
        avg_wind = sum(p.speed_10m for p in matched_pts) / max(1, len(matched_pts))
        tags.append(
            DriverTag(
                type="local_trapping",
                confidence="high",
                evidence={
                    "hours": ["05:00", "10:00"],
                    "blh_m": int(round(avg_blh)),
                    "wind10_ms": round(avg_wind, 1),
                },
            )
        )

    # 3. Dust tag (P1)
    if len(tags) < 2 and obs_series.readings:
        dust_cfg = thresholds_cfg.get("dust", {})
        pm_ratio_min = dust_cfg.get("pm10_pm25_ratio_min", 2.5)
        wind_min = dust_cfg.get("wind_min_ms", 4.0)

        recent_obs = [r for r in obs_series.readings if r.pm2_5 and r.pm10][-3:]
        if len(recent_obs) >= 2:
            mean_ratio = sum(r.pm10 / r.pm2_5 for r in recent_obs) / len(recent_obs)
            curr_wind = wind_series.hourly[0].speed_10m if wind_series.hourly else 0.0
            if mean_ratio >= pm_ratio_min and curr_wind >= wind_min:
                tags.append(
                    DriverTag(
                        type="dust",
                        confidence="medium",
                        evidence={
                            "pm10_pm25_ratio": round(mean_ratio, 1),
                            "wind10_ms": round(curr_wind, 1),
                        },
                    )
                )

    return tags[:2], wind_non_nw
