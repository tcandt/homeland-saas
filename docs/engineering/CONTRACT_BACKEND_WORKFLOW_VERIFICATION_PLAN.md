# Contract Backend Workflow Verification Plan

> **Objective:** Systematically verify the complete backend workflow of a contract, from `DRAFT` through to terminal states, ensuring all business logic, DB side-effects, and failure cases are rigorously tested.

## 1. Full Backend Workflow
The verification must trace and assert the two complete lifecycle paths:
- **Path A (Termination):** `DRAFT` ➔ `PENDING_APPROVAL` ➔ `APPROVED` ➔ `ACTIVE` ➔ `TERMINATED`
- **Path B (Expiry):** `DRAFT` ➔ `PENDING_APPROVAL` ➔ `APPROVED` ➔ `ACTIVE` ➔ `EXPIRED`

## 2. DB Verification
For every step of the workflow, we will verify the following invariants in the database:
- **Contract Status:** Updates accurately after each command.
- **Room Status:**
  - `AVAILABLE` before approval.
  - `RESERVED` after `approve`.
  - `OCCUPIED` after `activate`.
  - `CLEANING` after `terminate` or `expire`.
- **Deposit Lifecycle:**
  - Deposit record created in `DRAFT` state upon `approve`.
  - Deposit state changed to `CONVERTED_TO_CONTRACT` upon `activate` (assuming it was `PAID`).
- **Invoice Lifecycle:**
  - Initial `ISSUED` rent invoice created upon `activate`.
  - Final `DRAFT` invoice created upon `terminate` or `expire`.
- **Audit Logs:**
  - Ensure an `AuditLog` entry with `action: UPDATE`, the `entityId`, and correct `before`/`after` states is recorded for every command execution.

## 3. Failure Matrix
We must execute and verify that the system correctly rejects the following invalid operations with the appropriate HTTP exceptions (`BadRequestException`, `ConflictException`):
- Submit a contract that is not in `DRAFT`.
- Approve a contract that is not in `PENDING_APPROVAL`.
- Approve a contract when the Room is not `AVAILABLE` (e.g., `OCCUPIED`).
- Activate a contract when the associated Deposit is missing or not `PAID`.
- Activate a contract when the Room is not `RESERVED`.
- Terminate a contract that is not `ACTIVE` or `EXPIRING`.
- Expire a contract that is not `ACTIVE` or `EXPIRING`.
- Prevent any transition out of terminal states (`TERMINATED`, `EXPIRED`).

## 4. Evidence Package
Before declaring the backend workflow VERIFIED, the following artifacts must be captured or reviewed:
- **Unit Test Output:** Logs showing all `contracts.service.spec.ts` tests passing.
- **Integration/E2E Test Output:** (If applicable) API-level checks passing.
- **DB Snapshots:** `db-before.json` and `db-after.json` (or similar verification logs) showing state mutation.
- **Audit Verification:** Logs proving audit records were injected into the DB.
- **Status Transition Table:** Summary of all transitions that were checked.

## 5. Commands to Run
The fundamental verification gates:
```bash
npm run build --workspace=api
npm run test --workspace=api
```

## 6. Exit Criteria
The **Backend Workflow** is considered **VERIFIED** only when:
- All commands execute flawlessly in the correct sequence.
- All failure paths correctly reject state mutations.
- The DB accurately reflects all required side-effects (Room, Deposit, Invoice, Audit).
- Test outputs and evidence artifacts confirm total compliance.
