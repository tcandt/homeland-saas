# Isolated Recovery, Web Rollback and Worker - 2026-10-15

Status: bounded NAS runtime checks PASS; fixes remain local pending immutable
image rebuild/exact-SHA CI. Full worker/UAT/release gates and production remain OPEN.

## Isolation

- Root controlled NAS; one test writer used a separate local Docker scope.
  Writers were explicitly paused/released. No shared writable databases,
  application volumes, image tags or public routing were used by test lanes.
- NAS resources used the exact prefix `homeland_webworker_drill_20261015_`.
  PostgreSQL16 used network mode `none`, no host ports and tmpfs data. API,
  Redis, worker and Web shared only that loopback namespace.
- Restored the existing drill snapshot with the unchanged guarded runner:
  12/12 checks, 35 migrations, 75 tables/348 rows, full-data/schema hashes equal
  to its original snapshot source. No production migrations or source DB writes.
- Eight disposable containers removed after evidence download. Application and
  backup volumes preserved. Public staging readiness200; active images unchanged
  (API/worker573bc663, Webe9e24274). SSH session closed.

## Confirmed Fixes

1. Missing NAS seed password could fail only after migrations and partial seed
   writes. Added NAS-mode nonblank password preflight before Prisma creation and
   required interpolation in all three Compose artifacts. Sol High review PASS;
   independent Node22 pruned-image gate PASS: bootstrap/Compose19/19, missing and
   blank CLI guards, all3 Compose empty-config rejection/valid-config acceptance.
2. Real worker cron skipped normal queued rows with `error=NULL`: SQL `NOT`
   excluded NULL. Original image tick at04:10 UTC checked1/recovered1; only the
   stale row delivered, new CONSOLE/EMAIL rows remained QUEUED. Added explicit
   NULL eligibility while retaining cancellation/backoff/retry restrictions.
3. Independent review found pre-existing cancellation/retry/worker-claim races.
   Cancel now uses tenant-scoped atomic update limited to QUEUED/FAILED/RETRYING;
   retry atomically permits these states plus DEAD_LETTER. Both reject in-flight,
   delivered or concurrently changed rows. Focused cases cover terminal rejection,
   both claim/cancel orderings and eligible/racing manual retry. Final Sol High
   review PASS with no actionable findings; real PostgreSQL gate pending.

## Runtime Results

- Patched worker actual cron at04:15 UTC: checked3/recovered1. CONSOLE queued and
  recovered-stale each DELIVERED with exactly one delivery record; EMAIL guard
  FAILED with one attempt and future retry; future-backoff/manual-cancel/dead-letter
  each untouched with zero delivery records. No external delivery.
- Only Notification/NotificationDelivery/NotificationQueue full-row hashes changed.
  The worker started without an HTTP server. This used the Node22/API573 image
  with a TypeScript-compiled scheduler module mounted read-only, NOT a new
  immutable image or proof of the later cancellation patch on NAS.
- Webe9 -> Web11a -> Webe9:38/38 HTTP checks per phase, total114/114, including
  17 Next assets each, readiness/proxy, unauthenticated401, admin login/me/activity,
  notifications, SePay config, finance/report reads, retired Sales404, eight page
  responses and logout. Full-row hashes identical across both Web image switches.
- One harness method error (GET activity404) corrected to the canonical POST201;
  this was not an application route failure. No browser automation in this drill;
  HTTP200 page rendering does not prove interactive UI or frontend route guards.
- Final local affected communication tests29/29 and API TypeScript emit PASS,
  including the later retry-patch validation. Independent Sol High review PASS.

Sanitized JSON: `testing/nas-runtime-20261015/webworker-20261015/`.
Harness: `testing/nas-runtime-20261015/webworker-drill.cjs`.

## Financial Recovery Lane

- Isolated local PostgreSQL16 with no network/host ports; generated ephemeral
  credentials were inherited through environment, not command-line values.
  Bootstrap used API573 and its unchanged guarded 35-migration NAS runner.
- Direct Prisma synthetic fixture: one deposit2,000,000, CASH_IN ledger2,000,000,
  invoice3,000,000 with paid1,250,000, confirmed payment/allocation1,250,000.
  This is recovery coverage, NOT evidence of business/API lifecycle correctness.
- Unchanged production backup/restore runners:13/13 checks PASS, including
  dump/storage checksums, explicitly confirmed empty target and actual Prisma
  migration status. Full-row/selected-schema hashes match source and restored DB; source
  audit unchanged before backup, after backup and after restore verification.
  Initial review found enum/extension/sequence coverage missing. Expanded audit
  now compares229 enum labels,2 extension versions/schemas and1 nonempty synthetic
  sequence definition/state (`last_value` and `is_called`) as well as columns,
  constraints, indexes, functions and triggers. Expanded run exited0 PASS.
- One nonempty synthetic contract attachment was copied from the backup manifest
  into empty target storage by the TEST HARNESS and its SHA256 matched source.
  Application storage-restore workflow and restore UI were NOT tested.
- The first harness run lacked password pass-through; the next fixture violated
  the invoice billing-kind shape constraint. Both stopped without touching any
  live DB. Removed the synthetic RENT override to use valid default LEGACY;
  final run exited0. No application constraint/migration was modified.
- Initial successful run: `run-1792038949738-15d2e4d6`; expanded audited run:
  `run-1792039517604-0ba2979a`; post-secret-scan fixture rerun:
  `run-1792041564139-a936bfa6`. Earlier blocked run
  `run-1792038854460-6f2f279a` was initially mis-cited by the agent; root checked
  the corrected actual summary and both attachment files before accepting it.
- All financial-test containers removed; ephemeral database data removed with
  them. Private backup artifacts remain ignored locally. Sanitized summary and
  harness: `testing/recovery-financial-20261015/`. Initial Sol High review
  PASS_WITH_FINDINGS; exact audit gap fixed, expanded rerun and final Sol review PASS.
- The local check did NOT require off-host copy; its `off_host_copy: PASS` means
  that optional check was waived, not that off-host backup was exercised.

## Remaining

- Real DB cancellation race verification,
  independent runtime gate, new exact-SHA CI and unified immutable images.
- Full nonzero lifecycle/persona/device UAT, working SAST (CodeQL blocked without
  GHAS), approved provider integrations, off-host backup/recovery and sign-off.
- Another directory/RAID on the same NAS is not an off-host backup. No production
  traffic switch, release tag, migration apply or gate waiver was performed.
