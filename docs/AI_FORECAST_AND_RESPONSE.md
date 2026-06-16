# Platelets AI Forecast and Response Plan

## One Line Summary

Platelets is an AI map service that learns from historical 119 emergency call data and external context such as holidays, weather, and earthquakes to forecast regional and hourly increases in 119 demand, then helps fire departments prepare staff, vehicles, and equipment before demand spikes.

## Core Problem

119 demand changes by weekday, weekend, holidays, heat waves, cold waves, heavy rain, typhoons, earthquakes, and local conditions. Operations often react after calls cluster. This service should not claim to predict every accident. Its purpose is to predict where and when 119 call demand is likely to rise, so dispatch centers and field teams can raise monitoring priority, stage ambulances, and prepare response resources earlier.

## Product Direction

The first model target is total 119 call volume by region and time window. A practical first scope is a city such as Busan split by administrative dong or grid cell, predicting demand for the next 1 hour, 3 hours, and 24 hours.

The second target is call-type risk, such as emergency medical, rescue, and fire demand. Treat this as an advanced layer after total demand forecasting is stable.

The map should show predicted call risk by region. Clicking a region should reveal expected call count, increase versus baseline, main contributing factors, and recommended response actions.

Example explanation:

> Busan Haeundae-gu U-dong has high call increase risk from 18:00 to 22:00 today. Main factors: holiday, rain forecast, historical increase for the same weekday and time, expected visitor volume. Recommended response: strengthen ambulance standby and raise dispatch-center monitoring priority.

## Data Plan

Required fire-safety big data platform data:

- 119 incident/call reception records, such as Busan Fire Disaster Headquarters 119 call reception status.
- Jeju 119 call reception status is also useful because it includes location information, time analysis, regional analysis, and processing outcomes.

External public data:

- Korea Astronomy and Space Science Institute special-day API: holidays, public holidays, commemorative days, and solar terms.
- Korea Meteorological Administration short-term forecast API: ultra-short nowcast, ultra-short forecast, short-term forecast, and 5 km grid-based weather.
- Korea Meteorological Administration earthquake API: event time, latitude, longitude, epicenter location, magnitude, intensity, and related disaster-event metadata.

Current application data:

- `points`: fire stations/119 safety centers, police stations, and AED locations.
- `points`: hospitals and NMC emergency medical institutions, including
  emergency-room operation flags and real-time bed/capability fields when the
  NMC emergency-specific API is available.
- `hazard_events`: earthquake and tsunami events already imported from KMA.
- `dataset_updates`: source freshness and geocoding coverage.

## Model Inputs

Time variables:

- Month, weekday, hour, weekend flag, holiday flag, before/after holiday flag, night flag.

Weather variables:

- Temperature, precipitation, humidity, wind speed, snow flag, heat-wave/cold-wave/heavy-rain/typhoon indicators.

Disaster variables:

- Earthquake occurrence flag, distance to epicenter, magnitude, intensity, elapsed time after event.
- Earthquakes are rare, so they should start as an anomaly/event module rather than the core driver of ordinary demand.

Regional variables:

- Administrative dong, grid cell, fire-station jurisdiction, historical average call volume, previous-year same-period demand, recent 7-day growth rate.

## Modeling Approach

Start with interpretable baselines:

- Historical average by region/time.
- Moving average and same-weekday/time baseline.

Then compare against machine-learning models:

- Random Forest, XGBoost, or LightGBM regression for demand count.
- Separate model or multi-output layer for fire/rescue/emergency-medical demand after the total-volume model is useful.

Evaluation should compare AI predictions against baselines using MAE/RMSE and operational usefulness, such as whether high-risk cells capture real demand spikes.

## Emergency Response Recommendation

When an emergency point is reported, the system should:

1. Match nearby response resources, starting with fire stations/119 safety centers.
2. Estimate travel time from candidate response resources to the patient or incident location.
3. Show nearby hospitals/emergency rooms ranked by fastest and most appropriate response, not merely nearest straight-line distance.

