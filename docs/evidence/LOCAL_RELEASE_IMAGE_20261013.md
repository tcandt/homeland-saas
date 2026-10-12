# Local immutable release image verification — 13 October 2026

Checkpoint only; this does not approve NAS or production cutover.

## Source and images

- Source commit: `49c185d07c08be4623a7ad4eef197851dda8f031`.
- API image: `homeland-release-api:immutable-49c185d0`, Node `22.23.3`, image
  digest `sha256:db6cde121179e2df78ca459d10ef154e193bea16d5b6a87bf9ced8518b28fd85`.
- Web image: `homeland-release-web:immutable-49c185d0`, Node `20.20.2`, image
  digest `sha256:1d89d63cce2c33f301db2f15b68e3f03620776d681e64438259408280d52dd95`.
- Both images were built from a clean `git archive` context. API build included
  the PostgreSQL 16 client and completed successfully; Web build completed
  static generation and export with existing Turbopack filesystem warnings.

## Runtime smoke

- Isolated PostgreSQL 16 database `homeland_release_baseline_test`, 34 completed
  migrations; migrations, scheduled jobs and deposit outbox disabled.
- API container `homeland-release-api-49c185d0` is healthy on loopback `43304`.
- Web container `homeland-release-web-49c185d0` serves `/login` on loopback
  `43305` and uses the API container alias on the isolated network.
- Room turnover PostgreSQL integration: **9/9 PASS** against the isolated DB.
- GMT+7 reporting/month-close scheduler tests: **57/57 PASS** (including the
  last-day `23:59:59` cutoff and day-one `08:00` notification boundary).
- Release-image Desktop 1366 finance report-period check: **1/1 PASS**; the
  overview selects the current GMT+7 report month.
- Release-image Desktop 1366 contract regression: **3/3 PASS** for cleaning
  success, guarded rejection and the complete mocked rental journey.
- Release-image contracts smoke: **2/3 PASS**. Rendering/drawer functional
  assertions and mocked 500/empty states pass. The remaining screenshot check
  is the known `12%` pixel drift against the old `10%` baseline; the baseline
  was not overwritten and no visual PASS is claimed.

## Gate status

This closes the clean immutable-image build and release-runtime functional
checkpoint only. Staging HTTPS/NAS, version-matched rollback UI, visual review,
off-host backup, provider UAT, CI run for this SHA and CORE-10/GATE-10 remain
open. The running containers are local test resources and must not be treated
as a production deployment.
