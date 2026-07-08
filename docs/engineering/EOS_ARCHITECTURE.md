# EOS Architecture v2.0

> HomeLand Engineering Operating System — Document Hierarchy and Update Protocol
> Version: 2.0 | Effective: 2026-07-08

---

## Principle: Single Source of Truth

`BUSINESS_VERIFICATION_MATRIX` is the **only source from which status flows**.

```
Evidence (test run, DB snapshot, console log)
        │
        ▼
BUSINESS_VERIFICATION_MATRIX.md  ← only document updated directly from evidence
        │
        ▼
PRODUCTION_SCORE.md               ← derived from BVM gate counts
        │
        ▼
MODULE_STATUS.md                  ← derived from PRODUCTION_SCORE
        │
        ▼
EOS_OPERATOR_DASHBOARD.md        ← derived from all above (display only)
```

### FORBIDDEN

```
❌  Updating MODULE_STATUS.md directly without updating BVM first
❌  Claiming a gate ✅ without captured evidence
❌  Updating PRODUCTION_SCORE without a BVM gate change
❌  Skipping a module in DEPENDENCY_GRAPH critical path
❌  Fixing a bug that matches an RCA in ROOT_CAUSE_DATABASE without referencing it
```

---

## Document Registry

| Document | Role | Updated By |
|----------|------|-----------|
| `BUSINESS_VERIFICATION_MATRIX.md` | Source of truth for all verification gates | Test evidence only |
| `PRODUCTION_SCORE.md` | Derived gate scores per module | Derived from BVM |
| `MODULE_STATUS.md` | High-level status table | Derived from PRODUCTION_SCORE |
| `EOS_OPERATOR_DASHBOARD.md` | Session start dashboard | Derived from all above |
| `DEPENDENCY_GRAPH.md` | Module execution order | Manually, with approval |
| `ROOT_CAUSE_DATABASE.md` | All verified bugs | One entry per confirmed fix |
| `PRODUCTION_DATASET.md` | E2E standard dataset | Versioned, with changelog |
| `RELEASE_GATE.md` | Release level definitions | Architecture decisions only |
| `RELEASE_CHECKLIST.md` | Pre-release verification list | Updated on each release |
| `AUTOMATION_FSM.md` | AI execution state machine | Architecture decisions only |
| `ENGINEERING_CONSTITUTION.md` | Inviolable rules | Never modified during execution |

---

## Update Protocol

### When a test PASSES a gate:
1. Open `BUSINESS_VERIFICATION_MATRIX.md`
2. Update the specific gate from `⏳` to `✅`
3. Recalculate flow coverage percentage
4. Open `PRODUCTION_SCORE.md` → recalculate module score
5. Open `MODULE_STATUS.md` → update status (only if score threshold crossed)
6. Open `EOS_OPERATOR_DASHBOARD.md` → regenerate dashboard
7. Commit: `docs(bvm): mark [Gate] ✅ for [Flow/Module] — Evidence: [test name]`

### When a test FAILS (root cause found):
1. Open `ROOT_CAUSE_DATABASE.md`
2. Check: does this match an existing RCA?
   - If YES → reference existing RCA, do NOT create duplicate
   - If NO → create new RCA entry
3. Apply ONE fix
4. Re-run verification
5. If PASS → close RCA, update BVM gate

### When adding a new dataset version:
1. Open `PRODUCTION_DATASET.md`
2. Increment version (v1.0 → v1.1)
3. Document what changed
4. Update all test files that reference the old version

---

## Violation Policy

If any document is updated out-of-order (e.g., MODULE_STATUS updated without BVM update), the update must be reverted and re-applied through the correct flow.

**No exceptions.**
