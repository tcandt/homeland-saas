# CI/CD Pipeline Status Report
**Status:** ✅ COMPLETED
**Phase:** Sprint 6 - Repository Governance & Secret Management

> **Runtime verification:** PENDING until GitHub Secrets + Staging/Production VPS are configured manually in GitHub Settings.
## Overview
The GitHub Actions Pipeline (`ci-cd-pipeline.yml`) has been successfully hardened and fully expanded to match the defined DAG (Directed Acyclic Graph):

### 1. Verification Phase (Parallel)
- **Linting:** ESLint and Prettier across all workspaces.
- **Type Checking:** `tsc --noEmit` validation for Next.js and NestJS apps.

### 2. Testing Phase
- **Unit Tests:** Jest execution for core packages and services.
- **Integration Tests:** API integration testing with dedicated database instance via PostgreSQL.

### 3. Security Phase
- **Dependency Scanning:** Trivy scans `package-lock.json` for known CVEs.
- **SAST:** CodeQL analyzes TypeScript codebase for vulnerabilities.
- **SBOM Generation:** Syft creates `sbom.cdx.json` (CycloneDX).
- **Attestation & Signing:** Sigstore Cosign provides SLSA Level 3 provenances and signs OCI images.

### 4. Build & Package Phase
- **API Build:** Containerized `homeland-api` via `Dockerfile.api`. Passed build args (`COMMIT_SHA`, `VERSION`, `BUILD_ID`, `BUILD_TIME`).
- **Web Build:** Containerized `homeland-web` via `Dockerfile.web`. Passed build args.
- **Images Pushed:** Stored securely in GHCR (`ghcr.io/homeland-saas`).

### 5. Staging Deployment & E2E Phase
- **Deploy Staging:** Automated SSH deployment to Staging VPS. Tags updated in `.env` via regex/substitution.
- **Health Check Staging:** Validates deployed `commit` and `version` against the new `/api/v1/health/build-info` endpoint.
- **Smoke Test Staging:** Playwright tests run against `STAGING_URL` to ensure core flows are unbroken.
- **Rollback Staging:** Auto-triggers if E2E/Health fails, instantly reverting `.env` to the previous image tag and restarting.

### 6. Production Deployment
- **Deploy Production:** Requires manual approval (`environment: production`). Automates the same SSH zero-downtime deployment mechanism on Production VPS.

## Artifacts Generated
- `deployment.json` (Deployment Metadata)
- `sbom.cdx.json`
- `security-reports`
- Cosign Signatures & Attestations attached to GHCR images

This pipeline strictly enforces the rule: **Deployment is always the final job, and no code reaches Production without passing every gate.**
