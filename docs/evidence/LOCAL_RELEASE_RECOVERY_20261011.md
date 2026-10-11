# Local release recovery — 11 October 2026

Checkpoint only. CORE-10/GATE-10 and LIVE remain open. No NAS, production
mutation, historical migration edit, reset, prune, push or version bump.

## Recovery and verification

- Owner freed C. Latest read-only capacity: C ~39 GiB, D ~193 GiB.
- Clean `npm ci --ignore-scripts`, Prisma generate/rebuild and host build passed.
  Next is now locked16.3.8; host Node24 is supplementary, not CI runtime proof.
- Forced workspace tests/typechecks passed: API955 (63 opt-in skips), Web161,
  shared8, database1. Preflight scripts109/109 passed before the new safety test.
- Node22.23.3 exact UTC reporting30/30, Web161/161 and both typechecks passed.
- Locked full lint: 0 errors, 100 warnings. Previous91-warning count was from
  the older local Next dependency; warnings are not declared fixed.
- Current API nonincremental typecheck and affected backup/restore/Docker
  safety scripts47/47 passed. `git diff --check` passed.

## Isolated PostgreSQL and integration evidence

Dedicated container `homeland-release-baseline-db-20261011b`, pgvector/pg16,
synthetic credentials, local5436, database `homeland_release_baseline_test`.
Local bootstrap used its exact confirmation guard; baseline fingerprint,
historical18 + supplemental4 checksum inventory and forward migration status
passed34/34. Raw historical P3018 is not concealed or repaired in place.
Schema-only clones came from this verified current schema, not `db push`.
No shared `homeland_postgres` data was read or changed.

| Suite | Final passed | Notes |
|---|---:|---|
| Deposit core | 11 | Dedicated fresh DB; global outbox dispatcher must not share concurrent fixture queues |
| Contract core | 3 | Canonical paid ENTRY prerequisite added; activation race/replay preserved |
| P9 capacity | 1 | Canonical paid ENTRY added; loser state must equal pre-race state |
| P9 hold race | 1 | Real PostgreSQL |
| P8 whole-room payer | 1 | Real PostgreSQL |
| Billing snapshot | 5 | Real PostgreSQL |
| Monthly settlement run | 1 | Real PostgreSQL |
| Shared snapshot replay | 1 | Real PostgreSQL |
| Invoice adjustments | 19 | Real PostgreSQL |
| Booking guard | 13 | Own guard-approved loopback disposable DB |

Deduplicated integration total56/56. Initial mixed run failed5 tests plus the
booking safety guard; final affected reruns alone passed, not a repeated full
batch claim. Auth/buildings parallel12/12 also passed on a schema clone with
no initial ADMIN role. Verification image lacks Chrome, so those test startup
PDF-provider logs are not PDF-runtime acceptance.

B12 explicit storage drill: prepare6/6, restart3/3. Phase-only tests skip by
design. DB restarted and app recreated using the same named storage volume.
Fresh verification volume required UID1000 initialization; no user volume was
chowned. Original/scan checksums, concurrent approvals, audit rollback and
tenant denial passed.

## Docker runtime backup and restore

- Web candidate `homeland-release-web:20261011`, Node20.20.2,
  digest `sha256:d12909777ee0219f44f45b1e199b7af6cb33cb29d433eb091e6231ad800be221`.
  Chromium real login, closed registration, correlation ID and no page errors
  passed. Production registration test selectors now match the actual copy
  and assert the entire form is absent. Full API-backed test not claimed.
- Old API client18 dump failed PG16 restore: unsupported `transaction_timeout`.
  The failure rolled back; old backup retained, not reused as corrected proof.
- Corrected API `homeland-release-api:20261011-pg16`, Node22.23.3, pg_dump16.15,
  digest `sha256:7113ff725571e69bd2d2c325d8059bef482c820e379a6eea480e436e9cf65770`.
- Compiled `SystemUpdateService.createBackupSnapshot` used real pg_dump,
  storage copy and verifier; new backup
  `2026-10-11T14-38-18-418Z-0302d2c2-4a54-4302-958e-18c3de0ecd62` returned READY.
- Restore runner into confirmed empty `homeland_b12_restore_drill_test`
  passed19/19 including migration status. Off-host was not required: no
  off-host durability claim. Environment explicitly host-managed, not backed up.
- Storage copied manually from the verified bundle into a **new empty** named
  volume. Compiled tenant-aware document service verified restored provenance,
  all7 file sizes/SHA256, owned downloads and foreign-tenant rejection.
  Restored Customer/Document/AuditLog full rows match the source. This dataset
  is identity-only; no full business financial restore reconciliation claim.
- Independent Sol High diff review PASS after new-image/new-backup/restore
  finding was satisfied. These images have local metadata, not release SHA.

## Remaining gates

Production HTTP smoke: first container failed closed because APP_URL and
CORS_ORIGINS were omitted from the test launch. Corrected container creation
was denied by tool policy; no retry through a different mechanism. HTTP health,
API403 registration and the official production Playwright case remain unproven.

Authenticated release-SHA E2E/11 operating screenshots, real backup HTTP/UI,
automated complete storage restore, application-version rollback rehearsal,
runtime security policy, remote GitHub CI, off-host retention, staging/NAS
acceptance and human/provider sign-offs remain open. No A–Z release claim.

Local artifacts are under `testing/release-continuation-20261011/` (untracked).
Named disposable databases/volumes and backup artifacts are retained for the
next gate; no user-owned Docker resources or data were removed.
