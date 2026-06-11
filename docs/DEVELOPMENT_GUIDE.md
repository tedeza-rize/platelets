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

Before editing, always synchronize with the remote repository and inspect branch
state:

```bash
git fetch --all --prune
git pull --ff-only
git branch --all --verbose
gh pr list --state open
gh run list --limit 5
```

Use `git` for branch synchronization and GitHub CLI for GitHub state such as
issues, pull requests, workflow runs, and merge readiness.

Use this order for each coherent feature or fix:

1. 코드 수정.
2. linting: run `npm run lint` and address logic or lint findings.
3. 테스트: run focused checks and test affected UI/API behavior in the browser.
4. formatting: run `npm run format`.
5. 테스트: run `npm run lint`, `npm run test`, `npm run build`, focused
   integration checks, and `git diff --check` again.
6. 깃 커밋: commit only that feature, bug fix, or documentation/process update
   with a descriptive message.
7. 깃 푸쉬: always run `git push` after committing so the remote branch,
   GitHub Actions, and pull request state reflect the completed work.

Do not combine unrelated UI, data, security, and documentation work into one
commit merely because they were requested together.

## Branch And Pull Request Workflow

This repository uses GitHub Flow:

1. Start from an up-to-date `main`.
2. Create a short-lived branch named `feature/작업명`, `fix/버그명`, or
   `hotfix/긴급수정명`.
3. Open or link a GitHub issue before implementation when the work has product,
   operational, or user-visible impact.
4. Keep commits scoped to one feature, fix, or documentation/process change.
5. Push the branch after every completed commit set.
6. Open a pull request into `main` and wait for GitHub Actions to finish.
7. Merge only after the CI checks pass and required review or branch protection
   rules are satisfied.

The CI workflow runs on `main`, `feature/**`, `fix/**`, `hotfix/**`, and pull
requests to `main`. Treat a passing CI run as the baseline signal that the
branch can be merged, subject to review and repository protection settings.

When GitHub CLI is available, use it for the issue, pull request, and Actions
checks:

```bash
gh issue create --title "작업 제목" --body "작업 범위와 검증 계획"
gh pr create --base main --head feature/작업명 --fill
gh run watch
gh pr checks
gh pr merge --merge --delete-branch
```

## Browser Verification

For map or responsive UI changes, verify at minimum:

- Desktop navigation and the affected control
- Mobile bottom navigation and panel overflow
- Loading, success, empty, and error states
- A real API interaction where credentials and external availability permit it
- No horizontal overflow or inaccessible controls

Use DOM state for interaction correctness and a screenshot when visual layout
is the question. Reset temporary viewport overrides after testing.

When Playwright browser binaries are installed, run `npm run test:e2e`; it tests
both Chromium and Firefox. If local Playwright browsers are missing, choose a
reasonable fallback:

1. Use system Chrome with
   `$env:PLAYWRIGHT_BROWSER_CHANNEL = "chrome"; npm run test:e2e`.
2. Use system Edge with
   `$env:PLAYWRIGHT_BROWSER_CHANNEL = "msedge"; npm run test:e2e`.
3. Use the in-app browser when neither Playwright browsers nor system
   Chrome/Edge are available.

If Chromium or a Chromium-based system browser passes and the change is not
Firefox-specific, treat that as acceptable local browser evidence. GitHub
Actions still runs the full Chromium and Firefox Playwright suite before merge.

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
