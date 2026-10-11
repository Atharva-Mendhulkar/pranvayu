# PranVayu Status

Updated: 2026-10-11T20:15:00+05:30
Phase: Individual Pollution Hotspot Rendering Engine & Obsidian Geospatial Intelligence Redesign

## Done
- **Pure Obsidian & Charcoal Basemap (`web/src/index.css`)**:
  - Replaced hue-shifted inverted filter with pure 100% desaturated, inverted, high-contrast filter: `filter: grayscale(100%) invert(100%) contrast(1.7) brightness(0.5)`.
  - Zero brown, zero orange, zero green mud across the entire basemap; deep charcoal background (`#0A0E12`), crisp grey roads, and deep obsidian waterways (Yamuna).
  - Restrained interface color discipline: only interface cyan (`#27D3E2`) and neutral greys; warm scientific colors strictly reserved for localized pollution cores and data severity badges.

- **Physically Grounded Individual Hotspot Dispersion Engine (`web/src/components/DelhiFluidMap.tsx`)**:
  - Replaced single continuous diffuse smoke shader with individual, localized Gaussian dispersion plumes.
  - Calculated exact Euclidean ground distances in meters ($dx, dy$) using Web Mercator meters-per-pixel at Delhi latitude (`28.61° N`).
  - Spatial core radius $\sigma_0 = 2200.0$ meters clamped in screen pixels, ensuring stable geographic ground footprint across zoom levels.
  - Physics-informed anisotropic transport: downwind plume elongation along meteorological transport vector with sharp upstream cutoff ($0.60 \times \sigma$) and crosswind boundary ($0.80 \times \sigma$).
  - Strict cutoff at $q < 4.5$ ($3\sigma$): contribution drops smoothly to zero beyond the hotspot boundary.
  - Local concentration aggregation: $C_{\text{local}} = C_{\text{max}} + 0.25 \times (C_{\text{sum}} - C_{\text{max}})$, preventing runaway cumulative alpha from merging nearby hotspots into an opaque blob.
  - Direct concentration-to-color mapping:
    - $< 25$ µg/m³: Clean air $\to$ 100% transparent black basemap (zero color overlay).
    - $25 - 60$ µg/m³: Faint translucent yellow (`#E7C86F`, alpha 0.02–0.14).
    - $60 - 120$ µg/m³: Gentle warm amber (`#E9A45C`, alpha 0.14–0.30).
    - $120 - 180$ µg/m³: Distinct warm orange (`#E87849`, alpha 0.30–0.48).
    - $180 - 260$ µg/m³: Rich crimson (`#E9564E`, alpha 0.48–0.64).
    - $> 260$ µg/m³: Intense severe maroon core (`#A83B45`, alpha 0.64–0.76).
  - Mode B (Continuous Field) provides broader regional dispersion ($\sigma = 9$ km) with bounded alpha (0.45).

- **Geographically Anchored Station Markers & Layout Collision Resolution**:
  - Fixed marker placement with `position: absolute` and sub-pixel coordinates; each station marker (`Bawana`, `Punjabi Bagh`, `Anand Vihar`, `Dwarka`, `Okhla`) sits directly atop its physical hotspot core.
  - Zoom-dependent detail levels: Regional view (< 11), City view (11–13), and Neighborhood view (>= 13).
  - Stacked selected station detail popup directly above the bottom-left advisory card (`bottom: 185px, left: 20px`), keeping the top-left layer and mode controls completely unobstructed.

- **Verification & Visual Inspection**:
  - Captured headless Chrome screenshot at 1536x864 and visually inspected: distinct isolated hotspot cores, zero brown/muddy cast, readable basemap roads, and synchronized HUD.
  - `make test`: 10/10 pytest unit tests passing.
  - `make lint`: Ruff and TypeScript build passing with 0 errors.
  - Vite dev server running and tested on port 3001.

## Next
- Deliver completed overhaul to user.
