# PranVayu Status

Updated: 2026-10-11T20:38:00+05:30
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

- **Full Verification & Quality Assurance**:
  - Zero brown/orange tint on basemap: pure obsidian/charcoal cartography.
  - 10/10 pytest unit tests passed offline (`make test`).
  - Production TypeScript and Vite builds passing with 0 lint errors (`make lint`).
  - High-resolution visual screenshots captured and verified across regional, city, and neighborhood zooms (1536x864).

