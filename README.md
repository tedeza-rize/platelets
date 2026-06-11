# Platelets

Platelets is a Next.js emergency-response map for Korean public-safety data. It
imports facility and hazard datasets into SQLite, renders responsive MapLibre
layers, recommends emergency hospitals by road ETA and medical suitability,
and exposes summarized data to OpenAI-compatible models and a local MCP server.

## Main Features

- Responsive desktop navigation and mobile bottom navigation
- Fire stations, police stations, AEDs, childcare, pharmacies, hospitals,
  emergency institutions, schools, and universities
- Seoul real-time population/congestion popups and domestic earthquake display
- Staged dataset import progress and configurable automatic schedules
- Emergency dispatch and hospital ranking with Kakao ETA or directed OSM A*
- OpenAI Responses API and Chat Completions-compatible proxy configuration
- Read-only MCP tools for bounded facility summaries and grounding snapshots
- Public, admin, and sudo access boundaries

## Environment

Copy `env.example` to `.env.local` and fill only the integrations you use.
Never commit real keys.

Important variables:

```bash
NEXT_PUBLIC_VWORLD_API_KEY=
KAKAO_REST_API_KEY=
KAKAO_MOBILITY_REST_API_KEY=
PUBLIC_DATA_API_KEY=
SEOUL_OPEN_API_KEY=
PLATELETS_ADMIN_TOKEN=
PLATELETS_SUDO_TOKEN=
OPENAI_API_KEY=
OPENAI_BASE_URL=https://api.openai.com/v1
```

`PLATELETS_ADMIN_TOKEN` grants AI-query access. A sudo token also satisfies
admin access. `PLATELETS_SUDO_TOKEN` protects dataset refreshes, logs, quota
details, schedules, NTP settings, and AI configuration.

## Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Before changing Next.js code, read the relevant local guide under
`node_modules/next/dist/docs/`; this project uses Next.js 16.2.7 conventions.

## Verification

Before starting a branch or continuing existing work, synchronize and inspect
remote state:

```bash
git fetch --all --prune
git pull --ff-only
git branch --all --verbose
gh pr list --state open
gh run list --limit 5
```

Required local order:

1. 코드 수정
2. linting
3. 테스트, including browser verification when relevant
4. formatting
5. 테스트 again
6. 깃 커밋
7. 깃 푸쉬

```bash
npm run lint
npm run test
npm run format
npm run build
npm run test:e2e
npm audit
```

For UI work, also verify the affected flow in the in-app browser at desktop
and mobile breakpoints. Commit each coherent feature, bug fix, or
documentation/process update separately. Always push after committing; completed
work should not remain only in local commits.

## GitHub Flow

Use short-lived branches from `main` and open a pull request back to `main`.
Recommended branch names:

- `feature/작업명` for new functionality and durable improvements
- `fix/버그명` for ordinary bug fixes
- `hotfix/긴급수정명` for urgent production fixes

Create or link a GitHub issue before starting work whenever the scope is more
than a trivial local cleanup. A pull request is merge-ready only after the CI
workflow passes linting, type tests, production build, and the browser smoke
test, and any required review or branch-protection checks are satisfied.

Useful GitHub CLI commands:

```bash
gh issue create --title "작업 제목" --body "작업 범위와 검증 계획"
gh pr create --base main --head feature/작업명 --fill
gh run watch
gh pr checks
gh pr merge --merge --delete-branch
```

## AI And MCP

- AI analysis: `/ai`
- AI model, proxy, reasoning, verbosity, and system prompt settings: `/sudo/ai`
- Local MCP server: `npm run mcp:points`

The AI and MCP payloads intentionally contain bounded summaries rather than
raw provider records.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Development Guide](docs/DEVELOPMENT_GUIDE.md)
- [CI/CD And GitHub Flow](docs/CI_CD_AND_GITHUB_FLOW.md)
- [Data Sources And Licenses](docs/DATA_SOURCES_AND_LICENSES.md)
- [AI Forecast And Response Plan](docs/AI_FORECAST_AND_RESPONSE.md)
