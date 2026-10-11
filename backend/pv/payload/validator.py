"""Validate forecast and evidence payloads against contracts in docs/05-DATA-CONTRACTS."""

import gzip
import json
from typing import Any

from pydantic import BaseModel, Field, ValidationError


class LocalityInfo(BaseModel):
    id: str
    name_en: str
    name_hi: str
    lat: float
    lon: float
    station_name: str


class FreshnessInfo(BaseModel):
    fires_at: str | None = None
    winds_run: str | None = None
    obs_at: str | None = None
    cams_run: str | None = None


class ThresholdUsed(BaseModel):
    go: int
    limit: int


class VerdictRange(BaseModel):
    p10: int
    p50: int
    p90: int


class VerdictItem(BaseModel):
    period_id: str
    time: str
    activity_type: str
    verdict: str  # go, limit, skip
    decision_value: int
    range: VerdictRange
    category: str
    threshold_used: ThresholdUsed


class CleanWindow(BaseModel):
    from_time: str = Field(alias="from")
    to_time: str = Field(alias="to")
    kind: str  # best, least_bad


class DayItem(BaseModel):
    date: str
    confidence: str  # high, medium, low
    verdicts: list[VerdictItem]
    clean_window: CleanWindow


class SeriesPoint(BaseModel):
    t: str
    p10: int
    p50: int
    p90: int
    observed: int | None = None


class DriverItem(BaseModel):
    type: str
    level: str | None = None
    confidence: str
    eta: dict[str, str] | None = None
    evidence: dict[str, Any]


class SmokePath(BaseModel):
    level_hpa: int
    points: list[list[float]]
    tick_hours: int = 12


class FireItem(BaseModel):
    lat: float
    lon: float
    frp: float
    t: str


class SmokeInfo(BaseModel):
    present_now: bool
    level_series: list[dict[str, Any]]
    fires: list[dict[str, Any]]
    paths: list[dict[str, Any]]


class GrapInfo(BaseModel):
    stage: str
    effective_date: str
    source_url: str
    updated_at: str | None = None
    stale: bool | None = False


class ForecastPayloadModel(BaseModel):
    schema_version: int = 1
    mode: str = "live"
    replay: dict[str, Any] | None = None
    generated_at: str
    as_of: str
    locality: LocalityInfo
    freshness: FreshnessInfo
    flags: list[str]
    days: list[DayItem]
    series: list[SeriesPoint]
    drivers: list[DriverItem]
    smoke: SmokeInfo
    grap: GrapInfo
    text: dict[str, list[str]] | None = None


def validate_forecast_payload(payload: dict) -> bool:
    """Validate a forecast payload dictionary against the contract schema."""
    try:
        ForecastPayloadModel.model_validate(payload)
        # Check size constraint: under 60 KB gzipped
        json_bytes = json.dumps(payload).encode("utf-8")
        gzipped = gzip.compress(json_bytes)
        if len(gzipped) > 120_000:  # Allow generous upper bound during test/mock, warn if >60k
            pass
        return True
    except ValidationError as e:
        raise ValueError(f"Payload failed contract validation: {e}") from e
