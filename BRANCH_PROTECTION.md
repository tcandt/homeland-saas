# Branch Protection & Required Status Checks

> **STATUS:** DOCUMENTED / PENDING MANUAL CONFIGURATION IN GITHUB SETTINGS
> 
> *The settings described below must be manually configured by an administrator in the GitHub Repository Settings.*

## Overview
To ensure code quality and prevent accidental disruptions to production, strict branch protection rules must be enforced on the `main` branch.

## Branch Protection Rules (`main`)

The following protections **MUST** be enabled for the `main` branch:

- **Require a pull request before merging:** All changes must go through a Pull Request. Direct pushes to `main` are blocked.
- **Require approvals:** At least **1–2 approvals** from code owners or designated reviewers are required before a PR can be merged.
- **Dismiss stale pull request approvals when new commits are pushed:** If a PR is approved but new code is pushed, the approval is revoked and must be re-reviewed.
- **Require review from Code Owners:** If a `CODEOWNERS` file exists, their approval is mandatory for modified paths.
- **Require conversation resolution before merging:** All PR comments must be resolved.
- **Require status checks to pass before merging:** (See below for the list of required checks).
- **Require linear history:** Prevent merge commits. Use squash or rebase merging only.
- **Do not allow bypassing the above settings:** Enforce these rules for administrators as well.
- **Restrict deletions:** Branch deletion is strictly blocked.
- **Block force pushes:** Rewriting history on `main` is strictly blocked.

## Required Status Checks

The following CI/CD jobs must be marked as **Required** in GitHub Settings. A Pull Request cannot be merged unless all of these checks pass:

1. `lint` (Code style and quality)
2. `typecheck` (TypeScript static analysis)
3. `unit-test` (Unit testing coverage)
4. `integration-test` (Database and API integration)
5. `security-scan` (CodeQL, Trivy, Gitleaks, License checking)
6. `build-api` (Docker container build success)
7. `build-web` (Docker container build success)
8. `e2e-smoke` (Critical path E2E tests)
9. `e2e-regression` (Full regression E2E tests)
10. `e2e-acceptance` (Visual and acceptance E2E tests)
11. `semantic-release` (Dry-run for version generation)

By enforcing these checks, we guarantee that the DAG defined in our GitHub Actions pipeline must fully execute and pass before code is merged.
