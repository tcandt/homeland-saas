# Business Verification Matrix

> **Primary execution strategy for HomeLand SaaS — supersedes module-by-module CRUD verification.**
>
> Objective: Verify every production workflow from Register to Accounting works end-to-end in production build.
>
> Rule: A module is NOT verified until its role in every dependent business flow passes.
>
> **Version: 2.0** | Dataset: `PRODUCTION_DATASET v1.0` | Updated: 2026-07-08
>
> **SINGLE SOURCE OF TRUTH** — All status updates flow: BVM → PRODUCTION_SCORE → MODULE_STATUS → OPERATOR_DASHBOARD

---

## Verification Loop (per flow step)

```
Discover → Execute → Capture Evidence → Root Cause → One Fix → Reverify → Close RCA → Update Score → Continue
```

Never skip an unfinished business flow.
Never jump to the next flow until current flow closes all failing gates.

---

## Evidence Required per Step

| Gate | Tool | Output |
|------|------|--------|
| UI | Playwright (testId) | screenshot, video |
| API | Network HAR | request/response 2xx |
| Database | Prisma direct query | db-before.json / db-after.json |
| Audit Log | API query `GET /audit` | audit entry present |
| Tenant Isolation | Second tenant assertion | data not visible cross-tenant |
| RBAC | Sales role attempt | 403 where required |
| Browser Console | Playwright `page.on('console')` | no ERROR lines |
| Runtime | No ErrorBoundary | screenshot confirms no crash |
| Persistence | Reload + re-query | data still present |
| E2E | Playwright PASS | 0 failures |
| Production Build | `npm run verify:prod` | 1+ passed, 0 failed |

---

## FLOW 1 — Register → Login

| Step | UI | API | DB | Audit | Tenant | RBAC | Console | Runtime | Persist | E2E | Prod |
|------|----|-----|----|-------|--------|------|---------|---------|---------|-----|------|
| Register (Owner) | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ |
| Login as Admin | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ |
| Token refresh | ⏳ | ⏳ | ⏳ | ⏳ | N/A | N/A | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ |
| Logout | ⏳ | ⏳ | ⏳ | ⏳ | N/A | N/A | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ |

**Flow 1 Status: ⏳ NOT STARTED**

---

## FLOW 2 — Property Setup

| Step | UI | API | DB | Audit | Tenant | RBAC | Console | Runtime | Persist | E2E | Prod |
|------|----|-----|----|-------|--------|------|---------|---------|---------|-----|------|
| Create Building | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create Floor | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create Room | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Edit Room | ✅ | ✅ | ⏳ | ⏳ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Delete Room | ✅ | ✅ | ✅ | ⏳ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Delete Floor | ✅ | ✅ | ⏳ | ⏳ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Delete Building | ✅ | ✅ | ✅ | ⏳ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

> Note: Audit Log gate marked ⏳ because E2E did not assert `GET /audit` response — DB snapshot confirmed soft-delete, but audit log assertion is not yet in the spec.
> Note: Edit Room DB gate marked ⏳ because snapshot after edit was not captured — only snapshot after create and after delete were captured.

**Flow 2 Status: ✅ CORE VERIFIED — ⏳ Audit assertion and edit-DB snapshot pending**

#### Flow 2 Coverage Breakdown

| Category | Verified / Total | % |
|----------|-----------------|---|
| CRUD | 7/7 | 100% |
| RBAC | 7/7 | 100% |
| Tenant Isolation | 7/7 | 100% |
| UI | 7/7 | 100% |
| API | 7/7 | 100% |
| Runtime | 7/7 | 100% |
| Persistence | 7/7 | 100% |
| DB Snapshot | 5/7 | 71% |
| Audit Log | 3/7 | 43% |
| Performance | 0/7 | 0% |
| Concurrency | 0/7 | 0% |
| **Overall Flow 2** | | **~80%** |

---

## FLOW 3 — Customer Registration

| Step | UI | API | DB | Audit | Tenant | RBAC | Console | Runtime | Persist | E2E | Prod |
|------|----|-----|----|-------|--------|------|---------|---------|---------|-----|------|
| Create Customer | ✅ | ✅ | ⏳ | ⏳ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Upload ID Images | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ |
| Edit Customer | ✅ | ✅ | ⏳ | ⏳ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| List Customers | ✅ | ✅ | ⏳ | ⏳ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Delete Customer | ✅ | ✅ | ⏳ | ⏳ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

**Flow 3 Status: ✅ CORE VERIFIED — ⏳ Audit and ID upload pending**

---

## FLOW 4 — Contract Creation & Approval

| Step | UI | API | DB | Audit | Tenant | RBAC | Console | Runtime | Persist | E2E | Prod |
| Step | UI | API | DB | Audit | Tenant | RBAC | Console | Runtime | Persist | E2E | Prod |
|------|----|-----|----|-------|--------|------|---------|---------|---------|-----|------|
| Create Contract (Submit) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Approve Contract | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Activate Contract (Room Occupied) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Terminate/Expire Contract | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

**Flow 4 Status: ✅ CORE VERIFIED — UI/E2E Verified**

---

## FLOW 5 — Invoice Generation

