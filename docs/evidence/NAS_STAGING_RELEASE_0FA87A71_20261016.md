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

## Fresh isolated NAS preparation (not serving public traffic)

- Preserved the primary/e9 databases and all existing named volumes. Created only the new `homeland_nas_staging_v4_db_20261016` volume and preparation PostgreSQL container; network mode `none`, no published ports.
- Generated a fresh database credential without output and stored staging-only private configuration outside Git. DSM inherited permissions required an explicit chmod; all three new private env files were then verified mode600 before bootstrap.
- Correct `homeland-api:0fa87a71` bootstrap positively emitted `NAS staging bootstrap: INITIALIZED` and exited0. Independent read-only audit against the new target PASS:35 active migration checksums, approved schema fingerprint, seed completion marker; Building4/Room34/Customer0/Invoice0 and only ADMIN/MANAGER/FINANCE roles. This does not establish full UAT or a recovery drill.
- Readiness fix committed/pushed as `e1decc81045114db20e09718fcb465349aa012f9`; exact-SHA CI run441 (`38850506210`) started. No release publish or production deploy was requested.
- Exact clean Git archive for that candidate uploaded through host-key-verified SSH; local/NAS SHA256 `3be836759ef99c0ff63abd6f47a42550df08cdbc1f3e8e8a446808ef3c09f194` matches. SFTP is unavailable; no DSM service or SSH security setting was changed.
- Local Docker API and Web candidate builds PASS with metadata `3.1.1-rc.e1decc81`; Web retains14 known tracing warnings. NAS candidate API build is in progress. Public staging remains on the earlier0fa/34-migration database pending controlled activation and repeat UAT; no tunnel/public route switch in this follow-up.

## V4 preview deployment and bounded recovery checks

- Exact candidate e1decc81 CI441 is now SUCCESS: lint/typecheck/unit/integration/API build/Web build/security job/E2E all completed successfully. Publish/deploy/production approval jobs were SKIPPED. Within the green security job, CodeQL init/analyze were SKIPPED, not passed. Repository metadata now reports public; investigation found the `/code-scanning/alerts` capability probe unreliable. The local workflow fix makes CodeQL mandatory, with focused workflow safety21/21 PASS; remote SAST results still pending.
- NAS API image built successfully: `sha256:5e3fbee0ed3bcc70e96b75568f5d9099c8a6a1c9489b4970e037c3a0c1a2d3ad`, version `3.1.1-rc.e1decc81`, build `nas-e1decc81`. NAS Web build is still running from the matched clean archive. A first launch lacked Docker in noninteractive PATH and exited127; corrected to the absolute Docker path. The old exit file is stale during the active build: require final build success plus image identity, not that file alone.
- Reviewed separate v4 Compose uploaded, SHA256 `c41e201253dd8b8ced1d7bd689e62912f55eefd72611ac4626fa9aee44b54187d`. Port3002 was unused and dedicated tunnel logs still showed only `http://127.0.0.1:3001`. The preparation PostgreSQL was stopped before Compose attached the v4 DB volume. Old primary/e9 volumes were not attached or deleted. Fresh v4 storage/backups/runtime volumes were created.
- V4 bootstrap positively emitted `NAS staging bootstrap: VERIFIED_EXISTING`, exit0. Separate in-container read-only audit PASS:35 migration checksums, approved schema fingerprint, seed completion marker and roles ADMIN/MANAGER/FINANCE. API Node22.23.3 healthy; API/worker restart0 and matching exact image IDs.
- Actual API smoke41/41 PASS ran **inside `homeland_nas_staging_v4_api`**, so its loopback3001 is the v4 API, not the NAS host's old Web port3001. Protected build commit and staging/job/provider flags were asserted before auth. Three roles login/me/notifications/activity/logout passed; unauthorized endpoints401 and non-admin backup403 were expected; admin SePay config200; retired Sales404; outbound Zalo requests503 with the explicit staging-provider-disabled code. This is API smoke with an otherwise empty financial dataset, not full UI/business acceptance.
- Review follow-up removed the smoke origin default: require an explicit v4 namespace context and matching origin. Guard tests3/3 PASS; Compose tests4/4 PASS. No accepted host/public default remains.
- Uploaded one synthetic PDF through the v4 API, downloaded it with matching SHA256 `947a3496f36d44ef68956d81802dde75e126172725db142b11e63bd270f973766`. Document ID `cmvahlu1p000moltit978fdbs`.
- API-created backup `2026-10-16T04-48-17-276Z-5b974e90-a362-4686-827f-8054b3b29ff4` is READY, storage manifest contains1 file, real checksum/archive precheck9/9 PASS. This is same-NAS backup, not off-host proof or completed restore. Dedicated network-none/tmpfs PostgreSQL donor prepared for the separate restore drill; no restore result claimed yet.
- Local SSH preview listens only at `127.0.0.1:43305`, forwarding to NAS loopback3002. It does not expose a public listener or change Cloudflare. Thread heartbeat monitoring was successfully created, with human production gates retained; no credential is saved in its prompt.
- Independent review PASS_WITH_FINDINGS for mandatory CodeQL, explicit namespace guard and bounded restore harness; findings preserve off-host/financial/full-UAT limitations. Independent Node22.23.3 gate: workflow21/21, namespace guards3/3, restore harness syntax and diff checks PASS.
- Restore donor `homeland_nas_preview_restore_pg_20261016` uses network `none`, tmpfs DB, no published ports or source database volume. First restore launch correctly refused inherited stale build metadata before any restore/write. Rerun used DB-only private env, retaining actual image metadata; no data repair/reset or production change was needed.
- Actual isolated restore **13/13 PASS**, including real empty-target check, `pg_restore` and Prisma migration status (not skipped). Manual copy into a fresh dedicated storage volume verified the backed-up PDF checksum; uploaded Document metadata and release35/checksums/schema/seed marker are present in the restored database. Source backup volume was read-only. This is not a nonzero financial recovery, automated application storage restore or recovered-application HTTP test; those remain open. No production backup or full-UAT gate closed.

CORE-10.04/.06/.07, GATE-10 and production GO remain OPEN/NO-GO.
