# PranVayu: validation and replay plan

Purpose: produce the evidence page and the replay mode, and learn whether the smoke component adds anything. Rule: define the metrics before looking at results, report all of them, include the ones that look bad.

## 1. Principles

1. Pre-registered metrics (section 4). No adding or dropping a metric after seeing numbers.
2. Tune on one part of the window, report on the other (section 6).
3. Every number on the evidence page comes from the evaluation job output.
4. Negative results are published on the evidence page and change the product (section 9).
5. Label the data mode honestly (section 3).

## 2. Choosing the replay window

- Use the most recent completed stubble season, 7 to 14 days inside roughly 25 Oct to 15 Nov, containing at least one sharp PM2.5 rise at several Delhi stations.
- Look at the OpenAQ hourly series for the 12 stations first; pick the window by eye, then write the dates in `docs/10-DECISIONS-AND-ASSUMPTIONS.md` before running anything.
- Require at least 8 stations with 80% or more hourly coverage in the window. Drop stations below that and record it.
- As-of grid: every 3 hours across the window (the payloads precomputed into S3).

## 3. Data modes

The evaluation must run in the most honest mode available and say which.

| Mode | Winds used | What it tests |
|---|---|---|
| A. as_forecast | Archived forecasts as issued at 24 h and 48 h lead (Open-Meteo previous-runs or single-runs style access; verify what exists for pressure levels) | The real product |
| B. oracle_winds | Reanalysis or best-available analysis winds for the whole window | An upper bound for the trajectory method with perfect winds |

If only B is possible, the evidence page must say "winds are analysis values, not forecasts; real performance will be worse". Do not present B results as forecast skill.

Fires: archived `_SP` standard-processing detections from FIRMS for the window (live mode uses NRT). Observations: OpenAQ hourly history. CAMS: use an as-issued archive if one exists for the window; if not, the raw-CAMS baseline is dropped and the evidence page says so.

## 4. Metrics (pre-registered)

**M1. Smoke early warning against baselines.**
- Event: at a station, the 3-hour mean PM2.5 exceeds the median of the previous 24 h by at least 60 ug/m3 and is at least 100 ug/m3, with at least 12 h since the previous event (proposal).
- Warning: at issue time t_i, the model's probability p(T_a) is at least 0.5 for an arrival hour within plus or minus 3 h of the event time.
- Hit: an event with a warning issued up to 24 h earlier. Lead time: event time minus earliest qualifying issue time (capped at 24 h). False alarm: a warning with no event within plus or minus 6 h of T_a.
- Report hit rate, false alarm ratio, median lead time.
- Baseline B1 (fire count): warn when detections in the domain over the last 24 h are at or above N. Report at several N and at the N that matches the model's false alarm ratio. This answers: does the trajectory method add anything over counting fires?
- Baseline B2 (wind sector): warn when 950 hPa wind at the receptor is from 270 to 360 degrees and at least 3 m/s.

**M2. Forecast error.** For lead buckets 6-24 h and 24-48 h: MAE, RMSE and bias of corrected forecast, persistence (last observation), raw CAMS (if archive exists), and a 7-day same-hour mean. Skill vs persistence = 1 minus MAE_model over MAE_persistence. Also CPCB category agreement (exact, within one).

**M3. Verdict accuracy.** Compute the verdict from the forecast issued the evening before, and the verdict from observed 3-hour mean PM2.5 at the same period. Report the confusion matrix by activity type and:
- unsafe error rate: forecast Go while observed Skip;
- mild error rate: forecast Go while observed Limit, or forecast Limit while observed Skip;
- over-caution rate: forecast Skip while observed Go.
Target direction: unsafe errors rare; if over-caution is high, say so.

**M4. Calibration.** Coverage of the p10 to p90 band by lead bucket (ideal about 80%). MAE by confidence tier (low-confidence days should have larger errors; if not, the confidence label is not informative and must be reworded).

**M5. Smoke effect size.** Mean excess PM2.5 (observed minus previous-24-h median) in hours where p is at or above 0.5 versus other hours, with a block bootstrap interval by day. If the interval includes zero, say the smoke signal is not distinguishable from noise in this window.

## 5. Procedure

1. Fetch and freeze archived inputs into `replay/<run_id>/inputs/` (so results are reproducible).
2. Run the pipeline for every as-of time, writing payloads and the raw intermediate series.
3. Run the evaluation job over the evaluation days only.
4. Write `evidence/<run_id>/evidence.json` and regenerate `config/smoke_levels.json` and `config/bands.json` from the calibration days.
5. Re-run step 2 with the generated config so shipped payloads use calibrated levels and bands (evaluation numbers stay from the held-out days).
6. Commit the evidence JSON and the exact config used.

## 6. Split and tuning

- Sort days by date. First 40% are calibration days; the remaining 60% are evaluation days. With fewer than 7 days, use leave-one-day-out instead and say so.
- Tune only: tau_b, bias_mode, sigma0, decay time, smoke level cut points. Everything else stays at defaults.
- Never tune on evaluation days. Record the final tuned values in the decisions log.

## 7. Replay UI contract

The replay payloads are static S3 files. The replay UI shows, for the chosen as-of: what the app said then, and (once the as-of is behind the window end) the observed values drawn over the forecast, with the verdict compared to what would have been the verdict.

## 8. Acceptance for this phase

- Evaluation job runs end to end from a single command and regenerates the evidence JSON.
- At least M1 to M4 produced in some data mode; M5 if time allows.
- Evidence page renders from the JSON with no typed numbers.
- Data mode and limits visible on the page.

## 9. What results change

| Result | Product change |
|---|---|
| M1 shows no lead over the fire-count baseline | The smoke card is labelled "context" and does not lead any headline; the video does not claim early warning |
| M1 shows lead over the baselines with a wide interval | Keep the smoke card and the ETA range; state the interval |
| Corrected forecast no better than persistence at 24 h | Say so; verdicts for tomorrow use the wider band and "low" confidence more often; the product's value is the structure, not the forecast skill |
| Unsafe error rate high | Tighten decision value (use p90 more often) before shipping; show the rate honestly |
| Confidence tiers not informative | Rename the label to "data quality" and drop the claim about reliability |
| Band coverage far from 80% | Rescale band factors from the calibration days; report remaining gap |
| Only oracle-winds mode possible | State "upper bound" everywhere the numbers appear |
