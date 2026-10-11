# PranVayu: prompts for Claude Code and Antigravity

How to use:
- Put this pack in the repo first (`docs/`, `AGENTS.md`, `CLAUDE.md`). Both tools read the repo's instruction files; the prompts below only say what to do now.
- One session per track. `backend/` and `web/` sessions run at the same time on separate branches or folders; they meet only through `docs/05-DATA-CONTRACTS.md` and `web/public/mock/`.
- Paste one prompt at a time. Each ends with a stop rule. Read STATUS.md before starting the next phase.
- If the tool asks a question the docs answer, point it at the doc. If the docs do not answer, tell it to pick the simplest option and record it in `docs/10-DECISIONS-AND-ASSUMPTIONS.md`.
- Review prompts (bottom) should be run in a fresh session that has not seen the build conversation.

Placeholders in angle brackets are filled by you.

---

## P0. Scaffold and hello world (single session)

```
Read AGENTS.md, then docs/03-ARCHITECTURE.md (sections 3, 7, 8, 13, 14) and docs/05-DATA-CONTRACTS.md (sections 2, 3, 4).

Goal: a repository skeleton that other sessions can build into, plus a deployed hello-world API on AWS.

Do:
1. Create the folder layout in 03-ARCHITECTURE section 7. Empty packages get a one-line README explaining their job.
2. Python 3.12 backend with pytest and ruff configured; web app with Vite, React, TypeScript strict, Vitest; no UI kit, no CSS framework.
3. A Makefile with the targets named in AGENTS.md (test, lint, run-local, replay, evaluate, deploy). Targets that depend on later phases print "not implemented yet" and exit non-zero.
4. infra/template.yaml (AWS SAM): one Lambda (Python 3.12, arm64) behind an HTTP API route GET /v1/health returning {"ok": true, "version": "<git sha>"}; CORS enabled for any origin for now.
5. Deploy it to ap-south-1 with `sam build` and `sam deploy --guided` (I will run the interactive part; tell me exactly what to answer). Return the URL.
6. Write web/public/mock/dwarka.json by hand from the payload shape in 05-DATA-CONTRACTS section 4, with plausible values for three days, all five periods, all drivers, and a 48-hour series. Add a top-level "mock": true field and a README beside it explaining it is not data.
7. .gitignore covering .env, node_modules, .aws-sam, build output. LICENSE file (Apache-2.0).

Do not write any model, ingestion or UI feature code. Do not copy anything from outside this repository.
Stop when `make test` and `make lint` pass on the empty skeleton and the hello URL answers. Write STATUS.md with the URL and anything surprising.
```

## P1-A. Backend foundation (backend session)

```
Read AGENTS.md, docs/03-ARCHITECTURE.md, docs/04-ALGORITHMS.md (sections 2, 5, 6, 7, 8, 9), docs/05-DATA-CONTRACTS.md, docs/06-VALIDATION.md (section 7 only).

Goal: everything except trajectories, running offline on fixtures.

Do:
1. backend/pv/sources/: one module per source (fires, obs, winds, cams) with a client and a fixtures mode switched by PV_FIXTURES=1. Parsers return typed objects. Use the samples in backend/tests/fixtures/ (I saved them from the real APIs; if a field differs from 05-DATA-CONTRACTS, trust the fixture and record the difference in docs/10-DECISIONS-AND-ASSUMPTIONS.md).
2. backend/pv/model/correction.py: bias ratio, lead-decaying factor, near-term blend, band from config/bands.json (placeholder factors when the file is absent, flagged uncalibrated). Exactly as 04 section 5.
3. backend/pv/model/rules.py: decision value by confidence tier, thresholds from config/thresholds.yaml, verdicts per period, clean window search, as 04 section 6. Also export the rules as a small JSON for the browser (web/public/rules.json), generated from the same config.
4. backend/pv/model/drivers.py: local trapping rule and dust (P1, behind a config flag). Regional smoke tag reads a smoke object that is stubbed as "no signal" for now.
5. backend/pv/model/confidence.py as 04 section 8.
6. backend/pv/payload/: assemble the payload per 05 section 4 and validate it. Payload must contain no language-specific headline.
7. scripts/run_local: run all of the above on fixtures for every locality in config/localities.json and write payloads to web/public/mock/<id>.json with "mock": true.
8. scripts/replay_fetch: download and freeze archived inputs for the replay window written in docs/10 into replay/<run_id>/inputs/ (fires from FIRMS standard-processing archives, observations from OpenAQ hourly history, winds and CAMS from the Open-Meteo archive endpoints recorded in docs/10), resumable, respecting the rate limits in 05 section 1, with a manifest of endpoints, parameters, row counts and the data mode. I will run it on my machine; write it, test its parsing on tiny fixtures, and tell me the command.

Tests (pytest, offline): bias correction on a constructed series; each tier of decision value; threshold boundaries (60/61, 90/91, 30/31, 60/61); a clean window case with a Go run, one with none; stale-observation fixture lowers confidence; missing-station fixture produces a payload with the partial_data flag instead of an exception; payload size under 60 KB gzipped.

Constraints: pure functions where possible; every tunable number read from config; no network in tests; no print debugging left in.
Stop when the tests pass, `make lint` passes and run-local writes valid payloads. Write STATUS.md (done, not done, decisions, doc contradictions).
```

