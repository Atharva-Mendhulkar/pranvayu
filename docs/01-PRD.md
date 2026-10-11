# PranVayu: product requirements

Status: draft for build, Sat 10 Oct 2026. Owner: Atharva (team PranVayu). Event: Environmental Hacks, Air track (Bharat Builds Tour 02).

## 1. Summary

PranVayu tells a Delhi-NCR parent what the air means for their child's school day, tomorrow and the day after, and says how sure it is. The first screen answers "Should the outdoor assembly and PE happen? When is the cleanest time to be outside?" in plain English or Hindi. Underneath, a trajectory model checks whether stubble smoke is on its way and when, and a rule engine turns the corrected PM2.5 forecast into a verdict per school period.

It is not an AQI dashboard, not a city command centre, and not an official school-closure tool.

## 2. Problem

Parents get a number (AQI 312) and a colour. They have to turn it into decisions alone: assembly, break, PE, walking to the bus, evening play. Three gaps make this hard:

1. **Numbers are not decisions.** GRAP stages are tied to Delhi's average AQI and forecasts, and school closures need written government orders. Nothing covers the daily "is outdoor PE okay tomorrow" call.
2. **Forecasts are coarse.** The free global forecast we can reach (CAMS via Open-Meteo) is about 45 km and 3-hourly over India, so it cannot tell two Delhi localities apart.
3. **Smoke is contested.** Studies of Delhi's autumn air disagree on how much stubble burning contributes (one 2025 sensor study put Punjab burning near 14% of Delhi-NCR PM2.5 in Oct-Nov 2022 with no linear link to fire counts; transport time from Punjab/Haryana to Delhi's mixing layer is about 36-48 hours in trajectory studies). Apps either ignore smoke or imply certainty they do not have.

### Evidence base (used in this PRD)

| Claim | Source |
|---|---|
| Smoke reaches Delhi's mixing layer in ~36-48 h | Tracing the haze, PMC12823738 (HYSPLIT, 2020-2024) |
| Punjab crop burning ~14% of Delhi-NCR PM2.5 in Oct-Nov 2022; no linear fire-count relation | npj Climate and Atmospheric Science, 2025 |
| Contribution estimates are uncertain (meteorology, chemistry, emissions) | ScienceDirect critical review, 2025 |
| CAMS global forecast: 0.4 deg (~45 km), 3-hourly, updated every 12 h | Open-Meteo Air Quality API docs |
| GRAP stages follow Delhi average AQI (I 201-300, III 401-450, IV >450; II 301-400 per the 2024 order) and forecasts; closures need written orders | CAQM revised GRAP (Sept 2026) coverage; Careerindia |
| CPCB PM2.5 category breakpoints (ug/m3): Good 0-30, Satisfactory 31-60, Moderate 61-90, Poor 91-120, Very poor 121-250, Severe 250+ | CPCB AQI scheme (verify against the current bulletin) |

## 3. Users

**Primary: parent or guardian of a school-age child in Delhi-NCR.** Phone, often on mobile data, reads Hindi or English, checks in the evening or early morning, shares with other parents on WhatsApp. Decision: send the child out, keep them in, or move the activity.

**Secondary: school staff.** Same screen, no extra features this weekend.

**Explicitly not users:**
- Delivery riders and construction workers. Their exposure is an obligation, not a choice; a personal advisory does not change it. Out of scope by decision.
- MCD, DPCC, CAQM and enforcement staff. No command-centre view.

## 4. Core promise

> A decision for the school day, with the reason, and a straight statement of how sure we are.

Everything in the product must serve that sentence. Anything that does not is cut.

## 5. Scope

| Priority | Item |
|---|---|
| P0 | Locality picker, school-day settings, verdicts per period, 48 h air line, clean window, driver tags with evidence, smoke card and detail, confidence and freshness, GRAP banner, EN/HI toggle, share, replay mode, evidence page, method page, AWS deployment |
| P1 | Telegram evening digest, dust tag, geolocation shortcut, Strands-written "why" text (templated text is the P0 fallback) |
| Out | PINN, hyperlocal heatmap, industrial or vehicular attribution, enforcement or MCD panel, rider/worker advisory, SMS and WhatsApp Business API, accounts or login, per-school lookup, anything that claims to be an official decision |

## 6. Functional requirements

Each requirement has an ID that the build plan, tests and prompts reference.

**FR-1 Locality picker.** The user picks one of up to 12 Delhi localities, each mapped to a CPCB station found via OpenAQ. Choice persists in the browser. No GPS in P0.
Acceptance: first-time user selects a locality in at most 2 taps; reload keeps it; URL parameter overrides it.

**FR-2 School-day settings.** Defaults: arrival 07:30, assembly 07:45, break 10:30, PE 11:30, dispersal 14:30. User can edit each time. Stored locally.
Acceptance: editing a time updates verdicts without a network call.

**FR-3 Verdicts per period.** Each outdoor period gets Go, Limit or Skip from the rule engine (04-ALGORITHMS section 6), shown as a word plus a shape, never colour alone. A one-sentence headline is generated from the verdicts by fixed templates.
Acceptance: every verdict shows the PM2.5 range it was based on; headline contains no number not in the payload.

**FR-4 Forty-eight-hour air line.** One annotated chart: corrected PM2.5 median with a p10-p90 band, CPCB category zones labelled directly, night shaded, school hours bracketed, smoke arrival bracket on the time axis.
Acceptance: readable at 360 px width; no legend (direct labels); keyboard users can step through hours.

**FR-5 Clean window.** The longest contiguous stretch between 06:00 and 19:00 with Go for light activity. If none, show the least-bad window, labelled as such.
Acceptance: never shows an empty state; says "least bad, still limit" when applicable.

