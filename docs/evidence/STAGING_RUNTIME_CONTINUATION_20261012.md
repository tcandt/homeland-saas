# Staging runtime continuation - 12 October 2026

Checkpoint, not a release approval. CORE-10/GATE-10 and LIVE remain NO-GO.
No NAS operation, production migration, provider delivery, version bump or Git
push was performed. Unrelated dirty files and existing artifacts were retained.

## Identity and scope

- Immutable API/Web runtime source:
  `08de2dcac95b6d9a0f133e82e2ddec34c6d0e851`.
- Test harness started at `fd0a203a`; this continuation adds the reviewed
  guarded room-turnover command/UI plus focused test coverage.
- Isolated synthetic database: `homeland_release_baseline_test`, loopback5436,
  34 completed migrations. Shared `homeland_postgres`/`homeland_redis` untouched.
- Local API/Web: loopback43294/43295. Background jobs/outbox/immediate delivery
  disabled; migrations disabled. Dataset is synthetic seed data, not historical
  NAS reconciliation or anonymized production-load evidence.
- The prior Quick Tunnel stopped; its URL returns530 and is not a working
  handoff. No production domain binding was changed.

## Runtime E2E evidence

Previous HTTPS runs on this immutable runtime passed closed-registration and
Settings RBAC5/5, real contract/invoice lifecycle2/2, signed SePay1/1 and backup
UI/runtime1/1. Signed webhook evidence includes invalid-signature rejection,
accepted-once/replay invariants and second-transaction review, not real bank
delivery. Backup evidence includes original upload/download SHA256 and online
restore rejection. Staging admission/preflight guards18/18 passed; independent
final review remains open.

The serial CORE-10.04 loopback run initially finished26/32, with6 failures and
0 skips. Affected fixes and reruns:

- Pending settlement refund: the panel belongs to the Thanh toan tab. Focused
  test now passes; financial payload/proof/completion assertions retained.
- Reports: mocks now match exact URL path independently of query parameters,
  avoiding unintended live-data fallthrough. Aggregate assertions pass.
- Finance: removed overview bank-cashflow controls were replaced with the
  current building-profit period workflow. Fixed browser time, GMT+7 inclusive
  bounds, revenue/profit aggregates and filtered bank transaction amounts pass.
  This is not evidence that the removed overview cashflow widget still exists.
- Contracts smoke functional assertions pass with snapshots explicitly ignored.
  The12% visual difference versus the old10% threshold is still OPEN; no baseline
  was overwritten and no visual PASS is claimed.
- Mock full rental journey now passes on the current Node20 Web Docker runtime:
  deposit collect → conversion/issued ENTRY invoice → submit/approve → blocked
  activation while unpaid → pay invoice → move-in confirmation → ACTIVE /
  OCCUPIED → settlement/utility/refund → guarded CLEANING → AVAILABLE. The
  helper now synchronizes by drawer identity and role-based card/dialog
  selectors, refreshes page query state before final turnover, and uses the
  current invoice/payment controls. Focused Desktop1366 run is **3/3 PASS**
  (cleaning success, cleaning rejection, full journey). This is local mocked
  business-API evidence, not provider/UAT or NAS evidence.
- Cleaning completion is now guarded locally: the tenant-scoped `AVAILABLE`
  transition locks the room, rejects occupancy/visible-contract/active-hold/
  customer bindings, writes the Room audit in the same serializable transaction,
  and retries serialization/deadlock conflicts. The drawer action is
  non-optimistic and invalidates room/contract list **and detail**/dashboard
  queries only after the server settles. API unit/turnover tests are 23/23, Web
  mutation tests 2/2,
  focused cleaning E2E success/rejection are 2/2, and isolated PostgreSQL
  turnover-vs-booking integration is 9/9. The deterministic booking-first
  barrier now has a bounded lock-entry wait and always awaits both concurrent
  promises during cleanup; the rerun passed 9/9 in Node22/PostgreSQL16. The
  activation-race remains untested and the full rental journey remains OPEN.

Additional production-style desktop audit initially finished20/24. Expenses9/9,
SePay reconciliation5/5 and password-change1/1 passed; these fixtures mock the
business APIs and are not substitute evidence for real provider/ledger UAT.
Three route-audit failures were HTTP429 while rapidly traversing many pages:
notification and settings endpoints hit the unchanged100/minute limiter.
Optional test-only `E2E_ROUTE_PACE_MS=3000` and180-second audit timeouts preserve
all console/layout/error assertions and do not change application rate limits.
Affected paced rerun3/3 passed on restored runtime08de2dca in4.6 minutes,
covering dark responsive and light/dark authenticated routes. Together with
the invoice-credit rerun below, the24 distinct cases have passing evidence
across the initial/affected runs, not one repeated full batch.

Invoice credit affected rerun1/1 passes against the actual current UI: total
1,000,000, cash300,000/30%, credit200,000, remaining500,000/50%. The drawer must
request500,000, not inflate cash to500,000. An explicit pending synthetic payment
request prevents a mock UI test from creating a real backend request.