## P1-B. Web foundation (web session)

```
Read AGENTS.md, docs/02-UX-SPEC.md completely, docs/01-PRD.md (FR-1 to FR-6, FR-8 to FR-11, FR-16), docs/05-DATA-CONTRACTS.md section 4.

Goal: the home screen, complete in every state, built on web/public/mock/dwarka.json.

Do:
1. Tokens as CSS variables exactly as in 02 section 2. Mukta (400, 600, 800) self-hosted, subset Latin and Devanagari, font-display swap.
2. Routes /, /smoke, /evidence, /method with placeholders for the last three.
3. Home screen per the 02 section 3 wireframe: one-sentence locality and day control, headline built from i18n templates (02 section 5), ruled timetable with SVG verdict shapes and the word always shown, in-place row expansion with real thresholds, "Change times" inline form, why block, GRAP banner, freshness line, WhatsApp share link, language toggle persisted.
4. The air line as hand-built SVG per 02 section 3, with direct labels, brackets, observed dots, keyboard stepping, and the one 600 ms draw-in (disabled for reduced motion).
5. A debug query parameter ?state=loading|stale|partial|api-down|no-smoke|off-season|low-confidence|first-visit|replay that applies the states in 02 section 4 to the mock.
6. Verdict recompute in the browser from the series and web/public/rules.json (stub the file until the backend session writes it) so edited times need no network.
7. Hindi strings hand-written for everything on the home screen. Mark each with a TODO review tag in the dictionary, not in the UI.

Constraints: no component library, no CSS framework, no icon font, no emoji in the UI, no gradients or shadows, one 4 px radius. Everything in the banned list of 02 section 6 is a bug. Home JS under 200 KB gzipped.
Tests: Vitest for headline templates and the recompute function; two Playwright smoke tests (loads and shows headline; language toggle swaps text).
Stop when all states render at 360 and 1024 px. Save screenshots to docs/screenshots/. Write STATUS.md.
```

## P2-A. Trajectories and smoke (backend session)

```
Read AGENTS.md, docs/04-ALGORITHMS.md sections 3, 4, 7, 8, 9 and 10, docs/06-VALIDATION.md section 4 (M1 definitions).

Goal: the smoke arrival estimate, offline.

Do:
1. backend/pv/model/trajectories.py: vectorised backward ensemble (receptors x arrival times x levels x members) with second-order stepping, bilinear space and linear time interpolation, perturbations, truncation flags.
2. backend/pv/model/influence.py: fire aggregation, per-trajectory influence index, ensemble median/p10/p90, probability, level from config/smoke_levels.json (placeholder cuts and the uncalibrated flag when absent), arrival window logic exactly as 04 section 4.
3. Wire the result into the smoke object and the regional-smoke driver tag, and into the confidence rules.
4. Return the sample paths and top fires for the payload within the size limits in 05 section 4.

Synthetic tests (must be written first and must pass):
- Uniform 5 m/s westerly wind, fire 180 km due west, detected 6 h before: arrival about 10 h later within the ensemble spread, probability rises then falls.
- Same fire with a uniform easterly wind: no signal.
- Same fire with wind from the south-west rotated 45 degrees: lower probability than westerly.
- No fires: no signal, confidence not penalised for smoke.
- Fire 30 hours too old (age beyond the window): no contribution.
- Low boundary layer reduces influence relative to high boundary layer.
- Ensemble with all members truncated: result flagged, no exception.
- Runtime for 12 receptors, 17 arrival times, 3 levels, 24 members is under 60 s on the target Lambda size (record the measurement; use K and step from config to fit).
Never express the index as a concentration or a percentage anywhere in code, payload or tests.
Stop when tests pass. Write STATUS.md with the measured runtime and memory.
```

## P2-B. Smoke screens, method page, remaining routes (web session)

```
Read AGENTS.md, docs/02-UX-SPEC.md (sections 3 to 5), docs/01-PRD.md (FR-7, FR-10, FR-12, FR-13, FR-16).

Do:
1. Smoke card on home (level, arrival range, confidence, the calibration sentence from 02 section 5).
2. /smoke: fire list and sample path summary first; a Leaflet or MapLibre map only after the rest works, lazy loaded, with attribution. Three short paragraphs: what the model did, why the range is as wide as it is, what it cannot know.
3. /method: plain-language method, sources with licences, limits (use 04 section 10 wording), disclaimer, repository link, AI tools used, thresholds described as a proposal.
4. /evidence shell that renders from a mock evidence file matching 05 section 5, with one plain-reading sentence and one limits sentence under each table. No numbers typed into components.
5. Replay mode UI shell: banner, scrubber, "what it said then versus what happened" views, driven by the replay route in 05 section 3.
6. Accessibility pass: keyboard, focus rings, labels on the timetable and chart in both languages.
Stop when every route renders with mock data, in both languages, with no console errors. Write STATUS.md.
```

