# Customer Runtime Gap Report

> **DISCOVER Phase Analysis**
> Version: 1.0 | Date: 2026-07-08

---

## 1. Goal
Evaluate the readiness of the Customer module for Business Flow 3 (Customer Registration).

## 2. API Readiness (Backend)
- ✅ `CustomersController` implements full CRUD (`GET`, `POST`, `PATCH`, `DELETE`).
- ✅ `CustomersService` implements business logic and pagination.
- ✅ `CreateCustomerSchema` & `UpdateCustomerSchema` defined in `@homeland/shared`.
- ✅ Mutations for React Query are implemented in `customers.mutations.ts` (`useCreateCustomerMutation`, `useUpdateCustomerMutation`, `useDeleteCustomerMutation`).

## 3. UI Readiness (Frontend)
- ✅ `TenantsPage` (`/tenants`) exists and displays KPI, Insights, Filters, and Grid.
- ✅ `TenantGrid`, `TenantCard`, and `TenantDetailDrawer` successfully read and display customer data.
- ❌ **GAP:** No UI component exists to create a new customer.
- ❌ **GAP:** No UI component exists to edit an existing customer.
- ❌ **GAP:** No UI component exists to delete a customer.
- ❌ **GAP:** The `/tenants` page lacks an "Add Customer" button.

## 4. Root Cause for "DEV (PARTIAL)" Status
The backend and API client are fully functional, but the presentation layer is read-only. Without a Create/Edit form, Flow 3 (Customer Registration) cannot be verified end-to-end via the UI.

## 5. Implementation Plan (Next Action)
To unblock the Critical Path (Customer → Contract), we must:
1. Create `CustomerFormModal.tsx` in `apps/web/components/tenants/`.
2. Add an "Thêm khách thuê" (Add Tenant) button to `apps/web/app/tenants/page.tsx` or `TenantFilters.tsx` to trigger the form.
3. Integrate `useCreateCustomerMutation` and `useUpdateCustomerMutation` into the form.
4. Add Edit/Delete actions to `TenantCard` quick actions or `TenantDetailDrawer`.
5. Run E2E test for Flow 3.
