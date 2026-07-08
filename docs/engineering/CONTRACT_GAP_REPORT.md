# Contract Module Discovery & Gap Report

> **Objective:** Comprehensive discovery and gap analysis before implementing the Contract Module.
> **Scope:** Domain analysis, boundaries, state machines, events, and evidence mapping.

## 1. Business Lifecycle (Contract FSM)

The full Finite State Machine detailing states (`DRAFT` → `PENDING_APPROVAL` → `APPROVED` → `ACTIVE` → `EXPIRING` → `EXPIRED` → `TERMINATED` / `CANCELLED`), transitions, permissions, and side effects is documented separately in **[CONTRACT_FSM.md](./CONTRACT_FSM.md)**.

## 2. Event Map (Side Effects)

The Contract module is an Event Hub. The following events must be triggered sequentially during the Contract lifecycle:

```text
ContractCreated (DRAFT)
       ↓
ContractApproved (APPROVED)
       ↓
RoomOccupied (Update Room status to OCCUPIED)
       ↓
DepositGenerated (Create Deposit Record/Invoice)
       ↓
InvoiceScheduleCreated (Create first month rent Invoice)
       ↓
CustomerActivated (Update Customer status)
       ↓
AuditCreated (Log the APPROVE action)
       ↓
NotificationQueued (Notify tenant via SSE/Email)
```

## 3. Aggregate Boundary

**Contract Aggregate Root includes:**
- `Contract` (Root)
- `Signatures` (Physical or E-sign records)
- `Occupants` (List of members living in the room under this contract)
- `Terms` (Specific rules, deposit amount, monthly rent)
- `Extensions` (Contract renewals linked to this root)

**OUTSIDE the Aggregate (References only by ID):**
- `Invoice` (Independent aggregate, driven by Contract events)
- `Payment` (Independent aggregate)
- `Customer` (Independent aggregate)
- `Room` / `Deposit`

## 4. Invariants (Business Rules)

These critical rules MUST be guaranteed by the domain logic (Service layer):
- **Room Exclusivity:** A single `Room` can only have **1 ACTIVE** Contract at any given time.
- **Temporal Validity:** The `endDate` MUST be greater than `startDate`.
- **Financial Constraint:** `depositMoney` MUST be `>= 0`.
- **Relational Integrity:** The associated `Customer` MUST exist and not be soft-deleted.
- **Room Status:** To create an `ACTIVE` or `APPROVED` contract, the `Room` MUST be `AVAILABLE`.

## 5. Failure Matrix

Expected error handling during operations:

| Scenario | HTTP Code | Resolution / Message |
|----------|-----------|----------------------|
| Room is already `OCCUPIED` | `409 Conflict` | "Room is not available for renting." |
| Customer is deleted/not found | `404 Not Found` | "Customer does not exist." |
| Contract date overlap | `409 Conflict` | "Dates overlap with an existing contract." |
| Tenant ID mismatch | `403 Forbidden` | "You do not have access to this tenant." |
| Sales role attempts to approve | `403 Forbidden` | "Insufficient permissions to approve contracts." |
| End date < Start date | `400 Bad Request` | "End date must be after start date." |

## 6. RBAC Matrix

| Action / State Transition | Owner / Admin | Manager | Sales | Accountant | Tenant |
|---------------------------|---------------|---------|-------|------------|--------|
| Create (DRAFT) | ✅ | ✅ | ✅ | ❌ | ❌ |
| Submit for Approval | ✅ | ✅ | ✅ | ❌ | ❌ |
| Approve (APPROVED) | ✅ | ✅ | ❌ | ❌ | ❌ |
| Terminate / Cancel | ✅ | ✅ | ❌ | ❌ | ❌ |
| Extend (Renew) | ✅ | ✅ | ❌ | ❌ | ❌ |
| Export / View PDF | ✅ | ✅ | ✅ | ✅ | ✅ |
| Delete (Soft Delete) | ✅ | ❌ | ❌ | ❌ | ❌ |

## 7. Database Verification (Side-effect Mapping)

Example for the **Approve** action side-effects on the database:

| Entity | Action / Update |
|--------|-----------------|
| `Contract` | `status` updated to `APPROVED` |
| `Room` | `status` updated to `OCCUPIED` |
| `Customer` | `status` updated to `ACTIVE` (if not already) |
| `AuditLog` | `CREATE` record for `CONTRACT_APPROVE` |
| `Invoice` | `CREATE` record for initial rent/deposit |

## 8. Evidence Package

For each step in the business flow, the following evidence must be collected:
- **UI:** Playwright verification via `data-testid` assertions.
- **API (HAR):** Ensure 2xx responses for all contract mutations.
- **Screenshots/Video:** Visual proof of form submission and state change.
- **DB Before/After:** Prisma JSON snapshots proving `Contract`, `Room`, and `Invoice` tables updated correctly.
- **Audit Log:** Query proving the exact action was recorded.
- **Console:** 0 runtime errors during the flow.
- **Reload:** Data persists across browser refresh.
- **Tenant Isolation:** Ensure cross-tenant data is not visible.

## 9. Production Dataset

The Contract flow MUST use a fixed, predictable dataset to ensure reproducibility:
1. **Building:** "Tòa nhà Alpha" (Pre-seeded)
2. **Floor:** "Tầng 1" (Pre-seeded)
3. **Room:** "Phòng 101" (Starts `AVAILABLE`)
4. **Customer:** "Nguyễn Văn Test" (Created in prior E2E step)
5. **Contract:** 12 months duration (Generated during test)
6. **Deposit:** 1 month rent equivalent (Generated via event)
7. **Invoice:** August rent (Generated via event)
8. **Payment:** Bank transfer (Generated in subsequent flow)

---
**Next Step:** Proceed to Domain Review and implementation ONLY after this report is approved.
