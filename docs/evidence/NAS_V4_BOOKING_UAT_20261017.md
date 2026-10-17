# NAS v4 booking cash UAT — 17/10/2026

Status: **BLOCKED / LIVE NO-GO**. Interactive staging UAT found a financial workflow defect. This is not a full A–Z PASS or a deployment record for the local fix.

## Scope and identity

- Public staging: `https://homeland.ductinh.one`, isolated v4 origin NAS loopback3002.
- Serving version: `3.1.1-rc.e1decc81`; source `e1decc81045114db20e09718fcb465349aa012f9`.
- Local HEAD before fixes: `213ea2296464437d973533a021e1addabba9abee`; its CI38856526235 PASS does **not** cover this new working-tree patch or relabel the serving images.
- Only synthetic data was created. Provider delivery remains disabled. No real payment, production data repair, migration, volume deletion or production traffic change was performed.

## Synthetic journey and retained identifiers

| Record | Identifier |
|---|---|
| Room | LK01-31 / PN31-04 |
| Customer | `UAT-NAS-20261017-Deposit` / `cmvbvii6e001holti7m7q4d4m` |
| Booking contract | `HD-COC-DMEC657S-83FE55A8` / `cmvbviihj001nolti7auxawq2` |
| Deposit | `DC-GP-HD-COC-DMEC657S-83FE55A8` / `cmvbviikw001soltigut00wv7` |
| Invoice | `INV-COC-HD-COC-DMEC657S-83FE55A8` / `cmvbviioy0024oltiw456p1mr` |

1. Created customer + booking hold from room popup. Booking amount1,000,000 VND; monthly rent3,000,000; future security requirement3,000,000; expected move-in17/10/2026.
2. Customer, booking contract and one invoice were persisted. QR creation was unavailable; invoice detail correctly showed no configured receiving bank account. No bank/provider configuration was changed.
3. Invoice initially showed unpaid1,000,000, paid0; room changed to reserved/booking, not occupied.
4. Recorded synthetic cash400,000. Detail showed partial payment; room debt became600,000 and rental-cycle payment history showed confirmed cash400,000.
5. Attempted600,001 against remaining600,000. Server rejected with remaining-balance validation; no success notification was shown. Error text was English (localization issue).
6. Recorded exactly600,000. Invoice detail and main invoice page showed paid1,000,000, remaining0, fully paid; further collection controls disabled. Audit showed PARTIALLY_PAID→PAID, one600,000 MANUAL payment ID `cmvbvkiyk002ooltie43fl05s` and distinct cash reference.
7. Deposit list/detail still showed PENDING / received0 and enabled **Thu tiền cọc**. Conversion remained waiting for deposit collection. This extra collection was **not** attempted; retain the inconsistent fixture for diagnosis.

## Findings and disposition

| ID | Finding | Status |
|---|---|---|
| V4-UAT-01 / release blocker | Invoice cash settlement bypasses booking deposit collection: invoice PAID but Deposit/Pending and ledger0; potential second direct collection. | Local canonical transaction patch reviewed PASS_WITH_FINDINGS; isolated real-PG gate9/9 PASS. Target legacy inventory, immutable CI/rebuild/NAS retest pending. |
| V4-UAT-02 | Booking form remains on save step after persisted booking but QR failure, misleading retry action. | Local form-close/retry-copy patch; focused tests PASS; not deployed. |
| V4-UAT-03 | Room invoice row says unpaid after partial400,000; detail activity also says no payment despite receipt. | Local canonical payment-label/partial activity patch; focused tests PASS; not deployed. |
| V4-UAT-04 / OPEN | Unified transaction history has no entries for partial/final booking invoice receipts. Workflow explicitly skips booking-invoice revenue journals and expects deposit.collected. Canonical final collection should restore full-deposit journal, but partial-cash timing visibility remains unresolved. | Separate accounting scope; must not claim fixed by final-only deposit collection. |
| V4-UAT-05 / local fix | ADMIN bell shows three identical600,000 notifications, one400,000, one invoice-issued. User-scoped notifications mean this is not expected role fan-out. Audit/main totals do not establish duplicate money. | Investigator confirmed concurrent GET/unread/SSE read-path creation race. Initial review also found workflow `paymentId` versus synthesized `entityId` mismatch. Shared advisory transaction lock + exact tenant/user/type/payment identity recheck covers both writers and legacy aliases; Sol re-review PASS and independent real-PG8/8 PASS. Not deployed; existing duplicates retained. |
| V4-UAT-06 | Standalone booking invoice row is titled “Hóa đơn tiền phòng kỳ đầu”, although booking filter/detail identify it as holding deposit. | Local classification-label patch prepared; not deployed. |