For hospitals, ranking must consider patient type and capability:

- Infant or child respiratory distress should prioritize pediatric emergency capability and pediatric beds.
- Trauma should prioritize trauma center capability and available trauma beds.
- Cardiac symptoms should prioritize emergency cardiac capability.
- If the user does not select a patient type, show a default recommendation sorted by likely response speed and general emergency suitability.

Current implementation:

- `src/lib/medical-dataset-import.ts` imports NMC hospital FullData,
  moonlight-child-hospital data, and NMC emergency medical institution data.
- Emergency institution records merge basic institution information,
  real-time emergency bed data, and severe-condition capability data by HPID
  when the NMC emergency-specific endpoints are available.
- If the emergency-specific API is blocked, the importer derives candidates
  from hospital FullData records with `dutyEryn=1`. This fallback preserves
  emergency-room candidates but does not provide the same real-time bed fields.
- `src/lib/emergency-recommendation.ts` ranks nearby emergency institutions by
  scenario-specific weights for travel time, specialty evidence, bed evidence,
  critical-care evidence, availability, and source freshness.
- `/api/emergency/recommendations` returns both a dispatch-station candidate
  and scenario-aware hospital recommendations for browser use.
- Kakao Mobility ETA is used when configured. If the Kakao route call is not
  available, the recommendation falls back to a road-distance estimate rather
  than dropping the candidate.

Minimum hospital fields used by the ranking path:

- `id`, `name`, `address`, `latitude`, `longitude`, `phone`
- `emergencyRoomAvailable`
- `departments`
- `bedCounts` by type, including general ER, ICU, pediatric, neonatal, trauma, isolation
- `updatedAt`, `source`, `raw`

This is a rule-based operational recommender, not a trained demand-forecasting
model. Keep future forecast claims separate from the implemented hospital
ranking behavior.

## Kakao Directions API

Use Kakao Mobility Directions for travel-time-aware ranking.

Endpoint:

```txt
GET https://apis-navi.kakaomobility.com/v1/directions
Authorization: KakaoAK {stored Kakao Local API key}
Content-Type: application/json
```

Core parameters:

- `origin`: `${longitude},${latitude}` or `${longitude},${latitude},name=${name}`.
- `destination`: `${longitude},${latitude}` or `${longitude},${latitude},name=${name}`.
- `waypoints`: up to 5, separated by `|`.
- `priority`: `RECOMMEND`, `TIME`, or `DISTANCE`.
- `avoid`: optional restrictions such as `ferries`, `toll`, `motorway`, `schoolzone`, `uturn`.
- `summary`: use `true` for ranking and `false` only when rendering detailed route geometry.

Response fields needed for ranking:

- `routes[0].result_code`
- `routes[0].result_msg`
- `routes[0].summary.distance` in meters
- `routes[0].summary.duration` in seconds
- `routes[0].summary.fare`
- `routes[0].sections[].roads[].vertexes` only when route geometry is needed.

Current implementation:

- `scripts/points-mcp.ts` can rank existing response points using Kakao route duration when the Kakao Local key is stored during setup or in the sudo console.
- If the key is missing or Kakao directions fail, the tool falls back to straight-line distance.

## MCP Contract For LLMs

Run:

```bash
npm run mcp:points
```

Available resources:

- `platelets://docs/forecast-and-response`: this plan.
- `platelets://schema/points`: emergency point summary schema.

Available tools:

- `dataset_status`: source counts, freshness, and geocoding coverage.
- `geocode_place`: bounded Kakao Local place/address lookup for one Korean map
  query. Use it after deterministic source parsing, not for crawling webpages.
- `vworld_geocode_address`: VWorld Geocoder API 2.0 address-to-coordinate
  lookup for Korean road or parcel addresses.
