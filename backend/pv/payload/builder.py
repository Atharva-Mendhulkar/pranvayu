"""Assemble the PranVayu forecast payload per docs/05-DATA-CONTRACTS."""

from datetime import datetime, timedelta, timezone

from pv.model.confidence import compute_day_confidence
from pv.model.correction import CorrectionResult
from pv.model.drivers import evaluate_drivers
from pv.model.influence import SmokeInfluenceSummary
from pv.model.rules import compute_day_verdicts, find_clean_window
from pv.sources.cams import CamsSeries
from pv.sources.obs import StationObsSeries
from pv.sources.winds import WindSeries


def build_forecast_payload(
    locality: dict,
    correction: CorrectionResult,
    smoke: SmokeInfluenceSummary,
    wind_series: WindSeries,
    obs_series: StationObsSeries,
    cams_series: CamsSeries,
    timetable_defaults: list[dict],
    thresholds_cfg: dict,
    grap_cfg: dict,
    mode: str = "live",
    replay_meta: dict | None = None,
    mock: bool = False,
) -> dict:
    """Build standardized forecast payload for a single locality."""
    now_utc = datetime.now(timezone.utc)
    now_ts = int(now_utc.timestamp())

    # Build days: Today, Tomorrow, Day after tomorrow in IST (+05:30)
    ist_tz = timezone(timedelta(hours=5, minutes=30))
    today_ist = now_utc.astimezone(ist_tz).date()

    days_data = []
    day_dates = [
        today_ist,
        today_ist + timedelta(days=1),
        today_ist + timedelta(days=2),
    ]

    # Calculate smoke arrival window length if present
    smoke_win_h = None
    if smoke.arrival_window:
        try:
            t1 = datetime.fromisoformat(smoke.arrival_window["from"]).timestamp()
            t2 = datetime.fromisoformat(smoke.arrival_window["to"]).timestamp()
            smoke_win_h = max(0.0, (t2 - t1) / 3600.0)
        except Exception:
            pass

    # Drivers evaluation
    driver_tags, wind_non_nw = evaluate_drivers(
        smoke, wind_series, obs_series, str(day_dates[0]), thresholds_cfg
    )

    has_smoke_tag = any(d.type == "regional_smoke" for d in driver_tags)

    flags = list(set(correction.flags))
    if wind_series.is_stale:
        flags.append("stale_winds")
    if cams_series.is_stale:
        flags.append("stale_cams")

    for i, d_date in enumerate(day_dates):
        lead_h = i * 24.0
        conf = compute_day_confidence(
            day_lead_h=lead_h,
            station_is_stale=obs_series.is_stale,
            matched_hours_count=correction.matched_hours_count,
            wind_is_stale=wind_series.is_stale,
            smoke_window_hours=smoke_win_h,
            wind_is_non_nw=wind_non_nw,
            is_calibrated=smoke.is_calibrated and correction.is_calibrated,
            has_smoke_tag=has_smoke_tag,
        )

        d_str = str(d_date)
        verdicts = compute_day_verdicts(
            series=correction.series,
            day_date=d_str,
            timetable=timetable_defaults,
            thresholds_cfg=thresholds_cfg,
            confidence=conf,
        )
        clean_win = find_clean_window(
            series=correction.series,
            day_date=d_str,
            thresholds_cfg=thresholds_cfg,
            confidence=conf,
        )

        days_data.append({
            "date": d_str,
            "confidence": conf,
            "verdicts": [
                {
                    "period_id": v.period_id,
                    "time": v.time,
                    "activity_type": v.activity_type,
                    "verdict": v.verdict,
                    "decision_value": v.decision_value,
                    "range": v.range,
                    "category": v.category,
                    "threshold_used": v.threshold_used,
                }
                for v in verdicts
            ],
            "clean_window": {
                "from": clean_win.from_time,
                "to": clean_win.to_time,
                "kind": clean_win.kind,
            },
        })

    # Prepare series for display (48 hours past + forecast)
    series_data = [
        {
            "t": datetime.fromtimestamp(p.timestamp_utc, tz=timezone.utc).isoformat(),
            "p10": int(round(p.p10)),
            "p50": int(round(p.p50)),
            "p90": int(round(p.p90)),
            "observed": int(round(p.observed)) if p.observed is not None else None,
        }
        for p in correction.series
    ]

    # Freshness timestamps
    freshness = {
        "fires_at": smoke.top_fires[0]["t"] if smoke.top_fires else now_utc.isoformat(),
        "winds_run": datetime.fromtimestamp(wind_series.run_timestamp, tz=timezone.utc).isoformat(),
        "obs_at": datetime.fromtimestamp(obs_series.latest_at or now_ts, tz=timezone.utc).isoformat() if obs_series.latest_at else None,
        "cams_run": datetime.fromtimestamp(cams_series.run_timestamp, tz=timezone.utc).isoformat(),
    }

    # Format drivers
    formatted_drivers = [
        {
            "type": d.type,
            "level": d.level,
            "confidence": d.confidence,
            "eta": d.eta,
            "evidence": d.evidence,
        }
        for d in driver_tags
    ]

    payload = {
        "schema_version": 1,
        "mode": mode,
        "replay": replay_meta,
        "generated_at": now_utc.isoformat(),
        "as_of": now_utc.isoformat(),
        "locality": {
            "id": locality["id"],
            "name_en": locality["name_en"],
            "name_hi": locality["name_hi"],
            "lat": locality["lat"],
            "lon": locality["lon"],
            "station_name": locality.get("station_name", locality["name_en"]),
        },
        "freshness": freshness,
        "flags": flags,
        "days": days_data,
        "series": series_data,
        "drivers": formatted_drivers,
        "smoke": {
            "present_now": smoke.present_now,
            "level_series": smoke.level_series,
            "fires": smoke.top_fires[:800],
            "paths": smoke.sample_paths[:3],
        },
        "grap": grap_cfg,
        "text": None,
    }

    if mock:
        payload["mock"] = True

    return payload
