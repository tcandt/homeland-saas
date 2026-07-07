# Project Memory

**LONG-TERM IMMUTABLE MEMORY.**

- **Mandatory Startup Protocol**: EOS is the mandatory startup protocol. Any AI session MUST read `PROJECT_INDEX.md` then `PROJECT_BOOTSTRAP.md` before touching code.
- **Verified Root Causes**:
  - Auth Foundation Gap: Frontend Auth flows (register, forgot-password, reset-password) are completely mocked with `setTimeout`. Backend `auth.service.ts` uses `TODO`s instead of using existing Prisma schema fields for tokens and login history.
- **Architecture Decisions**:
  - Use `127.0.0.1` over `localhost` in tests.
  - Local Mirror First.
- **Anti-Patterns (BANNED)**:
  - Greenwashing CI
  - Placeholder tests (`passWithNoTests`, `continue-on-error`)
  - Mocking business logic just to pass tests.
  - Confusing feature verification with module readiness (`Feature-level verified ≠ Module-level production ready`). For example: `Customer List verified` không đồng nghĩa `Customer module verified`.
- **Lessons Learned**:
  - Playwright session cache issues.
