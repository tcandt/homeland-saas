# NAS staging bootstrap runtime - 2026-10-15

Status: local runtime regression and NAS HTTPS smoke PASS. API source
`573bc6636266313a04cb2d7b1fbcdef3223eec7b` is deployed to staging. Exact-SHA
remote CI432 PASS; independent review and full NAS A-Z acceptance remain PENDING.
Production remains NO-GO.

## Confirmed NAS failure

- SSH read-only Docker inspection identified the actual e9 bootstrap container,
  bypassing stale Container Manager UI names. Exit code: 1.
- Bootstrap ran all 35 migrations successfully, then Prisma seed failed with
  `spawn tsx ENOENT`. Runtime pruning removed the development-only seed runner.
- Read-only database counts: 35 applied migrations, 0 TenantOrg, 0 User.
- Existing database and all old volumes are preserved. No repair/reseed/reset,
  production migration, daemon restart or unrelated service mutation occurred.
- Owner approved a new staging-only DB volume after local image verification,
  while retaining the failed staging volume for investigation.

## Local fix and evidence

- Retain the same locked tsx and bcryptjs versions as database runtime
  dependencies; no dependency version upgrades or historical migration edits.
- Resolve seed runtime before opening Prisma and before initialization writes.
  Invoke the absolute tsx CLI through Node instead of relying on shell PATH.
- Bootstrap Compose uses direct Node argv. The fixed confirmation remains
  `homeland_nas_staging`, independent of the Compose project name.
- Focused bootstrap/Compose tests: 16/16 PASS; `git diff --check` PASS.
- Docker Desktop built `homeland-api:seed-runtime-20261015-preview` on Node22.
  This is explicitly a dirty preview, not an exact-SHA release image.
- `verify-nas-bootstrap-image.js` PASS against the production-pruned image:
  fresh isolated PostgreSQL16 database, 35 applied migrations, completion marker
  and seeded users, followed by two audit-only restarts. Full data-only dump
  hashes matched before/after both restarts. Temporary test containers/network
  were removed; no host ports, host mounts or persistent volumes were used.
- Added the same real-image regression after API image build in CI. CI run432
  completed SUCCESS for source573bc663: new image bootstrap step, lint,
  typecheck, unit, integration, API/Web build and security scan PASS. E2E smoke
  22/22, regression84/84 and acceptance37/37 PASS. Unit output reports981 passed
  and72 skipped; release-repair Web46/46, API integration13/13. Publishing,
  semantic release, automated deployment/production gates were SKIPPED, not PASS.
  Run: https://github.com/tcandt/homeland-saas/actions/runs/38673169738
- Independent Sol High review attempts returned model-capacity errors. No PASS
  or milestone closure is claimed.

## NAS replacement and real HTTPS smoke

- Fix committed/pushed as `573bc663`. Source-pinned API image has identical
  filesystem layers to the verified preview; only build metadata differs.
- API/worker image `homeland-api:3.0.2-573bc663`, image config digest
  `sha256:281deb6e3f2baa3a40d55cf143b156c5455efa8777640d7462c93acdb9190579`.
  Transfer TAR SHA256 matched on local and NAS:
  `2c6f974ed92902806409590b2ffbd0a35f3fab391bef7cd3f854578e6e75a5bc`.
- Web remains the existing `homeland-web:3.0.2-e9e24274` image. It was neither
  rebuilt nor relabeled as source573; this is not a unified production release.
- Preserved `compose.before-seed-runtime-573bc663.yaml` and the failed DB volume
  `homeland_nas_staging_e9_homeland_nas_staging_e9_db`.
- New DB volume: `homeland_nas_staging_e9_db_seed_runtime573bc663`. Compose2.20
  initially retained the old PostgreSQL mount despite creating the new volume;
  bootstrap correctly refused the missing seed marker. Recreated only staging
  PostgreSQL, verified the new mount and zero public tables, then bootstrapped.
- Real bootstrap exit0: `NAS staging bootstrap: INITIALIZED`. New DB contains
  1 tenant and 3 users; SALES role count0 and SalesLead table absent.
- API/Web healthy; API, Web and worker restart counts0. Worker schedules remain
  intentionally disabled (`DISABLE_SCHEDULED_JOBS=true`), so no heartbeat or
  live queue-processing PASS is claimed. External delivery is false in both
  API and worker. No provider messages were sent.
- Staging private env file was mode777; narrowed to600. Synology reports Linux
  permission mode, not an additional inherited ACL. No secret values logged.
- Public HTTPS readiness:200 READY, database/schema UP.
- Six initial preflight requests passed: readiness, denied unauthenticated
  build-info/notifications, protected exact build-info, diagnostics35 and seed.
