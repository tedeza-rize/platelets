# CI/CD And GitHub Flow

## Branch Strategy

Platelets uses GitHub Flow with short-lived branches from `main`.

Use these branch names:

- `feature/작업명` for new functionality and durable improvements
- `fix/버그명` for ordinary bug fixes
- `hotfix/긴급수정명` for urgent production fixes

Open or link a GitHub issue before starting work when the change is more than a
small local cleanup. The issue should describe the user impact, expected
verification, and any data or license changes.

Before starting work, always confirm the remote repository state:

```bash
git fetch --all --prune
git pull --ff-only
git branch --all --verbose
gh pr list --state open
gh run list --limit 5
```

Use `git` for local and remote branch synchronization. Use GitHub CLI for
GitHub-specific state such as open pull requests, workflow runs, issue state,
and merge readiness.

Recommended GitHub CLI flow:

```bash
gh auth login
gh issue create --title "작업 제목" --body "작업 범위와 검증 계획"
git switch -c feature/작업명
```

## Required Work Order

Use this order for every scoped code or documentation change:

1. 코드 수정
2. linting
3. 테스트, including browser verification when UI or routing can be affected
4. formatting
5. 테스트 again
6. 깃 커밋

Do not put all work into one commit by default. Commit by coherent feature,
code change, bug fix, or documentation/process update.

After committing, always push the branch:

```bash
git push -u origin feature/작업명
```

Do not leave completed work only in local commits. A task is not ready for
review or merge until the branch has been pushed and GitHub Actions has run on
the pushed commit.

Before committing or requesting review, map that order to these commands:

1. Run `npm run lint`.
2. Run `npm run test`.
3. Verify the affected browser flow.
4. Run `npm run format`.
5. Run `npm run lint`, `npm run test`, and `npm run build` again.
6. Run `npm run test:e2e` after Playwright browsers are installed.
7. Confirm `git diff --check` has no whitespace errors.

For browser verification, use `npm run test:e2e` when Playwright browsers are
installed. If local browser binaries are unavailable, verify the same flow in
the in-app browser and rely on GitHub Actions to run `npm run test:e2e`.

## GitHub Actions

The `CI` workflow runs on pushes to `main`, `feature/**`, `fix/**`, and
`hotfix/**`, and on pull requests targeting `main`.

The workflow performs:

- `npm ci`
- `npx playwright install --with-deps chromium`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run test:e2e`

A pull request is merge-ready only after the CI workflow passes and any required
review or branch-protection checks are satisfied.

After pushing a branch, confirm merge readiness through GitHub Actions:

```bash
gh pr create --base main --head feature/작업명 --fill
gh run watch
gh pr checks
gh pr view --json mergeStateStatus,mergeable,statusCheckRollup
```

If `gh pr checks` is passing and the pull request is not blocked by review or
branch protection, the branch can be merged through the GitHub Flow process.

Prefer merging with a regular merge commit when preserving scoped commits
matters:

```bash
gh pr merge --merge --delete-branch
```
