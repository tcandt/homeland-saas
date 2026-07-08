# Contract Workflow Decisions

> **Objective:** Lock the business invariants and command model for the Contract Aggregate Workflow before beginning implementation.
> **Status:** APPROVED

## 1. Accepted Invariants
1. **Room Locking:** 
   - When Contract is `APPROVED` ➔ `Room.status` becomes `RESERVED`.
   - When Contract is `ACTIVE` ➔ `Room.status` becomes `OCCUPIED`.
2. **Deposit Handling:** 
   - A Deposit schedule is created when the Contract becomes `APPROVED`.
   - A Contract can only transition to `ACTIVE` after the associated Deposit is fully `PAID` (or converted).
3. **Immutability:** Contract status can only be modified via explicit Command endpoints. Direct `PATCH /contracts/:id` updates to the `status` field are strictly forbidden.

## 2. State Transition Table

| Current State | Command | Next State | Condition |
| --- | --- | --- | --- |
| `DRAFT` | `Submit` | `PENDING_APPROVAL` | All required fields present |
| `PENDING_APPROVAL` | `Approve` | `APPROVED` | Valid permissions, Room is AVAILABLE |
| `APPROVED` | `Activate` | `ACTIVE` | Deposit is PAID, Room is RESERVED |
| `ACTIVE` | `Terminate` | `TERMINATED` | Manual termination action |
| `ACTIVE` | `Expire` (Cron) | `EXPIRED` | System clock > End Date |

## 3. Command Endpoints

- `POST /api/v1/contracts/:id/submit`
- `POST /api/v1/contracts/:id/approve`
- `POST /api/v1/contracts/:id/activate`
- `POST /api/v1/contracts/:id/terminate`
- `POST /api/v1/contracts/:id/expire`

## 4. Side Effects per Event

| Event | Side Effects |
| --- | --- |
| `ContractSubmitted` | Emit audit event. |
| `ContractApproved` | Update `Room` to `RESERVED`. Create `Deposit` draft. Emit audit event. |
| `ContractActivated` | Update `Room` to `OCCUPIED`. Convert Deposit to `CONVERTED_TO_CONTRACT`. Create initial `Invoice`. Emit audit event. |
| `ContractTerminated` | Update `Room` to `AVAILABLE`/`CLEANING`. Generate final `Invoice` / Settle Deposit. Emit audit event. |
| `ContractExpired` | Update `Room` to `AVAILABLE`. Settle Deposit. Emit audit event. |

## 5. RBAC per Command

| Command | Authorized Roles |
| --- | --- |
| `Submit` | `SALES`, `MANAGER`, `ADMIN` |
| `Approve` | `MANAGER`, `ADMIN` |
| `Activate` | `MANAGER`, `ADMIN`, `FINANCE` |
| `Terminate` | `MANAGER`, `ADMIN` |
| `Expire` | `SYSTEM` (Internal CRON) |

## 6. Failure Matrix

| Scenario | Handled By | Expected Result |
| --- | --- | --- |
| Approve fails because Room is already OCCUPIED | Command Guard | 409 Conflict. Contract remains `PENDING_APPROVAL`. |
| Activate fails because Deposit is not PAID | Command Guard | 400 Bad Request. Contract remains `APPROVED`. |
| DB transaction fails during Activate side-effects | Prisma Transaction | Full Rollback. Room, Deposit, Invoice, and Contract states are reverted. |

## 7. DB Verification Rules
- Use Prisma `$transaction` for all aggregate command updates.
- If `Contract.status` = `ACTIVE`, there MUST be an associated `Deposit` (unless explicitly waived) and `Room.status` MUST be `OCCUPIED`.
- If `Contract.status` = `APPROVED`, `Room.status` MUST be `RESERVED`.

## 8. Audit Requirements
- All FSM transitions must generate an `AuditLog` entry.
- The `AuditLog` must capture `userId`, `action` (e.g., `APPROVE_CONTRACT`), `before` state, and `after` state of the contract and associated side-effects.

## 9. E2E Business Scenario
**Flow 4 Verification Matrix:**
1. Create Customer
2. Create Contract (DRAFT)
3. Submit Contract (PENDING_APPROVAL)
4. Approve Contract (APPROVED) ➔ Verify Room is RESERVED & Deposit generated
5. Pay Deposit (PAID)
6. Activate Contract (ACTIVE) ➔ Verify Room is OCCUPIED & Rent Invoice generated
7. Pay Rent Invoice
8. Terminate Contract ➔ Verify Room released

## 10. Commit Budget
The implementation must be strictly staged.
**Stage 1 Commit:** `feat(contract): implement submit and approve commands`
*(Scope strictly limited to Submit/Approve, Room reservation, Deposit creation, Audit logs, and unit/integration tests).*
