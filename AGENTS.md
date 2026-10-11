# AGENTS.md: PranVayu

Instructions for any coding agent (Claude Code, Antigravity, others) working in this repository. Read this first, then the docs it points to.

## What this is

PranVayu is a citizen-facing school-day air advisory for Delhi, built for the Air track of Environmental Hacks (Bharat Builds Tour, event 02, 8 to 11 Oct 2026). A parent picks a locality and gets Go, Limit or Skip for each outdoor school period, the cleanest window of the day, a 48-hour air line, and a smoke arrival range for stubble smoke, with confidence and data age shown everywhere. Serverless on AWS (ap-south-1). English and Hindi.

## Source of truth

Read in this order when they disagree; the earlier one wins:
1. `docs/01-PRD.md` (what and why, FR-1 to FR-16)
2. `docs/02-UX-SPEC.md` (binding for the frontend)
3. `docs/04-ALGORITHMS.md` (what each step computes)
4. `docs/05-DATA-CONTRACTS.md` (shapes, routes, config files)
5. `docs/03-ARCHITECTURE.md` (AWS and repo layout)
6. `docs/06-VALIDATION.md` (replay and metrics)
7. `docs/10-DECISIONS-AND-ASSUMPTIONS.md` (what is verified and what is guessed)

`docs/07-BUILD-PLAN.md` says what to build when. `docs/09-AGENT-PROMPTS.md` holds the phase prompts.

If the docs are silent or ambiguous: choose the simplest option that satisfies the PRD, do it, and add a dated line to section 6 of `docs/10-DECISIONS-AND-ASSUMPTIONS.md`. If the docs contradict each other or reality (a fixture differs from the contract, an API field is missing), trust the fixture or the real response, fix nothing silently, and record the difference in the same place and in STATUS.md.

## Hard rules

1. **No old code.** Nothing from VayuMind, JointPINN or any earlier project: no files, snippets, weights, datasets. Do not copy code from the internet either, except short standard patterns; if you do, note the source in a comment and the licence in `docs/10`. The event rules disqualify earlier work.
2. **History is evidence.** Commit small and often, with plain messages saying what changed. Never rewrite history, never force-push, never backdate.
3. **No secrets in the repo, the bundle or logs.** Keys live in SSM Parameter Store and local `.env` (ignored).
4. **Rules decide, language explains.** Verdicts, thresholds, windows and confidence come from deterministic code driven by `config/`. Any language model only rewrites facts that were already computed, and templates must work with no model.
5. **Never show the smoke index as a concentration or a percentage.** No "X% of your air is from stubble". The product shows influence level and an arrival range.
6. **Label honestly.** Placeholder calibration is `uncalibrated`. Replay results carry their data mode. Mock data is marked `"mock": true` and never shown in production. Old data shows its age.
7. **Config over code.** Every tunable number in `docs/04` section 9 lives in `config/`, not in a function body.
8. **Tests run offline** on fixtures in `backend/tests/fixtures/`. No test calls the network.
9. **One working feature beats five that almost work.** Finish and check before starting the next. Follow the phase gates in `docs/07`. When a phase prompt tells you to stop, stop and write STATUS.md.
10. **Out of scope, do not add:** delivery-rider or construction-worker advisories, MCD or enforcement panels, heatmaps, vehicular or industrial attribution, neural or physics-informed models, accounts or logins, GPS, analytics trackers, ads.

## UI rules (binding; see `docs/02-UX-SPEC.md`)

- The signature element is the ruled school-diary timetable. Everything else stays quiet.
- Tokens: Notebook #FBFCFE, Rule blue #C9D6EA, Ink #14233C, Ink soft #4A5B78, Margin grey #9AA6B8, Panel #EEF2F8; focus ring #2447C8. Category colours only for data, from CPCB, checked for contrast.
- Type: Mukta 400, 600, 800 only. Sentence case. Tabular numerals.
- One radius (4 px). No shadows. No gradients.
- Verdicts are an SVG shape plus a word plus colour, never colour alone, never emoji.
- Banned: gradient or glass effects, rows of identical rounded cards, KPI tiles, hero big-number-small-label, tracked-out all-caps labels or eyebrows, numbered markers on non-sequential content, dot-joined meta strings, appended arrows on links, monospace for small labels, fade-up on scroll, hover lifts, purple or teal accents, a brand accent colour. If you produce one of these, remove it.
- Words: plain verbs, errors say what happened and what to do, the same action keeps the same name everywhere, copy comes from the copy deck. Hindi strings are hand-written, not machine translated.
- Budgets: home route JavaScript under 200 KB gzipped, CSS under 30 KB, payload under 60 KB gzipped, no chart or UI library.
- Accessibility: AA contrast, 44 px targets, visible focus, keyboard-stepping chart with announcements, reduced motion respected.

## Commands

Defined in the Makefile in Phase 0. Keep these names stable:
`make test`, `make lint`, `make run-local` (pipeline on fixtures, writes mock payloads), `make replay`, `make evaluate`, `make deploy`, `make web-build`.
Run `make test` and `make lint` before every commit.

## Code conventions

- Backend: Python 3.12, type hints, small pure functions, dataclasses or pydantic for shapes, numpy for the model, ruff for lint and format, pytest. Handlers in `backend/handlers/` only parse events and call `backend/pv/`.
- Frontend: TypeScript strict, React function components, plain CSS files with variables, no CSS-in-JS, no utility framework, i18n through a small dictionary module, no network calls except the single forecast fetch per locality.
- Errors: fail per locality, not per run. A broken input lowers confidence and shows a banner; it does not throw to the user.
- Logging: structured JSON with run id, locality, source ages.

## Working notes

- Keep `STATUS.md` at the repo root: what is done, what is not, decisions made, contradictions found, how to run. Update it at every gate and whenever you stop.
- Keep `docs/BUILD-LOG.md`: append a short dated entry whenever something fights back (a rate limit, a bad assumption, a surprising result, a fix). It becomes the blog post.
- Do not edit `docs/01` to `docs/06` to make the code easier. If a spec is wrong, say so in STATUS.md and in `docs/10`, and let the human change it.

## Definition of done for a change

Runs, tests pass, lint passes, matches the requirement it cites, handles the stale and missing-data cases, no banned UI pattern, no number hard-coded that belongs in config, committed with a message that names the requirement (for example "FR-5: clean window search").
