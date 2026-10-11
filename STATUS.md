# PranVayu Status

Updated: 2026-10-11T13:35:00Z
Phase: Leaflet Interactive Map Engine & Atmospheric Dispersion Physics

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
- **Leaflet Interactive Map Engine & Tile Layers**:
  - Migrated map engine to **Leaflet (v1.9.4)**: lightweight, robust, mobile-friendly map library.
  - Reduced map bundle from 1,036 kB (281 kB gzipped) down to just **149 kB (43 kB gzipped)**.
  - Multi-layer support: CartoDB Dark Matter (default), CartoDB Positron, OpenStreetMap standard, and CartoDB Voyager.
  - Real-time sub-pixel synchronization: Leaflet events (`move`, `zoom`, `viewreset`, `resize`) update container projection coordinates via `map.latLngToContainerPoint([lat, lon])` to drive Three.js shader uniforms and station pin projections in lockstep.
  - Created `LeafletModal.tsx` documentation modal detailing Leaflet, Volodymyr Agafonkin, and OpenStreetMap/CARTO credits.
- **Dark Mode & Glassmorphic UI Design System (`web/`)**:
  - Deep dark cosmic background (`--bg-root: #090D16`), frosted glass surfaces (`rgba(15, 23, 42, 0.92)`, `backdrop-filter: blur(24px)`), and crisp high-contrast text (`#F8FAFC`, `#94A3B8`).
  - Sleek rounded glass pill nav bar with brand, page switcher, locality selector, day tabs, language switch, and advisory menu toggle.
  - Dark mode styled across all components including `CollapsibleSideMenu`, `Timetable` time inputs and expansion drawers, and `LeafletModal`.
- **Synchronized Vector Basemap & Atmospheric Dispersion Physics**:
  - Real Leaflet cartographic map rendered at full opacity (1.0) and interactive in Top View.
  - True cartographic geography clearly visible: Connaught Place, Ring Road, NH48, Yamuna river, Noida, Gurugram, Dwarka, Rohini, Anand Vihar.
  - Real-time map synchronization: map movement (`move`, `zoom`, `rotate`, `resize`) updates hotspot screen coordinates and zoom scale in shader uniforms and station pin projections.
  - GLSL fragment shader with atmospheric dispersion physics:
    - Gaussian plume dispersion along wind vector with Pasquill-Gifford lateral spreading ($\sigma_y(x) = \sigma_0 + \alpha \sqrt{x_{dw}}$) and exponential downwind decay with sharp upstream cutoff.
    - Kelvin-Helmholtz vorticity & 2-layer vector domain-warping simulating rolling shear vortices.
    - Kolmogorov turbulent cascade multi-octave noise generating delicate micro-particulate tendrils.
    - Beer-Lambert optical extinction ($T = \exp(-\tau \rho)$) with transmittance-based cloud alpha.
    - Directional volumetric self-shadowing simulating dark soot core sunlight attenuation.
    - CPCB chromatic spectrum: emerald fringe $\to$ sulfuric amber $\to$ burnt orange $\to$ toxic crimson $\to$ hazardous soot core maroon.
    - Moving aerodynamic wind direction arrows gliding across the canvas along the NW $\to$ SE stubble trajectory.
- **Collision-Free Responsive HUD Layout**:
  - Top Wind HUD dynamically slides between `right: 476px` (side menu open) and `right: 20px` (side menu closed) with smooth CSS transitions.
  - Attribution badge dynamically shifts between `right: 476px` and `right: 20px` to never be occluded by the side menu drawer.
  - Selected Station card floats at `bottom: 180px, left: 24px`, completely avoiding the Clean Window card at `bottom: 24px`.
  - Clean Window card (`width: 360px`) and 48-Hour Scrubber Bar (`width: 460px`) aligned cleanly without overlap.
- **Tooling & Verification**:
  - `make test` (10/10 pytest unit tests passing).
  - `make lint` (ruff and TypeScript build passing with 0 errors).
  - `make run-local` (all 12 mock payloads verified and written).
  - `make evaluate` (evaluation metrics M1–M5 verified).
  - Dev server live and verified on port 3000 (HTTP 200 OK).

## Next
- Git commit changes.
- Final user handoff.
