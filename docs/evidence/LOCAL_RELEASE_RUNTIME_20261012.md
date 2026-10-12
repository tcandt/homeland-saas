# Local runtime continuation — 12 October 2026

Checkpoint only: CORE-10.04, CORE-10.07 and GATE-10 remain OPEN / LIVE NO-GO.
No Git push, release publication, NAS change, production migration or data repair.

## Runtime and provenance

The renewed local continuation successfully started the isolated API/Web pair:
`homeland-api-browser-20261011g` at loopback43194 and
`homeland-web-browser-20261012a` at loopback43195. Health/readiness/Web/login
respond successfully; database/schema are UP. Both images retain source SHA
`5b398c380c191a8ebf356ca1ec9b15dcaaeb883c`, version3.0.2, as documented in
`LOCAL_RELEASE_HTTP_CI_20261011.md`; they are not final release HEAD images.

Database `homeland_browser_release_test` has34/34 migrations and synthetic
personas only. Scheduled jobs, deposit outbox and immediate communications are
disabled; no real provider credentials were supplied. Shared localhost5430
PostgreSQL and6379 Redis were not modified.

## Verified bounded browser coverage

Artifacts: `testing/release-continuation-20261012/` (retained locally).

- Closed registration2, Settings RBAC3 and shared-room financial isolation1:
  six unique cases PASS across the initial5/6 run and affected1/1 rerun.
  Settings assertions now distinguish read-only integration summaries from
  actual editable configuration modals; no settings saved/provider send.
- Theme audit6/6 PASS, including23 authenticated routes, public routes and the
  mandatory password-change branch. That branch is mocked; SSE is intercepted
  by the auth fixture. This is not actual provider or SSE delivery evidence.
- Opt-in backup UI runtime1/1 PASS: synthetic PDF upload/download SHA256,
  real UI backup201/READY, verified row, disabled online restore and API400.
  The test enforces disposable database identity before mutation and retains
  the fixture for the separate offline restore drill. It is not default CI.

## Actual backup and offline restore

HTTP snapshot `2026-10-12T00-39-44-952Z-42a771d0-c432-4a99-9af5-91da88d54d9a`
was READY. Actual compiled PostgreSQL16 restore runner passes12/12 into empty
`homeland_browser_restore_20261012_test`; eight financial tables have equal
full-row hashes immediately after restore.

UI snapshot `2026-10-12T00-46-55-382Z-e0a8794f-e97f-4c1f-bfde-a2f7c31faf2b`
includes one910-byte synthetic PDF, SHA256
`232cfdabd0165cdd4d488ddf4daa1beb7b39ed86d828db06cb9d173bcbe13b21`.
Actual compiled restore runner passes13/13 into empty
`homeland_ui_restore_20261012_test`, including stored-file verification and
migration status. Corrected, exit-checked SQL confirms source/restored full-row
hash equality for Invoice, Payment, PaymentAllocation, Deposit,
DepositLedgerEntry, CreditNote, Contract, RentalCycle, Document and
DocumentVersion at verification time. Subsequent lifecycle runs mutate the
source fixtures; this snapshot must not be compared to that later state.

The earlier scratch SQL using a nonexistent DepositLedger table is discarded;
its empty-output result is not evidence. Restore helpers are retained stopped
with exit0. These drills do not prove serving-app storage restoration, persistent
backup volumes, off-host durability/retention or application-image rollback.

## Preflight correction and environment blocker

Real build-info uses `{success:true,data:{commit,...}}`. Preflight incorrectly
read root.commit. It now validates/unpacks successful object envelopes while
rejecting failed/malformed envelopes and retaining raw legacy compatibility.
Focused5/5 PASS and independent review PASS. Real preflight passes the build
identity check, then correctly returns403 on staging-diagnostics because this
API has no `DEPLOY_ENV=staging`; the staging guard was not weakened.

A command to replace the API with staging configuration/persistent owned
volumes was denied by tool policy before execution. No replacement candidate
was created and no alternate launch mechanism was attempted. The current
healthy isolated API stays unchanged. Staging preflight is not READY.

## Remaining work

Initial CI smoke20:9 PASS,11 FAIL. Artifacts in `ci-smoke/`. Failures include
removed UI controls/labels, stale invoice/finance views, a descendant-vs-root
tenant locator and visual baselines from a different fixture/layout. These
are not20 passing runtime checks. No visual baselines were overwritten.

Lifecycle's second ordinary fix cycle failed2/2 before completed money
flows (`core-lifecycle-rerun2/`): approve action outside viewport, issued
invoice text matches two elements. Ordinary fix loop stopped per project
rules; independent Sol High root-cause escalation requested. The financial
fixture now uses canonical ENTRY preparation and payment APIs instead of
directly marking a deposit paid, but runtime coverage is not yet PASS.

The root-cause-corrected escalated run was attempted once after the isolated
admin login had passed a direct API probe. Both tests nevertheless received
`AUTH_INVALID_CREDENTIALS` before workflow at `rbac.fixture.ts:61`
(`core-lifecycle-escalated1/` and `core-lifecycle-escalated2/`). No retry or
credential mutation was performed. Lifecycle remains unverified until the
fixture/API target and synthetic credential are refreshed consistently.

The fixture was then corrected to send login to `E2E_API_BASE_URL` (commit
`386ede88`) and one final run was made. Both specs still returned 401 at
`rbac.fixture.ts:65` (`core-lifecycle-escalated3/`). No further retries are
authorized; the isolated runtime credential/seed state is the blocker, not a
passing lifecycle result.

Actual screenshot review exposed a production Dashboard chart defect:
zero revenue with negative profit uses revenue-only positive scaling and an
overflow-visible SVG, drawing through the page. Local correction uses a
shared signed revenue/profit/zero axis, dynamic labels, zero-based bars,
bounded plotting and gaps for unknown amounts (not fabricated zero).
Docker Web Node20.20.2 focused scale tests6/6 PASS, nonincremental Web
TypeScript PASS and independent Sol High review PASS. Updated-image browser
verification is pending. This new code is
not in the currently running immutable Web image.

Lifecycle runtime tests and release acceptance/regression remain in progress.
Security policy, current-HEAD immutable build/remote CI, automated complete
storage restore, image rollback, off-host retention, NAS staging/UAT,11
operating screenshots, provider checks and owner sign-offs remain OPEN.
Historical NAS money/duplicate-contract reconciliation and CCCD approval
remain separate from local hardening. Domain/tunnel binding for the owner's
proposed `homeland.ductinh.one` has not been inspected.