Host Web typecheck/encoding and `git diff --check` pass. Host validation is
supplementary, not a fresh Node20 image build or remote CI result.

## Restore drill

Actual UI-created immutable backup:
`2026-10-12T10-58-04-981Z-c58d6edb-3b5b-4610-8aae-900b1c659856`.
Database dump312425 bytes, SHA256
`0b343468c8f6141d78f8380f75b55933ea0ed6ab373ec6083002ce691c583e16`.

- The bundled PG16 restore runner passed13/13 into confirmed empty
  `homeland_staging_restore_drill_20261012`, including migrate status34/34.
- Verified bundle storage copied into a new empty named volume with exclusive
  creation and size/SHA256 validation. One synthetic PDF restored.
- Restored API READY, real login and tenant-authorized HTTP document download200
  passed. Download SHA256 equals
  `3d4336f077cfe557746ed93170b79043c9129286063375b6231182eb3950aa24`.
- Restored Web contract mouse/keyboard/drawer/accessibility functional smoke1/1
  passed after returning to the current image. Snapshots explicitly excluded.
- Separate backup/restore/retention/update safety scripts52/52 passed.

Storage restoration was a guarded manual drill, not a newly implemented automatic
online restore feature. Environment is host-managed and not in the bundle.
No off-host durability, RPO/RTO SLA, full source-at-snapshot row reconciliation
or production financial reconciliation is claimed.

## Image rollback drill

On restored DB/storage only, switched API/Web from08de2dca to immutable source
`5b398c380c191a8ebf356ca1ec9b15dcaaeb883c`, then back to08de2dca. No migrations.

The initial old-Web probe correctly failed the expected-SHA guard: Next's built
rewrite targeted the existing `api` alias rather than the runtime override. A
dedicated restore/rollback network with exactly the active API on alias `api`
fixed test topology. Restarted probes returned the actual old SHA, READY, login
success and matching PDF checksum. This topology belongs in the deployment
runbook; merely changing `INTERNAL_API_ORIGIN` is not rollback proof.

The current keyboard-row smoke fails on the old Web at its newer sibling-button
selector. Mouse-open/history/close completed before that failure. Do not call
this a complete rollback UI PASS; a reviewed compatible rollback candidate and
version-matched smoke are still required.

After returning to08de2dca, exact SHA/readiness and functional UI smoke pass.
Counts plus ordered full-row JSON digests of19 finance/lifecycle tables are
unchanged across both switches; combined SHA256:
`89f3e53eb8a43778a2ac95f566ba10c7707de87d126ec112be69d48cd5e15ff5`.
User/session/audit changes are outside that19-table comparison. Some tables
are empty (CreditNote/BillingSnapshot/MonthlySettlementRun); this does not prove
rollback of those populated business scenarios.

## Open gates and next actions

1. Keep the guarded cleaning and canonical journey evidence above. The turnover
   guard has independent Sol High `PASS_WITH_FINDINGS`; activation-race coverage
   is still untested and the journey remains mocked, so staging/UAT evidence is
   still required.
2. Close visual baseline review, mobile/device/WebKit and remaining real-money
   scenarios/11 operational images, then the full release gate on exact SHA.
3. Owner initially selected a second NAS/server, then clarified that only the
   existing NAS is available. With explicit folder-creation authorization, created
   the empty `/docker/homeland-backups` directory through the logged-in DSM File
   Station and verified the listing. Screenshot:
   `testing/staging-20261012/nas-backup-folder/created.jpg`.
   No upload, mount, permission, tunnel, container or database change occurred.
   Read-only Container Manager inventory shows two existing containers
   (`cloudflared`, `mediaslution-web`), no projects and no Homeland stack.
   Neither container was changed. Inventory screenshot retained beside the
   folder screenshot; host volume path has not been established from DSM.
   This is same-NAS storage, not off-host durability; RAID does not satisfy BKP-01.
   Encryption/snapshots, separate restore permissions, automatic copy/receipt,
   retention and an independent recovery copy remain unverified. Do not delete
   backups or treat the clarified destination as a release-gate waiver.
4. Select compatible rollback images and complete version-matched UI smoke.
5. Fresh immutable HEAD build and remote GitHub CI are still open. Latest
   inspected remote run37108771515 failed before jobs on older SHA989f8521;
   it is not evidence for the current local SHA. No push/tag/publication yet.
6. NAS staging binding, production-secret rotation, historical incident/data
   reconciliation, monitoring/fire/resolved alerts and OPS/FIN/OWNER acceptance
   remain open. Real Hunonic remains owner-deferred. Do not open production or
   run production migration/provider transactions before these gates/approval.

Artifacts: `testing/staging-20261012/` in this repository. Initial CORE-10.04
artifacts also exist at `D:/homeland-new/testing/staging-20261012/core1004-loopback`
outside this repository; they were retained. Restore DB/volumes and old stopped
image containers are retained. No user data or backup bundle was deleted.
