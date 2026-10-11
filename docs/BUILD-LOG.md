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

### 2026-10-11 15:50 IST — OpenFreeMap Vector Basemap Integration & Makefile Fix
- Integrated OpenFreeMap vector basemap via MapLibre GL JS under Three.js fluid layer with 5 map styles (Dark, Positron, Liberty, Bright, Fiord).
- Top view renders vector basemap crisp and flat with advecting storm clouds and wind streaks; horizontal view extrudes 3D peaks along the Y-axis.
- Fixed `make evaluate` to set `PYTHONPATH=backend` so replay evaluation runs directly from repository root.
- Verified `make test`, `make lint`, `make run-local`, `make evaluate`.

### 2026-10-11 18:30 IST — Grey-White UI Overhaul, Full-Screen Map & Collapsible Advisory Menu
- Switched UI palette to clean grey-white glassmorphism with high-contrast slate `#0F172A` text on frosted white glass (`rgba(255, 255, 255, 0.92)`).
- Made the Atmospheric Dynamics Map cover the entire viewport in full-screen mode.
- Added animated moving wind direction arrows gliding across the city following the wind vector.
- Mapped pollution fluid clouds in GLSL fragment shader directly to official 6 CPCB PM2.5 color categories (emerald green, mint, amber, orange, crimson, deep maroon).
- Built slide-out Collapsible Advisory Side Menu holding School Day Timetable, Stubble Smoke Tracking, 48-Hour Forecast, Why block, and CAQM GRAP banner.
- Re-architected top navigation into a floating rounded corner glassmorphic pill nav bar.
- Added OpenFreeMap documentation and style modal with links to GitHub, X, Bluesky, and Zsolt Ero's project background.

### 2026-10-11 18:50 IST — Dark Mode Overhaul, Synchronized MapLibre Vector Map, & Atmospheric Dispersion Physics
- Returned entire application UI to a sleek cosmic dark glassmorphic theme (`#090D16`, `rgba(15, 23, 42, 0.92)` frosted glass, high-contrast `#F8FAFC` and `#94A3B8`).
- Removed OpenFreeMap button from the top navigation bar while preserving required attribution in the bottom badge and info modal.
- Made the actual vector map (streets, Yamuna river, Ring Road, localities) 100% visible and interactive in Top View.
- Added real-time synchronization between MapLibre GL map and Three.js shader: map pan, zoom, rotate, and resize events project station coordinates directly into shader uniforms, locking smoke plumes to geographic reality without coordinate drift.
- Enriched atmospheric dispersion physics in the GLSL fragment shader:
  - Gaussian plume dispersion along wind vector with Pasquill-Gifford lateral spreading ($\sigma_y(x) = \sigma_0 + \alpha \sqrt{x_{dw}}$) and exponential downwind decay with sharp upstream cutoff.
  - Zoom scale factor scaling plume width with map zoom.
  - Kelvin-Helmholtz vorticity & 2-layer vector domain-warping simulating rolling shear vortices.
  - Kolmogorov turbulent cascade multi-octave noise generating delicate micro-particulate tendrils.
  - Beer-Lambert optical extinction ($T = \exp(-\tau \rho)$) with transmittance-based cloud alpha.
  - Directional volumetric self-shadowing simulating dark soot core sunlight attenuation.
  - Authentic CPCB chromatic spectrum: emerald fringe $\to$ sulfuric amber $\to$ burnt orange $\to$ toxic crimson $\to$ hazardous soot core maroon.
- Resolved all UI layout collisions:
  - Top Wind HUD and Attribution Badge dynamically slide between `right: 476px` (when side menu is open) and `right: 20px` (when side menu is closed).
  - Selected station pin card positioned at `bottom: 180px, left: 24px`, safely above the Clean Window card at `bottom: 24px`.
  - Clean Window card and 48-Hour Forecast Scrubber aligned cleanly without overlap.
- Verification: `make test` passed 10/10, `make lint` passed with 0 errors, dev server responding with HTTP 200 OK.

