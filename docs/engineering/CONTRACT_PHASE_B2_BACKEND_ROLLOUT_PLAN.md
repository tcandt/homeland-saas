# Contract Phase B2: Backend Rollout Plan

> **Objective:** Update backend services to natively support `EXPIRED` and `TERMINATED` statuses. Ensure backwards read/write compatibility. Remove any remaining unsafe casts associated with contract status.
> **Date:** 2026-07-08
> **Status:** Phase B2 Completed. Ready for Phase B3.

---

## 1. Scope of Changes

- **Backend Read/Write Compatibility:**
  - Services must parse and handle the new FSM statuses (`PENDING_APPROVAL`, `APPROVED`, `EXPIRED`, `TERMINATED`).
  - Read queries (e.g., `findAll`, `count`) that accept status filters must support arrays/multiple statuses based on the `contracts.adapter.ts`.
- **API Response Normalization:**
  - Standardize responses to emit `ContractStatus` via the adapter to prevent crashing legacy clients.
  - If a legacy client sends `status=ENDED` as a query parameter, the backend adapter will map it to check for `ENDED`, `EXPIRED`, or `TERMINATED`.
- **Contract Status Adapter Integration:**
  - Use `normalizeContractStatus()`, `isTerminalContractStatus()`, and `isActiveLikeContractStatus()` in:
    - `contracts.service.ts`
    - `invoices.service.ts` (if applicable)
    - `dashboard.service.ts` (if applicable)
- **Remove Unsafe Casts:**
  - Audit the entire `apps/api` codebase for `as ContractStatus` or `as any` around contract status and replace them with adapter methods.
- **Contract CRUD Behavior:**
  - Ensure list, detail, and update endpoints correctly map internal state to DTO state.

---

## 2. Forbidden Changes (Strict Constraints)

- **No Frontend UI changes:** The frontend remains exactly as-is. `apps/web` must not be modified in this phase.
- **No Approve/Terminate Workflow Endpoints:** We are not building `POST /contracts/:id/approve` or `POST /contracts/:id/terminate` yet.
- **No Enum Cleanup:** Do NOT remove `ENDED` from `schema.prisma` or `ContractStatusEnum` in `@homeland/shared`.
- **No Phase C Work:** Cleanup comes later.

---

## 3. Impact Analysis

| System | Rollout Risk | Verification Strategy |
|--------|--------------|-----------------------|
| **Invoices** | High | Invoices must still generate for `ACTIVE` / `EXPIRING` contracts exactly as before. Unit tests to assert generation skips `TERMINATED`/`EXPIRED`. |
| **Reports** | Medium | Reports aggregating active rent or revenue must naturally ignore `TERMINATED` via the `isActiveLikeContractStatus` check. |
| **Documents** | Low | PDF generation focuses on draft/pending states. |
| **Dashboard** | Medium | Active contract counts must rely on the adapter to determine "active" status. |

---

## 4. Test Requirements

- **Unit Tests:**
  - Update `contracts.service.spec.ts` to assert that listing returns the correct mapped states.
  - Update `invoices.service.spec.ts` to verify billing skips terminal states correctly.
- **Integration Tests:** Ensure `GET /contracts` gracefully maps legacy filters.

---

## 5. Exit Criteria for Phase B2

1. **Test Coverage:** All unit tests in `apps/api` pass (`npm run test --workspace=api`).
2. **Build Success:** `npm run build --workspace=api` succeeds without TypeScript errors.
3. **No Unsafe Code:** No `as any` used to coerce `ContractStatus`.
4. **Adapter Compliance:** All status business logic routes through `contracts.adapter.ts`.
