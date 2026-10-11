"""Lambda handler for ingesting NASA FIRMS active fire detections."""

import json
import logging
import os
from datetime import datetime, timezone
from typing import Any

from pv.sources.fires import get_fires

logger = logging.getLogger("pv.ingest_fires")
logger.setLevel(logging.INFO)


def handler(event: dict = None, context: Any = None) -> dict:
    """Ingest fires and write to S3 bucket if configured."""
    logger.info("Ingesting FIRMS fire detections...")
    fires = get_fires()
    count = len(fires)
    logger.info(f"Retrieved {count} fire detections.")

    bucket_name = os.environ.get("S3_BUCKET_NAME")
    if bucket_name:
        try:
            import boto3  # type: ignore
            s3 = boto3.client("s3")
            ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%MZ")
            key = f"raw/fires/{ts}.json"
            s3.put_object(
                Bucket=bucket_name,
                Key=key,
                Body=json.dumps([f.to_dict() for f in fires]),
                ContentType="application/json",
            )
            logger.info(f"Saved fires to s3://{bucket_name}/{key}")
        except Exception as e:
            logger.error(f"Failed to upload to S3: {e}")

    return {"status": "ok", "fire_count": count}
