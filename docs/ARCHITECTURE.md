# Architecture

## Runtime

- Next.js 16.2.7 App Router with React 19
- Node.js route handlers for imports, SQLite, routing, and AI calls
- MapLibre GL client rendering with VWorld or OpenFreeMap styles
- SQLite database at `data/points.sqlite` through synchronous `better-sqlite3`
- Biome for linting and formatting

Read the relevant local Next.js documentation in `node_modules/next/dist/docs/`
before changing framework code. Do not assume older Next.js behavior.

## SQLite Deployment Boundary

SQLite writes are safe only when exactly one persistent application process
owns `data/points.sqlite`. `withDatabaseWriteTransaction` serializes writes with
an in-process queue and `BEGIN IMMEDIATE`; that queue does not cross Vercel,
AWS Lambda, Cloud Run, Azure Functions, or load-balanced Node.js processes.

When common serverless or multi-instance environment signals are present,
Platelets disables SQLite write transactions by default and fails fast with an
operator-facing deployment error instead of allowing `SQLITE_BUSY` storms.
There is no environment override: multi-instance deployments must use
PostgreSQL, MySQL, or MariaDB.

Horizontal scaling requires moving write-owned state to a shared database such
as PostgreSQL, or introducing an external single-writer job/lock service before
more than one app instance can mutate datasets, incidents, setup state, logs,
push subscriptions, or schedules.

## Directory Ownership

| Path | Responsibility |
| --- | --- |
| `src/app/` | Pages and HTTP route handlers |
| `src/components/` | Client UI, map controls, admin tools, and AI forms |
| `src/components/disaster-dashboard/` | Presentational widgets for the disaster dashboard, with data and actions supplied by the dashboard controller |
| `src/lib/points-db.ts` | Public database facade, shared domain types, settings, logs, and import persistence |
| `src/lib/database/` | Database engine adapters, SQL dialect helpers, and shared schema initialization |
| `src/lib/points-db-modules/` | Database connection ownership and focused point query repositories |
| `src/lib/dataset-import.ts` | General public-data imports and geocoding |
| `src/lib/medical-dataset-import.ts` | Childcare and NMC medical imports |
| `src/lib/emergency-recommendation.ts` | Scenario weights and hospital scoring |
| `src/lib/emergency-routing.ts` | Directed OSM A*, Kakao route adapter, and traffic-adjusted route result assembly |
| `src/lib/traffic/` | Optional live traffic adapters used to adjust route ETAs |
| `src/lib/disaster-response/` | MVP disaster-response domain models, SQLite incident repository, in-process incident change events, mock facility data, rule-based risk, dispatch, hospital, and resource recommendation services |
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

Incident mutations publish bounded metadata to an in-process event hub after
the database transaction succeeds. `/api/disaster/events` exposes those changes
as a no-cache Server-Sent Events stream with heartbeats, and the dashboard
coalesces notifications before refreshing its public snapshot. Deployments with
multiple application processes require a shared event broker to extend this
single-process delivery model.

High-risk incident creation schedules post-response alert delivery. Browser
Push subscriptions are stored in SQLite without VAPID private keys, while the
private key remains environment-only. Webhook destinations are deployment
configuration, capped at five, restricted to HTTPS, checked against private DNS
results, and called without following redirects.

The PWA service worker is a small hand-written runtime under `public/sw.js`.
It precaches the dashboard shell and `/offline`, uses network-first navigation
with an offline fallback, and runtime-caches static assets plus previously seen
map imagery. API requests are intentionally excluded from service-worker caches.

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
the national traffic API key is configured in the sudo console, the route result calls
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
The database boundary now routes through a shared adapter layer. SQLite remains
the local default, while PostgreSQL and MySQL/MariaDB can use the same
repository APIs through engine-specific clients and schema DDL. Facility,
route, and risk services can likewise be connected to public-safety big-data
pipelines, Kakao/OSM route adapters, or ML model adapters.

The first-run setup stores the selected engine once. Sudo database migration
copies the allowlisted application tables in bounded batches while holding a
consistent source snapshot and a target transaction. The active database
configuration is replaced only after the target schema and all copied rows
succeed, so a failed migration leaves the current database active.

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
default assembly geocoder runs independent candidate queries with bounded
parallelism and stores successful query results in `assembly_geocode_cache` to
avoid repeated provider calls for recurring public-safety landmarks. The
local MCP server also exposes a
`geocode_place` map tool and `list_assembly_protests` read tool for LLM-assisted
place-to-coordinate resolution and raw-free daily schedule context without
turning the board crawl itself over to a model.

## AI And MCP

`/api/ai/query` requires admin access and uses the official `openai` SDK. The
default is the Responses API with configurable model, reasoning effort,
verbosity, system prompt, and HTTPS OpenAI-compatible base URL. Chat Completions
mode supports providers that have not implemented Responses.

## Staff Accounts And Role Routing

Setup still creates the bootstrap `sudo` administrator and `admin` operator
accounts, and now mirrors them into the SQLite `users` table. Additional staff
accounts are managed from `/admin/users` with one-way PBKDF2 password hashes,
unique usernames, contact metadata, department, and a role of `admin`,
`dispatcher`, or `field_worker`.

`/login` creates the same HTTP-only session cookie used by the admin consoles,
but the session now includes the user's id, display name, and role. Login sends
field workers to `/field`, dispatchers to `/dashboard`, and administrators to
`/admin/users`. Route handlers remain the authorization boundary for mutations;
new staff-management APIs require `admin` or `sudo`, and incident mutations add
the active session's display name and role to `disaster_incident_events` for
audit history.

Grounding contains dataset counts, recent hazard summaries, bounded text
matches, and optional nearby facilities. It excludes raw records and API keys.
Requests set `store: false`.

The MCP server opens SQLite read-only and exposes bounded status, search,
nearest-point, ranking, and grounding tools. Tool results exclude raw JSON.

## Security Boundaries

- Public: summarized map, hazards, congestion, recommendation, and routing
- Admin: AI query access
- Sudo: imports, schedules, detailed logs, quotas, NTP, and AI configuration
- Secrets: API keys are encrypted with AES-256-GCM using the generated local
  `data/.platelets-secret-key` file; the data directory and key must be backed
  up together and real keys must never be committed
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