- `vworld_search_locations`: VWorld Search API 2.0 place, road address,
  parcel address, and district search with bounded normalized results.
- `vworld_reverse_geocode`: VWorld Geocoder API 2.0 coordinate-to-address
  lookup for Korean road and parcel addresses.
- `list_assembly_protests`: normalized daily assembly/protest schedules from
  police notices. Raw board text is never returned.
- `list_points`: bounded point listing for small context windows. Prefer bbox and low limits.
- `nearest_points`: straight-line nearest resources for an incident coordinate.
- `rank_response_points`: route-aware ranking for existing non-hospital
  response points. Uses Kakao directions when configured.
- `recommend_emergency_hospitals`: scenario-aware hospital recommendation
  using road-time evidence and stored NMC emergency institution capability
  fields.

LLM usage rules:

- Do not request all points unless the user explicitly needs a full export.
- Do not use LLMs or MCP tools to crawl police board pages. Parse source pages
  first, then use `geocode_place` only for ambiguous place-to-coordinate
  resolution.
- Prefer `nearest_points` or `list_points` with a bounding box.
- Treat route duration as operationally stronger than straight-line distance.
- Use `recommend_emergency_hospitals` for patient-type-specific hospital
  recommendations. Use `rank_response_points` for generic response resources
  such as fire stations or police stations.
- When explaining a hospital recommendation, distinguish confirmed NMC
  emergency institution fields from fallback hospital FullData candidates that
  only prove emergency-room operation.

## HTTP Points API

`GET /api/points` now returns lightweight map markers by default. Raw source records are omitted for map performance.

Optional query parameters:

- `source=fire-stations|police-stations|aeds`
  - Repeat `source` or pass comma-separated IDs to aggregate multiple datasets
    in one viewport request.
- `includeUnmapped=true`
- `includeRaw=true`
- `detail=map|summary`
- `limit=number`
- `cursor=opaque cursor returned as nextCursor`
- `minLatitude`, `maxLatitude`, `minLongitude`, `maxLongitude`

Detail levels:

- `detail=map` or no detail: marker fields only, for browser map rendering.
- `detail=summary`: address, name, phone, and source metadata without raw source records.
- `includeRaw=true`: full raw source record. Use only for admin/debug workflows, not for the map or LLM context by default.

Cursor behavior:

- Listing responses include `nextCursor`. Pass it back as `cursor` to request
  the next page with the same filters and `detail` level.
- Cursor pages use stable `id` ordering and enforce server-side maximum limits.
  Proximity sorting with `centerLatitude` and `centerLongitude` is not cursor
  paginated.

Operational logs:

- `GET /api/logs` accepts `limit`, `category`, `source`, and `cursor`.
- Log cursors follow `event_at DESC, id DESC` ordering so records with the same
  timestamp page consistently.
- Responses include `{ logs, nextCursor }`; malformed cursors return
  `errorCode: "invalid_cursor"`.

## Access And Secret Boundaries

- Public map and MCP context must use summarized point payloads by default.
- General agency admins use `/admin` for read-only dataset status. API quota,
  detailed logs, refresh actions, raw point records, and NTP configuration are
  intentionally hidden from this page.
- Developer/operator access uses role-aware sessions created from `/sudo`.
  Server route handlers enforce the session role for expensive API-consuming
  actions and sensitive operational details.
- Never commit real API keys or access tokens. Store provider credentials in
  the encrypted setup or sudo settings database.

Point detail:

- `GET /api/points/{id}` returns one summary point for popup/detail panels.

## Future Work

- Add 119 call reception data import and regional/time aggregation.
- Add special-day and weather feature pipelines.
- Add forecast table and API for region/time risk.
- Expand hospital/ER capability validation, operator-facing caveats, and
  freshness monitoring for real-time NMC fields.
- Add a route-ranking API for browser UI, backed by the same Kakao directions logic used by MCP.
- Render forecast heatmaps and incident response recommendations on the map.
