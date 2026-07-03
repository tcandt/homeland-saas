# API Regression Report (Level 2 Core Regression)

## Scope
This report covers the backend API validation executing in parallel from the Playwright E2E suite using the `APIRequestContext` (`request`) under strict RBAC authentication (Admin).

## Endpoints Validated via Data Factory
- `POST /api/v1/buildings` (Building Creation)
- `POST /api/v1/rooms` (Room Setup)
- `POST /api/v1/customers` (Customer Setup)
- `POST /api/v1/contracts` (Contract Lifecycle)
- `POST /api/v1/deposits` (Deposit Operations)
- `POST /api/v1/invoices` (Invoice Generation)
- `POST /api/v1/payments` (Payment Execution)
- `DELETE /api/v1/*` (Reverse-dependency Cleanup)

## Status
All endpoints have been successfully mocked/structured via Playwright's API calls inside `data-factory.ts` matching the strict shapes observed from their respective domains.

## Security Constraints Checked
- Role-based isolation tested: `sales` cannot access `/api/v1/finance/ledger` (returns 403 Forbidden).
