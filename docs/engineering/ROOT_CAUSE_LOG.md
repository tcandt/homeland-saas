# Root Cause Log

(Append all verified root causes here)

---

## RCA-003 — Room Delete Always 409 Conflict (2026-07-08)

**Symptom:** `npm run verify:prod` failed. Playwright `TimeoutError` waiting for `roomNode` to detach after clicking Delete Room. The room remained in the DOM.

**Root Cause:** `apps/api/src/rooms/rooms.service.ts` `softDelete()` contained dead debug code:
```ts
const mockCount = await (this.repository as any).count?.() || 0;
if (activeContractCount > 0 || mockCount > 0) {
  throw new HttpException('Cannot delete room with active contracts', HttpStatus.CONFLICT);
}
```
`(this.repository as any).count?.()` resolved to a truthy count (total DB rows), causing a 409 Conflict for every room deletion regardless of contract status.

**Fix:** Removed `mockCount` check. Guard is now `if (activeContractCount > 0)` only.

**Verified:** `npm run verify:prod` — 1 passed, 0 failed.

---
