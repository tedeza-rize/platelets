# Architecture

## Runtime

- Next.js 16.2.7 App Router with React 19
- Node.js route handlers for imports, SQLite, routing, and AI calls
- MapLibre GL client rendering with VWorld or OpenFreeMap styles
- SQLite database at `data/points.sqlite`
- Biome for linting and formatting

Read the relevant local Next.js documentation in `node_modules/next/dist/docs/`
before changing framework code. Do not assume older Next.js behavior.

## Directory Ownership

| Path | Responsibility |
| --- | --- |
| `src/app/` | Pages and HTTP route handlers |
| `src/components/` | Client UI, map controls, admin tools, and AI forms |
| `src/lib/points-db.ts` | SQLite schema, queries, settings, logs, and import persistence |
| `src/lib/dataset-import.ts` | General public-data imports and geocoding |
| `src/lib/medical-dataset-import.ts` | Childcare and NMC medical imports |
| `src/lib/emergency-recommendation.ts` | Scenario weights and hospital scoring |
| `src/lib/emergency-routing.ts` | Directed OSM A* and Kakao route adapters |
| `src/lib/ai-*.ts` | AI settings, provider validation, and summarized grounding |
| `scripts/points-mcp.ts` | Read-only local MCP server |
| `docs/` | Architecture, operational rules, sources, and design plans |

## Data Flow

1. A sudo request or scheduler starts a dataset update.
2. The importer reports real stages: requesting, receiving, processing, saving,
   completed, or failed.
3. Source records are normalized into `EmergencyPointInput` objects.
4. SQLite replacement runs in a transaction and stores source metadata.
5. Public map APIs return marker or summary fields only. Raw source JSON remains
   internal to server-side scoring, sudo/debug, or controlled import logic.
6. Map viewport queries bound the number of points sent to the browser.

Every new external source must be added to both
`docs/DATA_SOURCES_AND_LICENSES.md` and `src/lib/data-licenses.ts`.

## Map Rendering

`MapShell` owns the MapLibre instance and synchronizes independent GeoJSON
sources for facilities, Seoul population areas, hazards, and emergency routes.
Provider style changes recreate overlay layers after `style.load`. Point icons
are generated in canvas and keyed by dataset source.

Earthquakes outside South Korea remain stored and visible to administrators,
but are filtered from public map rendering and automatic map focus.

## Emergency Recommendation

The recommendation pipeline first selects nearby emergency institutions, then
uses Kakao road ETA when available. A conservative road-distance estimate is
used when the route API fails. Scores always total 100 possible points and use
scenario-specific weights for travel time, specialty, bed type, critical-care
capability, emergency availability, grade, congestion, and freshness.

The emergency-specific NMC API is preferred. If that service returns 403, the
importer derives candidates from hospital FullData records with `dutyEryn=1`.
That fallback has institution and emergency-operation data but no live beds.

The self-hosted route option downloads an OSM road graph through Overpass and
runs A*. Edges honor `oneway`, roundabouts, motorway direction, private access,
road class, and speed. It is bounded to South Korea and 70 km. It does not model
live traffic. Kakao routing is the live-road alternative.

## AI And MCP

`/api/ai/query` requires admin access and uses the official `openai` SDK. The
default is the Responses API with configurable model, reasoning effort,
verbosity, system prompt, and HTTPS OpenAI-compatible base URL. Chat Completions
mode supports providers that have not implemented Responses.

Grounding contains dataset counts, recent hazard summaries, bounded text
matches, and optional nearby facilities. It excludes raw records and API keys.
Requests set `store: false`.

The MCP server opens SQLite read-only and exposes bounded status, search,
nearest-point, ranking, and grounding tools. Tool results exclude raw JSON.

## Security Boundaries

- Public: summarized map, hazards, congestion, recommendation, and routing
- Admin: AI query access
- Sudo: imports, schedules, detailed logs, quotas, NTP, and AI configuration
- Secrets: environment variables only
- External routing: South Korea coordinates and per-process rate limits
- AI proxy: HTTPS only; credentials in URLs and private DNS/IP targets blocked
- HTML: popup builders escape source text; AI output renders as plain text
- SQL: values are parameterized; dynamic clauses come from validated enums

The in-memory public rate limiter is a single-process safety layer. A deployed
multi-instance service should also enforce limits at the reverse proxy or edge.

## Time

Database timestamps use UTC-compatible storage. User-facing dates are rendered
explicitly in `Asia/Seoul` and marked KST. Source timestamps without timezone
must be normalized before comparison or display.
