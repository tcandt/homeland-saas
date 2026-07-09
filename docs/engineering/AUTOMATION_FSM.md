# Automation FSM

> AI Execution State Machine for HomeLand EOS v2.0
> Version: 2.0 | Effective: 2026-07-08
>
> This document defines the ONLY valid execution sequence for the AI.
> Skipping states is FORBIDDEN. Returning to a prior state on failure is REQUIRED.

---

## State Machine

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   SESSION_START                                                 │
│   Read EOS_OPERATOR_DASHBOARD.md                                │
│   Identify current state from: BVM + RELEASE_GATE + DEPENDENCY  │
│   Select next unfinished flow from BUSINESS_VERIFICATION_MATRIX │
│                                                                 │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   DISCOVER                                                      │
│   Read current codebase state for target module/flow            │
│   Search ROOT_CAUSE_DATABASE for known issues                   │
│                                                                 │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   DOMAIN DESIGN                                                 │
│   Generate/Review DOMAIN REVIEW                                 │
│   Generate/Review STATE MACHINE (FSM)                           │
│   Generate/Review EVENT MAP                                     │
│   Generate/Review AGGREGATE BOUNDARY & INVARIANTS               │
│   Verify DATASET & DEPENDENCY CHECK                             │
│   If upstream NOT verified → switch to upstream first           │
│                                                                 │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   SCHEMA IMPACT                                                 │
│   Generate SCHEMA IMPACT REVIEW document                        │
│   Identify all downstream impacts of DB schema changes          │
│                                                                 │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   COMPATIBILITY REVIEW                                          │
│   Generate COMPATIBILITY MATRIX document                        │
│   Map old/new enums, API endpoints, Frontend, and Seed          │
│   Define Rollout Strategy (Expand → Migrate → Contract)         │
│   Define Versioning strategy for downstream consumers           │
│                                                                 │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   IMPLEMENT                                                     │
│   Write code / create test                                      │
│   Run `npm run build` (MUST PASS before continuing)             │
│   STOP if build fails → go to RCA                               │
│                                                                 │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   VERIFY                                                        │
│   Must execute sequentially:                                    │
│   1. UNIT Tests                                                 │
│   2. INTEGRATION Tests                                          │
│   3. E2E Tests (`npm run verify:prod` or specific spec)         │
│   4. DB VERIFY (Before/After DB snapshots)                      │
│   5. AUDIT VERIFY (Check audit logs)                            │
│   6. PERF & CONCURRENCY (Load testing)                          │
│                                                                 │
│   Collect Evidence Package:                                     │
│     - console.log, network.har, trace.zip, screenshots          │
│     - db-before.json / db-after.json                            │
│   Check: No ErrorBoundary, no console errors                    │
│                                                                 │
│   IF ALL PASS → go to CLOSE / RELEASE GATE                      │
│   IF ANY FAIL → go to RCA                                       │
│                                                                 │
└────────────────────────┬────────────────────────────────────────┘
                         │                    │
                    PASS │                    │ FAIL
                         │                    │
                         ▼                    ▼
┌────────────────────┐  ┌─────────────────────────────────────────┐
│                    │  │                                         │
│   CLOSE            │  │   RCA                                   │
│   Update BVM gate  │  │   Search ROOT_CAUSE_DATABASE            │
│   Update SCORE     │  │   Create new RCA entry if not found     │
│   Update STATUS    │  │   Identify ONE root cause               │
│   Update DASHBOARD │  │   Apply ONE fix only                    │
│   Close RCA if any │  │   Commit: fix(module): [description]    │
│   Commit docs      │  │   Return to → VERIFY                    │
│                    │  │                                         │
└────────┬───────────┘  └─────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   NEXT_FLOW                                                     │
│   Is current flow 100% complete in BVM?                         │
│   IF YES → select next flow from BUSINESS_VERIFICATION_MATRIX   │
│   IF NO  → return to DISCOVER for remaining gates               │
│                                                                 │
│   Is current module at correct RELEASE_GATE level?              │
│   Does DEPENDENCY_GRAPH allow moving to next module?            │
│                                                                 │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
                    SESSION_START
                    (next iteration)
