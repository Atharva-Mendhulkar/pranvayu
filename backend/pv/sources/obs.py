"""OpenAQ / CPCB surface air quality observations client and parser."""

import json
import os
import time
from dataclasses import dataclass


@dataclass(frozen=True)
class StationReading:
    timestamp_utc: int
    pm2_5: float | None
    pm10: float | None


@dataclass
class StationObsSeries:
    locality_id: str
    station_name: str
    latest_at: int | None
    readings: list[StationReading]

    @property
    def is_stale(self) -> bool:
        """True if the latest reading is older than 3 hours."""
        if not self.latest_at:
            return True
        now = int(time.time())
        return (now - self.latest_at) > (3 * 3600)

    @property
    def age_hours(self) -> float:
        if not self.latest_at:
            return 999.0
        now = int(time.time())
        return max(0.0, (now - self.latest_at) / 3600.0)


def parse_openaq_json(data: dict, locality_id: str) -> StationObsSeries:
    """Parse station observation dictionary for a locality."""
    loc_data = data.get(locality_id, {})
    readings_raw = loc_data.get("readings", [])
    latest_at = loc_data.get("latest_at")

    readings: list[StationReading] = []
    for r in readings_raw:
        readings.append(
            StationReading(
                timestamp_utc=r["time"],
                pm2_5=r.get("pm2_5"),
                pm10=r.get("pm10"),
            )
        )

    readings.sort(key=lambda x: x.timestamp_utc)
    return StationObsSeries(
        locality_id=locality_id,
        station_name=loc_data.get("station_name", locality_id),
        latest_at=latest_at,
        readings=readings,
    )


def get_observations(
    locality_ids: list[str],
    api_key: str | None = None,
    fixtures_path: str | None = None,
) -> dict[str, StationObsSeries]:
    """Retrieve observations for all requested localities."""
    if os.environ.get("PV_FIXTURES") == "1" or not api_key:
        fix_file = fixtures_path or os.path.join(
            os.path.dirname(__file__), "..", "..", "tests", "fixtures", "openaq_obs.json"
        )
        if os.path.exists(fix_file):
            with open(fix_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                return {loc: parse_openaq_json(data, loc) for loc in locality_ids}
        return {
            loc: StationObsSeries(loc, loc, None, []) for loc in locality_ids
        }

    # Live API implementation placeholder / offline fallback
    fix_file = os.path.join(
        os.path.dirname(__file__), "..", "..", "tests", "fixtures", "openaq_obs.json"
    )
    if os.path.exists(fix_file):
        with open(fix_file, "r", encoding="utf-8") as f:
            data = json.load(f)
            return {loc: parse_openaq_json(data, loc) for loc in locality_ids}

    return {loc: StationObsSeries(loc, loc, None, []) for loc in locality_ids}


def fetch_station_obs(locality_id: str, openaq_id: str | None = None) -> StationObsSeries:
    """Fetch station observations for a single locality."""
    res = get_observations([locality_id])
    return res.get(locality_id, StationObsSeries(locality_id, locality_id, None, []))
