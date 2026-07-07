# Business Verification Matrix

> **Primary execution strategy for HomeLand SaaS — supersedes module-by-module CRUD verification.**
>
> Objective: Verify every production workflow from Register to Accounting works end-to-end in production build.
>
> Rule: A module is NOT verified until its role in every dependent business flow passes.

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

---

## FLOW 3 — Customer Registration

| Step | UI | API | DB | Audit | Tenant | RBAC | Console | Runtime | Persist | E2E | Prod |
|------|----|-----|----|-------|--------|------|---------|---------|---------|-----|------|
| Create Customer | ⏳ | ✅ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ |
| Upload ID Images | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ |
| Edit Customer | ⏳ | ✅ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ |
| List Customers | ⏳ | ✅ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ |

**Flow 3 Status: ⏳ NOT STARTED (API exists, UI CRUD form not built)**

---

## FLOW 4 — Contract Creation & Approval

| Step | UI | API | DB | Audit | Tenant | RBAC | Console | Runtime | Persist | E2E | Prod |
|------|----|-----|----|-------|--------|------|---------|---------|---------|-----|------|
| Create Contract (Room + Customer) | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ |
| Approve Contract | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ |
| Room status changes to RENTED | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ |
| Generate Deposit | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ |
| Terminate Contract | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ |

**Flow 4 Status: ⏳ NOT STARTED**

---

## FLOW 5 — Invoice Generation

| Step | UI | API | DB | Audit | Tenant | RBAC | Console | Runtime | Persist | E2E | Prod |
|------|----|-----|----|-------|--------|------|---------|---------|---------|-----|------|
| Generate Monthly Invoice | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ |
| Add Service Charges | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ |
| Send Invoice to Tenant | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ |
| Tenant views Invoice | ⏳ | ⏳ | ⏳ | N/A | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ |

**Flow 5 Status: ⏳ NOT STARTED**

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

| Flow | Core Gates | Status | Score |
|------|-----------|--------|-------|
| Flow 1: Register → Login | 11 gates | ⏳ NOT STARTED | 0% |
| Flow 2: Property Setup | 11 gates | ✅ CORE / ⏳ Audit pending | 80% |
| Flow 3: Customer Registration | 11 gates | ⏳ NOT STARTED | 0% |
| Flow 4: Contract Creation & Approval | 11 gates | ⏳ NOT STARTED | 0% |
| Flow 5: Invoice Generation | 11 gates | ⏳ NOT STARTED | 0% |
| Flow 6: Payment Receipt | 11 gates | ⏳ NOT STARTED | 0% |
| Flow 7: Accounting Update | 11 gates | ⏳ NOT STARTED | 0% |
| Flow 8: Dashboard & Reports | 11 gates | ⏳ NOT STARTED | 0% |
| Flow 9: Notifications | 11 gates | ⏳ NOT STARTED | 0% |
| **TOTAL** | | | **~9%** |

**`PRODUCTION READY` requires: 100% across all flows.**

Current status: **NOT PRODUCTION READY**.
