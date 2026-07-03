# Console Error Report (Sprint 3.10.5)

## Overview
As part of the Playwright Production Acceptance Gate, we enforce a STRICT `0 Console Errors` policy. The global handler `global-handler.ts` intercepts all console errors and fails the test.

## Exemptions (Currently Allowed)
The following expected behaviors are temporarily or permanently exempted in the Global Handler:
1. **`favicon.ico` (404)**: Next.js missing favicon in test env. (Permanent Exemption).
2. **`status of 500` / `status of 400` / `status of 404`**: Deliberately caused by Network Route Mocking (e.g. testing Dashboard 500 error state) or Next.js layout fetching during logout navigation.
3. **`SSE Error, falling back to polling`**: Known fallback mechanism when Server-Sent Events fail in the test runner. (Permanent Exemption).
4. **`Failed to fetch RSC payload`**: Next.js behavior during logout when session cookies are cleared rapidly and the browser falls back to a hard navigation.

## Unhandled Errors Found
**None!**
All unhandled application console errors now correctly fail the CI pipeline. The complete Level 1 Smoke Suite (Auth, Dashboard, Buildings, Sales, Finance) passed with 0 unhandled console errors.
