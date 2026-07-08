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
│   Check DEPENDENCY_GRAPH — is upstream verified?                │
│   If upstream NOT verified → switch to upstream first           │
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
│   Run `npm run verify:prod` (or specific E2E)                   │
│   Collect Evidence Package:                                     │
│     - console.log                                               │
│     - network.har                                               │
│     - trace.zip                                                 │
│     - screenshots                                               │
│     - db-before.json / db-after.json                            │
│   Check: No ErrorBoundary, no console errors                    │
│                                                                 │
│   IF PASS → go to CLOSE                                         │
│   IF FAIL → go to RCA                                           │
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
```
