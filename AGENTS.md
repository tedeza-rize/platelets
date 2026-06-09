<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Data Source And License Rules

When adding or changing any external dataset, API, shapefile, CSV, spreadsheet, generated GeoJSON, or derived data artifact:

- Add the data source, provider, source URL, license, usage, and caveats to `docs/DATA_SOURCES_AND_LICENSES.md`.
- Add the same source to `src/lib/data-licenses.ts` so the in-app `/licenses` page stays current.
- Keep real API keys and tokens out of git. Use environment variables and update `env.example` with placeholder names only.
- Prefer summarized or derived payloads for public map/LLM contexts. Raw source records must remain sudo/debug-only unless explicitly reviewed.
