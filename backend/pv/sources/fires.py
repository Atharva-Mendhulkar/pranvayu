"""NASA FIRMS VIIRS active fire detections client and parser."""

import csv
import io
import os
from dataclasses import dataclass
from datetime import datetime, timezone


@dataclass(frozen=True)
class FireDetection:
    latitude: float
    longitude: float
    acq_datetime_utc: datetime
    frp: float
    confidence: str


def parse_firms_csv(csv_content: str) -> list[FireDetection]:
    """Parse FIRMS CSV content, filter low confidence, and deduplicate."""
    reader = csv.DictReader(io.StringIO(csv_content.strip()))
    raw_detections: list[FireDetection] = []

    for row in reader:
        try:
            confidence = row.get("confidence", "").strip().lower()
            if confidence in ("l", "low"):
                continue

            lat = float(row["latitude"])
            lon = float(row["longitude"])
            frp = float(row.get("frp", 0.0))

            acq_date = row.get("acq_date", "").strip()
            acq_time = row.get("acq_time", "").strip().zfill(4)

            hour = int(acq_time[:2])
            minute = int(acq_time[2:])
            dt = datetime.strptime(acq_date, "%Y-%m-%d").replace(
                hour=hour, minute=minute, tzinfo=timezone.utc
            )

            raw_detections.append(
                FireDetection(
                    latitude=lat,
                    longitude=lon,
                    acq_datetime_utc=dt,
                    frp=frp,
                    confidence=confidence,
                )
            )
        except (KeyError, ValueError):
            continue

    return deduplicate_fires(raw_detections)


def deduplicate_fires(
    detections: list[FireDetection],
    spatial_tol_deg: float = 0.01,
    time_tol_sec: float = 3600.0,
) -> list[FireDetection]:
    """Deduplicate detections of the same fire seen by different satellites."""
    if not detections:
        return []

    # Sort descending by FRP so higher intensity reading is preserved
    sorted_dets = sorted(detections, key=lambda d: d.frp, reverse=True)
    kept: list[FireDetection] = []

    for det in sorted_dets:
        is_dup = False
        det_ts = det.acq_datetime_utc.timestamp()

        for existing in kept:
            ex_ts = existing.acq_datetime_utc.timestamp()
            if abs(det_ts - ex_ts) <= time_tol_sec:
                d_lat = abs(det.latitude - existing.latitude)
                d_lon = abs(det.longitude - existing.longitude)
                if d_lat <= spatial_tol_deg and d_lon <= spatial_tol_deg:
                    is_dup = True
                    break

        if not is_dup:
            kept.append(det)

    return kept


def get_fires(
    map_key: str | None = None,
    bbox: str = "73.5,27.5,78.5,32.5",
    day_range: int = 3,
    fixtures_path: str | None = None,
) -> list[FireDetection]:
    """Retrieve fire detections from live FIRMS API or local fixtures."""
    if os.environ.get("PV_FIXTURES") == "1" or not map_key:
        fix_file = fixtures_path or os.path.join(
            os.path.dirname(__file__), "..", "..", "tests", "fixtures", "fires_snpp.csv"
        )
        if os.path.exists(fix_file):
            with open(fix_file, "r", encoding="utf-8") as f:
                return parse_firms_csv(f.read())
        return []

    import urllib.request

    url = f"https://firms.modaps.eosdis.nasa.gov/api/area/csv/{map_key}/VIIRS_SNPP_NRT/{bbox}/{day_range}"
    req = urllib.request.Request(url, headers={"User-Agent": "PranVayu/1.0"})
    with urllib.request.urlopen(req, timeout=15) as resp:
        return parse_firms_csv(resp.read().decode("utf-8"))


# Alias for compatibility
fetch_firms_detections = get_fires
