# Production Gate

The Production Gate defines the absolute threshold for a module to be declared PRODUCTION READY. 
Passing a standard Playwright E2E test is **not enough**. 

## Module Status Definitions

- **PRODUCTION CANDIDATE**: A module that has passed local UI/API Runtime CRUD verification **AND local Production Build Verification**, but has not yet met the full Evidence Package, DB, Performance, Concurrency, and Staging/CI requirements.
- **PRODUCTION READY**: A module that has satisfied all 14 steps of the Verification Pipeline, including full CI/Staging evidence.

## 5-Phase Reliability Roadmap
1. **Production Build Verification**: All tests must run against the optimized production bundle (`npm run start`), eliminating Next.js HMR/dev server noise.
2. **Production Smoke Suite**: Dedicated `*.production.spec.ts` suite running strictly without mocks or dev tools.
3. **Evidence Score Engine**: Systematically scoring the Evidence Package (0-100%).
4. **Concurrency**: Robust testing against race conditions (e.g., dual edits, simultaneous check-ins).
5. **Stress / Performance**: Benchmarking at volume (e.g., 1000s of rooms/contracts).

### Property Module Status
Currently, the Property Module remains:
- **Production Candidate** ✅
- **Production Ready** ❌
- **Production Build Verification**: PENDING (Local script implemented)

## 14-Step Verification Pipeline

Every module must automatically pass the following standard pipeline:
1. **DISCOVER**: Identify requirements and system state.
2. **ROOT CAUSE**: If fixing bugs, find the definitive root cause.
3. **IMPLEMENT**: Write the code without taking shortcuts.
4. **UNIT**: Unit test domain logic.
5. **INTEGRATION**: Integration test API boundaries.
6. **E2E**: End-to-end automation with Playwright.
7. **DB VERIFY**: Explicit Database state validation post-action.
8. **PERFORMANCE**: Network request limits and rendering metrics.
9. **SECURITY**: RBAC, tenant isolation, and security headers.
10. **CONCURRENCY**: Optimistic concurrency control and race conditions.
11. **RUNTIME**: 0 ErrorBoundaries, 0 console errors, graceful degradation.
12. **PRODUCTION SCORE**: Calculated metrics across all gates.
13. **COMMIT**: Merge with evidence.
14. **UPDATE EOS**: Reflect the new verifiable state in Documentation.

## Core Rule
**If evidence is missing, status = UNKNOWN or PARTIAL, never PASS.** Tooling follows policy.
