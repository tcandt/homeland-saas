# Contract Phase B4: Verification Plan

> **Objective:** Perform end-to-end verification of the contract system to ensure that legacy `ENDED` status compatibility is functional and new FSM statuses (`EXPIRED`, `TERMINATED`) work seamlessly across the stack.
> **Date:** 2026-07-08
> **Status:** Phase B4 Completed. Ready for Phase C.

---

## 1. Scope of Verification

This phase is strictly for **Verification and Validation (V&V)**. 
**No production data migration** or **new feature implementations** (e.g., Approve/Terminate endpoints) are permitted during this phase.

### Areas to Verify
- **Database Level:** Confirm that `ENDED` data migration (from Phase B1) handles edge cases correctly on a staging environment or local replica.
- **Backend API Level:** Validate that all backend modules (Contracts, Rooms, Metrics, Dashboard, Customers) process legacy `ENDED` correctly and that API endpoints accept and return the correct mapped statuses.
- **Frontend UI Level:** Ensure that `EXPIRED` and `TERMINATED` render appropriately on the frontend (Badges, Lists, Drawers) and that `ENDED` is gracefully displayed.
- **Integration Level:** Run automated end-to-end tests to verify cross-module workflows (e.g., invoicing and reporting) are unaffected by the expanded enums.

## 2. Verification Steps

### Step 1: Automated Test Suite Execution
- **Backend:** Run unit and integration tests (`npm run test --workspace=api`).
- **Frontend:** Run component tests (if applicable) and type checking (`npm run typecheck --workspace=web`).
- **E2E:** Execute end-to-end test suites covering contract lifecycle scenarios.

### Step 2: API Contract Validation
- Trigger simulated legacy API requests sending `ENDED`.
- Verify the backend normalizes the status and processes the request successfully.
- Verify API responses properly reflect `EXPIRED` or `TERMINATED` for previously `ENDED` contracts depending on their end dates.

### Step 3: UI Rendering Validation
- Open the UI against the local or staging environment.
- Verify that contracts in `EXPIRED` and `TERMINATED` states are displayed with correct visual badges (`neutral` and `error` respectively).
- Confirm legacy `ENDED` contracts (if any remain) are displayed using the fallback legacy badge (`Đã kết thúc (cũ)`).
- Verify that terminal states appropriately hide active action buttons (e.g., "Gia hạn", "Chấm dứt") in the `OperationsContractDrawer` and `OperationsContractRow`.

## 3. Rollout Criteria

Phase B4 will be considered **COMPLETED** and Phase C can begin when:
- All automated tests pass with no regressions.
- Manual UI validation is successful.
- No new `ENDED` statuses can be created via the backend or frontend.
- The system is deemed stable for the final legacy status deprecation (Phase C).

## 4. Required Evidence
- Test execution output logs.
- Screenshots of UI rendering terminal states (`EXPIRED`, `TERMINATED`).
- API response snippets confirming status normalization.
