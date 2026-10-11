"""Lambda handler for hourly model run per docs/03-ARCHITECTURE."""

import json
import logging
import os
from pathlib import Path
from typing import Any

import yaml
from pv.model.correction import apply_bias_correction
from pv.model.influence import evaluate_smoke_influence
from pv.model.trajectories import compute_trajectory_ensemble
from pv.payload.builder import build_forecast_payload
from pv.payload.validator import validate_forecast_payload
from pv.sources.cams import fetch_cams_forecast
from pv.sources.fires import get_fires
from pv.sources.obs import fetch_station_obs
from pv.sources.winds import fetch_wind_forecast

logger = logging.getLogger("pv.model_run")
logger.setLevel(logging.INFO)

CONFIG_DIR = Path(os.environ.get("CONFIG_DIR", Path(__file__).resolve().parent.parent.parent / "config"))


def run_pipeline_for_locality(
    locality: dict,
    fires: list[Any],
    wind_series: Any,
    cams_series: Any,
    obs_series: Any,
    model_cfg: dict,
    thresholds_cfg: dict,
    timetable_defaults: list[dict],
    grap_cfg: dict,
    smoke_levels_cfg: dict | None = None,
    bands_cfg: dict | None = None,
    mode: str = "live",
) -> dict:
    """Run end-to-end model pipeline for a single locality."""
    loc_lat = locality["lat"]
    loc_lon = locality["lon"]

    # 1. Bias correction
    correction = apply_bias_correction(
        cams=cams_series,
        obs=obs_series,
        model_cfg=model_cfg,
        bands_cfg=bands_cfg,
    )

    # 2. Trajectories ensemble
    trajectories = compute_trajectory_ensemble(
        rec_lat=loc_lat,
        rec_lon=loc_lon,
        winds=wind_series,
        model_cfg=model_cfg,
    )

    # 3. Fire grid & SII scoring, arrival window, sample paths
    smoke_summary = evaluate_smoke_influence(
        trajectories=trajectories,
        detections=fires,
        smoke_levels_cfg=smoke_levels_cfg,
    )

    # 4. Build payload
    payload = build_forecast_payload(
        locality=locality,
        correction=correction,
        smoke=smoke_summary,
        wind_series=wind_series,
        obs_series=obs_series,
        cams_series=cams_series,
        timetable_defaults=timetable_defaults,
        thresholds_cfg=thresholds_cfg,
        grap_cfg=grap_cfg,
        mode=mode,
    )

    # 5. Validate contract
    validate_forecast_payload(payload)
    return payload


def handler(event: dict = None, context: Any = None) -> dict:
    """Hourly model-run Lambda entrypoint."""
    logger.info("Starting PranVayu model-run...")

    with open(CONFIG_DIR / "localities.json") as f:
        localities = json.load(f)

    with open(CONFIG_DIR / "model.yaml") as f:
        model_cfg = yaml.safe_load(f)

    with open(CONFIG_DIR / "thresholds.yaml") as f:
        thresholds_cfg = yaml.safe_load(f)

    with open(CONFIG_DIR / "timetable_defaults.json") as f:
        timetable_defaults = json.load(f)

    with open(CONFIG_DIR / "grap.json") as f:
        grap_cfg = json.load(f)

    smoke_levels_cfg = None
    if (CONFIG_DIR / "smoke_levels.json").exists():
        with open(CONFIG_DIR / "smoke_levels.json") as f:
            smoke_levels_cfg = json.load(f)

    bands_cfg = None
    if (CONFIG_DIR / "bands.json").exists():
        with open(CONFIG_DIR / "bands.json") as f:
            bands_cfg = json.load(f)

    # Fetch sources (use fixtures if local/offline)
    fires = get_fires()
    table_name = os.environ.get("DYNAMODB_TABLE_PV_STATE")
    dynamo_table = None
    if table_name:
        try:
            import boto3  # type: ignore
            dynamo = boto3.resource("dynamodb")
            dynamo_table = dynamo.Table(table_name)
        except Exception as e:
            logger.warning(f"Could not connect to DynamoDB: {e}")

    success_count = 0
    results = {}

    for loc in localities:
        loc_id = loc["id"]
        try:
            winds = fetch_wind_forecast(loc["lat"], loc["lon"])
            cams = fetch_cams_forecast(loc["lat"], loc["lon"])
            obs = fetch_station_obs(loc_id, openaq_id=loc.get("openaq_location_id"))

            payload = run_pipeline_for_locality(
                locality=loc,
                fires=fires,
                wind_series=winds,
                cams_series=cams,
                obs_series=obs,
                model_cfg=model_cfg,
                thresholds_cfg=thresholds_cfg,
                timetable_defaults=timetable_defaults,
                grap_cfg=grap_cfg,
                smoke_levels_cfg=smoke_levels_cfg,
                bands_cfg=bands_cfg,
            )

            results[loc_id] = payload
            success_count += 1

            if dynamo_table:
                dynamo_table.put_item(
                    Item={
                        "pk": f"LOC#{loc_id}",
                        "sk": "LATEST",
                        "payload": json.dumps(payload),
                        "generated_at": payload["generated_at"],
                        "schema_version": 1,
                    }
                )
        except Exception as e:
            logger.error(f"Error executing pipeline for locality {loc_id}: {e}", exc_info=True)

    logger.info(f"Model-run complete. Successfully updated {success_count}/{len(localities)} localities.")
    return {
        "status": "success",
        "processed_localities": success_count,
        "total_localities": len(localities),
    }
