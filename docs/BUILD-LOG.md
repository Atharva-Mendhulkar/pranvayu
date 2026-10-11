# PranVayu Build Log

### 2026-10-11 03:37 IST — Initialization & Clean Slate
- Cleaned legacy codebase files to comply with hackathon rules (new repository standard, no prior project artifacts).
- Set up root structure with `AGENTS.md`, `CLAUDE.md`, `README.md`, `LICENSE`, `STATUS.md`.
- Confirmed runtime dependencies on local workstation: Python 3.14 (numpy, pytest, pydantic, pyyaml, ruff), Node.js, SAM CLI.
- Proceeding to assemble configuration dictionaries and offline fixtures.

### 2026-10-11 03:55 IST — Configuration & Test Fixtures Assembly
- Generated `config/localities.json` for 12 Delhi monitoring stations.
- Created `config/model.yaml`, `config/thresholds.yaml`, `config/timetable_defaults.json`, `config/grap.json`, `config/smoke_levels.json`, and `config/bands.json`.
- Built offline fixtures in `backend/tests/fixtures/`: `winds_dwarka.json`, `cams_dwarka.json`, `fires_snpp.csv`, and `openaq_obs.json`.

### 2026-10-11 04:15 IST — Core Modeling Engine & Validation
- Implemented `backend/pv/sources/` for FIRMS, Open-Meteo winds, CAMS, and OpenAQ with offline fixtures fallback.
- Implemented CAMS bias correction with near-term blending and lead decay in `backend/pv/model/correction.py`.
- Implemented 24-member backward trajectory ensemble integrator in `backend/pv/model/trajectories.py`.
- Implemented Smoke Influence Index (SII) calculation and arrival window determination in `backend/pv/model/influence.py`.
- Implemented timetable verdict rules, CPCB category mapper, and clean window search in `backend/pv/model/rules.py`.
- Built Pydantic payload validator `backend/pv/payload/validator.py` and evaluation module `backend/pv/replay/evaluate.py`.
- Wrote full unit test suite `backend/tests/test_pv.py` (10/10 tests passed with pytest).
- Executed `scripts/run_local` producing validated mock payloads for all 12 localities and `web/public/rules.json`.

### 2026-10-11 04:25 IST — Serverless Handlers & AWS SAM Infrastructure
- Implemented thin Lambda entry points in `backend/handlers/` (`api.py`, `model_run.py`, `ingest_fires.py`, `ingest_obs.py`, `ingest_winds.py`, `ingest_cams.py`).
- Built AWS SAM infrastructure template `infra/template.yaml` for `ap-south-1` (Mumbai).
- Created top-level `Makefile` with `test`, `lint`, `run-local`, `evaluate`, and `web-build`.

### 2026-10-11 04:30 IST — Frontend Web Application Build & Verification
- Scaffolding pure Vite + React + TypeScript web application in `web/` with zero UI framework dependencies.
- Styled according to `02-UX-SPEC.md`: School notebook paper palette (#FBFCFE), ruled lines (#C9D6EA), Ink (#14233C), Mukta typography, 4px single border-radius, zero box-shadows, zero gradients, zero emojis.
- Implemented Ruled School Diary Timetable with drawn SVG verdict shapes, row expansion, and zero-network client-side "Change times" recalculation using `rules.json`.
- Implemented hand-crafted SVG 48-hour air line chart with direct category labels, p10-p90 uncertainty band, night shading, brackets, and keyboard navigation.
- Implemented Why explanation block, Stubble smoke card, CAQM GRAP banner, WhatsApp share, and bilingual English & Hindi support.
- Implemented sub-routes: Home (`/`), Stubble Smoke Tracker (`/smoke`), Evaluation Evidence (`/evidence`), and Method & Credits (`/method`).
- Built production bundle in 316ms: **59.9 kB gzipped JS** and **1.8 kB gzipped CSS** (far under 200 kB budget).
- Conducted visual testing with browser subagent across all views and interactions.

### 2026-10-11 13:15 IST — Delhi NCR 3D Fluid & Storm Radar Map Visualization
- Built interactive Delhi NCR WebGL map (`web/src/components/DelhiFluidMap.tsx`) and route (`web/src/routes/MapRoute.tsx`).
- Implemented **Horizontal View**: Extrudes pollution hotspots (Anand Vihar, Wazirpur, Bawana, etc.) into 3D elevation peaks along the Y-axis with contour lines and subtle FBM turbulence.
- Implemented **Top View**: Storm/cloud weather-radar advection simulating pollution plumes drifting across Delhi with real wind vectors.
- Added 48-hour playback scrubber with autoplay, pointer orbit controls, and collision-free station pins showing outdoor school verdicts.
- Code-split via `React.lazy()` to maintain core home bundle at **60.7 kB gzipped JS**; Three.js lazy-loads seamlessly on demand.
- Visual verification confirmed via browser subagent recording.

### 2026-10-11 14:10 IST — Glassmorphic shadcn Overhaul & Integrated 2-Page Architecture
- User requested complete removal of all emojis across the entire UI and a redesign inspired by modern shadcn/ui glassmorphism.
- Created `web/src/components/Icons.tsx` replacing all emojis with 18 custom Lucide-style SVG vector icons (`WindIcon`, `CompassIcon`, `LayersIcon`, `ActivityIcon`, `ShieldCheckIcon`, `ClockIcon`, `BarChartIcon`, `FlameIcon`, `PlayIcon`, `PauseIcon`, etc.).
- Rebuilt design system in `web/src/index.css` with cosmic dark palette (`--bg-root: #090D16`), frosted glass surfaces (`backdrop-filter: blur(16px)`), luminous CPCB category rings, and translucent borders.
- Re-architected into two primary pages:
  - **Page 1 (Advisory Dashboard)**: Features the integrated 3D Atmospheric Dynamics Map as the hero visual element, showcasing Y-axis elevation peaks in Horizontal View, visible topographic contour relief and advecting storm clouds in Top View, real-time wind speed & direction HUD, 48-hour scrubber, and collision-free station markers, unified with the school timetable, clean window badge, 48-hour air line chart, and stubble smoke tracking.
  - **Page 2 (How We Estimate)**: Provides a complete, transparent breakdown of the 4-step computational pipeline, 3 core mathematical models (CAMS rolling bias correction, 24-member backward trajectory integration, Smoke Influence Index), pre-registered M1–M5 historical replay evaluation matrix, documented limitations, and data source attributions.
- Full verification: `make test` passed 10/10 tests, `make lint` passed with 0 errors, browser subagent visually verified both pages with 0 emojis and sleek glassmorphic aesthetics.