### 2026-10-11 19:15 IST — Complete Geospatial Air Intelligence Dashboard Redesign
- Redesigned PranVayu into a production-grade air-quality geospatial intelligence platform with Perplexity-inspired restrained dark aesthetic.
- Re-architected desktop layout into 64px fixed top nav bar and full-height two-column workspace (74% dominant Leaflet map workspace + 380px independent scrolling Intelligence Sidebar).
- Built 5 connected intelligence cards in the sidebar:
  1. Current Air Quality (prominent PM2.5 in µg/m³, severity badge, trend, 24h sparkline)
  2. Hotspot Forecast (ranked table with 12 Delhi NCR hotspots, selection focusing map & popup)
  3. Wind & Pollutant Transport (meteorological speed/origin, visual compass diagram, derived transport vector interpretation)
  4. Model Confidence (confidence tier, uncertainty interval, honest CAMS + OpenAQ provenance)
  5. PM2.5 Forecast Chart (interactive 48h curve with uncertainty envelope and timeline cursor synced with bottom scrubber)
- Upgraded atmospheric dispersion engine with scientific PM2.5 color ramp (`#F2CF76` -> `#F4A65A` -> `#F17A46` -> `#EF554D` -> `#A83B45`), 2D wind streamline particles, geographically anchored dark pill markers, and floating map panels (Top-Left layers/wind/horizon chips, Top-Right zoom/reset, Bottom-Left advisory, Bottom-Center timeline scrubber, Bottom-Right legend).
- Verified with `make test` (10/10 pytest passing), `make lint` (ruff + TypeScript 0 errors), and production build.

### 2026-10-11 20:05 IST — Design System Tokens, Synchronization Polish & Verification
- Unified global CSS design tokens in `web/src/index.css` (`--background`, `--surface`, `--surface-elevated`, `--border`, `--accent`, `--pollution-*`).
- Enhanced Leaflet dark cartography filter for OpenStreetMap with higher contrast (2.8) and obsidian tones.
- Added dual dispersion mode toggle ("Hotspots" core plumes vs "Continuous" regional concentration field) to Leaflet top-left HUD.
- Synchronized station pin popups with scrubber timeline offset for dynamic hourly PM2.5 forecast recalculation and CPCB category mapping.
- Connected map hotspot marker clicks directly to locality selection in parent state.
- Verified test suite (`make test` 10/10 passing), linter/typechecker (`make lint` 0 errors), offline mock generation (`make run-local`), and replay evaluation (`make evaluate`).

### 2026-10-11 20:15 IST — Individual Pollution Hotspot Rendering Engine & Obsidian Basemap
- Eliminated all brown/orange/green muddy tints from the basemap by replacing the hue-shifted inverted filter with a pure 100% desaturated, inverted, high-contrast filter (`filter: grayscale(100%) invert(100%) contrast(1.7) brightness(0.5)`).
- Diagnosed root cause of the "single diffuse smoke cloud" defect:
  1. Excessive spatial kernel cutoff ($>3.3\sigma$) spanning distances between nearby Delhi monitoring stations.
  2. Summed kernel weights blowing out the exponential alpha formula.
  3. Color evaluated from station peak value rather than local field concentration, applying uniform orange across outer boundaries.
- Re-architected rendering engine into a physically grounded Gaussian dispersion plume model:
  - Euclidean distances calculated in ground meters ($dx, dy$) via latitude-dependent Web Mercator meters-per-pixel.
  - Constant physical ground footprint ($\sigma_0 = 2.2$ km) across all camera zoom levels.
  - Atmospheric transport: downwind plume elongation along meteorological transport vector with sharp upstream cutoff ($0.60 \times \sigma$).
  - Smooth cutoff at $q < 4.5$ ($3\sigma$), falling to zero.
  - Combined concentration formula: $C_{\text{local}} = C_{\text{max}} + 0.25 \times (C_{\text{sum}} - C_{\text{max}})$, preserving independent local maxima without runaway alpha summation.
  - Direct local concentration-to-color mapping: clean air ($<25$ µg/m³) is 100% transparent black basemap; moderate air ($60-120$) is gentle amber; severe air ($>260$) forms deep, distinct maroon cores.
- Fixed marker placement bug by adding `position: absolute` and `z-index: 25` to `.hotspot-pill-marker`, locking each pill marker directly over its physical hotspot core.
- Repositioned station detail popup to stack above the advisory card (`bottom: 185px, left: 20px`), clearing the top-left layer and mode controls.
- Verified via headless Chrome screenshot (1536x864) and confirmed 10/10 pytest unit tests passing.