```

---

## Forbidden Transitions

| From | To (FORBIDDEN) | Reason |
|------|----------------|--------|
| IMPLEMENT | NEXT_FLOW | Must VERIFY before closing |
| VERIFY (FAIL) | CLOSE | Cannot close a failing gate |
| DISCOVER | IMPLEMENT | Must check ROOT_CAUSE_DATABASE first |
| CLOSE | NEXT_FLOW | Must update all 4 docs before moving on |
| Any state | Skip DISCOVER on new module | Context must always be refreshed |

---

## State Invariants

### Before entering IMPLEMENT:
- [ ] Upstream module at PRODUCTION CANDIDATE or higher
- [ ] No open RCA for this module (or RCA is the target of this work)
- [ ] `PRODUCTION_DATASET.md` version confirmed

### Before entering VERIFY:
- [ ] `npm run build` passed
- [ ] No TypeScript compile errors
- [ ] Evidence collector attached to test

### Before entering CLOSE:
- [ ] All gates for this flow step are `✅`
- [ ] Evidence files captured and referenced
- [ ] `npm run verify:prod` last run: PASS

### Epic Closure Guard
IF `verify:prod` != PASS OR Evidence Package incomplete OR Infrastructure Blocked THEN Epic cannot become CLOSED.
AI must refuse any status update that marks Production Candidate, Epic Closed, or Release Ready.

### Execution Receipt Constraint
At the end of every execution cycle, the AI MUST output a structured `Execution Receipt` block. Conversational assertions of success are forbidden.
Example:
```text
=== EXECUTION RECEIPT ===
Epic: [ID and Name]
Implementation: [PASS/FAIL/BLOCKED]
Backend Build: [PASS/FAIL/BLOCKED]
Frontend Build: [PASS/FAIL/BLOCKED]
Unit Test: [PASS/FAIL/BLOCKED]
Integration: [PASS/FAIL/BLOCKED]
verify:prod: [PASS/FAIL/BLOCKED]
Evidence: [COMPLETE/INCOMPLETE]
Infrastructure: [HEALTHY/BLOCKED]
---
Final Status: [e.g., VERIFICATION BLOCKED]
Epic Closed: [YES/NO]
Next Action: [Specific next step]
=========================
```

### Before entering NEXT_FLOW:
- [ ] BVM updated
- [ ] PRODUCTION_SCORE updated
- [ ] MODULE_STATUS updated (if threshold crossed)
- [ ] EOS_OPERATOR_DASHBOARD updated
- [ ] Git commit made

---

## Anti-Patterns (NEVER DO)

```
❌  DISCOVER → IMPLEMENT → claim VERIFIED without running tests
❌  IMPLEMENT → NEXT_FLOW (skipped VERIFY)
❌  Multiple IMPLEMENT cycles without VERIFY between them
❌  VERIFY PASS on dev server → claim production verified
❌  Update MODULE_STATUS without updating BVM
❌  Fix a bug without creating/referencing RCA entry
❌  Move to next module while current flow has ⏳ gates
❌  Mark Epic Closed or Production Candidate when verify:prod is failing or blocked

---

## Process Integrity Rules

### Rule 91: Anti-Greenwashing Rule
Evidence always wins. Never infer success from implementation.
Implementation ≠ Verification.
Verification ≠ Production.
Production ≠ Release.
Release ≠ Epic Closed.

### Rule 92: Infrastructure Hard Stop
If Infrastructure Blocked:
Stop immediately. Generate RCA. Generate Resume Guide. Update Dashboard. Wait for operator. Do not continue.

### Infrastructure FSM
Defines the sequential flow for infrastructure and verification gates:
`Docker → Postgres → Redis → Migration → Healthcheck → API → Web → verify:prod → Evidence → Epic Close`
If Docker fails → Do not start API. Do not verify. Do not update Dashboard. Do not Close Epic.
