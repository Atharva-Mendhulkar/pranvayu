# PranVayu: build plan

Written Sun 11 Oct 01:30 IST. Submissions open 08:00 the same day. The deadline time is not in the event page text; the countdown on the page snapshot ("Ends in 2 days, 5 hours") implied roughly **Sun 11 Oct 19:30 IST**, but I do not know when the snapshot was taken. So this plan is built to the early case: **submit by 17:30, hard stop 19:30**. If the real deadline turns out to be later (for example 23:59), give the extra hours to P4 and P5 quality and to the buffer, not to new features. Confirm the deadline at 08:00.

Team: one person (1 of 4 seats). Parallel work comes from two agent sessions, one for `backend/` and one for `web/`, both working against the contract in 05-DATA-CONTRACTS. Teammates can be added until you submit, but nobody can be added after.

## 1. Rules for the plan

1. The judges' own line: "One feature that runs beats five that almost do." Every phase ends at a gate that can be checked by looking at a running thing, not by reading code.
2. Deploy first, improve later. A live URL exists by 03:15 (hello world) and by 12:45 (real data).
3. Contract first. The frontend builds against a mock payload, the backend against fixtures; they meet at the live API.
4. When a gate is missed, run the cut list (section 4) before working longer. Time is the one budget that cannot be raised.
5. Sleep. The video and the writeup are done by a person, not an agent, and they are judged. Sleeping 03:30 to 07:00 is part of the plan.

## 2. Schedule

| Clock (Sun 11 Oct) | Phase | Result |
|---|---|---|
| 01:30 to 03:15 | P0 Foundation and verification | Accounts, keys, public repo, source samples saved, replay window chosen, hello API live on AWS |
| 03:15 | Launch agents | Start the P1 backend and P1 web sessions, then sleep |
| 03:30 to 07:00 | Sleep | Agents work to their gates and write STATUS.md; the replay input download runs on your laptop |
| 07:00 to 08:00 | Morning check | Read the Rules tab and submission form, confirm deadline, review STATUS.md, eat |
| 08:00 to 10:45 | P2 Model core and full home screen | End to end on fixtures, smoke ETA working, first usability test |
| 10:45 to 12:45 | P3 Live pipeline on AWS | Real data every hour at a public URL |
| 12:45 to 14:15 | P4 Replay and evidence | Evidence page rendered from an evaluation file |
| **14:15** | **Feature freeze** | Only fixes after this |
| 14:15 to 15:45 | P5 Polish and test | Usability tests, Hindi review, states, attribution, secrets scan |
| 15:45 to 17:30 | P6 Submission | Video, writeup, blog, form submitted |
| 17:30 to 19:30 | Buffer | Fix upload problems, nothing else |

## 3. Phases

### P0. Foundation and verification (01:30 to 03:15)

You (human, in this order, longest lead first):
1. AWS account (debit card or RuPay accepted, about ₹2 check) and Builder Center student verification. These are required to compete.
2. NASA FIRMS MAP_KEY and OpenAQ API key.
3. Public GitHub repo `pranvayu`. First commit: this docs pack plus AGENTS.md and CLAUDE.md. Commit dates must fall inside the event window; they do.
4. Run 11-PHASE0-VERIFY. Save the samples. Write what you found into 10-DECISIONS-AND-ASSUMPTIONS.
5. Choose the 12 localities from stations with live data and fill `config/localities.json`.
5a. Choose the replay window (06 section 2) and write the dates into 10-DECISIONS-AND-ASSUMPTIONS before anything is run. The replay download (P1 session A, item 8) needs it.
6. Look up the current GRAP stage and fill `config/grap.json`.

Agent session A (use the P0 prompt in 09): scaffold the repo to 03-ARCHITECTURE section 7, tooling, a Makefile with the command names in AGENTS.md, a SAM skeleton with one Lambda and one HTTP route, deploy it, and hand-write one mock payload from 05 section 4 using real locality names.

**Gate G0**
- The hello route answers from AWS at a URL you can open on your phone.
- Samples of all four sources are saved under `backend/tests/fixtures/`.
- `localities.json` has at least 8 stations with data in the last 6 hours.
- Repo is public with the first commit.

### P1. Parallel scaffolding (agents, unattended, 03:15 to 07:00)