- Initial login smoke sent the wrong field (`email` instead of `emailOrPhone`)
  and received400. Corrected the test harness only; no application change.
  Affected authenticated smoke then passed32 requests (including an identity
  recheck): admin/manager/finance login/me/notifications/activity/logout,
  SePay config, room/customer/contract/deposit/invoice lists, finance summaries,
  current GMT+7 reports, removed Sales route404 and two guarded Zalo503s with
  `EXTERNAL_PROVIDER_DISABLED_IN_STAGING`. This is not financial/provider UAT.
- Browser login rendered through Cloudflare. Unauthenticated Reports redirected
  to login; console error list was empty. Authenticated Finance/Reports UI and
  full business acceptance remain OPEN.
- Manual backup created through the authenticated HTTPS API and verified by
  the application: snapshot
  `2026-10-15T03-13-43-459Z-ef8e262b-f9ad-4394-aa94-665e3233c8d8`, READY,
  273251 bytes. Backup API reports connected=true and restoreSupported=false.
  No schedule toggles, deletes, online restore or off-host upload were performed.
  This proves same-NAS backup creation, not recovery or off-host protection.

## Isolated NAS recovery and API rollback

- Restored the API-created backup into a fresh loopback-only PostgreSQL16
  container: guarded runner12/12, including checksum, archive listing, empty
  target guard and read-only Prisma migration status PASS. The runner's optional
  off-host check is not an off-host PASS. Source comparison found subsequent
  differences in AuditLog/User; this older snapshot is not an exact current-state
  financial reconciliation.
- Created another snapshot with the existing backup runner into a NEW drill-only
  backup volume, source storage mounted read-only. Snapshot ID:
  `2026-10-15T03-22-41-367Z-ce390812-578c-400b-9e97-9420eb05f60a`.
  Source full-row hashes were identical before/after backup and after all drills.
  The standalone snapshot initially inherited old49c release metadata from the
  host env file; it is a data-recovery artifact, not a release provenance record.
- Fresh confirmed database `homeland_restore_drill_20261015_fresh`: guarded
  restore12/12 PASS,35 migrations,75 public tables/348 rows. Restored full-row
  hash matches the snapshot source exactly; no differing tables. Hash:
  `a52e55c7477c05102d46743ecf74b3330af3dddab6c6c431ea7bc091da91aa24`.
  Schema comparison (columns/constraints/indexes/functions) also matches:
  `45274cd1d689304e29e89d765b819de28138f1a56b48817e9a0f14815b7f4b59`.
  Restore plus audit took3392ms, not an end-to-end production RTO measurement.
- API573 -> APIe9 -> API573 on the restored DB:23/23 HTTP checks per phase,
  including exact build identity, readiness, three-role login/me/logout,
  notifications, domain lists, finance/report reads and retired Sales404.
  Full-row/schema hashes are unchanged across each application startup/switch;
  expected login/audit writes are checkpointed before the next image switch.
  Rollback readiness/audit/smoke measured61s after stopping the current API.
- Drill PostgreSQL network mode was none; Redis/API shared only its loopback
  namespace. No host ports, production access, source DB writes, provider
  delivery, migration apply, seed, live stack switch or tunnel edits.
- Harness first stopped on a mistyped old-image digest, then on stale COMMIT_SHA
  inherited from the host env. Corrected the harness and generated a mode600
  private file containing only four required credential keys. Image metadata
  remains truthful; no credentials are in reports or Git.
- Independent reviewer found the tracked deploy-only Compose still referenced
  broken APIe9. Repinned bootstrap/API/worker and API metadata to verified573;
  retained truthful Webe9 identity. Focused Compose tests6/6 PASS. Reviewer
  service failed capacity before final re-review, so review remains OPEN.
- Scripts and sanitized reports: `testing/nas-runtime-20261015/restore-audit.cjs`,
  `rollback-drill.sh` and `drill-20261015/`. These are bounded NAS drill tools,
  not a generic production restore command.
- Storage file count0 and financial fixture absent. Nonempty attachment restore,
  financial reconciliation, Web rollback/browser acceptance, worker processing,
  unified release and off-host recovery remain unverified. BKP-03/STG-05 are
  NOT closed by this API-only drill.

## Remaining

1. Obtain independent Sol High review; CI432 evidence does not replace it.
2. Complete authenticated UI, worker, lifecycle/finance A-Z acceptance, nonempty
   storage/financial restore and Web rollback; do not promote API smoke to UAT.
3. Build/test a unified immutable API/Web release after remaining fixes.
4. Keep off-host backup/recovery and production rollout gates OPEN. RAID and
   another folder on the same NAS are not an off-host backup.

No credentials, tokens, connection strings or database dumps are recorded here.
