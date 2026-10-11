# PranVayu Status

Updated: 2026-10-11T09:15:00Z
Phase: Map API Integration & Top View Flat Cloud Visualization Complete

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
  - **Real Map API Basemap Integration**:
    - Underneath the visualization, a real geographic Map API is seamlessly tiled (ArcGIS Dark Canvas Base & Reference tiles covering Delhi NCR at Zoom 11) with zero watermarks.
    - True cartographic geography rendered below: New Delhi, Connaught Place, Ring Road, Outer Ring Road, NH48, Yamuna river, Hindon river, Noida, Gurugram, Faridabad, Bawana, Ghaziabad, and administrative state boundaries.
  - **Top View (Map & Clouds - Zero Peaks)**:
    - Completely flat plane (`u_view_mode = 0.0`, `pos.y = 0.0`). Absolutely NO PEAKS in top view.
    - True nadir camera view `(0, 7.8, 0.001)` looking directly down `(0, 0, 0)`.
    - Real Map API basemap visible underneath with advecting weather/storm pollution clouds and dynamic cyan wind streamlines flowing across the city.
    - Station pins sit cleanly on the flat terrain surface over their true geographic coordinates.
  - **Horizontal View (3D Peaks on Y-Axis)**:
    - 3D perspective camera `(0, 3.2, 5.4)` looking at `(0, 0.4, 0)`.
    - Dramatic 3D peaks rising along the Y-axis (`u_height_scale: 1.65`) from hotspot stations according to PM2.5 severity.
    - Luminous topographic contour rings wrap around each peak summit with 3D directional hillshading.
  - **Controls & HUD**:
    - Mode toggle buttons: `Top View (Map & Clouds)` and `3D Horizontal Peaks`.
    - Map attribution badge: `Map API: ArcGIS Dark Canvas · OpenStreetMap`.
    - Atmospheric HUD showing wind speed, direction (`14 km/h (315°) NW`), and active plume advection.
  - **Integrated Pages**:
    - Page 1: Advisory Dashboard with Map, School Day Timetable, Cleanest Window, 48-Hour Forecast, Regional Stubble Smoke tracking.
    - Page 2: How We Estimate with 4-step pipeline, mathematical models (CAMS rolling bias, 24-member ensemble, SII), M1–M5 replay scorecard, and data sources.
  - **Budget Compliance**: Bundle size strictly maintained under budget (JS: 197.2 kB gzipped vs 200 kB budget; CSS: 2.01 kB gzipped vs 30 kB budget).
- **Tooling & Verification**:
  - `make test` (10/10 pytest unit tests passing).
  - `make lint` (ruff and TypeScript build passing with 0 errors).
  - Visual verification with screenshots confirming flat Top View with real map and advecting clouds, and 3D peaks in Horizontal View.

## Next
- Git commit changes.
- Final user handoff.
