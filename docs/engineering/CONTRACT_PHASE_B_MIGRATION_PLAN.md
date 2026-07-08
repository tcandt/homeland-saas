# Contract Phase B Migration Plan

> **Objective:** Safely migrate legacy `ENDED` contracts to their correct FSM state (`EXPIRED` or `TERMINATED`) while ensuring zero downtime and 100% backward compatibility for existing UI, API clients, Reports, and Invoices.
> **Date:** 2026-07-08
> **Status:** Planning

---

## 1. Legacy Data Analysis

Currently, the Prisma `ContractStatus` enum was expanded in Phase A to include new states, but legacy data uses the `ENDED` status.

- **Status Distribution Check:** We must count contracts grouped by status before migration.
- **Target rows to migrate:** Count total `ENDED` rows.
- **Safe Mapping Logic:**
  - **Rule 1:** If `status` = `ENDED` AND `endDate` < `now()` → Map to `EXPIRED`.
  - **Rule 2:** If `status` = `ENDED` AND (`endDate` >= `now()` OR `endDate` is NULL) → Map to `TERMINATED` (unless audit logs prove otherwise).
- **Documented Uncertainty:** We assume an early termination if the `endDate` hasn't passed yet but the contract is `ENDED`. This is a best-effort deterministic mapping.

---

## 2. Migration SQL Plan

- **Backup Requirement:** A database snapshot MUST be taken prior to running the UPDATE script in production.
- **SQL Update Strategy:**
  ```sql
  -- Step 1: Migrate naturally expired contracts
  UPDATE "Contract" 
  SET status = 'EXPIRED' 
  WHERE status = 'ENDED' AND "endDate" < NOW();

  -- Step 2: Migrate manually terminated contracts
  UPDATE "Contract" 
  SET status = 'TERMINATED' 
  WHERE status = 'ENDED';
  ```
- **Before/After Verification:**
  - `SELECT COUNT(*) FROM "Contract" WHERE status = 'ENDED';` (must equal 0 after migration)
  - Verify total count of `EXPIRED` + `TERMINATED` matches pre-migration `ENDED` count.
- **Forward-Fix Rollback Strategy:** If mapping proves incorrect (e.g. `EXPIRED` should have been `TERMINATED`), a forward-fix script reading from Audit Logs will be applied rather than rolling back the entire schema.

---

## 3. Code Rollout Plan

- **Backend Read Compatibility:** The backend API and Prisma schema will temporarily retain `ENDED` in the enum to safely accept reads/writes from outdated clients during the rollout window.
- **API Response Normalization Policy:** The Controller/Service will NOT actively intercept and modify `EXPIRED`/`TERMINATED` back to `ENDED` for `GET /contracts`. Instead, the UI must gracefully adapt.
- **UI Adapter Strategy:** The Frontend `OperationsContractRow.tsx` and Filters will be updated to accept and display `EXPIRED` and `TERMINATED`, while safely mapping `ENDED` to "Đã chấm dứt (cũ)" if it still appears in local cache.
- **Cross-Domain Compatibility:**
  - `InvoicesService`, `DashboardService`, and Reports currently query by `contractId` or active date overlaps, avoiding direct dependency on the `ENDED` string literal. We must verify this remains true.

---

## 4. Test Plan

- **Unit Tests for Mapping:** Add unit tests to the adapter logic verifying date-based state transitions.
- **Integration Test for Legacy Read:** Simulate fetching a legacy `ENDED` record and ensure the API successfully returns it without throwing Zod errors (resolved in Phase A via DTO expansion).
- **Migration Verification Test:** Run `db-before.json` / `db-after.json` snapshot diff in E2E.
- **Contracts List Verification:** Ensure the UI list correctly displays mixed statuses.
- **Invoice/Report/Dashboard Verification:** Ensure KPIs do not artificially drop or spike post-migration.

---

## 5. Risk Matrix

| Component | Risk Level | Mitigation |
|-----------|------------|------------|
| **Seed Scripts** | Medium | Update seed to generate `EXPIRED`/`TERMINATED` natively. |
| **Reports** | Low | Reports aggregate by `startDate`/`endDate`, not status. |
| **Dashboard Filters** | Medium | Update `OperationsContractRow` and Dashboard KPIs to include new terminal states. |
| **Invoices** | Low | Invoices trigger off `ACTIVE` states and `monthlyRent`. |
| **Documents** | Low | Document PDFs are generated on `DRAFT`/`PENDING_APPROVAL`, not terminal states. |
| **E2E Dataset** | High | `PRODUCTION_DATASET.md` must be updated to cover `EXPIRED` and `TERMINATED` traces. |

---

## 6. Commit Budget

1. `feat(contract): UI adapters and read-compatibility for legacy ENDED`
2. `chore(contract): SQL migration to convert ENDED to EXPIRED/TERMINATED`
3. `test(contract): verify mixed legacy/new state rendering in UI/API`

*(Note: API approve/terminate endpoints are explicitly NOT included in Phase B)*

---

## 7. Stop Condition

Phase B is considered complete ONLY when:
- **0 `ENDED` rows remain in the database.**
- **Old UI/cache still safely reads contracts without crashing.**
- **New FSM statuses (`EXPIRED`, `TERMINATED`) work and render correctly.**
- **No invoice, report, or dashboard regressions are detected.**
- **The migration has a documented rollback/forward-fix path.**