Finance current GMT+7 period remained10/2026; revenue remained0, expected for a deposit liability, not earned rent. Captured browser error logs at the end of this journey were empty; this is not full network/error coverage.

## Local verification and boundaries

- Independent Web affected tests:25/25 across `rental-draft-lifecycle.test.ts` and `invoice-financials.test.ts` using Node22.23.3 from canonical Web working directory; Web typecheck PASS. Earlier24/24 on host Node24 is superseded.
- Affected Web ESLint:0 errors,9 existing warnings. No broad warning cleanup.
- Backend writer: explicit Node22.23.3 affected invoice/deposit/payment specs126/126 PASS after review finding; API typecheck PASS. Initial Sol High review BLOCK identified a present-but-incomplete marker bypass; corrected to fail closed. Independent re-review PASS_WITH_FINDINGS: target legacy inventory/recovery policy remains open.
- Independent PostgreSQL16 gate9/9 PASS: partial then full cash settlement, direct collection rejection, malformed/legacy marker paths, markerless invoice fail-closed, overflow, same-reference concurrent replay, distinct-reference final race, real collector fault rollback, tenant/deposit mismatch zero effects. Unsafe enabled URL rejected; no skipped tests in this gate. Test fixtures retained only in the dedicated local database.
- CI explicitly clones the canonically migrated disposable CI database into `homeland_booking_invoice_test` before API E2E and enables separate booking and notification real-PG steps. No CI db push or production target. Node22 workflow safety23/23 PASS; remote CI for this working-tree change has not run.
- Notification controller/service canonical focused specs59/59 PASS using Node22.23.3 from `apps/api`. An earlier repo-root invocation discovered staged source copies and is not used as focused release evidence. Duplicate in-app creation/event/queue is suppressed by shared payment identity; external-channel behavior stays in scope-preserving paths. Independent Sol re-review PASS, real-PG8/8 PASS (two clients, both creation orders, legacy identity, equal amounts/different payments, scope isolation, rollback/retry and payment ID priority), API typecheck PASS. Root moved integration-only provider suppression into the enabled suite hook so skipped imports cannot alter other tests; affected PG8/8 rerun PASS.
- Node22 affected API production modules, identity helper and integration specs ESLint PASS (zero errors/warnings). `git diff --check` PASS.
- Legacy rollout policy: markerless booking-hold invoices are intentionally rejected on full settlement; do not guess a deposit or auto-backfill. Before deployment inventory target open rows and validate exact source links, or explicitly retain a restricted/rejected legacy workflow with an owner-approved recovery procedure. The retained already-PAID inconsistent UAT fixture is separate; it is not repaired by payment-reference replay.
- New isolated local PG16 database `homeland_booking_cash_20261017_test` prepared empty with current Prisma schema for transaction tests. This is **schema db push test setup**, not release migration/checksum evidence. Shared application DBs unchanged.
- Existing already-PAID inconsistent staging records are not automatically repaired by the patch. No repair was applied.
- Screenshots retained locally: `testing/nas-uat-20261017/booking-invoice-paid.jpg`, `booking-paid-deposit-pending.jpg`, `repeated-payment-notifications.jpg` (synthetic fixture, no credentials).

CORE-10.04/.06/.07 and GATE-10 remain OPEN. Next: independent financial review → affected real-PG gate → remaining confirmed defects → immutable build/CI → staging redeploy and repeat with a new synthetic fixture. Production GO still requires owner sign-off and the remaining backup/operational/UAT gates.

## Partial-booking accounting design gate

Independent Sol High design review returned **BLOCK** for the proposed incremental collector. This is not implemented and does not invalidate the bounded full-settlement transaction tests above. Required before expanding collection:

- Each installment needs immutable payment identity and a deterministic unique journal identity; the current workflow checks `paymentId` but creates journals using the deposit/source identity, with no unique source constraint.
- Partial cancellation must use actual ledger balance, close the unpaid invoice remainder by immutable adjustment, and follow one invoice-before-deposit lock order with payment.
- Expired holds with positive partial funds need explicit reconciliation/refund/keep/deduct handling; no automatic hold recreation or later payment/conversion.
- Exact marker/open lifecycle/root invoice/no-credit checks and prior-paid/ledger equality must fail closed. Required gates include pay-versus-cancel/expiry races, installment journal retry, partial disposal and matching UI states.
