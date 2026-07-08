# Release Gate

> Defines the release level ladder for HomeLand SaaS.
> AI must NOT skip levels. Every gate must be explicitly closed before advancing.
> Version: 2.0 | Effective: 2026-07-08

---

## Level Definitions

```
DEV
 │  Feature implemented, not yet verified
 │
 ▼
PRODUCTION CANDIDATE
 │  Core gates verified on production build locally
 │  (Backend API + UI + DB + Runtime + RBAC + Tenant Isolation)
 │
 ▼
STAGING VERIFIED
 │  All core gates verified on staging environment
 │  Business Verification Matrix ≥ 80% for module's flows
 │
 ▼
RELEASE CANDIDATE
 │  Business Verification Matrix = 100% for module's flows
 │  Smoke + Regression suites passing
 │  All RCAs closed
 │  No open P0/P1 bugs
 │
 ▼
PRODUCTION READY
 │  Release Checklist 100% complete
 │  Security audit passed
 │  Performance baseline met
 │  Backup/Restore verified
 │  Monitoring/Alerting active
 │
 ▼
LIVE
   Deployed to production, monitored
```

---

## Gate Requirements by Level

### DEV → PRODUCTION CANDIDATE

| Gate | Required |
|------|---------|
| Backend Unit Tests | ✅ PASS |
| Backend Integration Tests | ✅ PASS |
| UI basic CRUD via Playwright | ✅ PASS |
| Production Build (`npm run build`) | ✅ PASS |
| `npm run verify:prod` | ✅ PASS |
| No ErrorBoundary | ✅ CONFIRMED |
| No browser console errors | ✅ CONFIRMED |
| DB Snapshot before/after | ✅ CAPTURED |
| RBAC enforcement | ✅ VERIFIED |
| Tenant isolation | ✅ VERIFIED |

### PRODUCTION CANDIDATE → STAGING VERIFIED

| Gate | Required |
|------|---------|
| Deployed to staging environment | ✅ |
| Smoke suite on staging | ✅ PASS |
| Business Verification Matrix for module flows | ≥ 80% |
| Audit log entries confirmed | ✅ |
| All RCAs for module closed | ✅ |

### STAGING VERIFIED → RELEASE CANDIDATE

| Gate | Required |
|------|---------|
| Business Verification Matrix for module flows | 100% |
| Regression suite | ✅ PASS |
| No open P0/P1 bugs for this module | ✅ |
| Concurrency tests | ✅ PASS |
| Performance baseline met | ✅ |
| Security scan (OWASP top 10) | ✅ PASS |

### RELEASE CANDIDATE → PRODUCTION READY

| Gate | Required |
|------|---------|
| Full Release Checklist completed | 100% |
| All modules at RELEASE CANDIDATE | ✅ |
| Backup verified | ✅ |
| Restore tested | ✅ |
| Rollback plan documented | ✅ |
| Observability/alerting active | ✅ |
| Legal/compliance review | ✅ |

### PRODUCTION READY → LIVE

| Gate | Required |
|------|---------|
| Deployment runbook executed | ✅ |
| Post-deployment smoke test | ✅ PASS |
| Monitoring confirmed active | ✅ |
| On-call assigned | ✅ |

---

## Current Level per Module

| Module | Level | Blocker |
|--------|-------|---------|
| Authentication | PRODUCTION CANDIDATE | BVM Flow 1 not run |
| Property (Building/Floor/Room) | PRODUCTION CANDIDATE | Audit gate ⏳, BVM Flow 2 = 80% |
| Customer | DEV | UI Create/Edit form not built |
| Contract | DEV | Not started |
| Invoice | DEV | Not started |
| Payment | DEV | Not started |
| Accounting | DEV | Not started |
| Dashboard | DEV | Not started |
| Reports | DEV | Not started |
| Notifications | DEV | Not started |
| Settings | DEV | Not started |

---

## Rule: No Skipping

```
If module is DEV → cannot test Staging
If module is PRODUCTION CANDIDATE → cannot be called STAGING VERIFIED
If any critical path module is < RELEASE CANDIDATE → system cannot be PRODUCTION READY
```
