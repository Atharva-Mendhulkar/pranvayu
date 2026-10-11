# PranVayu: decisions and assumptions

One place for what is settled, what is a guess, and what must be checked. Update it as you learn; agents append here instead of silently deviating. Format for new entries: date, what changed, why.

## 1. Decided

| # | Decision | Why |
|---|---|---|
| D1 | Citizen-facing, Delhi, parent-first school-day advisory. Riders, construction workers, MCD, DPCC and CAQM operator panels are out | Narrow user and decision; judges: "a small problem solved well beats a big one solved vaguely"; workers excluded by the requester's own call |
| D2 | New repository, no VayuMind or JointPINN code, weights or data | Rules say earlier projects do not count; history must match the event dates |
| D3 | Method: backward trajectory ensemble plus fire influence index plus CAMS corrected by station readings. No PINN | Transport timing depends on winds from weather models; a learned field model cannot be validated in a weekend |
| D4 | Rules decide verdicts; language text only explains computed facts; templates are the P0 text | Reliability, testability |
| D5 | Show influence and arrival range, never smoke percentages or concentrations from the index | Contribution estimates are contested; one 2025 study put Punjab burning near 14% of Delhi-NCR PM2.5 in Oct to Nov 2022 and found no linear link to fire counts |
| D6 | Forecast horizon 48 hours; school-day verdicts for today, tomorrow and the day after | Transport from Punjab and Haryana is reported at roughly 36 to 48 hours; the earlier 9 to 14 hour framing was too short |
| D7 | Serverless on AWS in ap-south-1: EventBridge, Lambda, S3, DynamoDB, API Gateway, Amplify Hosting, SSM, CloudWatch; SAM for infrastructure | Satisfies "deployed on AWS"; cheap; precomputed so the API never waits on a source |
| D8 | Frontend: Vite, React, TypeScript, plain CSS variables, hand-built SVG chart, no UI kit | Distinct design, small bundle |
| D9 | Design: school-diary timetable, Mukta, Notebook palette, one radius, no shadows, no gradients, no brand accent | See 02-UX-SPEC |
| D10 | English and Hindi from the start, hand-written strings | Parents, not engineers |
| D11 | GRAP shown as a manually maintained banner with source link | Official orders drive closures; we do not infer stages |
| D12 | Pre-registered metrics M1 to M5; tune only five parameters; negative results published | Credibility of the evidence page |

## 2. Assumed, must be verified (owner: you, in 11-PHASE0-VERIFY)

| # | Assumption | How to verify | If false |
|---|---|---|---|
| A1 | Deadline is about Sun 11 Oct 19:30 IST (inferred from the page countdown; the plan submits by 17:30) | Event page at 08:00; Rules tab; submission form | If later, spend the time on P4 and P5 quality and buffer; if earlier, cut per 07 section 4 |
| A2 | Open-Meteo forecast API serves pressure-level winds at 975, 950, 925 hPa and `boundary_layer_height` for Delhi for a model we can name | Phase 0 curl | Use available levels; BLH from another model or fixed fallback; record |
| A3 | `models=ecmwf_ifs025` supports those variables; GFS as fallback | Phase 0 curl | Use the model that does |
| A4 | CAMS global PM2.5 and PM10 via Open-Meteo, 3-hourly, usable for Delhi | Phase 0 curl | None; core input |
| A5 | FIRMS key works for VIIRS NRT in the domain; column names and confidence coding as documented | Phase 0 curl and file head | Adapt parser; fixtures updated |
| A6 | OpenAQ v3 has at least 8 live Delhi PM2.5 stations; endpoints as named in 05 | Phase 0 curl | Fewer localities; stale states shown |
| A7 | Archived data exist for a replay window in Oct to Nov 2025: FIRMS SP, OpenAQ hourly, Open-Meteo historical winds and CAMS | Phase 0 probes | See D-OPEN-3 |
| A8 | numpy fits in Lambda via the AWS-provided layer or a bundled arm64 wheel | `sam build` in P0 | Container image Lambda |
| A9 | Bedrock model access and a usable model ID in ap-south-1 or via an inference profile | Console, only if P1 is attempted | Skip; templates only |
| A10 | Free-tier limits for Open-Meteo (600/min, 5,000/h, 10,000/day, non-commercial, CC BY 4.0) hold | Open-Meteo terms page | Reduce cadence |
| A11 | CPCB category colours and the revised GRAP text on school measures | CPCB bulletin; CAQM order | Use verified values; the app only shows stage and link, so GRAP text is low risk |
| A12 | Rules accept a YouTube video of 3 minutes or less and require a public repo | Rules tab | Follow the live rules |

## 3. Open decisions (fill before the stated time)

| # | Decision | Fill by | Default |
|---|---|---|---|
| D-OPEN-1 | Final 12 localities and their stations | 03:00 | Pick from stations with data in the last 6 hours, spread across the city, include Dwarka, Rohini, Anand Vihar, ITO, R K Puram |
| D-OPEN-2 | Replay window (7 to 14 days, written before running anything, per 06 section 2) | 03:00 (the P1 download needs it) | Largest PM2.5 rise sequence in 25 Oct to 15 Nov 2025 at 8 or more stations |
| D-OPEN-3 | Data mode (A as_forecast or B oracle_winds) | after probing in Phase 0 | Expect B: archived forecasts at fixed lead times for pressure-level winds are unlikely to exist; if B, the evidence page says "winds are analysis values, not forecasts" and results are upper bounds. For CAMS, the historical series is short-lead data, so 24 to 48 hour lead errors cannot be reported honestly; say that |
| D-OPEN-4 | Teammates | before submit | Solo |
| D-OPEN-5 | Pilot threshold review by someone with a health background | before P5 | Described as a proposal on the method page |
| D-OPEN-6 | Strands and Bedrock "why" text | only after G4 | Skip |
| D-OPEN-7 | Map library for /smoke | P2 | Leaflet with OpenStreetMap tiles at low volume with attribution; check tile usage policy; MapLibre with OpenFreeMap as the alternative |
| D-OPEN-8 | Licence | P0 | Apache-2.0 |

## 4. Proposals that are not facts

These numbers are design choices with reasons, to be tested or flagged, never presented as established:
- Verdict thresholds: light 60 and 90, strenuous 30 and 60 µg/m³ of PM2.5 (04 section 6).
- Smoke influence kernel parameters, 72-hour decay, 36-hour fire age window, ensemble perturbation sizes (04 section 9).
- Trapping rule: BLH under 400 m and 10 m wind under 2 m/s for 3 hours.
- Event definition in M1: rise of at least 60 µg/m³ over the previous 24-hour median and at least 100 µg/m³.
- Placeholder band factors 0.7 and 1.4 until bands.json exists.

## 5. Things we know we do not model

Fires after "now"; night-time fires and cloud-hidden fires; small fires below VIIRS detection; smoke from outside the domain; vertical mixing to the ground; chemistry; secondary aerosol; indoor air; exposure inside the school. All stated on the method page.

## 6. Log

Add entries below, newest first.

- 2026-10-11: Pack written (PRD to 11). Nothing verified yet.
