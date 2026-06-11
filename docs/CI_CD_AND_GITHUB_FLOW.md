# CI/CD And GitHub Flow

## Branch Strategy

Platelets uses GitHub Flow with short-lived branches from `main`.

Use these branch names:

- `feature/<work-name>` for new functionality and durable improvements
- `fix/<bug-name>` for ordinary bug fixes
- `hotfix/<urgent-fix-name>` for urgent production fixes

Open or link a GitHub issue before starting work when the change is more than a
small local cleanup. The issue should describe the user impact, expected
verification, and any data or license changes.

## Pull Request Readiness

Before requesting review:

1. Run `npm run lint`.
2. Run `npm run test`.
3. Verify the affected browser flow.
4. Run `npm run format`.
5. Run `npm run lint`, `npm run test`, and `npm run build` again.
6. Run `npm run test:e2e` after Playwright browsers are installed.
7. Confirm `git diff --check` has no whitespace errors.

Keep commits scoped. Do not combine unrelated UI, data, security, CI, and
documentation work into one commit.

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
