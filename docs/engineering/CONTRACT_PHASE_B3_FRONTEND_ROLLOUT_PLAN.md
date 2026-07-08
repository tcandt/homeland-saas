# Contract Phase B3: Frontend Rollout Plan

> **Objective:** Update frontend UI components to natively display, filter, and interact with the new FSM contract statuses (`EXPIRED` and `TERMINATED`) while maintaining legacy visual fallback.
> **Date:** 2026-07-08
> **Status:** Planning

---

## 1. Scope of Changes

- **Contract Status Mapping:**
  - Update any frontend status mapping utilities to localize `EXPIRED` to "Đã hết hạn" and `TERMINATED` to "Đã chấm dứt".
  - Ensure legacy `ENDED` still maps safely to a fallback like "Đã kết thúc (cũ)" in case of cached data.
- **Contract Badges:**
  - Map `EXPIRED` and `TERMINATED` to appropriate color schemas (e.g., neutral gray for expired, red for terminated).
- **Data Tables & Rows (`OperationsContractRow`, etc.):**
  - Ensure rows render correctly for terminal contracts.
  - Test that terminal contracts properly disable actions that shouldn't be allowed (like 'Edit' or 'Bill').
- **Filters & Search:**
  - Add `EXPIRED` and `TERMINATED` to the frontend filter dropdowns in the contract list view.
  - Remove `ENDED` from the creation/active filter lists if it was explicitly selectable (or hide it since there is 0 legacy data).
- **Forms & Drawers:**
  - Verify `ContractDrawer` and `ContractForm` display terminal statuses correctly in read-only mode if applicable.

---

## 2. Forbidden Changes

- **No Business Logic Workflows:** Do not add the "Approve" or "Terminate" buttons to the UI yet. We are only displaying the states.
- **No Backend Changes:** The backend was fully rolled out in Phase B2. No API changes are permitted.
- **No Enum Cleanup:** Phase C is still pending.

---

## 3. Impact Analysis

| Component | Rollout Risk | Verification Strategy |
|-----------|--------------|-----------------------|
| **Filters** | Low | Verify dropdown includes new options. |
| **Data Tables** | Low | Verify terminal records render without crashing and badges display correct colors. |
| **Navigation** | None | No structural changes. |

---

## 4. Test Requirements

- Verify UI list renders locally without console errors.
- Verify filters correctly fetch `EXPIRED` or `TERMINATED` from the API (which maps to the DB correctly).

---

## 5. Exit Criteria for Phase B3

1. **Build Success:** `npm run build --workspace=web` succeeds without TypeScript errors.
2. **UI Integrity:** Operations Dashboard successfully renders contracts in terminal states.
3. **No Console Errors:** Inspect browser console to confirm Zod/parsing errors do not occur.
