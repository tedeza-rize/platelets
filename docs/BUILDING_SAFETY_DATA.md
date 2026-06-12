# Building Safety Data

`/api/building-safety` is the boundary for building-specific safety details.
The map can identify public map buildings from OSM/OpenMapTiles, but floor
plans, exits, refuge areas, and internal hazards must come from a separate
verified source.

Current implementation:

- `src/lib/building-safety/types.ts` defines `BuildingSafetyProfile`,
  `BuildingFloorPlan`, `BuildingSectionLevel`, `EvacuationRoute`, and
  `EvacuationExit`.
- `data/building-safety/profiles.json` contains presentation samples for Seoul
  City Hall, a Myeongdong mixed-use retail building, a Sinyongsan mixed-use
  sample, Busan City Hall, and BEXCO.
- `src/lib/building-safety/building-safety-service.ts` loads that JSON file and
  returns source metadata separately from building profiles.
- `src/app/api/building-safety/route.ts` returns the nearest profile for a
  clicked coordinate and includes related source metadata.
- The dashboard building popup appends section summary, exits, evacuation
  routes, refuge area, and source verification notes when a profile exists.

Checked Fire Safety Big Data Platform source candidates:

| Source | Product | Access | Current use |
| --- | --- | --- | --- |
| `bigdata119-fire-mechanical-drawings` | 소방 설계 기계도면 정보, goods 165 | Free, unstructured download | Candidate for stairs, fire equipment, machine rooms, and floor-level fire-safety layout |
| `bigdata119-electrical-drawings` | 전기도면 정보, goods 168 | Paid, unstructured download | Candidate for electrical rooms, emergency power, distribution panels, and exit-sign context |
| `bigdata119-walking-distance-images` | 보행거리 검토 이미지, goods 177 | Free, unstructured image download | Candidate for evacuation routes, walking distances, and exit accessibility |
| `bigdata119-fire-evacuation-simulation` | 화재 및 피난 시뮬레이션, goods 181 | Paid, mixed unstructured download | Candidate for fire/evacuation bottlenecks and floor-risk weighting |

These products confirm that platform-side building drawing and evacuation
artifacts exist, but the public pages expose metadata rather than normalized
floor/exit records. Approved downloads must be converted before the map can use
them as verified operational data.

Operational data requirements:

- Building identifier and address
- Representative latitude and longitude
- Floor labels and key spaces
- Known internal hazards such as electrical rooms, machine rooms, atriums, and
  crowding zones
- Emergency exits with floor, label, direction, and coordinates
- Floor section summary and vertical exit access
- Evacuation routes with start, destination, intermediate path, and optional
  walking distance
- Nearest outdoor assembly point
- Source label, verification state, and update date

Before production use, replace the sample records with verified facility
management, fire-inspection, or building owner data. Do not expose sensitive
floor plans publicly unless the source owner explicitly approves that use.

To replace the samples, update `data/building-safety/profiles.json` with
approved records, keep `sourceIds` aligned with source metadata, set
`dataStatus` to `verified`, and rerun `npm run test`.
