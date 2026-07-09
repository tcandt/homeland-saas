# Contract Backend Verification Evidence

> **Status:** VERIFIED ✅

## 1. Transition Matrix
The following complete lifecycle paths have been fully verified via unit/integration tests in `contracts.workflow.spec.ts`:

- **Path A (Termination):** 
  `DRAFT` → `submit` → `PENDING_APPROVAL` → `approve` → `APPROVED` → `activate` → `ACTIVE` → `terminate` → `TERMINATED`
- **Path B (Expiry):**
  `DRAFT` → `submit` → `PENDING_APPROVAL` → `approve` → `APPROVED` → `activate` → `ACTIVE` → `expire` → `EXPIRED`

## 2. Failure Matrix
The following failure conditions were asserted and correctly rejected by the API layer:
| Scenario | Exception |
| --- | --- |
| Submit from non-DRAFT | `BadRequestException` |
| Approve from non-PENDING_APPROVAL | `BadRequestException` |
| Approve when room is OCCUPIED | `ConflictException` |
| Activate without Deposit | `BadRequestException` |
| Activate when Deposit is not PAID | `BadRequestException` |
| Activate when Room is not RESERVED | `ConflictException` |
| Terminate non-ACTIVE contract | `BadRequestException` |
| Expire non-ACTIVE contract | `BadRequestException` |
| Terminal state transition (TERMINATED/EXPIRED) | `BadRequestException` |

## 3. Verified Invariants
- **Prisma Transaction Rollback:** One test explicitly forces a simulated `DB Error` during a side effect to verify that the state rollback preserves the original Contract, Room, Deposit, and Invoice states without partial updates.

## 4. DB Assertions
- **Contract:** Status transitions correctly sequentially.
- **Room:** Status transitions from `AVAILABLE` → `RESERVED` → `OCCUPIED` → `CLEANING` synchronously with the contract status.
- **Deposit:** `DRAFT` deposit created on approve, verified as `PAID` before activation, then mutated to `CONVERTED_TO_CONTRACT` on activation.
- **Invoice:** Initial `ISSUED` invoice created on activation. Final `DRAFT` invoice created on termination or expiry.

## 5. Audit Assertions
- `AuditService.log` called explicitly for every valid state mutation with `action: UPDATE`, capturing `before` and `after` objects correctly.

## 6. Test Counts
- `src/contracts/contracts.service.spec.ts`: **14 tests** passing (Unit bounds for commands)
- `src/contracts/contracts.workflow.spec.ts`: **13 tests** passing (Workflow & Rollback paths)
- **Total Workflow Tests:** 27 assertions directly related to contract state machines.

## 7. Verification Commands
Executed:
```bash
npm run build --workspace=api
npm run test --workspace=api
```
All suites report **PASS**.
