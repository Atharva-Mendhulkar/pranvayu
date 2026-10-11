"""Confidence scoring across forecast lead times and degraded conditions."""


TIERS = ["low", "medium", "high"]


def downgrade_tier(tier: str, steps: int = 1) -> str:
    """Step down confidence by steps (high -> medium -> low)."""
    idx = TIERS.index(tier) if tier in TIERS else 1
    return TIERS[max(0, idx - steps)]


def compute_day_confidence(
    day_lead_h: float,
    station_is_stale: bool,
    matched_hours_count: int,
    wind_is_stale: bool,
    smoke_window_hours: float | None = None,
    wind_is_non_nw: bool = False,
    is_calibrated: bool = True,
    has_smoke_tag: bool = False,
) -> str:
    """Determine confidence tier (high, medium, low) for a day."""
    # 1. Start based on lead time
    if day_lead_h <= 24.0:
        current_tier = "high"
    else:
        current_tier = "medium"

    downgrade_steps = 0

    # 2. Station data penalties
    if station_is_stale or matched_hours_count < 12:
        downgrade_steps += 1

    # 3. Wind data penalty
    if wind_is_stale:
        downgrade_steps += 1

    # 4. Smoke penalties (if smoke is active for this day)
    if has_smoke_tag:
        if smoke_window_hours is not None and smoke_window_hours > 12.0:
            downgrade_steps += 1
        if wind_is_non_nw:
            downgrade_steps += 1

    # 5. Calibration penalty
    if not is_calibrated:
        downgrade_steps += 1

    return downgrade_tier(current_tier, downgrade_steps)
