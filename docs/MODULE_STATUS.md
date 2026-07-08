# Module Status

> ⚠️ **DERIVED DOCUMENT — DO NOT EDIT DIRECTLY**
> This file is derived from: `BUSINESS_VERIFICATION_MATRIX` → `PRODUCTION_SCORE` → here.
> To update: update a BVM gate with evidence → recalculate PRODUCTION_SCORE → update this file.
> See [EOS_ARCHITECTURE.md](engineering/EOS_ARCHITECTURE.md) for update protocol.
> Version: 2.0 | Last Updated: 2026-07-08


| Module | CRUD | Business | Unit | Integration | E2E | Security | Performance | Production |
| ------ | ---- | -------- | ---- | ----------- | --- | -------- | ----------- | ---------- |
| Auth | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | 90 |
| Customer (Tenants) | ✅ (Full) | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ LOCAL VERIFIED |
| Buildings | ✅ (Full) | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ LOCAL VERIFIED |
| Floors | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ | ✅ LOCAL VERIFIED |
| Rooms | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ | ✅ LOCAL VERIFIED |

### 2. Customer (Tenants)
* **Goal**: Manage tenants.
* **Status**: `PRODUCTION CANDIDATE` — Production Build verified 2026-07-08.

#### What was verified (Evidence on file)
| Step | Method | Status |
|------|--------|--------|
| Create Customer | UI (Playwright testId click + form fill) | ✅ |
| Edit Customer | UI (Playwright testId click + form fill) | ✅ |
| Delete Customer | UI (Playwright testId click + confirm dialog) | ✅ |
| List Customers | UI (Playwright verify card rendered) | ✅ |
| DB Snapshot after Create | Prisma direct query | ✅ |
| DB Snapshot after Delete | Prisma direct query | ✅ |
| Production Build | `npm run verify:prod` 1/1 passed | ✅ |
| No ErrorBoundary | Browser console verified | ✅ |

#### What is NOT yet verified
| Item | Status |
|------|--------|
| Upload ID Images | ⏳ Not built |
| Pagination & Search | ⏳ Not verified |

### 1. Property Structure (Buildings, Floors, Rooms)
* **Goal**: Manage physical structures that are rented out.
* **Status**: `PRODUCTION CANDIDATE` — Production Build verified 2026-07-08.

#### What was verified (Evidence on file)
| Step | Method | Status |
|------|--------|--------|
| Create Building | UI (Playwright testId click + form fill) | ✅ |
| Create Floor | UI (Playwright testId click + form fill) | ✅ |
| Create Room | UI (Playwright testId click + form fill) | ✅ |
| Edit Room (price change) | UI (Playwright form fill + save) | ✅ |
| Delete Room | UI (Playwright testId click + confirm dialog) | ✅ |
| Delete Floor | UI (Playwright testId click + confirm dialog) | ✅ |
| Delete Building | UI (Playwright testId click + confirm dialog) | ✅ |
| Persistence (reload) | Browser reload + tree re-select | ✅ |
| DB Snapshot after Create | Prisma direct query | ✅ |
| DB Snapshot after Delete | Prisma direct query (soft-deleted, null) | ✅ |
| Production Build | `npm run verify:prod` 1/1 passed | ✅ |
| No ErrorBoundary | Browser console verified | ✅ |

#### What is NOT yet verified
| Item | Status |
|------|--------|
| Floor premium detail panel (rich edit form) | ⏳ Not built |
| Room premium detail panel (full tenant/contract view) | ⏳ Not built (RoomPremiumModal uses mock data) |
| Smoke Suite (Phase 2) | ⏳ Not started |
| Regression Suite | ⏳ Not started |
| Concurrency Tests | ⏳ Not started |
| Performance / Load | ⏳ Not started |

