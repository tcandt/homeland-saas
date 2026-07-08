# Contract Phase Roadmap

> **Objective:** Execute the zero-downtime `Expand → Migrate → Contract` schema update for the `ContractStatus` enum across the entire SaaS platform.
> **Date:** 2026-07-08

---

## Phase A: Expand
✅ **STATUS: COMPLETED**

- **Objective:** Add new FSM enums without dropping the legacy enum. Add backend compatibility adapter to prevent type crashes.
- **Commit:** `feat(contract): expand status enum with compatibility adapter`

---

## Phase B1: Migration (DB Only)
✅ **STATUS: COMPLETED**

- **Objective:** Execute the data migration to securely convert all `ENDED` records to `EXPIRED` or `TERMINATED` at the DB level.
- **Allowed Changes:**
  - SQL Migration script
  - Data transfer
  - DB Verification
  - Adapter Verification
- **Forbidden Changes:**
  - UI code
  - New endpoints (approve/terminate)
- **Evidence Required:**
  - `db-before.json` / `db-after.json`
  - Count `ENDED` = 0
  - Rollback SQL
  - Migration runtime & logs
- **Exit Criteria:** 0 `ENDED` rows remain, Prisma state is stable.
- **Commit Name:** `feat(contract): migrate legacy contract statuses`

---

## Phase B2: Backend Rollout
✅ **STATUS: COMPLETED**

- **Objective:** Allow backend services to seamlessly handle both new FSM statuses and gracefully tolerate any remaining legacy requests.
- **Allowed Changes:**
  - Read compatibility (enum parsing)
  - Normalize adapter wiring
  - Service/Controller updates
- **Forbidden Changes:**
  - UI code
  - FSM Action Buttons
  - New action endpoints (`POST /approve`)
- **Evidence Required:** Unit test outputs confirming adapter behavior.
- **Exit Criteria:** Backend APIs run without `as any` type bypasses.
- **Commit Name:** `feat(contract): rollout backend status compatibility`

---

## Phase B3: Frontend Rollout
✅ **STATUS: COMPLETED**

- **Objective:** Update UI components to read and filter by the new FSM statuses.
- **Allowed Changes:**
  - `OperationsContractRow`, `ContractTable`, `ContractFilters`, `ContractBadge`, `ContractDrawer`, `ContractForm`
  - Status Mapping functions
- **Forbidden Changes:**
  - Workflow approval logic/buttons
- **Evidence Required:** Screenshots of UI rendering legacy mixed data correctly.
- **Exit Criteria:** UI renders `EXPIRED` and `TERMINATED` natively.
- **Commit Name:** `feat(web): support new contract status lifecycle`

---

## Phase B4: Verification
⏳ **STATUS: PENDING**

- **Objective:** Perform cross-system validation that the entire stack correctly honors the new FSM lifecycle with no regressions.
- **Allowed Changes:** None (Testing Only).
- **Forbidden Changes:** Source Code modifications.
- **Evidence Required:**
  - Unit / Integration / E2E test results
  - DB Verify / Audit Verify / Report Verify / Dashboard Verify
  - Full Evidence Package attached to Git
  - `PRODUCTION_DATASET.md` validation trace
- **Exit Criteria:** All tests pass with `npm run verify:prod`.
- **Commit Name:** `test(contract): verify status migration rollout`

---

## Phase C: Cleanup (Contract)
⏳ **STATUS: PENDING**

- **Objective:** Safely drop the `ENDED` enum from the Prisma schema and delete the backend compatibility adapter, concluding the migration.
- **Allowed Changes:**
  - Remove `ENDED` from `schema.prisma`
  - Drop `contracts.adapter.ts`
  - Refactor Controllers to drop fallback logic
- **Forbidden Changes:**
  - Any new feature logic
- **Evidence Required:** Prisma generate/migrate logs.
- **Exit Criteria:** `ENDED` no longer exists anywhere in the codebase.
- **Commit Name:** `chore(contract): drop legacy ENDED status and adapters`
