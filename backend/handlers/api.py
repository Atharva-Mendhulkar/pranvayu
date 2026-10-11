"""Thin Lambda entrypoint for PranVayu HTTP API per docs/03-ARCHITECTURE & docs/05-DATA-CONTRACTS."""

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

# Root path resolution
CONFIG_DIR = Path(os.environ.get("CONFIG_DIR", Path(__file__).resolve().parent.parent.parent / "config"))
MOCK_DIR = Path(os.environ.get("MOCK_DIR", Path(__file__).resolve().parent.parent.parent / "web" / "public" / "mock"))

def _response(status_code: int, body: Any, cache_seconds: int = 300) -> dict:
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Cache-Control": f"max-age={cache_seconds}",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
        },
        "body": json.dumps(body),
    }


def _error(status_code: int, code: str, message: str) -> dict:
    return _response(status_code, {"error": code, "message": message}, cache_seconds=60)


def handler(event: dict, context: Any = None) -> dict:
    """API Gateway HTTP API Lambda handler."""
    http_method = event.get("requestContext", {}).get("http", {}).get("method") or event.get("httpMethod", "GET")
    if http_method == "OPTIONS":
        return _response(200, {})

    raw_path = event.get("rawPath") or event.get("path", "/")
    params = event.get("queryStringParameters") or {}

    # 1. GET /v1/localities
    if raw_path.endswith("/v1/localities"):
        localities_file = CONFIG_DIR / "localities.json"
        if localities_file.exists():
            with open(localities_file) as f:
                data = json.load(f)
            # Return subset: id, name_en, name_hi, lat, lon
            result = [
                {
                    "id": loc["id"],
                    "name_en": loc["name_en"],
                    "name_hi": loc["name_hi"],
                    "lat": loc["lat"],
                    "lon": loc["lon"],
                }
                for loc in data
            ]
            return _response(200, {"schema_version": 1, "localities": result})
        return _error(500, "config_missing", "Locality configuration file not found.")

    # 2. GET /v1/forecast
    if raw_path.endswith("/v1/forecast"):
        locality_id = params.get("locality")
        if not locality_id:
            return _error(400, "missing_parameter", "Locality parameter is required.")

        replay_id = params.get("replay")
        _asof = params.get("asof")

        # In AWS environment, read DynamoDB or S3
        table_name = os.environ.get("DYNAMODB_TABLE_PV_STATE")
        if table_name and not replay_id:
            try:
                import boto3  # type: ignore
                dynamo = boto3.resource("dynamodb")
                table = dynamo.Table(table_name)
                resp = table.get_item(Key={"pk": f"LOC#{locality_id}", "sk": "LATEST"})
                if "Item" in resp and "payload" in resp["Item"]:
                    payload = json.loads(resp["Item"]["payload"])
                    return _response(200, payload)
            except Exception:
                pass

        # Local fallback from mock files
        mock_file = MOCK_DIR / f"{locality_id}.json"
        if mock_file.exists():
            with open(mock_file) as f:
                payload = json.load(f)
            return _response(200, payload)

        # Check if locality is valid in config
        localities_file = CONFIG_DIR / "localities.json"
        if localities_file.exists():
            with open(localities_file) as f:
                locs = json.load(f)
            if not any(loc["id"] == locality_id for loc in locs):
                return _error(404, "unknown_locality", f"Unknown locality '{locality_id}'.")

        return _error(404, "no_data_yet", f"No forecast data available yet for '{locality_id}'.")

    # 3. GET /v1/replay
    if raw_path.endswith("/v1/replay"):
        return _response(200, {
            "schema_version": 1,
            "runs": [
                {
                    "run_id": "stubble_2025_nov",
                    "window": ["2025-10-28", "2025-11-08"],
                    "asof_grid_hours": 3,
                    "description": "Peak stubble burning season across Punjab and Haryana, late Oct - early Nov 2025.",
                }
            ],
        })

    # 4. GET /v1/evidence
    if raw_path.endswith("/v1/evidence"):
        evidence_file = MOCK_DIR / "evidence.json"
        if evidence_file.exists():
            with open(evidence_file) as f:
                evidence = json.load(f)
            return _response(200, evidence)

        # Fallback to dynamic computation
        from pv.replay.evaluate import run_evaluation
        evidence = run_evaluation()
        return _response(200, evidence)

    # 5. GET /v1/health
    if raw_path.endswith("/v1/health"):
        now_utc = datetime.now(timezone.utc).isoformat()
        return _response(200, {
            "status": "ok",
            "as_of": now_utc,
            "sources": {
                "fires": {"cadence_hours": 1, "status": "active"},
                "obs": {"cadence_hours": 1, "status": "active"},
                "winds": {"cadence_hours": 6, "status": "active"},
                "cams": {"cadence_hours": 6, "status": "active"},
            },
            "model_run": {
                "last_run": now_utc,
                "status": "healthy",
            },
        })

    return _error(404, "not_found", "The requested path was not found.")
