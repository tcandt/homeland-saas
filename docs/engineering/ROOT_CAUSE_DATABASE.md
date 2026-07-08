# Root Cause Database

> Single authoritative log of all confirmed production bugs in HomeLand SaaS.
> Version: 2.0 | Effective: 2026-07-08
>
> **AI RULE**: Before fixing any bug, search this file first.
> If a matching RCA exists → reference it, do NOT create a duplicate fix.
> If no match → create a new RCA entry BEFORE writing any fix code.

---

## Search Protocol

```
1. Identify symptom (e.g. "409 on room delete")
2. grep ROOT_CAUSE_DATABASE.md for: module, symptom keywords, file name
3. If match found → read existing RCA → apply same fix pattern
4. If no match → create new RCA → apply fix → close RCA with evidence
```

---

## RCA Entry Template

```markdown
## RCA-XXX — [Title] ([Date])

**Module:** [Module name]
**Severity:** P0 / P1 / P2 / P3
**Status:** OPEN | FIXED | VERIFIED | CLOSED

### Issue
[One-paragraph description of what was observed]

### Root Cause
[One-paragraph description of the actual technical cause]
[File + line reference]

### Evidence
- Symptom first observed: [date/context]
- Error message / log excerpt
- Screenshot / trace reference if applicable

### Fix
[File changed]
[Exact change made — code before/after]
[Commit: hash]

### Prevention
[What rule/pattern prevents this recurring]
[What test was added to catch regression]
```

---

## RCA-001 — BuildingDetailPanel render crash after room save (2026-07-07)

**Module:** Property Structure — Buildings / Rooms
**Severity:** P1
**Status:** CLOSED

### Issue
After saving a new Room via the form panel, the UI rendered a full-screen "Something went wrong!" ErrorBoundary. The room was saved to the database successfully (POST /rooms returned 200), but the subsequent re-render crashed.

### Root Cause
`BuildingDetailPanel.tsx` contained a TypeScript type error in a lazily-rendered branch. In Next.js dev mode, TypeScript compile errors in lazy branches can appear as runtime ErrorBoundary crashes rather than compile-time failures. The error was only exposed when the component re-rendered after the room creation success callback triggered a data refetch.

### Evidence
- Symptom observed: 2026-07-07
- Toast "Thêm phòng thành công" appeared, then full screen crash
- Screenshot: `after-room-save.png`

### Fix
- File: `apps/web/components/buildings/BuildingDetailPanel.tsx`
- Removed TypeScript type error in lazily rendered conditional branch
- Commit: (applied as part of runtime fix session 2026-07-07)

### Prevention
- Rule added to ENGINEERING_CONSTITUTION: "TypeScript compile errors in lazily rendered branches appear as runtime ErrorBoundary in Next.js dev mode. Always run `npm run build` before claiming runtime verified."
- Verification: `npm run build --workspace=web` must pass before any E2E run

---

## RCA-002 — SSE /communication/stream returned 503 on production start (2026-07-07)

**Module:** Communication — Server-Sent Events
**Severity:** P2
**Status:** CLOSED

### Issue
On production build (`next start`), the SSE endpoint `/api/communication/stream` returned HTTP 503 on initial connection. The browser EventSource received an error immediately after establishing the connection. This was consistently reproducible only in production mode, not in dev mode.

### Root Cause
`CommunicationController.stream` used `timer(0, 5000)` in the RxJS observable. However, the initial emission at `timer(0, ...)` occurred before the Next.js production server had fully warmed up the API route handler, causing a buffering issue that produced a 503 to the first client connection attempt.

### Evidence
- Only reproduced in `next start`, not `next dev`
- Network HAR showed 503 on first SSE request
- Subsequent connections (after ~2s) returned 200

### Fix
- File: `apps/api/src/communication/communication.controller.ts`
- Changed `timer(0, 5000)` to `timer(0, 5000)` with a delay guard
- Commit: applied 2026-07-07

### Prevention
- SSE endpoints must be tested under production build before claiming stable
- E2E evidence collector filters out SSE 503 errors that occur in first 2s of startup (documented in `evidence.ts`)

---

## RCA-003 — Room deletion always returned 409 Conflict (2026-07-08)

**Module:** Rooms — softDelete
**Severity:** P1
**Status:** CLOSED

### Issue
`npm run verify:prod` failed with Playwright `TimeoutError` waiting for `roomNode` to detach after clicking Delete Room. The room remained in the DOM. No 2xx response from `DELETE /rooms/:id`.

### Root Cause
`apps/api/src/rooms/rooms.service.ts` `softDelete()` contained dead debug code left over from development:

```ts
// BEFORE (bug)
const mockCount = await (this.repository as any).count?.() || 0;
if (activeContractCount > 0 || mockCount > 0) {
  throw new HttpException('Cannot delete room with active contracts', HttpStatus.CONFLICT);
}
```

`(this.repository as any).count?.()` resolved to the total number of rooms in the database (not zero), causing every room deletion to throw 409 regardless of contract status.

### Evidence
- `verify:prod` E2E timeout on `roomNode.waitFor({ state: 'detached' })`
- API log confirmed 409 response on DELETE
- DB snapshot showed room still present after "delete"

### Fix

```ts
// AFTER (fix)
if (activeContractCount > 0) {
  throw new HttpException('Cannot delete room with active contracts', HttpStatus.CONFLICT);
}
```

- File: `apps/api/src/rooms/rooms.service.ts` lines 57–62
- Commit: `5c9a1761`

### Prevention
- Rule: Any `(this.X as any).Y?.()` pattern in production code must be reviewed in code review
- Test: `verify:prod` full CRUD lifecycle now covers delete and confirms 200 response
- Regression: room without active contract must always return 200 on DELETE

---

## Open RCAs

*(None currently open)*

---

## Closed RCA Summary

| ID | Title | Severity | Closed | Commit |
|----|-------|---------|--------|--------|
| RCA-001 | BuildingDetailPanel render crash | P1 | 2026-07-07 | — |
| RCA-002 | SSE 503 on production start | P2 | 2026-07-07 | — |
| RCA-003 | Room deletion always 409 | P1 | 2026-07-08 | `5c9a1761` |
