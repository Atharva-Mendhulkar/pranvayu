"""Lambda handler for ingesting OpenAQ station air quality observations."""

import json
import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from pv.sources.obs import fetch_station_obs

logger = logging.getLogger("pv.ingest_obs")
logger.setLevel(logging.INFO)

CONFIG_DIR = Path(os.environ.get("CONFIG_DIR", Path(__file__).resolve().parent.parent.parent / "config"))


def handler(event: dict = None, context: Any = None) -> dict:
    """Ingest station observations for all 12 localities."""
    logger.info("Ingesting OpenAQ observations...")
    with open(CONFIG_DIR / "localities.json") as f:
        localities = json.load(f)

    obs_data = {}
    for loc in localities:
        loc_id = loc["id"]
        obs_series = fetch_station_obs(loc_id, openaq_id=loc.get("openaq_location_id"))
        obs_data[loc_id] = {
            "latest_pm25": obs_series.latest_pm25,
            "latest_at": obs_series.latest_at,
            "hourly_count": len(obs_series.hourly_pm25),
            "is_stale": obs_series.is_stale,
        }

    bucket_name = os.environ.get("S3_BUCKET_NAME")
    if bucket_name:
        try:
            import boto3  # type: ignore
            s3 = boto3.client("s3")
            ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%MZ")
            key = f"raw/obs/{ts}.json"
            s3.put_object(
                Bucket=bucket_name,
                Key=key,
                Body=json.dumps(obs_data),
                ContentType="application/json",
            )
            logger.info(f"Saved observations to s3://{bucket_name}/{key}")
        except Exception as e:
            logger.error(f"Failed to upload observations to S3: {e}")

    return {"status": "ok", "stations_ingested": len(obs_data)}
