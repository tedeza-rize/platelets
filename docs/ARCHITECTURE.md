# Architecture

## Runtime

- Next.js 16.2.7 App Router with React 19
- Node.js route handlers for imports, SQLite, routing, and AI calls
- MapLibre GL client rendering with VWorld or OpenFreeMap styles
- SQLite database at `data/points.sqlite` through synchronous `better-sqlite3`
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
| `src/lib/emergency-routing.ts` | Directed OSM A*, Kakao route adapter, and traffic-adjusted route result assembly |
| `src/lib/traffic/` | Optional live traffic adapters used to adjust route ETAs |
| `src/lib/disaster-response/` | MVP disaster-response domain models, SQLite incident repository, mock facility data, rule-based risk, dispatch, hospital, and resource recommendation services |
| `src/lib/building-safety/` | Building safety profile models and the current presentation-sample adapter for floor, exit, and refuge data |
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

Fire Safety Big Data Platform CSV products are imported through the same
pipeline from `data/bigdata-119/`. Current point imports cover Seoul and Busan
fire-safety targets and fire-water sources. When the approved CSV is absent,
the importer stores a small presentation sample marked in raw metadata instead
of attempting unauthenticated platform scraping.

The national fire/force CSV is consumed by
`src/lib/disaster-response/bigdata119-risk-data.ts` rather than the point import
pipeline. Seoul/Busan/Jeonbuk 119 call and dispatch CSV samples are summarized
by `src/lib/disaster-response/bigdata119-operational-data.ts`, which extracts
region, event type, time, result, dispatch-distance, and risk-area load hints.
Both feeds contribute bounded factors to rule-based regional risk scoring and
resource placement recommendations. Building floor and exit data is separated
behind `/api/building-safety`; the current records are loaded from
`data/building-safety/profiles.json`, include Fire Safety Big Data Platform
drawing-product metadata, and must be replaced by verified facility data before
operational use.

Every new external source must be added to both
`docs/DATA_SOURCES_AND_LICENSES.md` and `src/lib/data-licenses.ts`.

## Map Rendering

`MapShell` owns the MapLibre instance and synchronizes independent GeoJSON
sources for facilities, Seoul population areas, hazards, and emergency routes.
Provider style changes recreate overlay layers after `style.load`. Point icons
are generated in canvas and keyed by dataset source.

Operational settings control the default public map provider, raster/vector
tile mode, and OSM tile source. Defaults are OSM, vector tiles, and OpenFreeMap.
The official OSM option uses the Shortbread vector tile schema, so it has a
separate MapLibre style from the OpenFreeMap/OpenMapTiles style.

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
road class, and speed. It is bounded to South Korea and 70 km. When
`ITS_OPEN_API_KEY` or `MOLIT_ITS_API_KEY` is configured, the route result calls
the National Transport Information Center traffic API for nearby road speed
samples and adjusts the A* ETA with a bounded multiplier. Without a key or
usable samples, the route keeps the baseline A* duration and marks traffic as
unconfigured or unavailable. Kakao routing is the external live-road
alternative and is marked separately in the route result.

## Disaster Response MVP

The `/dashboard`, `/incidents`, `/incidents/new`, `/risk`, and `/resources`
pages provide a presentation-ready MVP for real-time disaster response. Incident
creation, lookup, editing, deletion, and status transitions use the SQLite
`disaster_incidents` table in `data/points.sqlite`, seeded with presentation
records when empty. `disaster_incident_events` stores create/edit/status/delete
history so the dashboard can show operational context for the selected incident.
Fire stations and hospitals are read from imported point data when available
and fall back to local sample records for demos. Base risk areas are still
rule-based local sample regions. Fire Safety Big Data Platform fire-safety
target and fire-water datasets now share the generic point import model, so
risk and dispatch services can consume Seoul and Busan point data without
changing the public map API. Operational 119 call/dispatch products remain
separate from map points and are exposed as dashboard summaries plus risk-factor
explanations.

The service classes intentionally isolate incident persistence, distance-based
dispatch, incident-type hospital scoring, rule-based regional risk scoring, and
resource placement recommendations. Resource placement converts risk score,
recent incidents, water-source coverage, and 119 call/dispatch load into
separate fire engine, ambulance, and rescue truck counts for decision support.
The dashboard reuses `/api/routing/route` for the dispatch path from the
recommended fire station to the incident, then keeps a straight reserve line if
the road route provider fails or times out.
The incident repository is the SQLite
adapter boundary that can later be replaced by PostgreSQL while keeping route
handlers and UI flows stable. Facility, route, and risk services can likewise
be connected to public-safety big-data pipelines, Kakao/OSM route adapters, or
ML model adapters.

## Assembly And Protest Notices

Daily public assembly/protest notices are stored separately from durable map
points in `assembly_protests`. The sudo-only
`POST /api/assembly-protests/crawl` route crawls all 18 provincial police
agency websites for one KST date, replaces only successfully completed sources
for that date, and returns per-source success/failure and geocoded-row counts.
Public reads use `GET /api/assembly-protests?date=YYYY-MM-DD` and omit raw
provider text.

Board HTML and supported PDF/HWP/HWPX attachments are parsed before any model
call. After deterministic parsing and direct map lookup, LLM usage is limited
to a forced `geocode_place` map tool call; latitude/longitude persistence still
requires a bounded map/geocoding result inside Korea coordinate bounds. The
local MCP server also exposes a
`geocode_place` map tool and `list_assembly_protests` read tool for LLM-assisted
place-to-coordinate resolution and raw-free daily schedule context without
turning the board crawl itself over to a model.

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
- Secrets: API keys are encrypted in SQLite with AES-256-GCM using
  `PLATELETS_SECRET_KEY` or a generated local secret file; real keys still must
  never be committed
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
