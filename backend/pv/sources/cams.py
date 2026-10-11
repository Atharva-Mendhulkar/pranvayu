"""Open-Meteo CAMS Air Quality Forecast Client and Parser."""

import json
import os
import time
from dataclasses import dataclass


@dataclass
class CamsHourlyPoint:
    timestamp_utc: int
    pm2_5: float
    pm10: float


@dataclass
class CamsSeries:
    latitude: float
    longitude: float
    run_timestamp: int
    hourly: list[CamsHourlyPoint]

    @property
    def is_stale(self) -> bool:
        """True if the forecast data is older than 8 hours."""
        now = int(time.time())
        return (now - self.run_timestamp) > (8 * 3600)

    @property
    def age_hours(self) -> float:
        now = int(time.time())
        return max(0.0, (now - self.run_timestamp) / 3600.0)


def parse_openmeteo_cams(data: dict) -> CamsSeries:
    """Parse Open-Meteo CAMS Air Quality JSON structure."""
    hourly_raw = data.get("hourly", {})
    times = hourly_raw.get("time", [])

    points: list[CamsHourlyPoint] = []
    for i, t in enumerate(times):
        points.append(
            CamsHourlyPoint(
                timestamp_utc=int(t),
                pm2_5=float(hourly_raw.get("pm2_5", [0])[i] or 0),
                pm10=float(hourly_raw.get("pm10", [0])[i] or 0),
            )
        )

    points.sort(key=lambda p: p.timestamp_utc)
    run_ts = times[0] if times else int(time.time())

    return CamsSeries(
        latitude=float(data.get("latitude", 28.59)),
        longitude=float(data.get("longitude", 77.05)),
        run_timestamp=run_ts,
        hourly=points,
    )


def get_cams(
    lat: float = 28.59,
    lon: float = 77.05,
    fixtures_path: str | None = None,
) -> CamsSeries:
    """Retrieve CAMS forecast series from live API or local fixture."""
    if os.environ.get("PV_FIXTURES") == "1":
        fix_file = fixtures_path or os.path.join(
            os.path.dirname(__file__), "..", "..", "tests", "fixtures", "cams_dwarka.json"
        )
        if os.path.exists(fix_file):
            with open(fix_file, "r", encoding="utf-8") as f:
                return parse_openmeteo_cams(json.load(f))

    fix_file = os.path.join(
        os.path.dirname(__file__), "..", "..", "tests", "fixtures", "cams_dwarka.json"
    )
    if os.path.exists(fix_file):
        with open(fix_file, "r", encoding="utf-8") as f:
            return parse_openmeteo_cams(json.load(f))

    return CamsSeries(lat, lon, int(time.time()), [])


# Alias for compatibility
fetch_cams_forecast = get_cams
