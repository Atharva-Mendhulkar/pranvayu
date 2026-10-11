# PranVayu (प्राणवायु)

> A citizen-facing school-day air advisory for Delhi parents, answering the 9 PM question: can morning assembly, lunch break, and PE happen outdoors tomorrow?
> Built for the Air track of Environmental Hacks (Bharat Builds Tour, event 02, 8–11 Oct 2026).

---

## What It Is

PranVayu translates regional atmospheric forecasts into actionable school-day outdoor advisories for 12 Delhi localities. Rather than displaying an abstract citywide AQI number, it provides **Go**, **Limit**, or **Skip** verdicts for every period of the school timetable, pinpoints the cleanest outdoor window of the day, plots a 48-hour air line with uncertainty bands, and tracks stubble smoke arrival windows using a backward-trajectory ensemble.

It runs serverless on AWS (Mumbai `ap-south-1`) and operates bilingually in English and Hindi.

---

## Key Features

1. **School-Diary Timetable**: Ruled notebook aesthetic (`#FBFCFE` paper, `#C9D6EA` ruling) with direct SVG verdicts (Circle = Go, Triangle = Limit, Octagon = Skip).
2. **Zero-Network In-Place Recalculation**: Parents can click "Change times" to tweak bell schedules; verdicts recalculate instantly in the browser using pre-distributed deterministic thresholds (`rules.json`).
3. **48-Hour Air Line Chart**: Hand-crafted, responsive SVG chart featuring direct CPCB category labels, $p_{10}$–$p_{90}$ uncertainty shading, night-time dimming, and full keyboard navigation.
4. **Stubble Smoke Arrival Window**: Physics-grounded 24-member backward trajectory ensemble (975, 950, 925 hPa) matched against NASA FIRMS VIIRS satellite detections. Smoke influence is reported honestly as arrival time ranges and qualitative influence tiers—never pseudoscientific concentration percentages.
5. **Radical Transparency & Replay Evidence**: Dedicated `/evidence` page publishing pre-registered replay evaluation metrics (M1–M5) against real historical stubble events, including explicit documentation of failure modes.
6. **Built for Resilient Low-Bandwidth**: Entire web client bundles to **< 60 kB gzipped JS** and **< 2 kB CSS** with zero bloated UI libraries.

---

## Architecture & AWS Implementation

PranVayu uses a precompute-and-cache architecture so that a worried parent checking air quality at 9 PM never waits for third-party weather APIs or heavy models.

```
[EventBridge Schedulers]
       │
       ├── Hourly ───────► [Lambda: ingest_fires] ────► [S3: pv-raw/fires]
       ├── Hourly ───────► [Lambda: ingest_obs]   ────► [S3: pv-raw/obs]
       ├── 6-Hourly ─────► [Lambda: ingest_winds] ────► [S3: pv-raw/winds]
       └── 6-Hourly ─────► [Lambda: ingest_cams]  ────► [S3: pv-raw/cams]
                               │
       Hourly trigger ─────────┘
       │
       ▼
[Lambda: model_run]
       │  • Bilinear wind interpolation & 2nd-order trajectory ensemble
       │  • NASA VIIRS spatial-temporal deduplication & SII scoring
       │  • CAMS rolling bias ratio (ρ) correction & blend
       │  • Deterministic timetable rules & clean window search
       │  • Pydantic contract validation
       ▼
[DynamoDB: pv-state] (pk: locality_id, sk: run_time)
       ▲
       │
[API Gateway HTTP API] (/v1/forecast/{locality})
       ▲
       │
[Lambda: api] (Sub-50ms reads from DynamoDB)
       ▲
       │
[Amplify Hosting / CloudFront] ───► [PranVayu Web Client (React + TS)]
```

- **EventBridge**: Triggers serverless ingestion and pipeline execution.
- **AWS Lambda**: Pure Python 3.12 handlers running deterministic, vectorized algorithms.
- **Amazon S3**: Immutable raw atmospheric and satellite observations.
- **Amazon DynamoDB (`pv-state`)**: High-speed, single-digit millisecond storage for precomputed locality payloads.
- **Amazon API Gateway HTTP API**: Minimal latency API proxy with CORS enabled.
- **AWS SAM (`infra/template.yaml`)**: Complete Infrastructure-as-Code for reproducible deployments in `ap-south-1`.

---

## Local Development & Offline Running

PranVayu is strictly testable offline with zero external network dependencies during tests.

### Prerequisites
- Python 3.11+
- Node.js 18+
- `make`

### Commands

```bash
# Run backend pytest suite (10/10 offline unit tests using fixtures)
make test

# Run code linter and frontend TypeScript build checks
make lint

# Run offline local pipeline on fixtures to generate all 12 locality mock payloads
make run-local

# Start web development server
cd web && npm run dev

# Preview optimized production web build
cd web && npm run build && npm run preview
```

Open [http://localhost:4173/](http://localhost:4173/) to explore the app.
Toggle demo scenarios via query parameter:
- `http://localhost:4173/?state=stale` (simulates stale station feed)
- `http://localhost:4173/?state=nosmoke` (clean winds scenario)
- `http://localhost:4173/?state=offseason` (monsoon/summer mode)

---

## AWS Deployment

To deploy to AWS using the SAM CLI:

```bash
# Build and deploy serverless backend
sam build -t infra/template.yaml
sam deploy --guided --stack-name pranvayu-prod --region ap-south-1

# Build web distribution
cd web && npm run build
# Deploy web/dist to AWS Amplify Hosting or S3/CloudFront
```

---

## Data Sources & Licenses

- **Open-Meteo**: Boundary layer height, pressure-level winds, and atmospheric forecasts ([CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)).
- **NASA FIRMS**: VIIRS 375m active fire detections (NASA Earth Science Data Policy).
- **Copernicus Atmosphere Monitoring Service (CAMS)**: European air quality model forecasts.
- **OpenAQ & CPCB**: Surface PM2.5 monitor station observations (Open Data / CPCB).
- **OpenFreeMap & OpenStreetMap**: Vector basemap tiles and geospatial boundaries ([ODbL](https://www.openstreetmap.org/copyright)).

---

## Statutory Disclaimer & Limits

> **Advisory only.** PranVayu is an experimental advisory tool designed for parent school-day planning. It is not medical advice and is not an official regulatory forecast. Always adhere to official notifications from the Commission for Air Quality Management (CAQM), Central Pollution Control Board (CPCB), and your school administration.
> 
> Regional stubble smoke contribution to Delhi PM2.5 is physically coupled with local stagnation and inversion. PranVayu transparently estimates *influence level* and arrival windows rather than unprovable exact mass percentages.

---

## AI Tools Disclosure

As required by the Environmental Hacks rules:
- **Claude (Anthropic)** was used during planning for drafting the Product Requirements Document (`docs/01-PRD.md`), UX specifications (`docs/02-UX-SPEC.md`), and data contracts (`docs/05-DATA-CONTRACTS.md`).
- **Claude Code & Google Antigravity** were used as coding assistants to implement the pipeline under the strict specifications in `docs/`.
- All generated code was thoroughly reviewed, verified, and audited by the human team.
- **Zero legacy code, weights, or datasets** from previous projects (VayuMind, JointPINN) were reused; the repository was created fresh for Environmental Hacks.
