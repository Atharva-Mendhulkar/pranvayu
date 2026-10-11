"""Lambda handler for ingesting Open-Meteo CAMS air quality forecasts."""

import json
import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from pv.sources.cams import fetch_cams_forecast

logger = logging.getLogger("pv.ingest_cams")
logger.setLevel(logging.INFO)

CONFIG_DIR = Path(os.environ.get("CONFIG_DIR", Path(__file__).resolve().parent.parent.parent / "config"))


def handler(event: dict = None, context: Any = None) -> dict:
    """Ingest CAMS forecasts for all localities."""
    logger.info("Ingesting CAMS air quality forecasts...")
    with open(CONFIG_DIR / "localities.json") as f:
        localities = json.load(f)

    cams_data = {}
    for loc in localities:
        loc_id = loc["id"]
        cams = fetch_cams_forecast(loc["lat"], loc["lon"])
        cams_data[loc_id] = {
            "run_timestamp": cams.run_timestamp,
            "forecast_count": len(cams.forecast_pm25),
        }

    bucket_name = os.environ.get("S3_BUCKET_NAME")
    if bucket_name:
        try:
            import boto3  # type: ignore
            s3 = boto3.client("s3")
            ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%MZ")
            key = f"raw/cams/cams_{ts}.json"
            s3.put_object(
                Bucket=bucket_name,
                Key=key,
                Body=json.dumps(cams_data),
                ContentType="application/json",
            )
            logger.info(f"Saved CAMS forecasts to s3://{bucket_name}/{key}")
        except Exception as e:
            logger.error(f"Failed to upload CAMS to S3: {e}")

    return {"status": "ok", "localities_ingested": len(cams_data)}
