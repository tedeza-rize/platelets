# Building Safety Data

`/api/building-safety` is the boundary for building-specific safety details.
The map can identify public map buildings from OSM/OpenMapTiles, but floor
plans, exits, refuge areas, and internal hazards must come from a separate
verified source.

Current implementation:

- `src/lib/building-safety/types.ts` defines `BuildingSafetyProfile`,
  `BuildingFloorPlan`, and `EvacuationExit`.
- `src/lib/building-safety/building-safety-service.ts` contains presentation
  samples for Seoul City Hall, Busan City Hall, and BEXCO.
- `src/app/api/building-safety/route.ts` returns the nearest profile for a
  clicked coordinate.
- `MapShell` appends the profile to the building popup when a profile exists.

Operational data requirements:

- Building identifier and address
- Representative latitude and longitude
- Floor labels and key spaces
- Known internal hazards such as electrical rooms, machine rooms, atriums, and
  crowding zones
- Emergency exits with floor, label, direction, and coordinates
- Nearest outdoor assembly point
- Source label, verification state, and update date

Before production use, replace the sample records with verified facility
management, fire-inspection, or building owner data. Do not expose sensitive
floor plans publicly unless the source owner explicitly approves that use.
