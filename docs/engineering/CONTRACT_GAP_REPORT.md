# Contract Creation Gap Report

> **Objective:** Identify all gaps between the existing Contract implementation (API, DB, UI) and the requirements for the end-to-end `PRODUCTION READY` Contract lifecycle.
> **Scope:** Backend APIs, Frontend components, DB Schema, DTOs, Business flow dependencies (Customer, Room, Deposit, Invoice).

## 1. Existing Contract Backend APIs
- `GET /contracts` (List)
- `GET /contracts/:id` (Detail with Customer and Room relations)
- `POST /contracts` (Create)
- `PATCH /contracts/:id` (Update)
- `DELETE /contracts/:id` (Soft Delete)
**Gaps:**
- Validation is basic. It accepts `status` but does not enforce a strict state machine transition.
- Missing specific endpoints for lifecycle actions: `/approve`, `/terminate`, `/renew`.

## 2. Existing Contract Frontend Pages/Components
- `ContractsHeader.tsx`, `ContractsList.tsx`, `OperationsContractRow.tsx`, `OperationsContractDrawer.tsx`
**Gaps:**
- **No Create/Edit Form:** There is no UI component to actually fill out and submit a contract creation payload.
- Component structure is currently display-only (listing and drawer view).
- No integration with Room or Customer pickers for the Contract creation form.

## 3. DB Schema
```prisma
model Contract {
  id           String         @id @default(cuid())
  tenantId     String
  roomId       String
  customerId   String
  code         String
  status       ContractStatus @default(DRAFT)
  startDate    DateTime
  endDate      DateTime
  monthlyRent  Decimal        @db.Decimal(14, 2)
  depositMoney Decimal        @db.Decimal(14, 2)
  memberCount  Int            @default(1)
  // ... relations to Room, Customer, Invoice, Deposit
}

enum ContractStatus {
  DRAFT
  ACTIVE
  EXPIRING
  ENDED
  CANCELLED
}
```
**Gaps:**
- The database schema is well-defined, but it uses `ContractStatus` (`DRAFT`, `ACTIVE`, `EXPIRING`, `ENDED`, `CANCELLED`).
- There is no field for "uploaded document" or "scanned PDF URL".

## 4. DTOs
**Gaps (Mismatch!):**
- **Enum Mismatch:** `ContractStatusEnum` in `contracts.dto.ts` uses `['ACTIVE', 'EXPIRED', 'TERMINATED']`, which conflicts directly with the DB `ContractStatus` (`DRAFT`, `ACTIVE`, `EXPIRING`, `ENDED`, `CANCELLED`).
- **Field Mismatch:** DTO uses `contractCode`, `rentAmount`, `depositAmount`. DB uses `code`, `monthlyRent`, `depositMoney`. 
- The `ContractsController` manually maps these, but this creates brittle, easily broken mappings. 

## 5. Relation with Customer + Room
**Gaps:**
- A Contract requires a `customerId` and `roomId`.
- **Constraint Missing:** The system does not enforce that a Room must be `AVAILABLE` before creating an `ACTIVE` contract.
- Creating a Contract should theoretically change the Room status to `OCCUPIED` or `RENTED`, but `ContractsService` currently does not update the `Room` record.

## 6. Contract Status Lifecycle
**Gaps:**
- No strict Finite State Machine (FSM). 
- Should go `DRAFT` -> `ACTIVE` -> `EXPIRING` -> `ENDED` or `CANCELLED`.
- Need dedicated service methods to transition states rather than a generic `PATCH` that accepts any status.

## 7. Deposit Logic
**Gaps:**
- Creating a contract often requires a `Deposit` record to be created or converted.
- Currently, `depositMoney` is just a decimal field on the contract. It does not auto-generate a `Deposit` invoice/receipt.

## 8. Invoice Dependency
**Gaps:**
- Moving a contract to `ACTIVE` usually requires generating the first `Invoice` for the first month's rent.
- No background job or hook exists to generate this invoice.

## 9. PDF/Document Generation
**Gaps:**
- Missing completely. There is no flow to generate a PDF contract from a template or upload a signed scan.

## 10. RBAC
- Current endpoints use `@RequirePermissions('contract.*')`.
**Gaps:**
- Needs to be tested for Sales vs Admin roles (Sales can create DRAFT, Admin must approve to ACTIVE).

## 11. Audit Log
- The `BaseCrudService` handles generic Create/Update/Delete.
**Gaps:**
- Missing specific business audit actions (e.g., `SIGNED`, `CANCEL`, `CONVERT_CONTRACT`) which exist in the DB enum but are never called.

## 12. E2E Gaps
**Gaps:**
- No Playwright test exists for `contract-flow.e2e.spec.ts`.
- The test needs to: Create Customer -> Create Room -> Create Contract -> Approve Contract -> Check Room Status.

## 13. Production Dataset Mapping
**Gaps:**
- We need to ensure `PRODUCTION_DATASET` has pre-existing seed data for Contracts, or we must build the E2E test to scaffold everything from scratch dynamically.

---
**Conclusion:**
Before implementing the frontend UI, we MUST fix the DTO <-> Prisma enum mismatches, and establish the state transition logic for Contracts and Rooms.
