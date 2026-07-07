# Dependency Graph

> Module execution order for verification and development.
> Always work in dependency order — never verify a downstream module before its upstream is PRODUCTION CANDIDATE.

---

## Dependency Hierarchy

```
Authentication
    │
    ▼
Property (Building → Floor → Room)
    │
    ▼
Customer
    │
    ▼
Contract  ◄── depends on: Property (Room) + Customer
    │
    ▼
Invoice   ◄── depends on: Contract
    │
    ▼
Payment   ◄── depends on: Invoice
    │
    ▼
Accounting ◄── depends on: Payment
    │
    ├──────────────┐
    ▼              ▼
Dashboard       Reports
    │              │
    └──────┬───────┘
           ▼
      Notifications  ◄── depends on: Contract (expiry) + Invoice (overdue)
           │
           ▼
        Settings
```

---

## Module Status vs Dependency

| Order | Module | Depends On | Status | Blocker |
|-------|--------|-----------|--------|---------|
| 1 | Authentication | — | ✅ PRODUCTION CANDIDATE | None |
| 2 | Property | Auth | ✅ PRODUCTION CANDIDATE | None |
| 3 | Customer | Auth | ⚠️ PARTIAL | No UI Create/Edit form |
| 4 | Contract | Property + Customer | ⏳ NOT STARTED | Customer must be PRODUCTION CANDIDATE first |
| 5 | Invoice | Contract | ⏳ NOT STARTED | Contract must be PRODUCTION CANDIDATE first |
| 6 | Payment | Invoice | ⏳ NOT STARTED | Invoice must be PRODUCTION CANDIDATE first |
| 7 | Accounting | Payment | ⏳ NOT STARTED | Payment must be PRODUCTION CANDIDATE first |
| 8 | Dashboard | Accounting | ⏳ NOT STARTED | Accounting must be PRODUCTION CANDIDATE first |
| 9 | Reports | Accounting | ⏳ NOT STARTED | Accounting must be PRODUCTION CANDIDATE first |
| 10 | Notifications | Contract + Invoice | ⏳ NOT STARTED | Contract + Invoice must be PRODUCTION CANDIDATE |
| 11 | Settings | Auth | ⏳ NOT STARTED | Auth must be PRODUCTION CANDIDATE (it is) |

---

## Rules

1. **Do not skip a module.** If Contract depends on Customer, Customer must be verified first.
2. **Do not declare a module PRODUCTION READY based on its own CRUD only.** It must participate in its dependent business flows.
3. **If upstream is PARTIAL, downstream cannot be PRODUCTION CANDIDATE.**
4. **Settings can be worked on independently** (only depends on Auth which is verified).

---

## Current Execution Priority

```
Priority 1 → Customer (need UI Create/Edit form to unblock Contract)
Priority 2 → Contract (core revenue flow)
Priority 3 → Invoice → Payment → Accounting (revenue lifecycle)
Priority 4 → Dashboard + Reports + Notifications
Priority 5 → Settings
```
