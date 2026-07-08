# Dependency Graph

> Module execution order for verification and development.
> Always work in dependency order — never verify a downstream module before its upstream is PRODUCTION CANDIDATE.
> Version: 2.0 | Effective: 2026-07-08

---

## Critical Path vs Secondary Path

```
══════════════════════════════════════════════════════
  CRITICAL PATH  (revenue-generating, must be first)
══════════════════════════════════════════════════════

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


══════════════════════════════════════════════════════
  SECONDARY PATH  (support functions, parallel track)
══════════════════════════════════════════════════════

Dashboard    ◄── depends on: Accounting (for revenue data)
Reports      ◄── depends on: Accounting (for financial data)
Notifications ◄── depends on: Contract (expiry) + Invoice (overdue)
Settings     ◄── depends on: Authentication only
AI Assistant ◄── depends on: all core modules
```

---

## AI Execution Rule

```
1. Always complete the Critical Path in order.
2. Never start Secondary Path until Critical Path is STAGING VERIFIED.
3. Settings can be started in parallel (only depends on Auth).
4. Dashboard and Reports share the same dependency (Accounting).
   They can be verified in parallel once Accounting is PRODUCTION CANDIDATE.
```

---

## Module Status vs Dependency

| Order | Module | Path | Depends On | Status | Blocker |
|-------|--------|------|-----------|--------|---------|
| 1 | Authentication | CRITICAL | — | PRODUCTION CANDIDATE | None |
| 2 | Property | CRITICAL | Auth | PRODUCTION CANDIDATE | None |
| 3 | Customer | CRITICAL | Auth | DEV (PARTIAL) | No UI Create/Edit form |
| 4 | Contract | CRITICAL | Property + Customer | DEV | Customer must be PROD CANDIDATE |
| 5 | Invoice | CRITICAL | Contract | DEV | Contract must be PROD CANDIDATE |
| 6 | Payment | CRITICAL | Invoice | DEV | Invoice must be PROD CANDIDATE |
| 7 | Accounting | CRITICAL | Payment | DEV | Payment must be PROD CANDIDATE |
| 8a | Dashboard | SECONDARY | Accounting | DEV | Accounting must be PROD CANDIDATE |
| 8b | Reports | SECONDARY | Accounting | DEV | Accounting must be PROD CANDIDATE |
| 9 | Notifications | SECONDARY | Contract + Invoice | DEV | Contract + Invoice must be PROD CANDIDATE |
| 10 | Settings | SECONDARY | Auth | DEV | Auth is PROD CANDIDATE — can start |
| 11 | AI Assistant | SECONDARY | All core | DEV | All critical path must be PROD CANDIDATE |

---

## Current Execution Priority

```
IMMEDIATE (Critical Path, in order):
  Priority 1 → Customer (UI Create/Edit form — unblocks Contract)
  Priority 2 → Contract (core revenue flow)
  Priority 3 → Invoice → Payment → Accounting

PARALLEL (when unblocked):
  Settings (Auth is satisfied, can start anytime)

DEFERRED (Secondary Path, after critical path):
  Dashboard, Reports, Notifications, AI Assistant
```

---

## Rules

1. **No skipping**: If Contract depends on Customer, Customer must be PRODUCTION CANDIDATE first.
2. **No parallel critical path work**: Do not start Contract while Customer is still DEV.
3. **Secondary path is never Priority 1**: Unless all critical path modules are STAGING VERIFIED.
4. **A module is not done** until it participates in all its dependent business flows and passes.
5. **Settings exception**: Can be done any time after Auth is PRODUCTION CANDIDATE.
