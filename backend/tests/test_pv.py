"""Unit tests for PranVayu backend algorithms, sources, rules, and payloads."""

from pathlib import Path

from pv.model.confidence import compute_day_confidence
from pv.model.correction import apply_bias_correction
from pv.model.influence import (
    evaluate_smoke_influence,
    haversine_km,
)
from pv.model.rules import (
    evaluate_decision_value,
    evaluate_verdict,
    get_cpcb_category,
)
from pv.model.trajectories import (
    WindFieldInterpolator,
    compute_trajectory_ensemble,
)
from pv.payload.builder import build_forecast_payload
from pv.payload.validator import validate_forecast_payload
from pv.replay.evaluate import run_evaluation
from pv.sources.cams import get_cams
from pv.sources.fires import get_fires
from pv.sources.obs import fetch_station_obs
from pv.sources.winds import get_winds

FIXTURES_DIR = Path(__file__).parent / "fixtures"


def test_haversine_km():
    # Distance between Delhi (28.61, 77.23) and Chandigarh (30.73, 76.78) ~ 240 km
    d = haversine_km(28.61, 77.23, 30.73, 76.78)
    assert 230.0 < d < 260.0


def test_firms_parsing_and_deduplication():
    fires = get_fires(fixtures_path=str(FIXTURES_DIR / "fires_snpp.csv"))
    assert len(fires) > 0
    # Every detection has valid coordinates and positive FRP
    for f in fires:
        assert 25.0 <= f.latitude <= 35.0
        assert 70.0 <= f.longitude <= 80.0
        assert f.frp > 0


def test_winds_source_and_interpolator():
    winds = get_winds(fixtures_path=str(FIXTURES_DIR / "winds_dwarka.json"))
    assert len(winds.hourly) > 0
    interp = WindFieldInterpolator(winds)
    first_t = winds.hourly[0].timestamp_utc
    u, v, blh = interp.get_uv_blh(28.59, 77.05, first_t, 950)
    assert isinstance(u, float)
    assert isinstance(v, float)
    assert blh > 0


def test_cams_bias_correction():
    cams = get_cams(fixtures_path=str(FIXTURES_DIR / "cams_dwarka.json"))
    obs = fetch_station_obs("dwarka")
    correction = apply_bias_correction(cams, obs)
    assert len(correction.series) > 0
    # Verify p10 <= p50 <= p90
    for pt in correction.series:
        assert pt.p10 <= pt.p50 <= pt.p90 + 1e-5


def test_trajectory_ensemble_and_smoke_influence():
    winds = get_winds(fixtures_path=str(FIXTURES_DIR / "winds_dwarka.json"))
    fires = get_fires(fixtures_path=str(FIXTURES_DIR / "fires_snpp.csv"))
    trajectories = compute_trajectory_ensemble(28.59, 77.05, winds)
    assert len(trajectories) > 0

    smoke = evaluate_smoke_influence(trajectories, fires)
    assert smoke.receptor_id == "loc"
    assert len(smoke.sample_paths) <= 3
    assert len(smoke.top_fires) <= 800
    assert smoke.peak_probability >= 0.0


def test_rules_verdicts_and_clean_window():
    thresh = {
        "activities": {
            "light": {"go_max": 60, "limit_max": 90},
            "strenuous": {"go_max": 30, "limit_max": 60},
        }
    }
    # Light activity: Go <= 60, Limit 61-90, Skip > 90
    assert evaluate_verdict(50.0, "light", thresh)[0] == "go"
    assert evaluate_verdict(75.0, "light", thresh)[0] == "limit"
    assert evaluate_verdict(95.0, "light", thresh)[0] == "skip"

    # Strenuous activity: Go <= 30, Limit 31-60, Skip > 60
    assert evaluate_verdict(25.0, "strenuous", thresh)[0] == "go"
    assert evaluate_verdict(45.0, "strenuous", thresh)[0] == "limit"
    assert evaluate_verdict(65.0, "strenuous", thresh)[0] == "skip"

    # Decision value selection by confidence tier
    assert evaluate_decision_value(80.0, 120.0, "high") == 80
    assert evaluate_decision_value(80.0, 120.0, "medium") == 100
    assert evaluate_decision_value(80.0, 120.0, "low") == 120


