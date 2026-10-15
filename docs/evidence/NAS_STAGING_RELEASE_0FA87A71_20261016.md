# NAS staging release evidence — 2026-10-16

Scope: staging only (`homeland.ductinh.one`), no production traffic or migration.
Secrets, tokens, cookies and customer data are intentionally omitted.

## Candidate and runtime

- Source SHA: `0fa87a71`
- Application version: `3.1.0`
- API image: `homeland-api:0fa87a71`
- Web image: `homeland-web:0fa87a71-v2`
- Web image ID: `sha256:44104fa6d8acdff6085931deb0ac38697fa0647f1f7a7bbd3e96c0bcdc5ac583d`
- API and Web containers: running/healthy; readiness returned `READY` with database and schema `UP`.
- Public login route: HTTPS 200; footer shows `v3.1.0`.
- Protected build info: unauthenticated 401; internal check returned commit `0fa87a71`, version `3.1.0`, deployment environment `staging`, runtime role `api`.
- Staging diagnostics: HTTP 200, environment `staging`, migration count `34`.

## Authenticated A–Z smoke

Using the staging admin fixture without recording credentials:

| Check | Origin | Public HTTPS |
|---|---:|---:|
| Login | 201 | 201 |
| Auth activity | 201 | 201 |
| Notifications | 200 | 200 |
| Buildings | 200 (4 items) | 200 (4 items) |
| Revenue report, October 2026 GMT+7 | 200 | 200 |
| Profit/loss history, October 2026 GMT+7 | 200 | 200 |
| Building profit summary | 200 (4 items) | 200 (4 items) |
| SePay admin config guard | 200 | 200 |
| Zalo status guard | 200 | 200 |
| Removed Sales CRM route | 404 | 404 |

External provider delivery remained disabled during all checks.

## Backup and rollback

- Manual staging backup endpoint: HTTP 201; subsequent status listed one backup.
- Online restore remains fail-closed (`restoreSupported=false`); no live database restore was attempted.
- Worker test with scheduled processing temporarily enabled and external delivery disabled wrote a heartbeat with `checked=0`, `recovered=0`; policy was restored to `DISABLE_SCHEDULED_JOBS=true` afterward.
- Rollback drill to API/Web `3.0.2-11a4f3c1`: both healthy, readiness 200, origin/public login 200.
- Forward to the new immutable images: both healthy, readiness 200, origin/public login 200.
- PostgreSQL counts were unchanged across rollback/forward: Building 4, Room 34, Customer 0, Invoice 0.
- Previous Web container was stopped for the route switch and remains recoverable; no named volume was deleted.

## Release decision

This evidence closes the current NAS staging image/route/rollback smoke slice only. It does **not** close GATE-10 or authorize production: off-host backup/restore, complete financial/file recovery, full OPS/FIN/OWNER UAT and sign-off, provider UAT, security/SAST exceptions, production secret rotation/topology and hypercare evidence remain open in `docs/operations/GO_LIVE_TODO.md`.

**Production: NO-GO.**
