"""Activity verdict rules, clean window search, and browser rules exporter."""

import json
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from pv.model.correction import CorrectedSeriesPoint


@dataclass
class PeriodVerdict:
    period_id: str
    time: str  # HH:MM
    activity_type: str  # "light" | "strenuous"
    verdict: str  # "go" | "limit" | "skip"
    decision_value: int
    range: dict[str, int]  # p10, p50, p90
    category: str
    threshold_used: dict[str, int]  # go, limit


@dataclass
class CleanWindow:
    from_time: str  # HH:MM
    to_time: str  # HH:MM
    kind: str  # "best" | "least_bad"


def get_cpcb_category(pm25: float) -> str:
    """Return CPCB official PM2.5 category name."""
    if pm25 <= 30:
        return "good"
    if pm25 <= 60:
        return "satisfactory"
    if pm25 <= 90:
        return "moderate"
    if pm25 <= 120:
        return "poor"
    if pm25 <= 250:
        return "very_poor"
    return "severe"


def evaluate_decision_value(p50: float, p90: float, confidence: str) -> float:
    """Compute the decision value based on confidence tier."""
    if confidence == "high":
        return p50
    if confidence == "medium":
        return (p50 + p90) / 2.0
    return p90  # low confidence: lean cautious


def evaluate_verdict(decision_val: float, activity_type: str, thresholds_cfg: dict) -> tuple[str, dict[str, int]]:
    """Determine Go, Limit, or Skip from decision value and activity type."""
    acts = thresholds_cfg.get("activities", {})
    act_cfg = acts.get(activity_type, acts.get("light", {}))
    go_max = int(act_cfg.get("go_max", 60))
    limit_max = int(act_cfg.get("limit_max", 90))

    threshold_used = {"go": go_max, "limit": limit_max}

    if decision_val <= go_max:
        return "go", threshold_used
    if decision_val <= limit_max:
        return "limit", threshold_used
    return "skip", threshold_used


def get_series_for_period(
    series: list[CorrectedSeriesPoint],
    target_dt: datetime,
    duration_min: int = 30,
) -> tuple[float, float, float]:
    """Calculate mean p10, p50, p90 across the window starting at target_dt."""
    target_ts = int(target_dt.timestamp())
    end_ts = target_ts + (duration_min * 60)

    # Find points closest to or spanning the window
    matching = [p for p in series if target_ts - 1800 <= p.timestamp_utc <= end_ts + 1800]
    if not matching:
        matching = sorted(series, key=lambda p: abs(p.timestamp_utc - target_ts))[:1]

    mean_p10 = sum(p.p10 for p in matching) / len(matching)
    mean_p50 = sum(p.p50 for p in matching) / len(matching)
    mean_p90 = sum(p.p90 for p in matching) / len(matching)

    return mean_p10, mean_p50, mean_p90


def compute_day_verdicts(
    series: list[CorrectedSeriesPoint],
    day_date: str,  # YYYY-MM-DD
    timetable: list[dict],
    thresholds_cfg: dict,
    confidence: str,
) -> list[PeriodVerdict]:
    """Compute verdicts for each period in the school day timetable."""
    verdicts: list[PeriodVerdict] = []
    durations = thresholds_cfg.get("period_durations_min", {})

    for item in timetable:
        p_id = item.get("id") or item.get("period_id", "period")
        p_time = item["time"]
        act_type = item.get("activity_type", "light")
        dur_min = durations.get(p_id, 30)

        dt_str = f"{day_date}T{p_time}:00"
        # Parse as IST (+05:30) and convert to UTC
        ist_dt = datetime.fromisoformat(dt_str).replace(tzinfo=timezone(timedelta(hours=5, minutes=30)))
        utc_dt = ist_dt.astimezone(timezone.utc)

        p10, p50, p90 = get_series_for_period(series, utc_dt, dur_min)
        dec_val = evaluate_decision_value(p50, p90, confidence)
        verdict_word, thresh_used = evaluate_verdict(dec_val, act_type, thresholds_cfg)

        verdicts.append(
            PeriodVerdict(
                period_id=p_id,
                time=p_time,
                activity_type=act_type,
                verdict=verdict_word,
                decision_value=int(round(dec_val)),
                range={
                    "p10": int(round(p10)),
                    "p50": int(round(p50)),
                    "p90": int(round(p90)),
                },
                category=get_cpcb_category(dec_val),
                threshold_used=thresh_used,
            )
        )

    return verdicts