def test_cpcb_categories():
    assert get_cpcb_category(25.0) == "good"
    assert get_cpcb_category(45.0) == "satisfactory"
    assert get_cpcb_category(80.0) == "moderate"
    assert get_cpcb_category(105.0) == "poor"
    assert get_cpcb_category(180.0) == "very_poor"
    assert get_cpcb_category(350.0) == "severe"


def test_confidence_tiers():
    conf_high = compute_day_confidence(
        day_lead_h=0.0,
        station_is_stale=False,
        matched_hours_count=20,
        wind_is_stale=False,
        smoke_window_hours=4.0,
        wind_is_non_nw=False,
        is_calibrated=True,
        has_smoke_tag=False,
    )
    assert conf_high == "high"

    conf_low = compute_day_confidence(
        day_lead_h=48.0,
        station_is_stale=True,
        matched_hours_count=5,
        wind_is_stale=True,
        smoke_window_hours=12.0,
        wind_is_non_nw=True,
        is_calibrated=False,
        has_smoke_tag=True,
    )
    assert conf_low == "low"


def test_full_payload_validation(tmp_path):
    cams = get_cams(fixtures_path=str(FIXTURES_DIR / "cams_dwarka.json"))
    obs = fetch_station_obs("dwarka")
    winds = get_winds(fixtures_path=str(FIXTURES_DIR / "winds_dwarka.json"))
    fires = get_fires(fixtures_path=str(FIXTURES_DIR / "fires_snpp.csv"))

    correction = apply_bias_correction(cams, obs)
    trajectories = compute_trajectory_ensemble(28.59, 77.05, winds)
    smoke = evaluate_smoke_influence(trajectories, fires)

    locality = {
        "id": "dwarka",
        "name_en": "Dwarka",
        "name_hi": "द्वारका",
        "lat": 28.59,
        "lon": 77.05,
        "station_name": "Dwarka Sector 8",
    }
    thresholds = {
        "activities": {
            "light": {"go_max": 60, "limit_max": 90},
            "strenuous": {"go_max": 30, "limit_max": 60},
        },
        "period_durations_min": {"arrival": 30, "assembly": 30, "break": 30, "pe": 45, "dispersal": 30},
        "clean_window": {"start_hour": 6, "end_hour": 19, "window_minutes": 60, "step_minutes": 30},
    }
    timetable = [
        {"period_id": "arrival", "time": "07:30", "activity_type": "light"},
        {"period_id": "assembly", "time": "07:45", "activity_type": "light"},
        {"period_id": "break", "time": "10:30", "activity_type": "light"},
        {"period_id": "pe", "time": "11:30", "activity_type": "strenuous"},
        {"period_id": "dispersal", "time": "14:30", "activity_type": "light"},
    ]
    grap = {"stage": "II", "effective_date": "2026-10-10", "source_url": "https://caqm.nic.in", "stale": False}

    payload = build_forecast_payload(
        locality=locality,
        correction=correction,
        smoke=smoke,
        wind_series=winds,
        obs_series=obs,
        cams_series=cams,
        timetable_defaults=timetable,
        thresholds_cfg=thresholds,
        grap_cfg=grap,
    )

    assert validate_forecast_payload(payload) is True
    assert payload["locality"]["id"] == "dwarka"
    assert len(payload["days"]) == 3
    assert len(payload["series"]) > 0


def test_evaluation_metrics():
    evidence = run_evaluation()
    assert evidence["schema_version"] == 1
    assert "m1_events" in evidence["metrics"]
    assert "m2_error" in evidence["metrics"]
    assert "m3_verdicts" in evidence["metrics"]
    assert "m4_calibration" in evidence["metrics"]
    assert "m5_smoke_effect" in evidence["metrics"]
    assert evidence["metrics"]["m1_events"]["hit_rate"] >= 0.5
