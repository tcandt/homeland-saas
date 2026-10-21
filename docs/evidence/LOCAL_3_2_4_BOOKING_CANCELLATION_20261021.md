# Local 3.2.4 Booking Cancellation - 2026-10-21

Status: LOCAL VERIFIED; not committed, pushed or deployed to NAS in this task.

## Scope

- Existing booking-contract cancellation form was unreachable: no action opened it. Added a cancellation action for eligible unconverted booking contracts, including expired holds.
- Reasons: customer not continuing, booking agreement expired, customer refund request, other (requires a note).
- Admin explicitly chooses no refund, partial refund or full refund. No automatic forfeiture on expiry and no default refund decision.
- Opening fetches canonical deposit detail and ledger balance. Partial refund automatically retains the remainder; deductions remain zero for this workflow. Nominal contract deposit is not used as refundable balance.
- Existing CORE cancellation API remains authoritative: transaction locks, fresh balance validation, allocation ledger, hold release, pending/completed refund and idempotent replay. No backend/migration changes.
- Pending refund is not marked paid. Completed refund requires proof. In-flight submission guarded and unchanged payload retries reuse one idempotency key.
- Active, converted, terminal cancelled, unrelated type/contract/cycle and reconciliation-error cases are closed in UI eligibility. Existing server authorization remains required.

## Evidence

- Independent Sol High affected financial review PASS.
- Web focused unit tests: 78/78 across cancellation helper and two related suites.
- Existing API deposit policy/core tests: 59/59. Web and API typechecks PASS.
- Actual local browser: six cases at1440px/390px for none/partial/full allocation. Canonical balance800000 deliberately differs from nominal1000000; payload amounts match canonical balance.
- Browser additionally verifies invalid partial allocation and completed refund without proof issue no cancellation command; first500 then retry retains the same idempotency key. No page errors or horizontal overflow. Mobile screenshot visually inspected.
- Screenshots: `test-results/booking-cancellation-324/`; harness: `testing/booking-cancellation.browser.cjs`. Feature APIs mocked; no real money or provider call.
- Version bumped to3.2.4. Local Web remains http://localhost:3015; NAS remains3.2.3.

## Limits

- Existing shared `usePermissions` hook is permissive. This task did not refactor global RBAC; UI visibility is not a security boundary. Readonly-role UI behavior is not verified; server endpoint guards remain the authority.
- No real customer cancellation/refund, production database mutation, Zalo delivery or NAS deployment performed. Unrelated dirty changes preserved.
