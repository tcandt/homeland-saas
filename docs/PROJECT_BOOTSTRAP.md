# Project Bootstrap Sequence

> Version: 2.0 | EOS v2.0 | Updated: 2026-07-08
>
> **MANDATORY BEFORE ANY CODE MODIFICATION OR ACTION.**
> Read documents in exact order. Do not skip steps.

---

## Session Start Protocol

```
Step 1: READ EOS_OPERATOR_DASHBOARD
         → This tells you: current state, blocker, next action.
         → If dashboard is clear → proceed.
         → If dashboard shows open RCA → go to RCA before anything else.

Step 2: READ ENGINEERING_CONSTITUTION
         → Confirm inviolable rules are understood.

Step 3: READ AUTOMATION_FSM
         → Confirm which state you are entering (DISCOVER / IMPLEMENT / VERIFY / RCA / CLOSE).

Step 4: READ DEPENDENCY_GRAPH
         → Confirm which module is next on Critical Path.
         → Confirm upstream module is at correct RELEASE_GATE level.

Step 5: READ BUSINESS_VERIFICATION_MATRIX
         → Identify first ⏳ gate on current flow.
         → This is your target.

Step 6: SEARCH ROOT_CAUSE_DATABASE
         → Before writing any fix code: search for existing RCA.

Step 7: CHECK PRODUCTION_DATASET version
         → Confirm your tests reference the correct dataset version.

Step 8: EXECUTE (per AUTOMATION_FSM)
         → DISCOVER → IMPLEMENT → VERIFY → CLOSE
```

---

## Document Reading Order (Full)

| # | Document | Purpose |
|---|----------|---------|
| 1 | [EOS_OPERATOR_DASHBOARD.md](engineering/EOS_OPERATOR_DASHBOARD.md) | **Current state + next action** |
| 2 | [ENGINEERING_CONSTITUTION.md](engineering/ENGINEERING_CONSTITUTION.md) | Inviolable rules |
| 3 | [AUTOMATION_FSM.md](engineering/AUTOMATION_FSM.md) | Execution state machine |
| 4 | [DEPENDENCY_GRAPH.md](engineering/DEPENDENCY_GRAPH.md) | Critical path order |
| 5 | [BUSINESS_VERIFICATION_MATRIX.md](engineering/BUSINESS_VERIFICATION_MATRIX.md) | Gate status — source of truth |
| 6 | [ROOT_CAUSE_DATABASE.md](engineering/ROOT_CAUSE_DATABASE.md) | Known bugs — search before fix |
| 7 | [PRODUCTION_DATASET.md](engineering/PRODUCTION_DATASET.md) | E2E dataset version |
| 8 | [RELEASE_GATE.md](engineering/RELEASE_GATE.md) | Release level requirements |
| 9 | [PROJECT_CONTEXT.md](engineering/PROJECT_CONTEXT.md) | Technical context |
| 10 | [SYSTEM_OVERVIEW.md](architecture/SYSTEM_OVERVIEW.md) | Architecture |
| 11 | [PRODUCT_SPEC.md](product/PRODUCT_SPEC.md) | Product requirements |
| 12 | [KNOWN_ISSUES.md](engineering/KNOWN_ISSUES.md) | Active known issues |

---

## Update Flow (after session)

```
Evidence captured
      ↓
BUSINESS_VERIFICATION_MATRIX updated
      ↓
PRODUCTION_SCORE updated
      ↓
MODULE_STATUS updated (if threshold crossed)
      ↓
EOS_OPERATOR_DASHBOARD regenerated
      ↓
git commit
```

**Do NOT update MODULE_STATUS directly. Always update BVM first.**
