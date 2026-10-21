# Local 3.2.5 Zalo QR Notification Scope - 2026-10-21

Status: LOCAL VERIFIED; no commit, push or NAS deployment in this task.

## Cause And Scope

- Reported screenshots show an unpaid QR for room31-06 followed by a payment receipt for room31-02. Code inspection found that sending an invoice QR invoked an unscoped outbox drain, releasing unrelated historical events. This is an identified causal path, not proof that production recorded a payment against the new invoice; production records were not inspected.
- QR-triggered immediate processing now selects only unpublished invoice issue/payment events for the exact tenant and invoice. Both bounded drain passes receive those event IDs; no matching events means no drain. Lookup failure leaves delivery recoverable without falling back to a global drain.
- Actual same-invoice committed payment events can still follow QR delivery. Existing publisher issue-before-payment ordering, scoped stale-claim recovery and financial write paths remain unchanged. Existing webhook/background retry behavior is unchanged.
- Admin workflow messages use room code without building name. Successful registration Admin message also omits the building. Client room/building labels remain unchanged.
- Pending booking deposit creation says request created / waiting for collection, not payment received. Admin booking dates use one hold-expiry field when both dates fall on the same Asia/Bangkok calendar day; distinct dates remain visible.
- Version incremented from local3.2.4 to3.2.5, preserving prior cancellation work and unrelated dirty changes.

## Verification

- Independent Sol High review: PASS.
- Test gate:121/121 across payments.service, workflow.engine, zalo-registration.service, template.engine and deposit-outbox.publisher suites.
- Regression assertions cover exact tenant/invoice/event selection, both scoped passes after QR, empty/error lookup with no global fallback, Admin room-only/client label preservation, same-day dedupe/distinct dates, pending wording and no payment receipt from registration.
- API typecheck and affected diff whitespace checks: PASS.

## Limits

- No production database change, real payment/refund, provider message, historical backlog replay, commit/push or NAS deployment performed. NAS remains3.2.3; actual provider delivery is unverified.
- Local Web remains http://localhost:3015. Backend-focused change; no new browser acceptance claimed.
