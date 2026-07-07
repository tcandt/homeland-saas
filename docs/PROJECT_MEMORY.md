# Project Memory

**LONG-TERM IMMUTABLE MEMORY.**

- **Mandatory Startup Protocol**: EOS is the mandatory startup protocol. Any AI session MUST read `PROJECT_INDEX.md` then `PROJECT_BOOTSTRAP.md` before touching code.
- **Verified Root Causes**: (Append here)
- **Architecture Decisions**: 
  - Use `127.0.0.1` over `localhost` in tests.
  - Local Mirror First.
- **Anti-Patterns (BANNED)**:
  - Greenwashing CI
  - Placeholder tests (`passWithNoTests`, `continue-on-error`)
  - Mocking business logic just to pass tests.
- **Lessons Learned**:
  - Playwright session cache issues.
