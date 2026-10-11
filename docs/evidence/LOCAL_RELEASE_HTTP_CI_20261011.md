# Local HTTP / CI continuation — 11 October 2026

Status: checkpoint only; CORE-10.04 / CORE-10.07 / GATE-10 remain OPEN.
No Git push, release publication, NAS operation or production migration/data repair.

## Confirmed scheduler bug and correction

The earlier isolated HTTP container could start after renewed owner authorization.
It was initially pointed at the synthetic integration-fixture database. Deposit
outbox intervals consumed fixture events despite `DISABLE_SCHEDULED_JOBS=true`.
No real provider credentials or production data were supplied. That container
(`homeland-api-http-smoke-20261011e`) was stopped and must not be restarted
against the integration database.

Nest Schedule's `cronJobs: false` does not disable intervals or timeouts.
Commit `e5ab9360` configures all three kinds together, preserving normal enabled
behavior. Real Nest scheduler registry tests pass 7/7 on Node22.23.3;
nonincremental API TypeScript passes; independent read-only review PASS.

## E2E target routing

Commit `5b398c38` removes fixed ports from seven harness/helper files, uses
configured APIRequestContexts / relative page routes, and requires explicit
base URLs for independent contexts. Root inspected the accumulated diff.
Playwright discovery passes 10 cases across six specs, with only configured
loopback targets 43194/43195. This is discovery, not browser execution.

## Immutable application images

Both images were built from a clean Git archive of full source SHA
`5b398c380c191a8ebf356ca1ec9b15dcaaeb883c`, not the dirty workspace.
No application version bump: `3.0.2`, build ID `local-release-5b398c38`.

| Image | Docker image ID | Build time UTC |
| --- | --- | --- |
| `homeland-release-api:5b398c38` | `sha256:3c6946ec079872db59b23ffe548e09772791984ae713b8597a82e96cea8cc663` | `2026-10-11T15:31:30Z` |
| `homeland-release-web:5b398c38` | `sha256:54b15bc79bea308f3893fa6cada3339873ac9349a5523debd9d2162c8a4d8293` | `2026-10-11T15:30:12Z` |

API Node22 and Web Node20 compile/export PASS. Web reports 14 existing dynamic
filesystem tracing warnings. Image metadata matches the full source SHA.
These are local Docker image IDs, not remote registry publication evidence.

A separate synthetic browser database `homeland_browser_release_test` was
provisioned in the owned PostgreSQL16 container, using verified schema/history
snapshots (34/34) and the existing seed with synthetic passwords. This is not
a fresh migration replay or production database.

Creating the new API HTTP container for that database was rejected by tool
policy. Read-only inspection confirms `homeland-api-browser-20261011g` does not
exist. No retry through a different tool, shell, host server or changed target.
Backend-backed browser E2E and HTTP backup/rollback therefore remain unexecuted.

## Confirmed CI discovery gap

Job-equivalent discovery: smoke 20 cases / 7 files, regression 96 / 39;
acceptance originally fails during module loading because four mandatory
database isolation variables were missing. Supplying synthetic values makes
acceptance discover 38 cases / 8 files. Neither result is runtime PASS.

Workflow now binds `E2E_DATABASE_URL` to its existing disposable CI database,
sets target identity/disposable/run ID, disables scheduled jobs and immediate
communication delivery, and uses the API-only runtime role. Explicit closed
registration flags and its two smoke assertions are included in CI.
Automatic release publication and all remote deployment jobs remain disabled
for push/PR. Independent read-only review PASS; post-review workflow safety
19/19 PASS, acceptance discovery 38/8 and smoke plus closed-registration
discovery 22/8 PASS; `git diff --check` clean. No browser tests were executed.
The workflow-only follow-up is newer than the built application SHA; no
assertion that these images are the final release HEAD is made.

## NAS staging choice and remaining gates

Owner proposed `homeland.ductinh.one`, Container Manager and Cloudflare Tunnel;
NAS browser session is already logged in. Current DNS/tunnel/application
binding has NOT been inspected. Verify it before any change, and provision
separate staging database/storage with no real provider side effects.

Remaining: authenticated immutable-SHA runtime E2E, real backup HTTP/UI,
automated complete storage restore, application-image rollback, off-host
durability/retention, final security gate, remote GitHub CI, NAS staging/UAT,
historical money/duplicate-contract reconciliation and required sign-offs.
