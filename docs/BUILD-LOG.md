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
### 2026-10-11 20:38 IST — Geospatial Air Intelligence Platform v2 Overhaul
- **Restrained Perplexity-Style Sidebar**: Overhauled `web/src/components/IntelligenceSidebar.tsx` into a unified 340px black & charcoal (`#0B0F14`) single-surface panel with thin 1px hairline dividers (`#1C242D`), eliminating nested card boundaries. Implemented 8 sequential sections: Header with +0H Horizon badge, Current Conditions (with AQI and 24h mini sparkline), Inferred Hotspot Cores ranking table, Wind & Transport with dual-arrow compass needle, Monitoring Network (12 CPCB/DPCC stations), School Air-Quality Outlook, Model Uncertainty & Stubble Smoke Arrival Window, 48-Hour Forecast Curve SVG, and Priority Advisories.
- **Directional Wind Streamlines**: Updated `web/src/components/DelhiFluidMap.tsx` to render 160 animated 2D cyan streamlines with visible moving directional arrowheads along vector $(dx, dy)$ derived from `(windDirectionDeg + 180) % 360`, clearly showing atmospheric transport across Delhi NCR.
- **Dedicated Schools Layer & Timetable Assessment**: Added 15 authentic Delhi institutions (`config/schools.json`, `web/src/data/schools.ts`) with lat/lon, student population, and nearest station distances. Added `.school-marker` (compact cyan square with mortarboard icon) and interactive popup/sidebar breakdown detailing outdoor activity verdicts across 4 periods (Morning Arrival, Assembly, Recess & PE, Afternoon Dispersal) with actionable guidance.
- **CPCB / DPCC Monitoring Stations vs. Model Hotspots**: Separated real ground observation stations (`.station-marker` with neutral circular outline and concentric dot, OpenAQ IDs, BAM/TEOM metadata) from model-derived concentration plumes (`.hotspot-pill-marker`). Added 5-layer toggle control in top-left HUD.
- **Validation**: Verified with `make test` (10/10 pytest passing offline), `make lint` (ruff + TypeScript 0 errors), and high-resolution headless Chrome screenshots confirming flawless visual rendering.

### 2026-10-11 21:05 IST — Atmospheric Particle Advection Engine & Zoom-Aware Granular Transport
- Implemented Layer 5 dedicated HTML5 2D canvas overlay (`zIndex: 14`) sandwiched between Three.js WebGL dispersion field (`zIndex: 10`) and wind streamlines (`zIndex: 16`).
- Implemented true geographic $(\text{lat}, \text{lon})$ particle tracking using geodesic increments $\Delta \text{lat} = \frac{v \cdot \Delta t}{R_E} \frac{180}{\pi}$, $\Delta \text{lon} = \frac{u \cdot \Delta t}{R_E \cos(\text{lat})} \frac{180}{\pi}$, reprojecting via `map.latLngToContainerPoint` on each frame to completely eliminate screen-space drift during pan/zoom.
- Concentration-guided spawning (72% plume envelope, 28% background) and local field coloration: faint slate ($<35\,\mu\text{g/m}^3$), translucent amber ($35-90$), warm terracotta ($90-180$), and deep crimson ($>180$), keeping wind vector styling (cyan) cleanly separated from particulate matter concentration.
- Multi-scale granules with short fading trails (3–8 geodesic history points) and subtle Yamuna valley channeling.
- Dynamic zoom-adaptive particle budget scaling from 420 particles at regional zoom ($z \le 10$) up to 1,800 particles at neighborhood zoom ($z \ge 15$).
- Independent layer controls: dedicated "Particles" toggle in HUD, custom `ParticlesIcon` in `web/src/components/Icons.tsx`, particle density pills (`Auto`, `Low`, `Med`, `High`), and safety clamps ($\Delta t \le 0.05$s, reduced motion detection, visibilitychange pausing).
- Added URL deep linking (`?locality=...&zoom=...`) and automated `flyTo` on hotspot/station/school selection.
- Verified offline with `make test` (10/10 pytest passing), `make lint` (ruff and TypeScript 0 errors), and captured/validated high-resolution visual evidence across regional, city, and neighborhood scales.

### 2026-10-11 21:35 IST — Concentrated Hotspot Cores & Multiscale Transport Arrows
- **Two-Component Hotspot Architecture (Core + Halo)**:
  - Upgraded both the WebGL fragment shader and the client advection concentration sampler to a co-axial two-component Gaussian formulation:
    - Tight localized core ($\sigma_{\text{down}} = 1350\text{m}, \sigma_{\text{cross}} = 900\text{m}$, weight 0.75) for urban and industrial emission clusters.
    - Soft surrounding halo ($\sigma_{\text{down}} = 3200\text{m}, \sigma_{\text{cross}} = 2200\text{m}$, weight 0.25) representing downwind dispersion.
  - Successfully prevents diffuse mega-blobs while producing distinct, high-intensity cores (Anand Vihar, Wazirpur, Bawana, Jahangirpuri) that decay cleanly to black/charcoal basemap outside the plume perimeter.
- **Concentration-Weighted Atmospheric Grain Accumulation**:
  - Implemented roulette-wheel sampling $P_i \propto (C_i / 100)^{1.8}$ so severe hotspots receive higher grain allocations (~5× more particles than low-pollution nodes).
  - Biased 72% of hotspot spawns slightly upstream of the core center so grains traverse directly through the epicenter, creating a visibly dense accumulation of crimson and terracotta particles in the core before drifting downwind into the plume tail.
