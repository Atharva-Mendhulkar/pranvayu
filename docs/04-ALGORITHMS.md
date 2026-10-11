# PranVayu: algorithm specification

This describes what each step computes and why. It contains no implementation. Every number marked "tunable" lives in `config/model.yaml` or `config/thresholds.yaml`. Anything that is a design choice rather than a measured fact is marked as a proposal; the evaluation job (06-VALIDATION) tests the ones that matter.

## 1. Overview

For each locality (receptor) and each school day:

1. Build a corrected PM2.5 forecast with an uncertainty band (section 5).
2. Run an ensemble of backward air-parcel trajectories and score upwind fires to get a smoke influence level and an arrival window (sections 3 and 4).
3. Turn the corrected forecast into verdicts per period and a clean window (section 6).
4. Attach driver tags, confidence and freshness (sections 7 and 8).

No physics-informed or learned model is used. Rationale: transport timing depends mostly on winds taken from weather models, and a learned field model cannot be validated for this task in a weekend.

## 2. Inputs and domain

- **Domain D:** west 73.5, south 27.5, east 78.5, north 32.5 (degrees). Covers Punjab, Haryana, Delhi and western Uttar Pradesh.
- **Receptors:** up to 12 Delhi localities, each tied to a CPCB station reachable through OpenAQ. Ground elevation about 220 m (use a constant or the Open-Meteo elevation).
- **Wind grid:** 0.5 degree grid over D, 121 points. Per point, hourly: wind speed and direction at 975, 950 and 925 hPa and at 10 m, and boundary layer height. Model: ECMWF IFS 0.25 degree (fallback: GFS) if it supplies pressure-level winds; verify in Phase 0. Window: 72 h past, 72 h forecast. Units m/s.
- **Release levels** (using Open-Meteo's altitude table minus Delhi ground): 975 hPa about 100 m above ground, 950 hPa about 300 m, 925 hPa about 600 m.
- **Fires:** VIIRS S-NPP, NOAA-20 and NOAA-21 near-real-time detections over D for the last 72 h. Drop low-confidence detections. Deduplicate detections of the same fire seen by different satellites (within about 0.01 degrees and 60 minutes). Keep location, detection time, fire radiative power (FRP).
- **CAMS PM2.5 and PM10:** at each receptor, from the global domain (about 45 km, 3-hourly), interpolated to hourly.
- **Observations:** hourly PM2.5 (and PM10 when present) at each receptor's station.

## 3. Backward trajectory ensemble

For each receptor r, arrival time T_a in {now, now+3 h, ..., now+48 h} (17 times), release level l (3), and ensemble member k (K = 24, tunable):

1. Start at the receptor at time T_a + delta_k, with delta_k a whole-hour jitter in [-2, +2] (proposal).
2. Step backward in time with a midpoint (second-order) method, step 30 minutes, for 60 hours.
3. Wind at a position and time: bilinear in space on the 0.5 degree grid, linear in time between hourly values, at the member's release level (the parcel stays on its level; this is an acknowledged simplification).
4. Perturbations per member (proposals, tunable): a speed factor (1 + e_s), e_s ~ Normal(0, 0.15), fixed for the trajectory; a rotation of the wind direction by e_theta ~ Normal(0, 10 degrees), fixed; and an independent Normal(0, 0.5 m/s) wind component noise added at each step to represent turbulence and wind error.
5. Stop a trajectory if it leaves D or runs out of wind data; mark it truncated.

Output per trajectory: positions at each step, and boundary layer height along the path.

Performance target: all receptors and arrival times in under 60 seconds in one Lambda (about 1,800 MB). Use array operations across members and levels, and the fire aggregation in section 4.

## 4. Smoke influence index and arrival window

**Aggregate fires first.** Bin detections to 0.1 degree cells and 6-hour bins; sum FRP; keep at most 1,500 sources (highest FRP). This keeps the trajectory-by-fire comparison small.

**Influence of one source on one trajectory.** For source f (location, time t_f, FRP_f) and trajectory step s at time t_s with position x_s:

- age = t_s - t_f in hours. A source can only influence the parcel when age is between -6 and +36 hours (the parcel passes after detection, burning continues for some hours around the overpass).
- Time weight H: 1 for age in [-6, 12], falling linearly to 0 at age 36.
- Space weight G = exp(-0.5 (d / sigma)^2), d = distance from x_s to the source, sigma = 20 km + 1.0 km/h x max(age, 0) (plume growth).
- Mixing factor M = clip(BLH at x_s, t_s / 400 m, 0.25, 1).
- Travel decay D = exp(-(travel hours from step to arrival) / 72) (aerosol lifetime, proposal).
- Contribution = FRP_f x the maximum over steps s of (G x H x M x D). Taking the maximum over steps counts each source once at its closest effective passage.

**Index per trajectory:** SII_j = sum over sources of contributions. It is a relative index in FRP-weighted units. It is not micrograms per cubic metre and must never be shown as a concentration.

**Ensemble statistics** per receptor and arrival time: median SII, p10, p90, and the probability p(T_a) = fraction of members with SII at or above the "moderate" threshold.

**Levels.** Low below q50, moderate from q50 to q85, high above q85 of the ensemble-median SII over the calibration window and receptors. Thresholds are produced by the evaluation job into `config/smoke_levels.json`. Until that file exists, the code uses placeholder thresholds and marks the output `uncalibrated: true`, which lowers confidence and shows on the evidence page.

**Arrival window (per receptor).**
- No signal: p never reaches 0.25 in the 48 h.
- Already present: p(now) is at or above 0.5. Report "smoke influence is already present" and the time p falls below 0.25 if within 48 h.
- Otherwise: window from = first T_a with p at or above 0.25; window to = first T_a with p at or above 0.75, or the last evaluated hour if never reached.
- Width of the window feeds confidence (section 8).

Not modelled (state on the method page): fires after "now" (we count only detected fires; confidence falls with lead time), night-time fires that satellites do not see, cloud-hidden fires, smoke from outside D, vertical mixing to the surface, chemistry, and smoke's true share of ground-level PM2.5.

## 5. Corrected PM2.5 and uncertainty band

For each receptor with CAMS series c(t) and observed series o(t):

1. Matched hours: the last 24 h where both exist and c is at least 10 ug/m3. Need at least 12 matched hours; otherwise no correction (rho = 1) and a confidence downgrade.
2. Bias ratio rho = median of o/c over matched hours, clipped to [0.5, 3.0]. (An additive version is an alternative: bias_mode in config; choose by replay MAE.)
3. Lead-dependent factor: rho_eff(h) = 1 + (rho - 1) x exp(-h / tau_b), tau_b = 24 h (tunable), h = hours ahead of the latest observation.
4. Median forecast m(t) = rho_eff x c(t).
5. Near-term blend for h up to 6: m(t) = w x o_last + (1 - w) x rho_eff x c(t), w = exp(-h / 3).
6. Band: multiplicative factors for p10 and p90 from the replay residuals log(o / m) by lead bucket {0-6, 6-24, 24-48 h}, stored in `config/bands.json`. Placeholder factors before calibration: 0.7 and 1.4, marked uncalibrated.
7. Past hours: show observed values as dots; the line starts at the latest observation.

If observations are stale (over 3 h), skip steps 2 to 5 and use raw CAMS with the widest band.

## 6. Verdict rules and clean window

**Decision value per period.** Use the mean of the median forecast over the activity window (assembly 30 min, break 30 min, PE 45 min, arrival and dispersal 30 min), then:
- confidence high: use the median;
- medium: the midpoint of median and p90;
- low: the p90.
Rationale: when we are less sure, lean cautious.

**Thresholds (PM2.5, ug/m3), proposals aligned to CPCB category edges, in `config/thresholds.yaml`:**

| Activity type | Go | Limit | Skip |
|---|---|---|---|
| Light (assembly, break, arrival, dispersal) | 60 or below | 61 to 90 | above 90 |
| Strenuous (PE, games) | 30 or below | 31 to 60 | above 60 |

Notes: these are the app's advisory rules, not official guidance. Do not describe them as medical advice. PE sits one CPCB band cleaner than light activity because intensity raises inhaled dose. In peak Delhi season this will say Skip on many days; that is expected, and the clean window and "least bad" guidance keep the app useful on those days. Have the thresholds reviewed by someone with a health background if time allows, and say in the method page that they are a proposal.

**Headline.** Fixed templates over the set of verdicts (see UX spec section 5): all Go; mixed (name the Skip periods first, then the Go periods); all Skip (include the least-bad window).

**Clean window.** In 06:00 to 19:00 for the chosen day, evaluate sliding 60-minute windows with the light thresholds (30-minute step). Choose the longest contiguous run of Go; ties go to the lowest mean. If no Go run exists, choose the lowest-mean 60-minute window and label it `least_bad` with its verdict.

**Editing times.** The browser recomputes verdicts from the hourly series in the payload using the same rules, shipped as a small JSON.

## 7. Driver tags

At most two tags are shown, in this priority order. A tag appears only when its rule fires.

1. **Regional smoke.** Fires when p(T_a) is at or above 0.5 for any hour in the displayed day, or the arrival window starts within 24 h. Evidence shown: level, arrival window, how many distinct upwind fire clusters the member paths cross, and wind direction at 950 hPa during the arrival hours. If the wind is not from the west-to-north sector (about 270 to 360 degrees), say so and lower confidence one step.
2. **Local trapping.** Fires when, for at least 3 consecutive hours between 05:00 and 11:00 or between 17:00 and 23:00, boundary layer height is under 400 m and 10 m wind speed is under 2.0 m/s (proposals). Evidence: the hours and the two values.
3. **Dust (P1).** Fires when the last-3-hour observed PM10 to PM2.5 ratio is at or above 2.5 and 10 m wind is at least 4 m/s.

If none fire: "No clear driver. Likely regional background."

Tags are explanations of conditions, not a split of the PM2.5 total. The UI must not show percentages.

## 8. Confidence

Three tiers: high, medium, low. Start at high for the first 24 hours of lead and at medium beyond 24 hours (cap). Lower one step for each of:
- station data older than 3 h or fewer than 12 matched hours;
- wind data older than 8 h;
- smoke arrival window wider than 12 h (applies to the smoke tag and the day's confidence when the smoke tag is active);
- smoke tag active while winds are not from the north-west sector;
- calibration files missing (`uncalibrated`).
Floor is low. Confidence is computed per day (today, tomorrow, day after) and per tag.

## 9. Parameter table

| Parameter | Default | File | Notes |
|---|---|---|---|
| ensemble members K | 24 | model.yaml | raise if time allows |
| release levels | 975, 950, 925 hPa | model.yaml | about 100, 300, 600 m above ground |
| back-trajectory length | 60 h | model.yaml | |
| step | 30 min | model.yaml | |
| time jitter | plus or minus 2 h | model.yaml | |
| speed error sigma | 0.15 | model.yaml | |
| direction error sigma | 10 degrees | model.yaml | |
| step noise | 0.5 m/s | model.yaml | |
| fire age window | -6 to +36 h | model.yaml | |
| sigma0, growth | 20 km, 1.0 km/h | model.yaml | |
| BLH reference | 400 m, floor 0.25 | model.yaml | |
| decay time | 72 h | model.yaml | |
| fire aggregation | 0.1 degree, 6 h, cap 1,500 | model.yaml | |
| bias window, min matched | 24 h, 12 | model.yaml | |
| tau_b | 24 h | model.yaml | tune in replay |
| rho clip | 0.5 to 3.0 | model.yaml | |
| band factors | from bands.json | bands.json | placeholders 0.7 / 1.4 |
| light thresholds | 60 / 90 | thresholds.yaml | |
| strenuous thresholds | 30 / 60 | thresholds.yaml | |
| trapping | BLH < 400 m, wind < 2 m/s, 3 h | model.yaml | |
| dust | ratio 2.5, wind 4 m/s | model.yaml | P1 |
| smoke levels | q50 / q85 | smoke_levels.json | generated |

At most five of these should be tuned in the replay (tau_b, bias mode, sigma0, decay time, smoke level cut points). Keep the rest fixed to avoid overfitting a short window.

## 10. Known limits to state publicly

- CAMS over India is about 45 km and 3-hourly; two localities in Delhi can share a grid cell. Differences between them come mostly from observations.
- The smoke index measures how much detected fire the air has passed over, not how much smoke reaches the ground.
- Studies disagree on stubble's share of Delhi PM2.5; one 2025 sensor study put it near 14% for one season.
- Verdict thresholds are a proposal aligned to CPCB category edges.
- The model sees only detected fires; cloud, night burning and small fires are missed.
