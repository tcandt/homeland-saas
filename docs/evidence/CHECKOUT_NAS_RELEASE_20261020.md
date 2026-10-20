# Checkout NAS Release 2026-10-20

## Accepted Artifact

- Public URL: https://homeland.ductinh.one
- Source commit: `87aa24573fe3d7e0a5bbea7a44d042cf854c4e5d` (includes checkout fix `e962b32d49270964ee3342499fe5d93068727211`). Both pushed to `origin/main`.
- Build ID/project: `checkout-87aa2457` / `homeland_checkout_87aa2457`.
- API/worker image: `sha256:2063224877317507abffb19e6f096a96a9f231fd8dffd91689fd90ee43f0eae9`.
- Web image: `sha256:ae856a6a4860938630366036ffbfcc7acc40ce6f5f33503efb5a7dc204fc82bb`.
- NAS archive SHA256: `02acf137dc5ba5f699971fd6e7ec7aea0c45678bb3b13970ffbffc6513ea6da1`; archive commit verified on NAS.

## Gates

- Exact-source CI: https://github.com/tcandt/homeland-saas/actions/runs/39404634819 . Lint, type check, unit, integration, API/Web build, security and E2E all SUCCESS. Workflow-managed deployment jobs were skipped; NAS deployment was performed separately using the reviewed scripts.
- Checkout focused tests: API 146/146, additional Hunonic 6/6, Web 6/6; bounded migration harness 6 invariants PASS. Bootstrap guard regression 13/13 PASS.
- Independent Sol High checkout/migration and deployment reviews completed. Initial deployment gate 17/17 PASS; two additional restore/checkpoint tests PASS after the NAS timestamp failure was corrected.
- Actual NAS images scanned with pinned Trivy, offline database under 48 hours old: API 0 CRITICAL, 0 HIGH, 22 MEDIUM, 1 LOW; Web 0 CRITICAL, 0 HIGH, 3 MEDIUM, 0 LOW; no detected secrets in either image.
- Actual-image runtime PASS: Node 22/non-root Web, dependencies/templates, login/static assets, same-origin mock API, synthetic DOCX-to-PDF. API disposable database initialized 37 migrations and seed; two audit-only restarts preserved the full data dump.
- Generated Compose audit: one redacted actual configuration file scanned, no findings. Structural assertions additionally checked immutable image IDs, loopback-only Web port, no database/API published ports, no privileged/host-network/capability/socket settings. This bounded configuration audit does not establish absence of every security issue.

## Data and Activation

- User authorized a fresh business dataset while retaining accounts, RBAC, organization/settings and integration configuration. Old database and volumes were not reset, migrated or deleted.
- Source API/worker were briefly quiesced for a consistent full protected dump, schema and whitelist export, then restarted before private candidate preparation continued.
- New isolated database/storage/runtime volumes: `homeland_checkout_87aa2457_{database,storage,runtime}`. Original `homeland_release_320_{database,storage,runtime}` remain recoverable.
- Exact retained-table digests verified: 6 users, 3 roles, 74 permissions, 147 role-permission links, 10 settings, 5 document templates, 2 bank accounts, 37 Hunonic mapping configurations, plus organization/owner/link records. All 56 nonretained business tables were empty at acceptance.
- Hunonic room/building bindings, cached readings/status/amounts/raw payload and sync timestamps were cleared; provider identities/configuration retained. No provider sync or external notification was initiated by smoke tests.
- Only referenced tenant-bound settings assets were copied, with traversal/symlink checks and byte verification.
- Initial Prisma mapping restore rejected PostgreSQL timestamps without timezone before any insert (candidate count remained zero). Reviewed retry uses parameterized PostgreSQL `jsonb_populate_recordset`, preserving original typed timestamps/NULLs; focused regression tests and subsequent complete digest verification PASS.
- Synology inherited ACLs overrode `umask`. Removed inherited ACLs from the exact final release directory and private artifacts; verified directory `700`, private files `600`, root-owned. No broad share/other-application permission changes were made.
- Forward settlement migration applied only on candidate; 37 completed migrations and both settlement protection triggers verified.
- Private smoke PASS, source configuration/assets freshness PASS, then Web port changed from loopback 3004 to 3002. New DB became authoritative before publication; automatic rollback to the old DB was disabled after that boundary to avoid losing acknowledged writes.
- Public HTTPS smoke PASS: exact protected commit/build identity, readiness, anonymous protection, temporary-fixture normal login/logout, authenticated buildings/rooms/customers/contracts/invoices/Hunonic history, login page and four static assets. Fixture and its auth/audit side effects removed; retained digests and empty business tables reverified afterward.
- Activation exited 0. API/Web healthy; worker running; all three restart counts 0. External readiness returned HTTP 200 with database/schema UP at `2026-10-20T10:43:02Z`. Existing tunnels and unrelated media application remained running.
- Temporary deployment key removed from both root and tcandt authorized-keys files, preserving other entries. Subsequent key-only login was denied for both accounts. Local temporary key deletion was blocked by tool policy; local files remain, but the key is revoked on NAS.

## Recovery and Limits

- Root-only release evidence and full source dump remain under `/volume1/docker/homeland/release-4fc77db1/checkout-87aa2457`; never commit private environment, account snapshots, SQL exports or full dumps.
- Do not switch back to the old database automatically after public writes. Recovery must reconcile the authoritative new database before any traffic change.
- These are release and bounded runtime acceptance checks, not live tenant checkout/provider UAT. With business records intentionally empty, live-room Hunonic and settlement workflows still require normal operational acceptance using newly created business records.
