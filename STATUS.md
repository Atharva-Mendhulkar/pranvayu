# PranVayu Status

Updated: 2026-10-11T13:45:00Z
Phase: Complete Geospatial Air Intelligence Dashboard Redesign

## Done
- **Perplexity-Inspired Dark Visual Design System (`web/src/index.css`)**:
  - Deep dark background (`--bg-root: #080B0F`), dark surface (`--bg-surface: #0D1117`), elevated surface (`--bg-surface-elevated: #121821`), subtle borders (`--border-subtle: #27313D`).
  - Restrained interface cyan accent (`--accent-cyan: #27D3E2`) used for focus rings, timeline highlights, and subtle wind streamlines.
  - Strict scientific PM2.5 color ramp:
    - 0.00: `#F2CF76` (Good/Low)
    - 0.25: `#F4A65A` (Satisfactory/Moderate)
    - 0.50: `#F17A46` (Poor)
    - 0.75: `#EF554D` (Very Poor)
    - 1.00: `#A83B45` (Severe/Hazardous)
  - Micro-typography, tabular figures for numerical air measurements, clean scrollbars, and strict contrast ratios.

- **Fixed 64px Top Navigation Bar (`web/src/components/Header.tsx`)**:
  - Compact PranVayu SVG logo, product title "PranVayu", and subtitle "Delhi NCR Air Intelligence".
  - Clean page switcher tabs: "Overview" and "How it works".
  - Region selector dropdown ("Delhi NCR" and 12 monitored localities).
  - Segmented pill control: "Today" / "Tomorrow".
  - Bilingual language switcher: "EN" / "हिन्दी".

- **Two-Column Geospatial Intelligence Layout (`web/src/routes/HomeRoute.tsx`)**:
  - Full-height desktop workspace (`calc(100vh - 64px)`) with zero outer page scrollbars.
  - Dominant Map Workspace occupying ~74% width.
  - Dedicated Right Intelligence Sidebar occupying 380px fixed width with independent vertical scrolling.

- **Right Intelligence Sidebar with 5 Connected Cards (`web/src/components/IntelligenceSidebar.tsx`)**:
  1. *Current Air Quality Card*: Prominent PM2.5 reading in µg/m³, scientific severity badge, relative trend change (+4.2%), and 24-hour SVG sparkline.
  2. *Hotspot Forecast Card*: Ranked table of monitored locations (Anand Vihar, Wazirpur, Bawana, Jahangirpuri, Punjabi Bagh, ITO, Okhla, Rohini, RK Puram, Dwarka, Siri Fort, Mandir Marg) with forecast PM2.5, severity pills, and click-to-focus map interaction.
  3. *Wind and Pollutant Transport Card*: Meteorological wind speed (km/h) and origin (e.g. WNW · 315°), visual 2-needle compass diagram showing origin and transport vector, and derived physical transport interpretation.
  4. *Model Confidence Card*: Confidence tier (High / Moderate), uncertainty margin ($\pm 14\,\mu\text{g/m}^3$), and honest provenance labels (CAMS ECMWF + OpenAQ surface stations + FIRMS VIIRS).
  5. *PM2.5 Forecast Chart*: Interactive 48-hour time series chart with $p_{10}$–$p_{90}$ uncertainty envelope, median line, vertical timeline cursor, and click-to-seek scrubbing.

- **Interactive Geospatial Visualization Engine (`web/src/components/DelhiFluidMap.tsx`)**:
  - Real, interactive Leaflet base map with OpenStreetMap tiles (pan, zoom, pinch, double-click).
  - Three.js WebGL shader with physics-informed Gaussian plume dispersion, Pasquill-Gifford lateral spread, Kelvin-Helmholtz shear vorticity, Beer-Lambert optical extinction, and scientific color stops.
  - Sub-pixel coordinate synchronization via `map.latLngToContainerPoint([lat, lon])` on Leaflet `move`, `zoom`, and `resize` events.
  - Toggleable 2D wind streamline particles flowing smoothly along the meteorologically inverted transport vector.
  - Geographically anchored hotspot markers styled as dark technical pills (`[dot] Anand Vihar [318]`) with detail popups.
  - Floating Map Controls:
    - *Top-Left*: Layer visibility menu (Pollution field, Wind vectors, Hotspots), fast Wind toggle, and Forecast Horizon chips (`Now`, `+1h`, `+3h`, `+6h`, `+12h`, `+24h`).
    - *Top-Right*: Reset Delhi NCR bounds and Zoom (+/-) buttons.
    - *Bottom-Left*: Floating Air Quality Advisory card with situation summary, actionable school advice, and confidence.
    - *Bottom-Center*: Floating Forecast Timeline Scrubber with Play/Pause button, slider, and horizon markers.
    - *Bottom-Right*: Floating PM2.5 scientific color legend with tick marks (0, 50, 100, 200, 300, 500 µg/m³).

- **Tooling & Verification**:
  - `make test` (10/10 pytest unit tests passing).
  - `make lint` (ruff and TypeScript build passing with 0 errors).
  - Frontend production build compiles cleanly (`npm run build`).
  - Dev server live and verified on port 3000 (HTTP 200 OK).

## Next
- Git commit changes.
- Final user handoff.
