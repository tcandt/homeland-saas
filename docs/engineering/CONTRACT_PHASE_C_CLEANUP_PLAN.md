# Contract Phase C: Legacy Cleanup Plan

> **Objective:** Permanently remove the legacy `ENDED` status from the system following successful backward compatibility and data migration rollout.
> **Date:** 2026-07-08
> **Status:** Phase C Completed. Ready for Workflow Implementation.

---

## 1. Scope and Objective

This phase concludes the `Expand -> Migrate -> Contract` lifecycle by performing the **Contract (Cleanup)** phase.
This phase focuses strictly on removing legacy footprint.

**Forbidden Actions in this Phase:**
- 🚫 No implementation of business workflow endpoints (Approve / Terminate).
- 🚫 No implementation of UI workflow actions.
- 🚫 No side effects in Invoices, Payments, or Accounting logic.

## 2. Execution Steps

### Step 1: Database Verification
- Double-check that `ENDED` count is precisely `0` using Prisma aggregation to guarantee that the `enum` drop will not cause data truncation errors.

### Step 2: Prisma Schema Cleanup
- Remove `ENDED` from `enum ContractStatus` in `schema.prisma`.
- Generate and apply a new Prisma migration (`remove_legacy_ended_status`).

### Step 3: Backend Adapter Cleanup
- **Remove** `ContractStatus.ENDED` references from `apps/api/src/contracts/contracts.adapter.ts`.
- **Remove** any unit test blocks verifying `ENDED` normalization.

### Step 4: Frontend Status Cleanup
- **Remove** the legacy `ENDED` fallback configuration from `CONTRACT_STATUS_MAP` in `apps/web/lib/contracts/contract-status.ts`.
- Check if any components explicitly reference `ENDED` (should be none, but perform grep search).

### Step 5: Global Sweeps
- Search the entire codebase (`apps/api`, `apps/web`, `docs`, `tests`) for occurrences of `ENDED` to ensure absolute cleanup.

### Step 6: Verification and Tests
- Run `npm run build --workspace=api`
- Run `npm run test --workspace=api`
- Run `npm run build --workspace=web`
- Run `npm run typecheck --workspace=web`
- Run `npm run verify:prod`

## 3. Rollout Criteria
Phase C will be marked as **COMPLETED** when:
- Prisma migration is successfully generated and applied with no data warnings.
- Sweeps confirm 0 usages of `ENDED`.
- All `verify:prod` validations pass.
- System functions correctly strictly on the new FSM state machine without legacy support.