def find_clean_window(
    series: list[CorrectedSeriesPoint],
    day_date: str,  # YYYY-MM-DD
    thresholds_cfg: dict,
    confidence: str,
) -> CleanWindow:
    """Find the longest contiguous run of Go between 06:00 and 19:00, or lowest-mean least-bad window."""
    clean_cfg = thresholds_cfg.get("clean_window", {})
    start_h = clean_cfg.get("start_hour", 6)
    end_h = clean_cfg.get("end_hour", 19)
    go_max = thresholds_cfg.get("activities", {}).get("light", {}).get("go_max", 60)

    # Evaluate 60-min steps every 30 mins
    candidates = []
    current_min = start_h * 60
    end_min = end_h * 60

    while current_min + 60 <= end_min:
        sh = current_min // 60
        sm = current_min % 60
        eh = (current_min + 60) // 60
        em = (current_min + 60) % 60

        from_str = f"{sh:02d}:{sm:02d}"
        to_str = f"{eh:02d}:{em:02d}"

        dt_str = f"{day_date}T{from_str}:00"
        ist_dt = datetime.fromisoformat(dt_str).replace(tzinfo=timezone(timedelta(hours=5, minutes=30)))
        utc_dt = ist_dt.astimezone(timezone.utc)

        _, p50, p90 = get_series_for_period(series, utc_dt, 60)
        dec_val = evaluate_decision_value(p50, p90, confidence)
        is_go = dec_val <= go_max

        candidates.append({
            "from": from_str,
            "to": to_str,
            "dec_val": dec_val,
            "is_go": is_go,
            "start_min": current_min,
        })
        current_min += 30

    # Search for contiguous runs of Go
    runs = []
    current_run = []
    for c in candidates:
        if c["is_go"]:
            current_run.append(c)
        else:
            if current_run:
                runs.append(current_run)
                current_run = []
    if current_run:
        runs.append(current_run)

    if runs:
        # Longest run, tie-break by lowest mean
        runs.sort(key=lambda r: (-len(r), sum(x["dec_val"] for x in r) / len(r)))
        best_run = runs[0]
        return CleanWindow(
            from_time=best_run[0]["from"],
            to_time=best_run[-1]["to"],
            kind="best",
        )

    # If no Go run, choose the lowest-mean 60-minute window
    if candidates:
        candidates.sort(key=lambda x: x["dec_val"])
        lowest = candidates[0]
        return CleanWindow(
            from_time=lowest["from"],
            to_time=lowest["to"],
            kind="least_bad",
        )

    return CleanWindow(from_time="15:00", to_time="16:00", kind="least_bad")


def generate_headline(verdicts: list[PeriodVerdict], clean_win: CleanWindow, lang: str = "en") -> str:
    """Deterministic headline generator as defined in UX-SPEC section 5."""
    skips = [v for v in verdicts if v.verdict == "skip"]
    gos = [v for v in verdicts if v.verdict == "go"]

    if lang == "hi":
        if len(gos) == len(verdicts):
            return "आज बाहर का समय ठीक है।"
        if len(skips) == len(verdicts):
            return f"सब कुछ अंदर रखें। सबसे कम खराब समय {clean_win.from_time} से {clean_win.to_time} है।"
        # Mixed
        if "assembly" in [v.period_id for v in skips] and "pe" in [v.period_id for v in gos]:
            return "बाहर की असेंबली न रखें। पीटी का समय ठीक है।"
        return "कुछ गतिविधियां अंदर रखें और बाकी बाहर की जा सकती हैं।"

    # English
    if len(gos) == len(verdicts):
        return "Outdoor time is fine today."
    if len(skips) == len(verdicts):
        return f"Keep everything indoors. The least bad time is {clean_win.from_time} to {clean_win.to_time}."

    # Mixed
    if "assembly" in [v.period_id for v in skips] and "pe" in [v.period_id for v in gos]:
        pe_v = next(v for v in gos if v.period_id == "pe")
        return f"Skip the outdoor assembly. PE at {pe_v.time} is fine."

    if skips:
        first_skip = skips[0]
        return f"Limit or skip {first_skip.period_id}. Cleanest window is {clean_win.from_time} to {clean_win.to_time}."

    return "Outdoor activities are mostly manageable today."


def export_browser_rules(thresholds_cfg: dict, output_path: str):
    """Export lightweight JSON rules for client-side timetable recalculation."""
    rules_data = {
        "activities": thresholds_cfg.get("activities", {}),
        "period_durations_min": thresholds_cfg.get("period_durations_min", {}),
        "clean_window": thresholds_cfg.get("clean_window", {}),
    }
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(rules_data, f, indent=2)
