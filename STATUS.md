# PranVayu Status

Updated: 2026-10-11T22:52:00+05:30
Phase: PranVayu Geospatial Air Intelligence Platform v2 Overhaul

## Done
- **Restrained Perplexity-Inspired Unified Sidebar (`web/src/components/IntelligenceSidebar.tsx`, `web/src/index.css`)**:
  - Replaced nested card-in-card clutter with a single continuous black & charcoal (`#0B0F14`) panel (width: 340px) structured with thin 1px hairline dividers (`#1C242D`).
  - Standardized typography with disciplined uppercase tracking (`10.5px`, `letter-spacing: 0.6px`) for section headers and cyan (`#27D3E2`) as the sole interactive accent color.
  - Implemented 8 sequential sections:
    1. Locality & Timestamp Header with `+0H FORECAST` pill badge.
    2. Current Conditions: PM2.5, CPCB category badge, AQI equivalent, source freshness, and 24h mini sparkline.
    3. Inferred Hotspot Cores: Plumes ranked by concentration with severity tags and pan-to-focus interaction.
    4. Wind & Transport: Dual-needle compass dial (origin vs. transport vector) with meteorologically inverted transport interpretation.
    5. CPCB / DPCC Monitoring Network: Live ground BAM/TEOM stations with agency badges (CPCB vs. DPCC) and real observed PM2.5.
    6. School Air-Quality Outlook: 15 verified institutions with distance to nearest monitoring station ($D \le 3.5$ km anchor vs. coordinate model estimate) and outdoor timetable schedule (Morning Arrival, Assembly, Recess & PE, Afternoon Dispersal).
    7. Model Uncertainty & Attribution: PINN confidence, 90% confidence uncertainty spread, stubble arrival range (16:00–21:00 IST), and source tags.
    8. 48-Hour Forecast Curve: Interactive SVG chart with median line and p10–p90 uncertainty ribbon.
    9. Priority Advisories: School athletic cancellations and vulnerable group guidance.

- **Directional Wind Streamlines with Arrowheads (`web/src/components/DelhiFluidMap.tsx`)**:
  - Rendered 160 animated 2D cyan streamlines with visible, moving directional arrowheads oriented precisely along the transport vector $(dx, dy)$ derived from `(windDirectionDeg + 180) % 360`.
  - Fast, fluid particle animation with sine-squared alpha pulsing and sharp vector tips across the Delhi NCR extent.

- **First-Class Schools Layer (`config/schools.json`, `web/src/data/schools.ts`, `web/src/components/DelhiFluidMap.tsx`)**:
  - Curated and validated 15 authentic Delhi educational institutions with verified geographic coordinates, student populations, and nearest station distances.
  - Dedicated map marker `.school-marker`: compact square badge with cyan border and `SchoolIcon` (mortarboard cap).
  - Interactive school popup displaying institution name, student count, provenance anchor, and 4-period outdoor activity verdicts (Go / Limit / Skip).

- **Semantic Separation: Monitoring Stations vs. Inferred Hotspots (`web/src/data/stations.ts`, `web/src/components/DelhiFluidMap.tsx`)**:
  - Distinct `.station-marker`: Neutral circular ring with concentric colored dot representing fixed CPCB/DPCC continuous monitoring sites (OpenAQ IDs, elevation, direct BAM/TEOM observations).
  - Distinct `.hotspot-pill-marker`: Rounded pill badges representing model-inferred localized concentration cores (PINN / atmospheric dispersion plumes).
  - 5-layer toggle control in top-left HUD allowing independent toggling of: (1) Pollution dispersion field, (2) Wind streamlines & vectors, (3) Inferred hotspot cores, (4) CPCB/DPCC stations, (5) Schools & academies.

- **Atmospheric Particle Advection Engine & Granular Transport (`web/src/components/DelhiFluidMap.tsx`, `web/src/components/Icons.tsx`)**:
  - Implemented Layer 5 dedicated 2D canvas overlay (`zIndex: 14`) between Three.js concentration field (`zIndex: 10`) and wind streamlines (`zIndex: 16`).
  - True geographic $(\text{lat}, \text{lon})$ particle tracking using geodesic velocities:
    $\Delta \text{lat} = \frac{v \cdot \Delta t}{R_E} \frac{180}{\pi}$, $\Delta \text{lon} = \frac{u \cdot \Delta t}{R_E \cos(\text{lat})} \frac{180}{\pi}$, reprojecting via `map.latLngToContainerPoint` each frame so particles remain physically anchored to roads, schools, and stations during pan and zoom.
  - Concentration-weighted spawning: 72% spawn inside active Gaussian plume envelopes, 28% across the broader viewport for atmospheric context.
  - Concentration-guided coloration: faint slate ($<35\,\mu\text{g/m}^3$), translucent amber ($35-90$), warm terracotta ($90-180$), and deep crimson ($>180$).
  - Zoom-adaptive detail and particle budget: scales dynamically from 420 particles at regional overview ($z \le 10$), to 850 at city zoom ($z \le 12$), 1,350 at district zoom ($z \le 14$), and 1,800 at neighborhood zoom ($z \ge 15$).
  - Multi-scale granules with short fading trails (3–8 history points) and subtle Yamuna valley channeling.
  - Independent layer control: added dedicated "Particles" toggle with `ParticlesIcon`, density selector pills (`Auto`, `Low`, `Med`, `High`), and reduced-motion / visibilitychange handling with clamped $\Delta t \le 0.05\text{s}$.
  - Deep-linking & neighborhood inspection: supported URL parameters (`?locality=...&zoom=...`) and smooth `flyTo` on selection.

