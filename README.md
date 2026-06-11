# Platelets

Platelets is a Next.js emergency-response map for Korean public-safety data. It
imports facility and hazard datasets into SQLite, renders responsive MapLibre
layers, recommends emergency hospitals by road ETA and medical suitability,
and exposes summarized data to OpenAI-compatible models and a local MCP server.

## Main Features

- Responsive desktop navigation and mobile bottom navigation
- Fire stations, police stations, AEDs, childcare, pharmacies, hospitals,
  emergency institutions, schools, universities, and Fire Safety Big Data
  Platform fire-safety targets/fire-water sources
- Seoul real-time population/congestion popups and domestic earthquake display
- Staged dataset import progress and configurable automatic schedules
- Emergency dispatch and hospital ranking with Kakao ETA or directed OSM A*
- MVP disaster-response dashboard with SQLite-backed incidents, status
  transitions, imported facility fallback data, rule-based regional risk, and
  resource placement recommendations
- OpenAI Responses API and Chat Completions-compatible proxy configuration
- Read-only MCP tools for bounded facility summaries and grounding snapshots
- Public, admin, and sudo access boundaries

## Environment

Copy `env.example` to `.env.local` and fill only the integrations you use.
Never commit real keys.

Important variables:

```bash
NEXT_PUBLIC_VWORLD_API_KEY=
KAKAO_REST_API_KEY=
KAKAO_MOBILITY_REST_API_KEY=
PUBLIC_DATA_API_KEY=
SEOUL_OPEN_API_KEY=
PLATELETS_ADMIN_TOKEN=
PLATELETS_SUDO_TOKEN=
OPENAI_API_KEY=
OPENAI_BASE_URL=https://api.openai.com/v1
```

`PLATELETS_ADMIN_TOKEN` grants AI-query access. A sudo token also satisfies
admin access. `PLATELETS_SUDO_TOKEN` protects dataset refreshes, logs, quota
details, schedules, NTP settings, and AI configuration.

## Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Before changing Next.js code, read the relevant local guide under
`node_modules/next/dist/docs/`; this project uses Next.js 16.2.7 conventions.

## Verification

```bash
npm run lint
npm run format
npm run build
npm audit
```

For UI work, also verify the affected flow in the in-app browser at desktop
and mobile breakpoints. Commit each coherent feature or fix separately.

## AI And MCP

- AI analysis: `/ai`
- AI model, proxy, reasoning, verbosity, and system prompt settings: `/sudo/ai`
- Local MCP server: `npm run mcp:points`

The AI and MCP payloads intentionally contain bounded summaries rather than
raw provider records.

## Disaster Response MVP

- Dashboard: `/dashboard`
- Incident list: `/incidents`
- Incident create: `/incidents/new`
- Risk map: `/risk`
- Resource recommendations: `/resources`

The MVP uses `src/lib/disaster-response/` service classes. Incidents are stored
in SQLite at `data/points.sqlite` in the `disaster_incidents` table; the app
seeds two presentation incidents when the table is empty and persists incident
status transitions from reported to dispatched or closed. Fire stations and
hospitals are read from imported point data when available, with local sample
fallbacks for demos. Base risk areas use rule-based scoring with Fire Safety
Big Data Platform point data and regional fire/force statistics when local CSV
files are present.

## Fire Safety Big Data Platform

The app includes import sources for the Fire Safety Big Data Platform datasets
`서울소방재난본부_특정소방대상물 현황`, `서울소방재난본부_소방용수 현황`,
`부산소방재난본부_특정소방대상물 현황`, and `부산소방재난본부_소방용수 현황`.
The current MVP uses the following platform products:

| Local use | Platform product | Product URL | Local file |
| --- | --- | --- | --- |
| Seoul fire-safety target map points and risk scoring | 서울소방재난본부_특정소방대상물 현황 | https://bigdata-119.kr/goods/goodsInfo?goods_mng_sn=378 | `data/bigdata-119/seoul-fire-safety-targets.csv` |
| Seoul fire-water source map points and response-resource context | 서울소방재난본부_소방용수 현황 | https://bigdata-119.kr/goods/goodsInfo?goods_mng_sn=380 | `data/bigdata-119/seoul-fire-water-sources.csv` |
| Busan fire-safety target map points and risk scoring | 부산소방재난본부_특정소방대상물 현황 | https://bigdata-119.kr/goods/goodsInfo?goods_mng_sn=404 | `data/bigdata-119/busan-fire-safety-targets.csv` |
| Busan fire-water source map points and response-resource context | 부산소방재난본부_소방용수 현황 | https://bigdata-119.kr/goods/goodsInfo?goods_mng_sn=403 | `data/bigdata-119/busan-fire-water-sources.csv` |
| Regional rule-based risk and resource recommendation inputs | 전국 시군구별 화재현황 및 소방력 정보 | https://bigdata-119.kr/goods/goodsInfo?goods_mng_sn=9 | `data/bigdata-119/national-fire-force.csv` |

`npm run download:bigdata119` downloads the platform's public sample XLSX files
for these products, converts them to the local CSV files above, and records
product/file metadata in `data/bigdata-119/manifest.json`. Full CSV files still
require the platform login/free-purchase download flow and should be checked
against the platform usage terms before public release.

Place approved CSV downloads in `data/bigdata-119/` using one of these names:

- `seoul-fire-safety-targets.csv` or `특정소방대상물_2024.csv`
- `seoul-fire-water-sources.csv` or `소방용수_2024.csv`
- `busan-fire-safety-targets.csv` or `부산소방재난본부_특정소방대상물 현황_2025_부산.csv`
- `busan-fire-water-sources.csv` or `부산소방재난본부_소방용수 현황_2025_부산.csv`
- `national-fire-force.csv` or `화재_소방력_2021_전국.csv`

When no approved CSV is present, the importer uses a clearly marked
presentation sample so the dashboard and map layers still run locally.

Building floor plans and evacuation exits are isolated behind
`/api/building-safety`. The current profiles are presentation samples; replace
them with verified facility-management or fire-inspection data before using the
building safety panel operationally.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Development Guide](docs/DEVELOPMENT_GUIDE.md)
- [Data Sources And Licenses](docs/DATA_SOURCES_AND_LICENSES.md)
- [AI Forecast And Response Plan](docs/AI_FORECAST_AND_RESPONSE.md)
- [Building Safety Data](docs/BUILDING_SAFETY_DATA.md)
