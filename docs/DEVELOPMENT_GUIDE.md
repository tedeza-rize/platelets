# Development Guide

## Before Editing

1. Read `AGENTS.md`.
2. Read the relevant Next.js 16 guide under `node_modules/next/dist/docs/`.
3. Inspect nearby modules and reuse their types, helpers, and error patterns.
4. Check `git status`; never discard unrelated user changes.

## Implementation Rules

- Keep server-only keys and provider calls out of client components.
- Use route handlers as validation and authorization boundaries.
- Parameterize SQL and validate any dynamic identifier against a fixed enum.
- Send bounded summaries to public, MCP, and LLM contexts.
- Keep raw provider records server-side unless explicitly reviewed.
- Use `Asia/Seoul` for user-visible dates and retain UTC for durable storage.
- Add abstractions only when they remove meaningful duplication.
- Prefer existing CSS modules and flat responsive layouts.

## External Data Checklist

When adding or changing a dataset, API, CSV, spreadsheet, shapefile, GeoJSON,
or derived artifact:

1. Add the provider, URL, license, usage, and caveats to
   `docs/DATA_SOURCES_AND_LICENSES.md`.
2. Add the same entry to `src/lib/data-licenses.ts`.
3. Put placeholder variable names in `env.example`; never commit a real key.
4. Normalize records into the shared point model.
5. Report requesting, receiving, processing, saving, and completion progress.
6. Keep public and AI payloads summarized and bounded.
7. Define a scheduler default and verify it can be changed in sudo controls.

## Feature Workflow

Use this order for each coherent feature or fix:

1. Make the scoped code change.
2. Run `npm run lint` and address logic or lint findings.
3. Test affected UI and API behavior in the browser.
4. Run `npm run format`.
5. Run `npm run lint` and `npm run build` again.
6. Run focused integration checks and `git diff --check`.
7. Commit only that feature or fix with a descriptive message.

Do not combine unrelated UI, data, security, and documentation work into one
commit merely because they were requested together.

## Browser Verification

For map or responsive UI changes, verify at minimum:

- Desktop navigation and the affected control
- Mobile bottom navigation and panel overflow
- Loading, success, empty, and error states
- A real API interaction where credentials and external availability permit it
- No horizontal overflow or inaccessible controls

Use DOM state for interaction correctness and a screenshot when visual layout
is the question. Reset temporary viewport overrides after testing.

## Database And Imports

The database is generated state and is not committed. Imports should be
restartable and transactional. Batch writes must remain below SQLite parameter
limits. Dataset-specific transformations belong in their importer; generic
persistence, status, and query behavior belong in `points-db.ts`.

If an upstream service is unavailable, a fallback must be explicit in data
metadata and UI caveats. Do not silently present fallback data as real-time.

## Security Review

Before finishing a server feature, check:

- Required admin or sudo role
- Request size and numeric bounds
- Rate or cost amplification against external providers
- SSRF through configurable URLs
- Raw record, log, token, or key exposure
- XSS in HTML-producing code
- SQL injection in constructed clauses
- Safe error messages that do not contain secrets
- `npm audit`, while remembering that logic flaws are outside dependency scans

## Definition Of Done

A change is done when behavior is implemented, lint and build pass, relevant
browser/API flows are verified, data licenses are synchronized, documentation
reflects durable architectural changes, and the working tree contains only
intentional uncommitted work.
