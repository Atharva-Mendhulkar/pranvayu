# PranVayu Status

Updated: 2026-10-11T20:05:00+05:30
Phase: Complete Geospatial Air Intelligence Dashboard Redesign & Polish

## Done
- **Centralized Design System Tokens (`web/src/index.css`)**:
  - Semantic palette tokens: `--background: #080B0F`, `--map-background: #0A0E12`, `--surface: #0E1319`, `--surface-elevated: #121821`, `--surface-hover: #18212B`, `--border: #27313D`, `--border-subtle: #1B2530`.
  - Contrast-tested text hierarchy: `--text-primary: #F3F5F7`, `--text-secondary: #A1ACB8`, `--text-muted: #6E7B89`.
  - Restrained interface cyan accent: `--accent: #27D3E2` (`--accent-muted: rgba(39, 211, 226, 0.12)`, `--accent-border: rgba(39, 211, 226, 0.35)`).
  - Scientific PM2.5 & Pollution Palette:
    - 0-60 µg/m³: `--pollution-low: #E7C86F` (Good / Satisfactory)
    - 61-120 µg/m³: `--pollution-moderate: #E9A45C` (Moderate)
    - 121-180 µg/m³: `--pollution-high: #E87849` (Poor)
    - 181-250 µg/m³: `--pollution-very-high: #E9564E` (Very Poor)
    - 250+ µg/m³: `--pollution-extreme: #A83B45` (Severe / Hazardous)
  - Obsidian & charcoal black OpenStreetMap dark cartographic filter with enhanced contrast (2.8) and reduced saturation (0.18).

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
  - Bidirectional synchronization between map hotspot markers and locality selection state.

- **Right Intelligence Sidebar with 5 Connected Cards (`web/src/components/IntelligenceSidebar.tsx`)**:
  1. *Current Air Quality Card*: Prominent PM2.5 reading in µg/m³, scientific severity badge, relative trend change (+4.2%), and 24-hour SVG sparkline.
  2. *Hotspot Forecast Card*: Ranked table of monitored locations (Anand Vihar, Wazirpur, Bawana, Jahangirpuri, Punjabi Bagh, ITO, Okhla, Rohini, RK Puram, Dwarka, Siri Fort, Mandir Marg) with forecast PM2.5, severity pills, and click-to-focus map interaction.
  3. *Wind and Pollutant Transport Card*: Meteorological wind speed (km/h) and origin (e.g. WNW · 315°), visual 2-needle compass diagram showing origin and transport vector, and derived physical transport interpretation.
  4. *Model Confidence Card*: Confidence tier (High / Moderate), uncertainty margin (±14 µg/m³), and honest provenance labels (CAMS ECMWF + OpenAQ surface stations + FIRMS VIIRS).
  5. *PM2.5 Forecast Chart*: Interactive 48-hour time series chart with $p_{10}$–$p_{90}$ uncertainty envelope, median line, vertical timeline cursor, and click-to-seek scrubbing.

- **Interactive Geospatial Visualization Engine (`web/src/components/DelhiFluidMap.tsx`)**:
  - Real, interactive Leaflet base map with OpenStreetMap tiles (pan, zoom, pinch, double-click).
  - Three.js WebGL shader with physics-informed Gaussian plume dispersion, Pasquill-Gifford lateral spread, Kelvin-Helmholtz shear vorticity, Beer-Lambert optical extinction, and scientific color stops.
  - Sub-pixel coordinate synchronization via `map.latLngToContainerPoint([lat, lon])` on Leaflet `move`, `zoom`, and `resize` events.
  - Mode toggle: Individual Hotspot core plumes vs. Continuous regional concentration field.
  - Dynamic hotspot popups showing time-scrubbed forecast PM2.5, category badge, coordinates, and monitoring metadata.
  - Geographically anchored hotspot markers styled as dark technical pills (`[dot] Anand Vihar [318]`) with detail popups.
  - Toggleable 2D wind streamline particles flowing smoothly along the meteorologically inverted transport vector.
  - Floating Map Controls:
    - *Top-Left*: Layer visibility menu (Pollution Layer, Wind Streamlines, Station Markers), Mode toggle (Hotspots vs Continuous), and Quick Wind toggle.
    - *Top-Right*: Reset Delhi NCR bounds and Zoom (+/-) buttons.
    - *Bottom-Left*: Floating Air Quality Advisory card with situation summary, actionable school advice, and confidence.
    - *Bottom-Center*: Floating Forecast Timeline Scrubber with Play/Pause button, slider, and horizon markers (`Now`, `+1h`, `+3h`, `+6h`, `+12h`, `+24h`).
    - *Bottom-Right*: Floating PM2.5 scientific color legend with tick marks (0, 60, 120, 180, 250, 350+ µg/m³).

- **Tooling & Verification**:
  - `make test` (10/10 pytest unit tests passing).
  - `make lint` (ruff and TypeScript build passing with 0 errors).
  - `make run-local` (pipeline executed and 12 mock payloads generated & validated).
  - `make evaluate` (replay evaluation executed cleanly).
  - Frontend production build compiles cleanly (`npm run build`).

## Next
- Deliver completed work to user.