## P3. Live pipeline on AWS (backend session, you present for the console steps)

```
Read AGENTS.md, docs/03-ARCHITECTURE.md completely, docs/05-DATA-CONTRACTS.md sections 1 to 3 and 6.

Goal: scheduled real data, a public API, a public site.

Do:
1. handlers/: thin entry points for ingest-fires, ingest-obs, ingest-winds, ingest-cams, model-run, api, health. Handlers parse events and call pv.* only. Secrets from SSM at cold start.
2. infra/template.yaml: functions, schedules (03 section 4 cadences), DynamoDB pv-state, S3 pv-data, HTTP API with throttling and CORS to the site origin, three CloudWatch alarms with an email topic, least-privilege IAM per function.
3. Per-locality isolation in model-run; "keep last good" on failure; freshness and flags in every payload.
4. Structured JSON logs (03 section 10).
5. Deployment steps documented in README under "Deploy" (I run the interactive parts; tell me exactly what to do and what to check).
6. Point web/ at the live API through one environment variable; keep ?mock=1 for development. Build and give me the zip for Amplify Hosting.
7. scripts/smoke_test: calls the live API and checks freshness under 90 minutes, schema valid, at least 8 localities.
Stop when the smoke test passes against the live URL. Write STATUS.md including the measured model-run duration and any quota warnings.
```

## P4. Replay and evaluation (backend session; fetching runs on my laptop)

```
Read AGENTS.md, docs/06-VALIDATION.md completely, docs/04-ALGORITHMS.md section 5, docs/10-DECISIONS-AND-ASSUMPTIONS.md (replay window and data mode entries).

Do:
1. Check the replay inputs frozen by scripts/replay_fetch (manifest, row counts, gaps). Fix gaps; do not widen the window after seeing results.
2. scripts/replay: run the same pipeline code for every 3-hourly as-of and write payloads under replay/<run_id>/<locality>/<asof>.json.
3. pv/replay/evaluate.py: M1 to M5 exactly as defined, with the calibration/evaluation split and tuning limited to the five parameters in 06 section 6. Write evidence.json per 05 section 5, plus config/smoke_levels.json and config/bands.json from the calibration days.
4. Re-run the replay with the generated config. Evaluation numbers stay from held-out days.
5. Upload to S3 prefixes in 03 section 5 and confirm /v1/replay, /v1/forecast with replay parameters, /v1/evidence work.
Tests: metric functions on tiny hand-made series with known answers (event detection, hit/false alarm, lead time, coverage); split logic; leave-one-day-out fallback.
Never adjust a metric or an event definition after seeing results. If results are poor, report them and apply the table in 06 section 9.
Stop when the evidence JSON exists and the live evidence page renders it. Write STATUS.md with the headline numbers, the data mode, and every limit you can think of.
```

## P5. Polish (both sessions, after the freeze)

```
Read AGENTS.md and docs/08-SUBMISSION-KIT.md sections 1 and 2.
Fix only: bugs, unclear copy, accessibility failures, missing attribution, console errors, performance budget misses, secret leaks, dead code. Add no features.
Then tick every box in 08 section 2 and write the unticked ones into STATUS.md.
```

---

## Review prompts (fresh session, give it the repo and the docs, not your opinion)

### R1. Spec compliance review

```
You are reviewing a repository against its specification. Read docs/01-PRD.md, docs/04-ALGORITHMS.md and docs/05-DATA-CONTRACTS.md, then read the code in backend/pv.
For each functional requirement FR-1 to FR-16 and each section of 04, state: implemented, partly, not at all, or contradicts the spec, with file and line evidence. Separately list any place where a number is hard-coded that the spec says belongs in config, and any place where a relative index is shown as a concentration or percentage. Do not fix anything. Be specific and sceptical.
```

### R2. UI banned-pattern review

```
Read docs/02-UX-SPEC.md sections 2, 3 and 6. Open the running site at <URL> at 360 and 1024 px in English and Hindi, and screenshot each route and each state reachable by ?state=. For every screenshot list any violation of the banned patterns, token drift (colours, radius, type sizes), emoji, shadows, gradients, misaligned timetable rules, text that does not match the copy deck, and any place that looks like a generic template. Then say what a stranger would take the product to be after five seconds. Do not edit code.
```

### R3. Evidence honesty review

```
Read docs/06-VALIDATION.md, then evidence/<run_id>/evidence.json, the evidence page, and pv/replay/evaluate.py. Check: metrics match the pre-registered definitions; no tuning on evaluation days; every number on the page equals the JSON; the data mode is stated wherever numbers appear; the limits listed are real and complete; any claim in the README, method page or video script that the numbers do not support. List what to change. Do not edit code.
```

### R4. Secrets and rules review

```
Search the working tree, the built web bundle and the git history for API keys, tokens and account IDs. Check that the commit dates are on or after 8 October 2026 and that history was not rewritten. Check that no file looks copied from another project (unusual headers, style changes, vendored folders). List findings with evidence only.
```
