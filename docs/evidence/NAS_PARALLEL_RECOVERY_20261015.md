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

## Remaining

- Financial/nonempty-file recovery lane, real DB cancellation race verification,
  independent runtime gate, new exact-SHA CI and unified immutable images.
- Full nonzero lifecycle/persona/device UAT, working SAST (CodeQL blocked without
  GHAS), approved provider integrations, off-host backup/recovery and sign-off.
- Another directory/RAID on the same NAS is not an off-host backup. No production
  traffic switch, release tag, migration apply or gate waiver was performed.
