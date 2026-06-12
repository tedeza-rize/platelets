<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Platelets — Agent Guide

> **⚠️ STOP. Read this entire file before touching anything.**
>
> This file is the single source of truth for all AI agents (Claude, Codex, Gemini, etc.). `CLAUDE.md` and `GEMINI.md` only point here. Past agents have repeatedly (1) coded without understanding the project, (2) committed directly to `main`, and (3) skipped the docs. All three are treated as failed work and will be reverted. Do not skim this file — read all of it, then follow it exactly.

## What Platelets Is

Platelets is a Next.js 16 emergency-response map for Korean public-safety (fire/police/disaster-preparedness) data. It imports facility and hazard datasets into SQLite (`data/points.sqlite`), renders MapLibre layers, recommends emergency hospitals by road ETA, and runs a disaster-response MVP dashboard. Summarized data is exposed to OpenAI-compatible models and a local MCP server; raw provider records stay behind sudo/debug boundaries.

The audience is public-safety operators, not developers. UI copy must be plain Korean/English for that audience — no raw technical jargon like "자격 증명" or "CMS" in user-facing strings.

Read `README.md` for features, environment variables, and dataset details. Do not start coding from assumptions; if this guide and the docs below don't answer your question, read the relevant source under `src/` first.

## Hard Rules — Violating Any of These Means the Work Is Rejected

These are not suggestions. There are no exceptions, including "small" or "obvious" changes.

1. **NEVER commit to `main`. No exceptions, ever — not for docs, not for one-line fixes, not for "urgent" changes.** Before your first commit, run `git branch --show-current`. If it prints `main`, stop and create a branch first (see Git Workflow below). All changes reach `main` only through a pull request. A commit made directly on `main` is wrong even if its content is perfect.
2. **Read the required docs before editing** (see Required Reading table). Do not guess Next.js APIs — this repo uses Next.js 16.2.7; check `node_modules/next/dist/docs/` when unsure. "I assumed it works like usual" is not acceptable in this repo.
3. **No hardcoded user-facing strings.** Every UI string (consoles and error messages included) goes through the `AppDictionary` i18n system in `src/lib/i18n.ts`, with both `ko` and `en` entries. More languages are planned, so never inline Korean or English text in components.
4. **No `Co-Authored-By` or AI-attribution trailers in commit messages.** Plain conventional commits only (`feat:`, `fix:`, `refactor:`, `docs:`, ...), one coherent change per commit.
5. **Never commit real API keys, tokens, or downloaded raw datasets.** Use environment variables; update `env.example` with placeholder names only.
6. **Follow the verification order** before every commit: code → `npm run lint` → `npm run test` → `npm run format` → `npm run test` again → commit → push.
7. **Cross-engine browser testing is mandatory when behavior may diverge.** If a change could plausibly behave differently between Chromium-based browsers and Firefox — CSS layout/scrolling, pointer/touch/wheel events, map rendering (MapLibre/WebGL), input and IME handling, date/number formatting, clipboard, media, or any browser API with known engine differences — you MUST run the affected tests/flows on **both** Chromium and Firefox before opening a PR. Do not skip Firefox because it is inconvenient or binaries are missing; install them (`npx playwright install chromium firefox`) or, if local install is truly impossible, state this explicitly in the PR and confirm the GitHub Actions Chromium + Firefox run passes before merge.

## Required Reading

| Before you... | Read |
| --- | --- |
| Touch anything (always) | This file, `README.md` |
| Write/modify Next.js routes, layouts, server code | The relevant guide in `node_modules/next/dist/docs/` |
| Change architecture, add modules, move directories | `docs/ARCHITECTURE.md` |
| Implement a feature or fix | `docs/DEVELOPMENT_GUIDE.md` |
| Branch, commit, open a PR | `docs/CI_CD_AND_GITHUB_FLOW.md` |
| Add or change any dataset, API, or derived data | `docs/DATA_SOURCES_AND_LICENSES.md` |
| Work on AI/MCP/forecast features | `docs/AI_FORECAST_AND_RESPONSE.md` |
| Work on building floor plans / evacuation data | `docs/BUILDING_SAFETY_DATA.md` |

## Git Workflow (GitHub Flow)

```bash
git fetch --all --prune
git switch main && git pull --ff-only
git switch -c feature/work-name   # or fix/bug-name, hotfix/urgent-fix-name
```

- Create or link a GitHub issue for anything beyond trivial cleanup; label it (`enhancement`, `bug`, `documentation`).
- Commit in small coherent units and push after every commit — finished work must not sit only in local commits.
- Open a PR back to `main` (`gh pr create --base main --fill`). It is merge-ready only after CI (lint, type tests, build, browser smoke test) passes.
- Full details: `docs/CI_CD_AND_GITHUB_FLOW.md`.

## Verification Commands

```bash
npm run lint        # biome check + encoding check
npm run test        # typecheck + unit tests
npm run format      # biome format --write
npm run build
npm run test:e2e    # Playwright; if no local browsers: $env:PLAYWRIGHT_BROWSER_CHANNEL = "msedge"
```

For UI work, also verify the affected flow in a browser at desktop and mobile breakpoints.

Playwright runs against Chromium **and** Firefox. If you suspect the change behaves differently across engines (see Hard Rule 7), both engines are mandatory, not optional — a Chromium-only (or Edge-channel-only) pass does not count as verification in that case. The full Chromium + Firefox suite also runs in GitHub Actions; it must be green before merge.

## Data Source And License Rules

When adding or changing any external dataset, API, shapefile, CSV, spreadsheet, generated GeoJSON, or derived data artifact:

- Add the data source, provider, source URL, license, usage, and caveats to `docs/DATA_SOURCES_AND_LICENSES.md`.
- Add the same source to `src/lib/data-licenses.ts` so the in-app `/licenses` page stays current.
- Keep real API keys and tokens out of git. Use environment variables and update `env.example` with placeholder names only.
- Prefer summarized or derived payloads for public map/LLM contexts. Raw source records must remain sudo/debug-only unless explicitly reviewed.
