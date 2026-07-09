# Contract Workflow Stage 3: Termination and Expiry Plan

> **Objective:** Define the business logic, side effects, and dependencies for the `Terminate` and `Expire` commands to finalize the contract lifecycle.

## Scope
- Implement the `terminate` command (`POST /api/v1/contracts/:id/terminate`).
- Implement the `expire` command (usually triggered by a cron job).
- Ensure the state transitions from `ACTIVE` to `TERMINATED` or `EXPIRED`.
- Implement Room release policy.
- Implement final invoice generation and deposit settlement guidelines.
- Ensure all actions are wrapped in a DB transaction with proper Audit logging.

## Resolved Questions

1. **On terminate, Room becomes AVAILABLE or CLEANING?**
   - The Room becomes `CLEANING`. This enforces a maintenance/cleaning process before the room can be booked by another tenant.
2. **Is final invoice generated immediately?**
   - A final invoice is generated immediately as a `DRAFT`. This allows Finance or Management to review, add deductions (e.g., utility bills, damages), and apply deposit offsets before issuing it to the customer.
3. **How is deposit settled/refunded?**
   - The Deposit remains in `CONVERTED_TO_CONTRACT` status during the termination/expiry command. Settlement or refunding is a separate accounting action performed by Finance against the final invoice, after which the deposit may be updated to `REFUNDED` or kept as offset. The terminate command does not mutate the deposit directly.
4. **Can expired contract be terminated?**
   - No. `EXPIRED` is a terminal state. A contract cannot transition from `EXPIRED` to `TERMINATED`.
5. **Can terminated contract be reactivated?**
   - No. `TERMINATED` is a terminal state. Once terminated, a new contract must be drafted if the tenant wishes to return.
6. **Is expire command only system/cron?**
   - Yes, the `expire` command is intended to be executed systematically by a daily cron job checking for `ACTIVE` contracts where `endDate < now()`. An admin could trigger it manually via an internal API if needed for reconciliation.
7. **Who can terminate?**
   - `MANAGER`, `ADMIN`, and `FINANCE` roles.

## DB Verification Rules & Failure Cases
- **Transaction:** `Contract` update, `Room` update, and final `Invoice` creation MUST happen within a single Prisma `$transaction`.
- **Guards:** Reject `Terminate` or `Expire` if `Contract.status !== ACTIVE` (and `EXPIRING` if applicable).
- **Failure:** If any side-effect fails, the transaction rolls back, leaving the contract `ACTIVE`.

## Test Plan
- **Unit/Integration Test 1:** Successfully terminate an `ACTIVE` contract, verifying `Room` is `CLEANING` and a `DRAFT` final `Invoice` is created.
- **Unit/Integration Test 2:** Fail to terminate if `Contract` is not `ACTIVE`.
- **Unit/Integration Test 3:** Successfully expire an `ACTIVE` contract whose end date has passed, verifying `Room` is `CLEANING`.
- **Unit/Integration Test 4:** Verify terminal states (`TERMINATED`, `EXPIRED`) cannot be reactivated or re-terminated.

## Commit Budget
The implementation will be confined to one specific commit:
**Commit:** `docs(contract): plan termination and expiry commands`