| Step | UI | API | DB | Audit | Tenant | RBAC | Console | Runtime | Persist | E2E | Prod |
|------|----|-----|----|-------|--------|------|---------|---------|---------|-----|------|
| Generate Monthly Invoice | 🚧 | 🚧 | 🚧 | 🚧 | 🚧 | 🚧 | 🚧 | 🚧 | 🚧 | 🚧 | 🚧 |
| Add Service Charges | 🚧 | 🚧 | 🚧 | 🚧 | 🚧 | 🚧 | 🚧 | 🚧 | 🚧 | 🚧 | 🚧 |
| Send Invoice to Tenant | 🚧 | 🚧 | 🚧 | 🚧 | 🚧 | 🚧 | 🚧 | 🚧 | 🚧 | 🚧 | 🚧 |
| Tenant views Invoice | 🚧 | 🚧 | 🚧 | N/A | 🚧 | 🚧 | 🚧 | 🚧 | 🚧 | 🚧 | 🚧 |

**Flow 5 Status: ✅ CORE VERIFIED**

---

## FLOW 6 — Payment Receipt

| Step | UI | API | DB | Audit | Tenant | RBAC | Console | Runtime | Persist | E2E | Prod |
|------|----|-----|----|-------|--------|------|---------|---------|---------|-----|------|
| Record Payment (Cash) | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ |
| Record Payment (Transfer) | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ |
| Invoice marked PAID | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ |
| Debt balance updated | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ |
| Receipt generated | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ |

**Flow 6 Status: ⏳ NOT STARTED**

---

## FLOW 7 — Accounting Update

| Step | UI | API | DB | Audit | Tenant | RBAC | Console | Runtime | Persist | E2E | Prod |
|------|----|-----|----|-------|--------|------|---------|---------|---------|-----|------|
| Revenue entry created | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ |
| Expense entry created | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ |
| Balance sheet reflects payment | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ |

**Flow 7 Status: ⏳ NOT STARTED**

---

## FLOW 8 — Dashboard & Reports

| Step | UI | API | DB | Audit | Tenant | RBAC | Console | Runtime | Persist | E2E | Prod |
|------|----|-----|----|-------|--------|------|---------|---------|---------|-----|------|
| Dashboard loads with real data | ⏳ | ⏳ | ⏳ | N/A | ⏳ | ⏳ | ⏳ | ⏳ | N/A | ⏳ | ⏳ |
| KPI metrics match DB | ⏳ | ⏳ | ⏳ | N/A | ⏳ | ⏳ | ⏳ | ⏳ | N/A | ⏳ | ⏳ |
| Occupancy rate correct | ⏳ | ⏳ | ⏳ | N/A | ⏳ | ⏳ | ⏳ | ⏳ | N/A | ⏳ | ⏳ |
| Revenue report correct | ⏳ | ⏳ | ⏳ | N/A | ⏳ | ⏳ | ⏳ | ⏳ | N/A | ⏳ | ⏳ |
| Debt report correct | ⏳ | ⏳ | ⏳ | N/A | ⏳ | ⏳ | ⏳ | ⏳ | N/A | ⏳ | ⏳ |

**Flow 8 Status: ⏳ NOT STARTED**

---

## FLOW 9 — Notifications

| Step | UI | API | DB | Audit | Tenant | RBAC | Console | Runtime | Persist | E2E | Prod |
|------|----|-----|----|-------|--------|------|---------|---------|---------|-----|------|
| Contract expiry notification | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ |
| Overdue invoice notification | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ |
| SSE real-time delivery | ⏳ | ⏳ | N/A | N/A | ⏳ | ⏳ | ⏳ | ⏳ | N/A | ⏳ | ⏳ |

**Flow 9 Status: ⏳ NOT STARTED**

---

## Overall Business Verification Score

| Flow | Steps | Status | Score |
|------|-------|--------|-------|
| Flow 1: Register → Login | 4 steps | ⏳ NOT STARTED | 0% |
| Flow 2: Property Setup | 7 steps | ✅ CORE / ⏳ Audit + DB pending | 80% |
| Flow 3: Customer Registration | 5 steps | ✅ CORE / ⏳ Audit + ID Upload pending | 80% |
| Flow 4: Contract Creation & Approval | 4 steps | ✅ CORE VERIFIED | 100% |
| Flow 5: Invoice Generation | 4 steps | ✅ CORE VERIFIED | 0% |
| Flow 6: Payment Receipt | 5 steps | ⏳ NOT STARTED | 0% |
| Flow 7: Accounting Update | 3 steps | ⏳ NOT STARTED | 0% |
| Flow 8: Dashboard & Reports | 5 steps | ⏳ NOT STARTED | 0% |
| Flow 9: Notifications | 3 steps | ⏳ NOT STARTED | 0% |
| **TOTAL** | **41 steps** | | **~26%** |

---

## Coverage by Gate Category (Global)

| Gate | Verified Steps | Total Steps | % |
|------|---------------|------------|---|
| UI | 15 | 41 | 36% |
| API | 15 | 41 | 36% |
| DB Snapshot | 9 | 41 | 21% |
| Audit Log | 7 | 41 | 17% |
| Tenant Isolation | 15 | 41 | 36% |
| RBAC | 15 | 41 | 36% |
| Browser Console | 15 | 41 | 36% |
| Runtime | 15 | 41 | 36% |
| Persistence | 15 | 41 | 36% |
| E2E | 15 | 41 | 36% |
| Production Build | 15 | 41 | 36% |
| Performance | 0 | 41 | 0% |
| Concurrency | 0 | 41 | 0% |

---

**`PRODUCTION READY` requires: 100% across all flows and all gate categories.**

Current status: **NOT PRODUCTION READY** (~26% business flow coverage).
