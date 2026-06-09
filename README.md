# Platelets

Responsive Next.js map UI with a top navigation bar and selectable vector
basemaps.

## Environment

Create `.env.local` in the project root and set the keys you need:

```bash
KAKAO_REST_API_KEY=your_kakao_rest_api_key
PUBLIC_DATA_API_KEY=your_data_go_kr_service_key
PLATELETS_SUDO_TOKEN=use_a_long_random_value
SEOUL_OPEN_API_KEY=your_seoul_open_data_api_key
```

VWorld and OSM map choices both load MapLibre vector styles instead of raster
tile layers.

`PUBLIC_DATA_API_KEY` is shared by public data portal integrations such as AED
and Korea Meteorological Administration earthquake/tsunami events.

`KAKAO_REST_API_KEY` is used by Kakao Local address search with the
`Authorization: KakaoAK ${KAKAO_REST_API_KEY}` header.

`PLATELETS_SUDO_TOKEN` protects developer-only API usage, dataset refreshes,
log details, raw point payloads, and NTP configuration. Keep real keys and
tokens in `.env.local`; do not commit them.

`SEOUL_OPEN_API_KEY` is used server-side for Seoul real-time city population
lookups when a Seoul 121-place area is selected on the map.

## Access Levels

- Public map: read-only map and summarized point data.
- Admin page (`/admin`): read-only operational dataset status for agency users.
- Sudo page (`/sudo`): developer/operator controls. Enter `PLATELETS_SUDO_TOKEN`
  in the page before using quota views, logs, refresh actions, or NTP settings.

## Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## AI and MCP

Read [docs/AI_FORECAST_AND_RESPONSE.md](docs/AI_FORECAST_AND_RESPONSE.md) for
the 119 demand forecast, incident response ranking, hospital-data extension,
and Kakao Directions integration plan.

Run the local points MCP server for LLM integrations:

```bash
npm run mcp:points
```

## Checks

```bash
npm run lint
npm run build
npm run format
```