Session A (backend): source clients with a fixtures mode and parsers, bias correction and bands (04 section 5), verdict rules and clean window (04 section 6), trapping tag, confidence (04 sections 7 and 8), payload assembly and schema check, and `scripts/run_local` writing a payload from fixtures, and `scripts/replay_fetch` downloading and freezing the replay inputs for the chosen window (run it on your own machine, not in the agent's network). Smoke is stubbed as "no signal, uncalibrated".

Session B (web): app shell, tokens and fonts from 02-UX-SPEC, i18n structure, home screen from the mock payload: locality sentence, headline from templates, timetable with SVG verdict shapes and row expansion, air line chart, why block, GRAP banner, freshness line, language toggle. A debug query parameter switches the screen between all states in the UX state table.

**Gate G1**
- Backend: tests pass offline; `run_local` produces a payload that validates against the schema.
- Web: all UX states reachable from the debug parameter; screenshots at 360 and 1024 px; typecheck and lint pass; home route under 200 KB gzipped JavaScript.
- Each session has left a STATUS.md: done, not done, decisions made, anything that contradicts the docs.

### P2. Model core and complete home screen (08:00 to 10:45)

Session A: backward trajectory ensemble, fire influence index, arrival window (04 sections 3 and 4), with the synthetic tests listed in 09. The browser-side rules JSON for editing times. Per-locality isolation of failures.

Session B: smoke card, smoke detail route (fire list and path summary first, map only if time remains), method and credits route, WhatsApp share, change-times form, evidence page shell reading a mock evidence file, keyboard and screen-reader pass on timetable and chart.

You: run the first usability test (02 section 9) with one person at about 10:00 on the mock. Fix what they stumble on while P3 starts.

**Gate G2**
- `run_local` on the fixtures yields a smoke arrival window that matches the synthetic expectations.
- The web app, pointed at that payload, shows the smoke card correctly, in both languages.
- One person answered the PE question in 20 seconds or less.

### P3. Live pipeline on AWS (10:45 to 12:45)

Handlers for the four ingest jobs, model-run and api; full SAM template with SSM parameters, schedules, DynamoDB, S3, alarms; frontend pointed at the live API; Amplify deploy; `/v1/health`.

Enable the schedules by 11:45 at the latest so two consecutive hourly model-runs can be seen before the gate.

Benchmark the trajectory step in Lambda. If it exceeds 60 seconds, reduce K to 12 and evaluate arrival times every 6 hours instead of every 3 (both are config values).

**Gate G3**
- A public URL opens on a phone and shows real data for at least 8 localities.
- Payload age under 90 minutes, two consecutive scheduled runs succeeded.
- Three alarms exist; killing one source key produces a visible "older data" state, not an error page.
- The console view you will show in the video (Lambda, EventBridge, DynamoDB, API Gateway, Amplify, CloudWatch) is ready.

### P4. Replay and evidence (12:45 to 14:15)

Follow 06-VALIDATION: freeze archived inputs, run every as-of, evaluate on held-out days, write evidence JSON, regenerate `smoke_levels.json` and `bands.json`, re-run with them, upload to S3, wire replay mode and the evidence page.

The inputs were downloaded during P1; check the manifest first and fix gaps early. Time-box winds archive trouble to 30 minutes, then use the fallbacks in the cut list. While the evaluation runs, draft the blog from BUILD-LOG.

**Gate G4**
- Evidence page renders from the JSON on the live site, with data mode and limits visible.
- M1 to M4 present (M5 if time allowed). Numbers are whatever they are.
- Replay banner and scrubber work on the live site.
- Product wording was updated according to 06-VALIDATION section 9 if results demanded it.

### Feature freeze at 14:15

### P5. Polish and test (14:15 to 15:45)

- Usability test with three people on the live URL, using the script. Fix only what blocks understanding.
- Native Hindi reader checks the Hindi strings.
- Stale, partial and API-down states checked on the live site by breaking inputs.
- Attribution and licences on the method page (CAMS via Open-Meteo, FIRMS, OpenAQ, OpenStreetMap if used).
- Secrets scan across the repo and the built bundle; confirm no keys in git history.
- README with what it is, live URL, architecture picture, how to run on fixtures, AI tools used, data sources and limits.
- Delete dead code and unused dependencies. Confirm no file came from VayuMind or JointPINN.

**Gate G5:** checklist in 08-SUBMISSION-KIT section 2 passes.

### P6. Submission (15:45 to 17:30)

Follow 08-SUBMISSION-KIT: record the video from the live site, write the blog on AWS Builder Center, fill the form, submit by 17:30. Do not change the site after recording unless something is broken.

## 4. Cut list and minimum ladder

Cut in this order when behind:

1. Telegram digest (FR-14).
2. Bedrock and Strands "why" text (templates are the P0 text).
3. Dust tag (FR-15).
4. Map on the smoke detail screen (keep the fire list and a path summary).
5. Replay scrubber (keep a fixed as-of picker with three choices, or the static evidence page only).
6. M5 smoke effect size.
7. The 5th to 12th locality (keep at least 6).

Minimum ladder, each rung must be on the live site by its time:

| Rung | By | Content |
|---|---|---|
| 1 | 12:45 | Live app: corrected PM2.5 forecast, verdicts, timetable, air line, freshness, GRAP banner, on AWS |
| 2 | 14:15 | Smoke card from the ensemble and fires, calibrated or honestly labelled uncalibrated |
| 3 | 14:15 | Replay and evidence in whatever data mode was possible |
| 4 | 15:45 | Hindi, share, usability fixes |

If rung 2 slips, the smoke card shows recent fires and the wind sector only, labelled "context, no arrival estimate", and the video does not claim a smoke early warning. Rung 1 is never cut.

If winds cannot be archived in any usable form: replay covers M2 to M4 on CAMS and observations only, the smoke card is disabled inside the replay, and the evidence page says why.

## 5. Risks

| Risk | Early sign | Response |
|---|---|---|
| Open-Meteo pressure-level variables or model not as assumed | Phase 0 sample lacks the fields | Use the variables that exist (850 hPa, 10 m) and record the change in 10; the method still runs |
| Open-Meteo rate limit on grid fetch | 429 in ingest logs | Fetch 4 times a day only; stagger; cache by run |
| OpenAQ stations stale or missing | Fewer than 8 live stations | Use fewer localities; show the stale state; do not invent readings |
| Lambda too slow for trajectories | model-run over 60 s | K down, arrival step up, cap sources |
| AWS account verification blocked | Card rejected | Try RuPay/debit; contact organisers on Discord; eight-hour free sandbox only as a stopgap, since the URL must stay up for judging |
| Replay shows no skill | M1 no better than baselines | Publish it; change wording per 06 section 9; the video says what we learned |
| Agent drifts into generic UI | Gradients, card grids, emoji verdicts appear | Run the banned-pattern review prompt (09) and delete |
| Running out of time | Gate missed by over 30 minutes | Cut list, do not extend the phase |

## 6. Checkpoint habit

At every gate: run the app, take two screenshots, commit, update `docs/BUILD-LOG.md` with what fought back (this becomes the blog), and write the gate result into STATUS.md. Commit often and in small pieces; the repo's history is part of what gets checked.
