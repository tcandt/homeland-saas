# Epic Master Spec

> Homeland SaaS Platform - Master Execution Specification
> This document defines the entire sequence of 11 Epics, their dependencies, the Definition of Done (DoD), and the Verification Gates.

## Epic Sequence & Dependencies

| Epic ID | Name | Dependencies | Status |
|---------|------|--------------|--------|
| 01 | Auth | None | ✅ CLOSED |
| 02 | Property & Customer | Auth | ✅ CLOSED |
| 03 | Contract | Property & Customer | ✅ CLOSED |
| 04 | Invoice | Contract | ⬅️ IN PROGRESS |
| 05 | Payment | Invoice | ⏳ PENDING |
| 06 | Accounting | Payment | ⏳ PENDING |
| 07 | Dashboard & Reports | Accounting | ⏳ PENDING |
| 08 | Notifications | Dashboard & Reports | ⏳ PENDING |
| 09 | Maintenance | Notifications | ⏳ PENDING |
| 10 | AI Assistant | Maintenance | ⏳ PENDING |
| 11 | Production Hardening | AI Assistant | ⏳ PENDING |
| 12 | v1.0 Release Candidate | Production Hardening | ⏳ PENDING |

## Definition of Done (DoD) & Verification Gate

An Epic transitions from `IN PROGRESS` to `CLOSED` ONLY when it successfully passes the **Verification Gate**.

### Verification Gate Requirements

1. **Domain Model & FSM Finalized**: Clear states, transitions, and invariants are documented and enforced by the code.
2. **Backend API Completeness**: All required REST commands/queries are built, integrated with Prisma, and logged via Audit service.
3. **Frontend UI Completeness**: The workflow is fully supported via the UI with optimistic updates, proper RBAC checks, and error handling. No mock data.
4. **Unit & Integration Tests**: All business logic passes isolated and integrated tests.
5. **Full E2E Verification**: Playwright tests cover the entire business flow, asserting not just UI, but also DB state and Audit logs.
6. **Production Build verified**: `npm run verify:prod` passes perfectly, proving Next.js compilation, type-safety, and test coverage.
7. **EOS Docs Updated**: The `BUSINESS_VERIFICATION_MATRIX.md`, `PRODUCTION_SCORE.md`, `MODULE_STATUS.md`, and `EOS_OPERATOR_DASHBOARD.md` reflect the Epic's true state.
8. **Closure Report**: An `EPIC_XX_CLOSURE_REPORT.md` is generated detailing the execution.

## Transitioning Epics

The AI agent executes an Epic autonomously until it meets the Verification Gate. Once verified:
1. Generates the Closure Report.
2. Updates this `EPIC_MASTER_SPEC.md` to mark the Epic as `CLOSED`.
3. Marks the next Epic as `IN PROGRESS`.
4. Continues without requiring manual "what's next?" prompts from the user.