**FR-6 Why this verdict.** Up to two driver tags (regional smoke, local trapping; dust is P1), each with its evidence in plain language and the numbers behind it.
Acceptance: a tag appears only when its rule fires; "no clear driver" is a valid state.

**FR-7 Smoke card and detail.** Card on the home screen: level (low, moderate, high), arrival window as a range, confidence label, one sentence. Detail view: map with recent fires and three sample paths, how the ETA is formed, what we cannot know.
Acceptance: ETA is always a range; low confidence is visually distinct and says why.

**FR-8 Confidence and freshness.** Every payload carries confidence (high, medium, low) and timestamps for fires, winds and station readings. Stale (over 3 h for station data, over 8 h for winds) and partial states are visible and downgrade confidence.
Acceptance: unplugging one source in test produces a visible banner and lower confidence, not a blank screen.

**FR-9 GRAP banner.** Reads a manually maintained config (stage, effective date, source URL). Shows "Official: CAQM GRAP Stage N (as of date)" and a line that school closures follow official orders.
Acceptance: when config is missing or older than 7 days, banner says "Check the latest CAQM order" and links to it; app never infers a stage.

**FR-10 Language.** English and Hindi toggle on every screen, persisted. Deterministic strings are hand-written in both languages.
Acceptance: no untranslated string in Hindi mode except proper nouns and units.

**FR-11 Share.** One tap opens WhatsApp with a short text and a link that restores locality and day.
Acceptance: text includes locality, day, headline and confidence; link opens to the same view.

**FR-12 Replay mode.** A past peak-smoke window runs through the same pipeline. A banner states it is a replay with dates. A scrubber moves "now" through the window and shows what the app would have said against what happened.
Acceptance: the replay banner cannot be missed or dismissed; live and replay never mix on one screen.

**FR-13 Evidence page.** Shows the pre-defined validation numbers from the replay (06-VALIDATION): lead time, forecast error against baselines, verdict accuracy including unsafe-error rate, band coverage. States limits.
Acceptance: every number on the page is generated by the evaluation job, not typed.

**FR-14 Telegram digest (P1).** Subscribe via bot to one locality; evening message with tomorrow's headline and clean window; one trigger alert if tomorrow's assembly verdict is Skip or smoke ETA is within 24 h. Stop command deletes the subscription.

**FR-15 Dust tag (P1).** PM10/PM2.5 ratio and wind rule.

**FR-16 Method and credits.** Plain-language method, data sources with licences (CAMS via Open-Meteo, NASA FIRMS, OpenAQ/CPCB), limits, disclaimer, repository link, AI tools used.

## 7. Non-functional requirements

- **Speed.** First answer visible within 3 s on throttled 4G. JavaScript under 200 KB gzipped for the home route.
- **Reliability.** API reads precomputed results only. If a pipeline run fails, serve the last good result with its age.
- **Accessibility.** WCAG AA contrast, visible focus, no information by colour alone, reduced-motion respected, touch targets 44 px or larger.
- **Privacy.** No accounts, no tracking scripts, no storing locations of users. Browser storage only for locality, times, language. Telegram chat id stored only while subscribed.
- **Cost and limits.** Stay inside Open-Meteo free limits (10,000 calls/day), OpenAQ (60/min, 2,000/h), FIRMS (5,000 per 10 min) and AWS free tier credits.
- **Security.** API keys in AWS Systems Manager Parameter Store or Secrets Manager, never in the repo or client. API Gateway throttling on. CORS limited to the site origin.
- **Truthfulness.** No claim in the UI, README or video without a measured number or a cited source behind it.

## 8. Success criteria

For the hackathon (mapped to the judging criteria):

| Criterion | What we need to show |
|---|---|
| Idea and impact | One real decision (school-day outdoor activity) for one real user, with evidence for the gap |
| Built on AWS | Scheduled Lambda pipeline, API Gateway, DynamoDB/S3, hosted frontend, visible in the video |
| Design and usability | A stranger finds tomorrow's PE verdict for a named locality in 20 seconds (test with three people tonight) |
| Execution | Live deployed URL working end to end, plus replay |
| Demo video | Under 3 minutes, shows the product, who it is for, where AWS fits |

Model honesty targets (report whatever the numbers are):
- Lead time of the smoke index ahead of observed rises, against a raw fire-count baseline.
- Forecast error at 24 h and 48 h against persistence (and raw CAMS if an archive exists).
- Unsafe-error rate: share of "Go" verdicts where observed air would have been "Skip".

## 9. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Smoke adds little signal on some days | Say so on the evidence page; verdicts rely on corrected PM2.5, smoke is explanation and early warning |
| Few live fires on demo day | Replay mode is first-class and labelled |
| Archive data missing for replay | Fall back to oracle-winds evaluation and label it as an upper bound (06-VALIDATION) |
| Strict PE threshold says Skip most winter days and users tune out | Always show the clean or least-bad window and an indoor alternative line |
| Time (deadline unknown; the page countdown implied about Sun 19:30 IST, so plan to submit by 17:30) | Cut list and gates in 07-BUILD-PLAN; features freeze Sun 14:15 |
| Open-Meteo or OpenAQ outage | Cache last good, show age, downgrade confidence |
| Rule violation (old project) | New repo, no VayuMind or JointPINN code or weights; ask organizers before reusing anything |

## 10. Open questions

1. Exact submission deadline time (check the form when it opens Sun 08:00; the countdown implied roughly Sun 19:30 IST, and the plan assumes that).
2. Which past event window to replay (pick after looking at OpenAQ series; 06-VALIDATION section 2).
3. Whether archived CAMS forecasts exist for that window.
4. Bedrock model access in the team's account (only matters for P1 explain text).

See 10-DECISIONS-AND-ASSUMPTIONS for what is decided versus unverified.
