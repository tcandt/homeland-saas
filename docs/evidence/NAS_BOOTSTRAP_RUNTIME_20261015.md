# NAS staging bootstrap runtime - 2026-10-15

Status: local runtime regression PASS; NAS replacement, exact-SHA remote CI,
independent review and A-Z acceptance PENDING. Production remains NO-GO.

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
- Added the same real-image regression after API image build in CI. Remote CI
  for this change has not yet run; prior e9 CI is not evidence for this patch.
- Independent Sol High review attempts returned model-capacity errors. No PASS
  or milestone closure is claimed.

## Remaining

1. Obtain independent review and commit/source-pinned image evidence.
2. Deploy the verified image and new staging-only DB volume, preserving old data.
3. Verify readiness, exact build identity and real HTTPS A-Z acceptance.
4. Keep off-host backup/recovery and production rollout gates OPEN. RAID and
   another folder on the same NAS are not an off-host backup.

No credentials, tokens, connection strings or database dumps are recorded here.
