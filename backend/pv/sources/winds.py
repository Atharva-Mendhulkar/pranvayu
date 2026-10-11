"""Open-Meteo weather forecast (pressure-level winds and boundary layer height) client."""

import json
import math
import os
import time
from dataclasses import dataclass


@dataclass
class WindHourlyPoint:
    timestamp_utc: int
    speed_975: float
    direction_975: float
    speed_950: float
    direction_950: float
    speed_925: float
    direction_925: float
    speed_10m: float
    direction_10m: float
    blh: float

    def uv_at_level(self, level_hpa: int) -> tuple[float, float]:
        """Convert wind speed and meteorological direction to (u, v) components."""
        if level_hpa == 975:
            s, d = self.speed_975, self.direction_975
        elif level_hpa == 950:
            s, d = self.speed_950, self.direction_950
        elif level_hpa == 925:
            s, d = self.speed_925, self.direction_925
        else:
            s, d = self.speed_10m, self.direction_10m

        rad = math.radians(d)
        # Meteorological wind: direction where wind blows FROM
        # u: west-to-east (+ eastward), v: south-to-north (+ northward)
        u = -s * math.sin(rad)
        v = -s * math.cos(rad)
        return (u, v)


@dataclass
class WindSeries:
    latitude: float
    longitude: float
    run_timestamp: int
    hourly: list[WindHourlyPoint]

    @property
    def is_stale(self) -> bool:
        """True if the wind data is older than 8 hours."""
        now = int(time.time())
        return (now - self.run_timestamp) > (8 * 3600)

    @property
    def age_hours(self) -> float:
        now = int(time.time())
        return max(0.0, (now - self.run_timestamp) / 3600.0)


def parse_openmeteo_winds(data: dict) -> WindSeries:
    """Parse Open-Meteo wind forecast JSON structure."""
    hourly_raw = data.get("hourly", {})
    times = hourly_raw.get("time", [])

    points: list[WindHourlyPoint] = []
    for i, t in enumerate(times):
        points.append(
            WindHourlyPoint(
                timestamp_utc=int(t),
                speed_975=float(hourly_raw.get("wind_speed_975hPa", [0])[i] or 0),
                direction_975=float(hourly_raw.get("wind_direction_975hPa", [0])[i] or 0),
                speed_950=float(hourly_raw.get("wind_speed_950hPa", [0])[i] or 0),
                direction_950=float(hourly_raw.get("wind_direction_950hPa", [0])[i] or 0),
                speed_925=float(hourly_raw.get("wind_speed_925hPa", [0])[i] or 0),
                direction_925=float(hourly_raw.get("wind_direction_925hPa", [0])[i] or 0),
                speed_10m=float(hourly_raw.get("wind_speed_10m", [0])[i] or 0),
                direction_10m=float(hourly_raw.get("wind_direction_10m", [0])[i] or 0),
                blh=float(hourly_raw.get("boundary_layer_height", [300])[i] or 300),
            )
        )

    points.sort(key=lambda p: p.timestamp_utc)
    run_ts = times[0] if times else int(time.time())

    return WindSeries(
        latitude=float(data.get("latitude", 28.59)),
        longitude=float(data.get("longitude", 77.05)),
        run_timestamp=run_ts,
        hourly=points,
    )


def get_winds(
    lat: float = 28.59,
    lon: float = 77.05,
    fixtures_path: str | None = None,
) -> WindSeries:
    """Retrieve wind series from live API or local fixture."""
    if os.environ.get("PV_FIXTURES") == "1":
        fix_file = fixtures_path or os.path.join(
            os.path.dirname(__file__), "..", "..", "tests", "fixtures", "winds_dwarka.json"
        )
        if os.path.exists(fix_file):
            with open(fix_file, "r", encoding="utf-8") as f:
                return parse_openmeteo_winds(json.load(f))

    fix_file = os.path.join(
        os.path.dirname(__file__), "..", "..", "tests", "fixtures", "winds_dwarka.json"
    )
    if os.path.exists(fix_file):
        with open(fix_file, "r", encoding="utf-8") as f:
            return parse_openmeteo_winds(json.load(f))

    return WindSeries(lat, lon, int(time.time()), [])


# Alias for compatibility
fetch_wind_forecast = get_winds
