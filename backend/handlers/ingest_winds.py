"""Lambda handler for ingesting Open-Meteo wind forecasts."""

import json
import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from pv.sources.winds import fetch_wind_forecast

logger = logging.getLogger("pv.ingest_winds")
logger.setLevel(logging.INFO)

CONFIG_DIR = Path(os.environ.get("CONFIG_DIR", Path(__file__).resolve().parent.parent.parent / "config"))


def handler(event: dict = None, context: Any = None) -> dict:
    """Ingest wind forecasts for reference grid."""
    logger.info("Ingesting Open-Meteo winds...")
    # Reference central Delhi coordinates (or 121 grid batch)
    lat = 28.61
    lon = 77.23
    winds = fetch_wind_forecast(lat, lon)

    bucket_name = os.environ.get("S3_BUCKET_NAME")
    if bucket_name:
        try:
            import boto3  # type: ignore
            s3 = boto3.client("s3")
            ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%MZ")
            key = f"raw/winds/ecmwf_{ts}.json"
            s3.put_object(
                Bucket=bucket_name,
                Key=key,
                Body=json.dumps({"run_timestamp": winds.run_timestamp, "hours_count": len(winds.hours)}),
                ContentType="application/json",
            )
            logger.info(f"Saved winds to s3://{bucket_name}/{key}")
        except Exception as e:
            logger.error(f"Failed to upload winds to S3: {e}")

    return {"status": "ok", "wind_hours": len(winds.hours)}
