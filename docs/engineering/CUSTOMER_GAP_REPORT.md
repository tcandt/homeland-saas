# Customer (Tenant) Gap Report

## 1. Domain Discrepancy (Terminology)
- **Frontend**: The UI uses the term "Khách thuê" and maps it to the `Tenants` module (`apps/web/app/tenants`).
- **Backend & Database**: The business entity is modeled as `Customer` (`apps/api/src/customers` and `packages/database/prisma/schema.prisma`). "TenantOrg" is used for B2B multi-tenant logic.
- **Action**: We will maintain the term `Customer` for backend/DB and `Tenant` for frontend, but document this mapping clearly.

## 2. API Status Filtering Bug
- **Issue**: The frontend `TenantFilters` component sends a `status` query parameter to filter customers (e.g., "Đang thuê", "Đã trả phòng", "Đang nợ"). The backend `CustomersService` attempts to apply this directly to the database: `where.status = status;`.
- **Root Cause**: The `Customer` Prisma model **does not have a `status` field**. This will cause a Prisma exception (500 Internal Server Error) whenever a user filters by status.
- **Fix Required**: 
  - The status of a "Khách thuê" (Customer) must be derived dynamically or stored based on their relations:
    - **ACTIVE** (Đang thuê): Has at least one `Contract` with status `ACTIVE`.
    - **INACTIVE** (Đã trả phòng): Has `Contract` with status `ENDED` or `CANCELLED` and no `ACTIVE` contracts.
    - **DEBT** (Đang nợ): Has an `Invoice` with status `OVERDUE` or unpaid balance.
  - Modify `CustomersService.listCustomers` to correctly interpret the `status` string and map it to Prisma relation filters (`contracts.some`, etc.).

## 3. Missing API Tests
- **Issue**: `apps/api/src/customers` has `0` tests.
- **Action**: Create `customers.controller.spec.ts` and `customers.service.spec.ts` to verify filtering logic and CRUD operations.

## 4. Frontend Integration
- **Issue**: Need to ensure the `useCustomersQuery` mapping correctly matches the dynamic status values expected by the backend.
- **Action**: Inspect `TenantFilters.tsx` to align the status enum strings.

## Execution Plan
1. Update `CustomersService.listCustomers` to implement relation-based status filtering.
2. Verify `TenantFilters.tsx` status enums.
3. Add Unit Tests for `CustomersService` and `CustomersController`.
4. Run Local E2E tests for `tenants`.
