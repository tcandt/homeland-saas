# Contract Workflow Stage 2: Activation Plan

> **Objective:** Define the business logic, side effects, and dependencies for the `Activate` command.
> **Status:** IMPLEMENTED ✅

## Scope
- Implement the `activate` command (`POST /api/v1/contracts/:id/activate`).
- Ensure the state transitions from `APPROVED` to `ACTIVE`.
- Implement Room occupancy update (`RESERVED` ➔ `OCCUPIED`).
- Implement the Deposit payment dependency check.
- Handle initial invoice generation logic.
- Ensure all actions are wrapped in a DB transaction with proper Audit logging.

## Resolved Questions

1. **What deposit status means "paid"?**
   - A Deposit is considered paid if its status is `PAID` or `CONVERTED_TO_CONTRACT`. The `Activate` command will convert the `PAID` deposit to `CONVERTED_TO_CONTRACT`.
2. **Does Activate create first rent invoice immediately or only schedule it?**
   - The `Activate` command creates the initial rent invoice *immediately* (status `ISSUED` or `DRAFT` depending on business configuration, default to `ISSUED`) so that it is ready for payment.
3. **What happens if room is not RESERVED?**
   - The `Activate` command will fail with a `409 Conflict` (e.g., if it somehow became `MAINTENANCE`). It *must* be `RESERVED` as set during the `Approve` stage.
4. **What happens if deposit missing?**
   - If the `Deposit` record is not found or is in `DRAFT`/`PENDING` status, the `Activate` command will fail with a `400 Bad Request`.
5. **What happens if deposit partially paid?**
   - The `DepositStatus` enum only supports `PENDING` and `PAID`. A partial payment does not change the status to `PAID`. Therefore, if it is not explicitly `PAID`, activation fails (`400 Bad Request`).
6. **Who can activate?**
   - `MANAGER`, `ADMIN`, and `FINANCE` roles.

## DB Verification Rules & Failure Cases
- **Transaction:** `Contract` update, `Room` update, `Deposit` update, and `Invoice` creation MUST happen within a single Prisma `$transaction`.
- **Failure:** If any side-effect fails, the transaction rolls back, leaving the contract `APPROVED`.
- **Guard:** Reject `Activate` if `Contract.status !== APPROVED`.

## Test Plan
- **Unit/Integration Test 1:** Successfully activate an `APPROVED` contract with a `PAID` deposit, verifying `Room` is `OCCUPIED`, `Deposit` is `CONVERTED_TO_CONTRACT`, and initial `Invoice` is created.
- **Unit/Integration Test 2:** Fail to activate if `Contract` is not `APPROVED`.
- **Unit/Integration Test 3:** Fail to activate if `Deposit` is missing or not `PAID`.
- **Unit/Integration Test 4:** Fail to activate if `Room` is not `RESERVED`.

## Commit Budget
The implementation will be confined to one specific commit:
**Commit:** `feat(contract): implement activate command and deposit dependency`