- **Multiscale Pollution Transport Visualization (`web/src/components/DelhiFluidMap.tsx`, `backend/tests/test_multiscale_transport.py`)**:
  - **Two-Component Concentrated Hotspot Model (Core + Halo)**: Upgraded WebGL fragment shader and client concentration sampler to co-axial Core (1350m downwind, 900m crosswind, weight 0.75) and Halo (3200m downwind, 2200m crosswind, weight 0.25). Creates distinct high-intensity cores that decay cleanly into the surrounding gradient without merging into one giant blob.
  - **Atmospheric Grain Accumulation**: Implemented roulette-wheel sampling proportional to $f(C(x)) = (C / 100)^{1.8}$. 78% of particles spawn within active hotspots, with 72% biased slightly upwind so particles traverse directly through the center of the hotspot core, accumulating into a visibly dense cluster of fine grains that drift downwind.
  - **Zoom-Adaptive Transport Arrows**: Implemented 6 geographically anchored transport corridors across Delhi NCR (NW Inflow Corridor, Capital Trans-Yamuna Flow, SE Outflow Corridor, and 3 local cluster axes).
    - Regional zoom ($z \le 10.5$): Large prominent directional arrows (88px shaft, 19px aerodynamic arrowhead, dark contrast halo, traveling light pulse, and metadata pill badge: "NW Inflow Corridor · 14 km/h → SE").
    - City zoom ($z = 11.5–13$): Regional arrows scale down smoothly; secondary local plume indicators emerge along active downwind axes.
    - Neighborhood zoom ($z \ge 14$): Large arrows hide completely (`opacity: 0`), leaving fine-grained particle advection to reveal block-level flow.
    - Direction accurately derived from $(\theta_{\text{met}} + 180) \bmod 360$ (NW $315^\circ \to$ SE $135^\circ$).
  - **Air Intelligence Key**: Added compact two-tier legend in bottom-right corner distinguishing: (1) PM2.5 Concentration scale, (2) Particle Transport (Particulate Mass Motion), (3) Transport Vectors (Dominant Regional Arrows vs Local Streamlines).
  - **Offline Unit Tests**: Added `backend/tests/test_multiscale_transport.py` (7 tests) verifying direction conversion, geodesic velocities, two-component core/halo separation, concentration-weighted sampling, zoom-adaptive curves, vector coherence, and calm wind fallback. Full suite 17/17 passing.

- **Continuous Physics-Informed Air Quality Field & Coordinate Inspection (`backend/pv/model/spatial_field.py`, `web/src/lib/continuousField.ts`, `web/src/components/DelhiFluidMap.tsx`, `web/src/components/IntelligenceSidebar.tsx`)**:
  - **Basin-Wide Geographic Coverage**: Eliminated the defect where unmonitored areas rendered as black/empty voids. Implemented continuous physics-informed spatial estimation across the entire Delhi NCR basin ($28.25^\circ\text{N} - 28.95^\circ\text{N}$, $76.75^\circ\text{E} - 77.60^\circ\text{E}$).
  - **Dark Region Root Cause Diagnosed**:
    1. **Percentage of valid grid cells**: 100.0% within the model domain (5,950 / 5,950 cells at 1.1 km resolution).
    2. **Percentage of valid cells rendered visibly**: 91.1% had $\Delta L \ge 0.075$; 8.9% of lowest-tier cells had insufficient alpha (0.24) and blended into the obsidian tiles.
    3. **Percentage of viewport outside model domain**: 60.9% of the visible map viewport (at $z=10$) is outside the Delhi NCR modeling bounds, which was previously dropped as transparent black (`vec4(0.0)`).
  - **Explicit Validity Mask & Three Distinct States**:
    1. *Valid Low Pollution*: Clean air ($\le 30\,\mu\text{g/m}^3$ and $30-60\,\mu\text{g/m}^3$) rendered in visible Deep Forest Emerald (`#18382E`) and Muted Green (`#2F7656`) with alpha boosted to $0.44 - 0.54$, providing clear contrast against the dark basemap.
    2. *Valid Elevated Pollution*: Graded through olive, amber, rust, and crimson cores ($60 - 320+\,\mu\text{g/m}^3$).
    3. *Out-of-Domain Boundaries*: Smooth feathering to zero opacity at the NCR basin borders via `smoothstep`, leaving the dark basemap clean and unencumbered without dark screen covers. Clicking outside the domain displays honest `-- µg/m³ PM2.5`, `badge-missing`, and explicit explanation without fabricating values.
  - **No Fabricated Concentration Values**:
    - Clicking an out-of-domain cell displays `-- µg/m³ PM2.5`, `badge-missing`, and explicit message: *"An estimate is unavailable at this location for the selected horizon."*
    - Unmonitored coordinates within domain display `Physics-Informed Spatial Estimate` with $\pm \sigma$ spatial uncertainty ($\sigma(d) = 12.0 + 1.8 \min(d, 25)$).
  - **Offline Unit Tests**: 23/23 pytest tests passing offline (`backend/tests/test_continuous_field.py`).

