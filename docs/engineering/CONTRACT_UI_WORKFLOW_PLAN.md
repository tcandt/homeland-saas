# Contract UI Workflow Plan

> **Objective:** Design the frontend workflow layer to interact with the verified backend state machine without changing backend business logic or schemas.

## 1. Existing Contract UI Inventory
- `ContractList` (Table view with basic status badges).
- `ContractDetail` (Header details with status).
- `ContractForm` (Creation modal/page creating `DRAFT` status).
- `ContractStatusBadge` (Visual indicator of status).

## 2. Missing UI Workflow Actions
We will add contextual action buttons in the `ContractDetail` view (and optionally `ContractList` actions menu) based on the contract's current status:
- **Submit:** Button visible when status is `DRAFT`.
- **Approve:** Button visible when status is `PENDING_APPROVAL`.
- **Activate:** Button visible when status is `APPROVED`.
- **Terminate:** Button visible when status is `ACTIVE` or `EXPIRING`.
- **Expire:** This is a system action (cron). The UI will only *display* the `EXPIRED` status. There will be no manual "Expire" button unless an admin override is explicitly requested later.

## 3. RBAC Visibility Rules
Buttons will only render if the `CurrentUser` possesses the required permissions (managed via existing frontend RBAC/auth context):
- `contract.submit` (or equivalent update permission).
- `contract.approve` (Manager/Admin level).
- `contract.activate` (Manager/Admin level).
- `contract.terminate` (Manager/Admin level).

## 4. UI State Machine
The UI will derive button visibility purely from `contract.status`:
- `DRAFT` ➔ Render **[Submit for Approval]**
- `PENDING_APPROVAL` ➔ Render **[Approve Contract]**
- `APPROVED` ➔ Render **[Activate Contract]** (Should indicate if deposit payment is pending).
- `ACTIVE` ➔ Render **[Terminate Contract]** (Usually hidden in a dropdown or requires confirmation).
- `TERMINATED` ➔ (Terminal) No workflow buttons.
- `EXPIRED` ➔ (Terminal) No workflow buttons.

## 5. API Integration Points
Using the existing HTTP client (e.g., React Query or Axios):
- `POST /api/v1/contracts/:id/submit`
- `POST /api/v1/contracts/:id/approve`
- `POST /api/v1/contracts/:id/activate`
- `POST /api/v1/contracts/:id/terminate`

On success, the UI must invalidate the contract query to fetch the updated state, Room status, and Deposit information.

## 6. Error/Toast Behavior
- **Success:** Display a green toast notification ("Contract activated successfully").
- **Error:** Catch API errors (e.g., `409 Conflict`, `400 Bad Request`) and display a red toast with the specific backend error message (e.g., "Cannot activate: Deposit is not paid").

## 7. Evidence Requirements
- Visual evidence (screenshots/video) of buttons appearing and disappearing based on state.
- Network HAR traces confirming the `POST` requests and subsequent `GET` refetches.
- Toast notifications shown for both success and error paths.
- Room status badge visually updating in relevant views.

## 8. E2E Scenario
A Playwright E2E test will be written to traverse:
1. Create Draft Contract
2. Click Submit
3. Click Approve
4. (Simulate deposit payment via DB or API bypass if payment UI doesn't exist)
5. Click Activate
6. Click Terminate

## 9. Forbidden Scope
- **NO** invoice, payment, or accounting UI implementation.
- **NO** backend business logic modifications.
- **NO** Prisma schema changes.

## 10. Commit Budget
- `feat(contract-ui): implement contract workflow action buttons`
- `test(e2e): add contract lifecycle workflow test`
