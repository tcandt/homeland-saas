# NAS staging release evidence — 2026-10-16

Scope: staging only (`homeland.ductinh.one`), no production traffic or migration.
Secrets, tokens, cookies and customer data are intentionally omitted.

## Candidate and runtime

- Source SHA: `0fa87a71`
- Application version: `3.1.0`
- API image: `homeland-api:0fa87a71`
- Web image: `homeland-web:0fa87a71-v2`
- Web image ID: `sha256:44104fa6d8acdff6085931deb0ac38697fa064f1f7a7bbd3e96c0bcdc5ac583d`
- API and Web containers: running/healthy; readiness returned `READY` with database and schema `UP`.
- Staging bootstrap one-shot using the same API image exited `0`; no production migration or production database was touched.
- Public login route: HTTPS 200; footer shows `v3.1.0`.
- Protected build info: unauthenticated 401; internal check returned commit `0fa87a71`, version `3.1.0`, deployment environment `staging`, runtime role `api`.
- Staging diagnostics: HTTP 200, environment `staging`, migration count `34`.

## Bounded authenticated read smoke (not A–Z acceptance)

Using the staging admin fixture without recording credentials. The token was obtained at the origin, then reused for HTTPS endpoint checks; successful public authentication itself was not established by this run:

| Check | Origin | Public HTTPS |
|---|---:|---:|
| Login | 201 | Not verified; Python client received Cloudflare 403/1010 |
| Auth activity | 201 | 201 |
| Notifications | 200 | 200 |
| Buildings | 200 (4 items) | 200 (4 items) |
| Revenue report, explicit October 2026 parameters | 200 | 200 |
| Profit/loss history, explicit October 2026 parameters | 200 | 200 |
| Building profit summary | 200 (4 items) | 200 (4 items) |
| SePay admin config guard | 200 | 200 |
| Zalo status guard | 200 | 200 |
| Removed Sales CRM route | 404 | 404 |

External provider delivery remained disabled during all checks.
The financial dataset was empty. HTTP 200 with explicit period parameters does not verify financial calculations or the current GMT+7 UI default for this release.

## Staging topology limitation

The public route switched from the e9 stack to the primary staging stack, using a different staging database (34 recorded migrations versus 35 in the earlier e9 drill). The primary dataset has 4 buildings, 34 rooms, no customers and no invoices. Earlier e9 database recovery evidence must not be treated as proof for this database. Reconcile database identity, migration checksums and schema before full UAT. Base Compose and release overrides also require persistence verification before any Container Manager rebuild.

## Backup and rollback

- Manual staging backup endpoint: HTTP 201; subsequent status listed one backup. READY state, archive integrity and manifest checksums were not captured in this run and remain unverified.
- Online restore remains fail-closed (`restoreSupported=false`); no live database restore was attempted.
- Worker test with scheduled processing temporarily enabled and external delivery disabled wrote a heartbeat with `checked=0`, `recovered=0`; policy was restored to `DISABLE_SCHEDULED_JOBS=true` afterward.
- Rollback drill to API/Web `3.0.2-11a4f3c1`: both healthy, readiness 200, origin/public login 200.
- Forward to the new immutable images: both healthy, readiness 200, origin/public login 200.
- PostgreSQL counts matched after rollback and after forward: Building 4, Room 34, Customer 0, Invoice 0. The pre-rollback query failed; this is not before/after rollback data-integrity proof, and no full-row hashes were captured.
- Previous Web container was stopped for the route switch and remains recoverable; no named volume was deleted.

## Release decision

This evidence records a limited NAS staging image/route/rollback smoke only; it closes no release milestone. It does **not** close GATE-10 or authorize production: off-host backup/restore (owner currently chooses same-NAS storage only; no risk waiver recorded), complete financial/file recovery, full OPS/FIN/OWNER UAT and sign-off, in-scope provider UAT, security/SAST exceptions, production secret rotation/topology and hypercare evidence remain open in `docs/operations/GO_LIVE_TODO.md`. Hunonic provider UAT remains explicitly deferred under SCP-01.

**Production: NO-GO.**

## Follow-up verification and blocking finding — 2026-10-16

The earlier smoke above is retained as a bounded historical result, not release approval.

- SSH connected with the already-known host key; private staging env remains mode600.
- Active containers are API/worker `homeland-api:0fa87a71`, Web `homeland-web:0fa87a71-v2`. Compose labels reference both the source base and release override; Web currently binds loopback ports3000 and3001 due to list merging. Do not rebuild from the stale base alone.
- **BLOCK:** primary DB `homeland_staging` has34 completed migrations versus35 in the image. The34 checksums match; missing `20261014130000_retire_sales_role_and_leads`. `SalesLead` still exists (0 rows), role SALES still has1 assignment. `auditNasRelease` rejects coverage drift and `assertNasSeedCompleted` rejects the old marker. The old bootstrap container image `3.0.2-11a4f3c1` exiting0 is not evidence that the new bootstrap ran successfully.
- Current readiness incorrectly returns200 on that34-migration database. The local fix requires the latest completed/unrolled migration, no unfinished migration, no SalesLead table, and exactly ADMIN/FINANCE/MANAGER RoleCode labels. Executing its read-only predicate against this NAS database returns `compatible=false`, as expected. No remote database mutation was performed during this follow-up.
- Public POST login and logout were now independently exercised through `https://homeland.ductinh.one` using NAS Node fetch:201/201, token issued, no credential or token output. This supersedes only the earlier public-login uncertainty; it is not interactive UI UAT.
- Existing backup `2026-10-15T18-39-24-981Z-253519ab-da35-49d3-8d0d-51e18e1e1cbd` reports SUCCESS/complete and passes restore precheck8/8, including dump checksum, storage-manifest checksum and real `pg_restore --list`. Off-host was **not required by this check**; it is not off-host proof. Storage manifest has0 files, so nonempty attachment recovery remains open.
- Local Node22.23.3 focused health tests7/7 PASS. Isolated local PG16/Node22.23.3 harness8/8 PASS: fresh bootstrap35/checksums/schema/seed marker, current predicate true, five negative schema/migration cases rejected with transaction rollback, final audit unchanged. `testing/release-readiness-20261016/run-readiness.cjs` records the executable procedure. No application volumes or public ports were used; the disposable donor was removed.
- Independent Sol High review: local readiness fix PASS; current deployment remains BLOCK. Preserve the old DB volume and initialize a fresh, explicitly staging-only volume using the correct bootstrap, then repeat diagnostics and UAT. The retire-sales migration is destructive; old-image rollback on the migrated DB does not restore deleted SALES/CRM structures/data. Use the untouched old volume or verified pre-migration backup for that boundary.

STG-02, STG-04, STG-05, BKP and GATE-10 remain open; production remains NO-GO.