- **Atmospheric Pollution Cloud Restoration & Multi-Layer Orthogonality (`web/src/components/DelhiFluidMap.tsx`)**:
  - **Organic FBM Atmospheric Turbulence**: Added lightweight 2D noise and 3-octave Fractal Brownian Motion (FBM) in the WebGL fragment shader, imparting drifting eddies, realistic smoke filamentation along the NW-to-SE transport corridor, and soft plume edge billowing.
  - **Soft Domain Boundary Attenuation (`domainFactor`)**: Replaced the harsh screen-covering hatch with continuous boundary feathering (`domainFactor = smoothstep(-0.015, 0.035, edgeDist)`). Clouds fade smoothly across ~4 km into the basemap.
  - **Hotspot Core & Plume Uniform Separation (`u_hotspots_visible`)**: Added `u_hotspots_visible` uniform to the Three.js shader, linked to `layers.hotspots`. Hotspot cores can be toggled without disturbing the continuous regional background field.
  - **Calibrated Translucent Opacity Curve**: Clean air ($\le 30\,\mu\text{g/m}^3$) is rendered in translucent emerald (alpha $0.18 - 0.26$) so roads and basemap geometry remain crisp; ramping up smoothly to $0.74 - 0.88$ for severe crimson cores.
  - **6 Independent Layer Toggles**: Standardized layer controls: (1) `Concentration clouds`, (2) `Hotspot cores`, (3) `Particles`, (4) `Wind vectors`, (5) `Monitoring stations`, (6) `Schools`.

- **Single-Page Animated Physics Explainer Overhaul (`web/src/routes/MethodRoute.tsx`)**:
  - Re-architected How It Works into a single-page, compact, animated 30-second technical explainer that fits in a desktop viewport without long scrolling articles.
  - **5-Stage Central Animated Pipeline**: (1) `Observe` (sparse ground stations), (2) `Ingest Meteorology` (multi-level winds, boundary layer height, satellite fires), (3) `Spatial Estimation ★` (transformation from sparse points to continuous basin field with distinct cores), (4) `Atmospheric Transport` (particulate advection), (5) `School Advisory` (timetable guidance).
  - **Stage Details & 30-Second Tour**: Clicking a stage highlights it with cyan border and animated traveling data beam, updating structured cards (What Enters, What The Engine Does, What Comes Out, Key Limitation) calibrated to 40–60 words. Features Play/Pause tour control and reduced-motion support.
  - **Spatial Estimation Novelty Visual**: Compact side-by-side comparison of Raw Measured (sparse 12 stations) vs Physics-Estimated (continuous basin with highlighted unmonitored location at Najafgarh showing 52 µg/m³ ±37.6 µg/m³).
  - **Collapsible Physics Panel**: Displays conceptual governing equation $\partial C/\partial t + \mathbf{u} \cdot \nabla C = \nabla \cdot (\mathbf{K} \nabla C) + S$ and plain language explanation of the implemented semi-analytical Gaussian plume + backward trajectory solver.
  - **Trust and Uncertainty Strip**: Standardizes `MEASURED`, `ESTIMATED`, and `UNCERTAIN / UNAVAILABLE` distinctions.
  - **Full-Viewport Responsive Layout**: Expanded container to `width: 100vw`, `height: calc(100vh - 64px)` with proportional SVG scaling (120px pipeline graphics, 100px comparison displays) and flex distribution, ensuring the explainer completely fills widescreen displays without dead margins.

- **Full Verification & Quality Assurance**:
  - Pure obsidian/charcoal cartography with zero brown/orange mud.
  - 23/23 pytest unit tests passed offline (`make test`).
  - Production TypeScript and Vite builds passing with 0 lint errors (`make lint`).
  - Home route CSS at 30.44 kB (9.87 kB gzipped), well under budgets.
  - Visual validation verified via high-resolution headless Chrome rendering (1440x900) across EN and HI views.


