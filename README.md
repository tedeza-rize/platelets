# Platelets

Platelets is a Next.js emergency-response map for Korean public-safety data. It
imports facility and hazard datasets into SQLite, renders responsive MapLibre
layers, recommends emergency hospitals by road ETA and medical suitability,
and exposes summarized data to OpenAI-compatible models and a local MCP server.

## Main Features

- Responsive desktop navigation and mobile bottom navigation
- Fire stations, police stations, AEDs, childcare, pharmacies, hospitals,
  emergency institutions, schools, and universities
- Seoul real-time population/congestion popups and domestic earthquake display
- Staged dataset import progress and configurable automatic schedules
- Emergency dispatch and hospital ranking with Kakao ETA or directed OSM A*
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

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Development Guide](docs/DEVELOPMENT_GUIDE.md)
- [Data Sources And Licenses](docs/DATA_SOURCES_AND_LICENSES.md)
- [AI Forecast And Response Plan](docs/AI_FORECAST_AND_RESPONSE.md)
