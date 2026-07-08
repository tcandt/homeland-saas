# EOS Operator Dashboard

> **READ THIS FIRST at the start of every session.**
> This dashboard is derived from BUSINESS_VERIFICATION_MATRIX → PRODUCTION_SCORE → MODULE_STATUS.
> Do NOT update this file directly. Regenerate from source documents after each evidence update.
>
> Version: 2.0 | Dataset: PRODUCTION_DATASET v1.0 | Last Updated: 2026-07-08

---

```
══════════════════════════════════════════════════════════════════
  HOMELAND EOS — OPERATOR DASHBOARD
  2026-07-08 | Session Start
══════════════════════════════════════════════════════════════════

  RELEASE LADDER
  ──────────────
  DEV            → PRODUCTION CANDIDATE → STAGING VERIFIED
                 → RELEASE CANDIDATE → PRODUCTION READY → LIVE

  CURRENT MODULE LEVELS
  ─────────────────────
  Authentication   [PRODUCTION CANDIDATE]
  Property         [PRODUCTION CANDIDATE]
  Customer         [PRODUCTION CANDIDATE]
  Contract         [DEV]                     ← CURRENT PRIORITY
  Invoice          [DEV]                     ← BLOCKED by Contract
  Payment          [DEV]                     ← BLOCKED by Invoice
  Accounting       [DEV]                     ← BLOCKED by Payment
  Dashboard        [DEV]                     ← BLOCKED by Accounting
  Reports          [DEV]                     ← BLOCKED by Accounting
  Notifications    [DEV]                     ← BLOCKED by Contract+Invoice
  Settings         [DEV]                     ← CAN START (Auth satisfied)

  BUSINESS FLOW VERIFICATION
  ──────────────────────────
  Flow 1: Register → Login
  ░░░░░░░░░░  0%

  Flow 2: Property Setup
  ████████░░  80%
    CRUD       100% ████████████████████
    RBAC       100% ████████████████████
    Tenant     100% ████████████████████
    DB         71%  ██████████████░░░░░░
    Audit      43%  █████████░░░░░░░░░░░
    Perf       0%   ░░░░░░░░░░░░░░░░░░░░
    Concurr    0%   ░░░░░░░░░░░░░░░░░░░░

  Flow 3: Customer Registration
  ████████░░  80%

  Flow 4: Contract Creation
  ░░░░░░░░░░  0%

  Flow 5: Invoice Generation
  ░░░░░░░░░░  0%

  Flow 6: Payment Receipt
  ░░░░░░░░░░  0%

  Flow 7: Accounting Update
  ░░░░░░░░░░  0%

  Flow 8: Dashboard & Reports
  ░░░░░░░░░░  0%

  Flow 9: Notifications
  ░░░░░░░░░░  0%

  COVERAGE SUMMARY (Global Gate %)
  ─────────────────────────────────
  UI               26%  █████░░░░░░░░░░░░░░░
  API              26%  █████░░░░░░░░░░░░░░░
  DB Snapshot      12%  ██░░░░░░░░░░░░░░░░░░
  Audit Log         7%  █░░░░░░░░░░░░░░░░░░░
  Tenant Isol.     26%  █████░░░░░░░░░░░░░░░
  RBAC             26%  █████░░░░░░░░░░░░░░░
  Runtime          26%  █████░░░░░░░░░░░░░░░
  Persistence      26%  █████░░░░░░░░░░░░░░░
  E2E              26%  █████░░░░░░░░░░░░░░░
  Performance       0%  ░░░░░░░░░░░░░░░░░░░░
  Concurrency       0%  ░░░░░░░░░░░░░░░░░░░░

  CRITICAL PATH STATUS
  ────────────────────
  Auth ✅ → Property ✅ → Customer ✅ → Contract ⏳ → Invoice ⏳
         → Payment ⏳ → Accounting ⏳

  CURRENT BLOCKER
  ───────────────
  Contract Creation API/UI not built
  → Blocks: Invoice → Payment → Accounting

  ROOT CAUSE DATABASE
  ───────────────────
  Open RCAs:  0
  Closed RCAs: 3 (RCA-001, RCA-002, RCA-003)

  NEXT ACTION
  ───────────
  1. Build Contract Backend API + UI
  2. Run BVM Flow 4 (Contract Creation)
  3. Update BVM → PRODUCTION_SCORE → MODULE_STATUS → this dashboard

  PRODUCTION SCORES
  ─────────────────
  Auth            85%  [PRODUCTION CANDIDATE]
  Property        75%  [PRODUCTION CANDIDATE]
  Customer        80%  [PRODUCTION CANDIDATE]
  Contract–Acctg   0%  [NOT STARTED]
  Dashboard/Rpts   0%  [NOT STARTED]
  ──────────────────
  Overall:        ~26%  [NOT PRODUCTION READY]

  RELEASE READINESS
  ─────────────────
  Release Checklist: 0/49 items complete
  Business Matrix:   ~26% coverage
  ──────────────────────────────────────
  Status: NOT PRODUCTION READY

══════════════════════════════════════════════════════════════════
```

---

## Regeneration Instructions

After any BVM gate update, regenerate this dashboard:

1. Count ✅ per flow in `BUSINESS_VERIFICATION_MATRIX.md`
2. Calculate percentage: `(✅ count / total gates) × 100`
3. Update the bar charts above (each `█` = 10%)
4. Update module levels from `RELEASE_GATE.md`
5. Update blocker from `DEPENDENCY_GRAPH.md`
6. Update RCA counts from `ROOT_CAUSE_DATABASE.md`
7. Set "Next Action" to first unfinished BVM gate on Critical Path
8. Commit: `docs(dashboard): regenerate EOS operator dashboard — [summary of change]`

---

## EOS Document Map

| Document | Read When |
|----------|-----------|
| [EOS_OPERATOR_DASHBOARD.md](./EOS_OPERATOR_DASHBOARD.md) | **Every session start** |
| [EOS_ARCHITECTURE.md](./EOS_ARCHITECTURE.md) | Understanding update protocol |
| [AUTOMATION_FSM.md](./AUTOMATION_FSM.md) | Choosing next action |
| [BUSINESS_VERIFICATION_MATRIX.md](./BUSINESS_VERIFICATION_MATRIX.md) | Checking gate status |
| [DEPENDENCY_GRAPH.md](./DEPENDENCY_GRAPH.md) | Choosing next module |
| [ROOT_CAUSE_DATABASE.md](./ROOT_CAUSE_DATABASE.md) | Before fixing any bug |
| [PRODUCTION_DATASET.md](./PRODUCTION_DATASET.md) | Before running E2E tests |
| [RELEASE_GATE.md](./RELEASE_GATE.md) | Checking release level requirements |
| [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md) | Pre-release verification |
| [ENGINEERING_CONSTITUTION.md](./ENGINEERING_CONSTITUTION.md) | Inviolable rules |
| [PRODUCTION_SCORE.md](./PRODUCTION_SCORE.md) | Checking module scores |
| [MODULE_STATUS.md](../MODULE_STATUS.md) | High-level status only |
