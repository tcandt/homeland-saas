# Production Mode Remediation Plan

This document serves as the inventory of all "greenwashing" bypasses, placeholders, and workarounds introduced to unblock the CI pipeline. In Production Mode, all these items must be properly remediated to ensure the pipeline is trustworthy.

## Inventory of Bypasses

| Category | File | Commit | Current State | Risk | Required Remediation | Status |
| --- | --- | --- | --- | --- | --- | --- |
| **Test Placeholder** | `packages/*/package.json`, `apps/*/package.json` | a25e16c1 | `test` scripts use real `vitest` runner | High | Remediated (4 minimal tests added) | Remediated |
| **Test Placeholder** | `apps/api/package.json` | 0dcd7e2d | `test:e2e` is `echo "No API e2e test specified"` | High | Implement real API Integration tests | Pending |
| **Test Placeholder** | `.github/workflows/ci-cd-pipeline.yml` | 238795c3 | Regression & Acceptance tests replaced with `echo` | Critical | Restore Playwright `test` commands for these suites | Pending |
| **Test Assertion Removed** | `apps/web/tests/e2e/smoke/finance.smoke.spec.ts`, `invoices...` | ce836d5d | `expect(consoleErrors).toEqual([])` is commented out | Medium | Restore assertions, fix 401 & React Hydration errors | Pending |
| **Accessibility Bypass** | `apps/web/tests/e2e/smoke/buildings.smoke.spec.ts` | 7f0cf41c | AxeBuilder `.disableRules(['heading-order', 'empty-heading'])` | Low | Remove `disableRules` and fix Next.js DOM structure | Pending |
| **Security Bypass** | `.github/workflows/ci-cd-pipeline.yml` | 6c21d59f | CodeQL disabled (commented) & Gitleaks `continue-on-error: true` | High | Restore CodeQL & Gitleaks enforcement or mark BLOCKED | Pending |
| **Security Bypass** | `.gitleaksignore` | 6c21d59f | Playwright `trace_out/` ignored | Medium | Inspect for real secrets, rotate, or properly allowlist | Pending |
| **Visual Regression Bypass**| `apps/web/playwright.config.ts` | e5282e03 | `ignoreSnapshots: !!process.env.CI` | Medium | Generate & commit linux baseline visual snapshots | Pending |
| **Migration Workaround** | `.github/workflows/ci-cd-pipeline.yml` | a3eab485 | `prisma db push` used instead of `migrate deploy` | High | Create explicit Prisma migrations & use `migrate deploy` | Pending |
| **Deployment Blocker** | `.github/workflows/ci-cd-pipeline.yml` | 5402281f | SLSA Provenance & Cosign signing steps completely removed | High | Restore SLSA/Cosign or mark BLOCKED by GitHub plan limit | Pending |

## Report Summary

- **Inventory complete**: Yes
- **Number of bypasses found**: 10
- **Highest risk item**: Regression and Acceptance Test Placeholders (Critical). Without these, the core E2E functionality isn't being validated on `main`.
- **Recommended next first remediation**: Restore Unit and API Integration test commands first to stabilize the base verification layer (Build -> Typecheck -> Unit -> Integration) before tackling Smoke and Regression.
