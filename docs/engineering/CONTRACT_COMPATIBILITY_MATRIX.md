# Contract Compatibility Matrix

> **Objective:** Ensure zero-downtime migration of the `ContractStatus` enum across all layers of the stack, enforcing the **Expand → Migrate → Contract** pattern.
> **Date:** 2026-07-08
> **Domain Version:** Contract FSM v2

## 1. Enum Mapping Matrix

| Current DB/DTO Enum | New FSM Enum | Migration | Backward Compatible | Notes |
|---------------------|--------------|-----------|---------------------|-------|
| `DRAFT` | `DRAFT` | None | ✅ | Unchanged |
| `ACTIVE` | `ACTIVE` | None | ✅ | Unchanged |
| `EXPIRING` | `EXPIRING` | None | ✅ | Unchanged |
| `CANCELLED` | `CANCELLED` | None | ✅ | Unchanged |
| `ENDED` | `EXPIRED` or `TERMINATED` | SQL UPDATE | ❌ | Breaking change. Requires adapter and data migration rule. |
| N/A | `PENDING_APPROVAL` | None | ✅ | New state, safely ignored by legacy. |
| N/A | `APPROVED` | None | ✅ | New state, safely ignored by legacy. |

**Data Migration Rule for `ENDED`:**
If `endDate` <= `now()`, map to `EXPIRED`. Otherwise, map to `TERMINATED`.

---

## 2. API Compatibility

| Endpoint | Request Change | Response Change | Validation Change | Backward Compatible |
|----------|----------------|-----------------|-------------------|---------------------|
| `GET /contracts` | Accepts new filters | Returns new enum | Soft (Zod `.nativeEnum`) | ⚠️ Requires adapter to map `ENDED` back for old clients during migration |
| `GET /contracts/:id` | None | Returns new enum | Soft | ⚠️ Needs adapter |
| `POST /contracts` | Restrict `status` | None | Hard (FSM enforced) | ❌ Must refactor to enforce DRAFT only creation |
| `PATCH /contracts/:id` | Restrict `status` | None | Hard (FSM enforced) | ❌ Disallow manual status changes. Use dedicated endpoints. |
| `POST /contracts/:id/approve` | **NEW Endpoint** | Returns Contract | FSM: PENDING → APPROVED | ✅ Additive |
| `POST /contracts/:id/terminate` | **NEW Endpoint** | Returns Contract | FSM: ACTIVE → TERMINATED | ✅ Additive |

---

## 3. Frontend Compatibility

| Component | Status | Required Change |
|-----------|--------|-----------------|
| `OperationsContractRow` | ❌ Breaking | Must update `ContractStatus` type and `getBadgeVariant` mapping. |
| `OperationsContractDrawer` | ❌ Breaking | Must show "Approve" button if `PENDING_APPROVAL`, or "Terminate" if `ACTIVE`. |
| `ContractsList` | ⚠️ Needs adapter | Filter dropdowns must reflect new FSM states. |
| `ContractsHeader` | ✅ Safe | No direct status dependency. |
| `TenantFormModal` | ✅ Safe | No direct status dependency. |
| `ContractFormModal` | 🆕 New | Must be built enforcing `DRAFT` submission. |
| `Dashboard` | ⚠️ Needs adapter | Contract KPIs (Active, Expiring) must explicitly include/exclude new states. |

---

## 4. Seed Compatibility

| Dataset | Uses `ENDED`? | Required Migration |
|---------|---------------|--------------------|
| `seed.ts` | No | Update to seed new states (`PENDING_APPROVAL`, `APPROVED`) for testing. |
| `PRODUCTION_DATASET.md` | N/A | Upgrade to v1.1. Explicitly trace a contract through all 8 FSM states. |

---

## 5. Rollout Strategy (Expand → Migrate → Contract)

We will use the **Expand → Migrate → Contract** pattern to guarantee zero downtime.

### Phase A: Expand & Compatibility Layer (✅ COMPLETED)
1. **DB Expand:** Update `schema.prisma` by ADDING `PENDING_APPROVAL`, `APPROVED`, `EXPIRED`, `TERMINATED` to `ContractStatus` enum. **DO NOT REMOVE `ENDED` YET.** Run Prisma migration.
2. **DTO & Backend Adapter:** Update DTOs. Intercept responses returning `EXPIRED`/`TERMINATED` and cast them to `ENDED` for old UI components if version headers require it, OR simply ensure UI falls back gracefully.
3. **Deploy Phase A.**

### Phase B: Migrate Data & Code
1. **Data Migration:** Run SQL script to convert all existing `ENDED` records to `EXPIRED` or `TERMINATED` based on the date logic.
2. **UI & API Rollout:** Deploy new UI components, dedicated endpoints (`/approve`, `/terminate`), and new DTO validation.

### Phase C: Contract (Cleanup)
1. **DB Contract:** Once zero rows remain as `ENDED` and no active clients send `ENDED`, run a Prisma migration to DROP `ENDED` from the enum entirely.
2. **Remove Adapters:** Clean up compatibility code in the Controller.
3. **Deploy Phase C.**

---

## 6. Versioning

**Contract Domain Version: v2**

All dependent domains (Invoice, Payment) subscribing to Contract events MUST explicitly expect Domain v2 events (`ContractApproved`, `ContractActivated`). Legacy events (if any) are deprecated.
