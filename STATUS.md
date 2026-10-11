# PranVayu Status

Updated: 2026-10-11T08:35:00Z
Phase: Glassmorphic shadcn Redesign & Integrated Architecture Complete

## Done
- **Clean Slate & Repo Structure**: Complete elimination of legacy VayuMind/JointPINN artifacts to satisfy Environmental Hacks rules. Added Apache-2.0 `LICENSE`, `README.md`, `AGENTS.md`, `CLAUDE.md`, and complete `docs/` suite.
- **Configuration Assets**: Configured all 12 Delhi localities (`config/localities.json`), `model.yaml`, `thresholds.yaml`, `timetable_defaults.json`, official CAQM GRAP Stage II config (`grap.json`), calibrated smoke cutpoints (`smoke_levels.json`), and uncertainty bands (`bands.json`).
- **Offline Test Fixtures**: Created high-fidelity fixtures for FIRMS VIIRS active fires, Open-Meteo multi-level pressure winds and boundary layer heights, CAMS PM2.5/PM10 forecasts, and OpenAQ surface observations for all 12 stations.
- **Backend Model & Pipeline (`backend/pv/`)**:
  - FIRMS VIIRS parsing with spatio-temporal deduplication (`sources/fires.py`).
  - Open-Meteo pressure-level winds (975, 950, 925 hPa, 10m) with bilinear interpolation (`sources/winds.py`).
  - Open-Meteo CAMS forecast ingestion (`sources/cams.py`).
  - OpenAQ surface air quality station observations parser with staleness detection (`sources/obs.py`).
  - CAMS PM2.5 bias correction (rolling ratio ρ, lead decay, near-term blend, p10-p90 uncertainty bands) (`model/correction.py`).
  - 24-member 2nd-order midpoint backward trajectory ensemble integration (`model/trajectories.py`).
  - Smoke Influence Index (SII) scoring (Gaussian G, time H, mixing M, travel decay D) and smoke arrival window determination (`model/influence.py`).
  - Regional smoke, local calm-air trapping, and coarse dust tags (`model/drivers.py`).
  - Dynamic confidence tier evaluation (`model/confidence.py`).
  - School timetable verdict rules, CPCB category mapper, clean window search, and deterministic bilingual headlines (`model/rules.py`).
  - Full payload assembly and Pydantic contract validation (`payload/builder.py`, `payload/validator.py`).
  - Evaluation job calculating pre-registered metrics M1 through M5 (`replay/evaluate.py`).
- **AWS Serverless Handlers & Infrastructure**:
  - Thin Lambda handlers (`api.py`, `model_run.py`, `ingest_fires.py`, `ingest_obs.py`, `ingest_winds.py`, `ingest_cams.py`).
  - Complete AWS SAM template (`infra/template.yaml`) for Mumbai (`ap-south-1`) with S3 bucket, DynamoDB `pv-state`, HTTP API, Schedulers, and IAM least-privilege policies.
- **Frontend Overhaul: Glassmorphic shadcn Architecture (`web/`)**:
  - **Zero Emojis**: Complete elimination of all emojis across all components, replaced by custom SVG vector icons (`Icons.tsx`) and clean typographic badges.
  - **Glassmorphic Design System**: Dark cosmic palette (`--bg-root: #090D16`), frosted glass surfaces (`backdrop-filter: blur(16px)`), luminous CPCB category rings, and translucent borders (`rgba(255, 255, 255, 0.08)`).
  - **Page 1: Integrated Advisory Dashboard**:
    - Hero 3D Atmospheric Dynamics Map coupling physical elevation peaks and advecting storm clouds.
    - **Horizontal View**: Dramatic Y-axis elevation peaks mapping hotspot pollution severity (Anand Vihar, Bawana, Wazirpur, etc.) with glowing topographic contour lines.
    - **Top View**: High-angle perspective showing both elevated relief peaks and weather-radar style smoke cloud advection flowing from northwest corridors across Delhi.
    - Real-time Wind HUD (`14 km/h NW • 315°`) and Plume Advection indicator.
    - Staggered collision-avoidant station markers and interactive pointer orbit drag.
    - Integrated with School Day Timetable (Go/Limit/Skip SVG shapes, in-place time adjustment), Cleanest Window badge, 48-hour air line chart with uncertainty band, and Regional Stubble Smoke tracking card.
  - **Page 2: How We Estimate & Evidence**:
    - Transparent breakdown of the 4-step computational pipeline (Ingestion, Calibration, Physics, Decision).
    - Detailed mathematical formulations for Model A (CAMS rolling bias correction), Model B (24-member 2nd-order backward trajectory integration), and Model C (Smoke Influence Index).
    - Pre-registered historical replay evaluation matrix (M1 through M5) comparing PranVayu against naive baselines with deltas.
    - Documented limitations (cloud obscuration, local dust, station outages) and data source attributions.
  - **Budget Compliance**: Bundle size strictly maintained under budget (JS: 196.7 kB gzipped vs 200 kB budget; CSS: 2.01 kB gzipped vs 30 kB budget).
- **Tooling & Verification**:
  - `make test` (10/10 pytest unit tests passing).
  - `make lint` (ruff and TypeScript build passing with 0 errors).
  - Browser subagent visual verification completed on local preview server (screenshots captured for Page 1 horizontal peaks, Page 1 top view relief and storm clouds, and Page 2 estimation methodology).

## Next
- Git commit changes.
- Final review and handoff.