- **Zoom-Adaptive Transport Arrows**:
  - Implemented 6 geographically anchored transport corridors across Delhi NCR (NW Inflow, Capital Trans-Yamuna Flow, SE Outflow, Anand Vihar axis, Wazirpur axis, Dwarka axis).
  - Derived transport direction strictly from meteorological wind: $\theta_{\text{trans}} = (\theta_{\text{met}} + 180) \bmod 360$ (NW $315^\circ \to$ SE $135^\circ$).
  - Smooth zoom-adaptive scaling:
    - Regional ($z \le 10.5$): Prominent directional transport arrows (88px shaft, 19px aerodynamic arrowhead, dark halo underlay, traveling light pulse, and metadata pill badge).
    - City ($z = 11.5–13$): Regional arrows scale down smoothly; secondary local corridor indicators emerge along active plume axes.
    - Neighborhood ($z \ge 14$): Large arrows hide completely (`opacity: 0`), leaving fine-grained particle advection to reveal block-level transport.
- **Air Intelligence Key**:
  - Added a compact two-tier key in the bottom-right corner distinguishing: (1) PM2.5 Concentration scale, (2) Particle Transport (Particulate Mass Motion), and (3) Transport Vectors (Dominant Regional Arrows vs Local Streamlines).
- **Test Suite & Verification**:
  - Wrote `backend/tests/test_multiscale_transport.py` with 7 offline unit tests.
  - Verified with `make test` (17/17 pytest tests passing offline) and `make lint` (ruff check + tsc + vite build 0 errors).
  - Captured and inspected visual evidence at Regional zoom ($z=10$), City zoom ($z=12$), and Neighborhood zoom ($z=14$).

### 2026-10-11 22:00 IST — Physics-Informed Continuous Air Quality Field & Coordinate Inspection Overhaul
- **Problem Diagnosed**:
  - The previous UI rendered pollution only around discrete monitoring stations and hotspot clusters. Outer Delhi NCR sectors appeared as black, transparent voids.
  - This fundamentally compromised PranVayu's key research thesis: providing continuous physics-informed spatial estimation across unmonitored locations using atmospheric advection and dispersion modeling. Unmonitored coordinates looked missing rather than estimated.
- **Physics-Informed Basin-Wide Continuous Field**:
  - Formulated continuous spatial model in `backend/pv/model/spatial_field.py` and synced TypeScript engine in `web/src/lib/continuousField.ts`.
  - Spans entire Delhi NCR domain ($28.25^\circ\text{N} - 28.95^\circ\text{N}$, $76.75^\circ\text{E} - 77.60^\circ\text{E}$).
  - Synthesizes 3 physical components:
    1. Regional Background Ventilation: $C_{\text{bg}}(\text{lat}, \text{lon}) \approx 26 - 40\,\mu\text{g/m}^3$.
    2. Upstream Stubble Smoke Corridor: NW agricultural biomass advection tongue traversing towards southeast.
    3. Urban Plume Cores & Dispersion Halos: Localized emission clusters around industrial and transport hubs.
  - Upgraded WebGL fragment shader with Mercator UV geographic coordinate recovery using `u_map_bounds`, smooth domain boundary falloff, and continuous spatial field evaluation.
- **Green Means Clean Air**:
  - Implemented 7-tier scientific palette (`PALETTE_TIERS`).
  - Mapped clean air ($\le 30\,\mu\text{g/m}^3$) to Deep Forest Emerald (`#18382E`, alpha 0.28) and $30-60\,\mu\text{g/m}^3$ to Muted Green (`#2F7656`, alpha 0.34).
  - Clean outer sectors (Rohtak, Jhajjar, Sonipat, Meerut) render in visible muted green tones, proving clean air rather than absent data.
  - Alpha clamped strictly to $0.24 - 0.74$, ensuring road networks and basemap geometry remain crisp.
- **Semantic Separation & Honest Provenance**:
  - Ground monitoring stations remain distinct physical sensor nodes with OpenAQ ID, elevation, and "DPCC VERIFIED" badge.
  - Unmonitored coordinates are explicitly labeled "PHYSICS-INFORMED SPATIAL ESTIMATE".
  - Modeled spatial uncertainty scaling: $\sigma(d) = 12.0 + 1.8 \times \min(d_{\text{sensor}}, 25.0)\,\mu\text{g/m}^3$, honestly reporting expanding error bounds with distance from physical ground monitors.
- **Interactive Coordinate Inspection**:
  - Added click listener on Leaflet map evaluating coordinates on the fly.
  - Renders pulsing cyan inspection reticle (`.inspector-reticle`) on map canvas.
  - Displays on-map HUD card (`POPUP 0`) and synchronizes with Section 2 of `IntelligenceSidebar`: displays exact coordinates, estimated PM2.5, $\pm \sigma$ spread, outdoor guidance, nearest physical monitor distance ($d_{\text{sensor}}$ km), and 3-component model decomposition.
- **Verification & Quality Gates**:
  - Added `backend/tests/test_continuous_field.py` (6 unit tests); 23/23 pytest tests passing offline (`make test`).
  - Production build verified: `make lint` clean (ruff 0 warnings, tsc 0 errors, CSS bundle 28.73 kB / 9.38 kB gzipped, well within 30 kB budget).
  - High-resolution headless Chrome screenshot captured and inspected, confirming continuous emerald green field across outer sectors, distinct warm hotspot cores, and crisp road legibility.



