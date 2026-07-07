# Runtime Gate

The Runtime Gate verifies that the application does not crash, throw unhandled exceptions, or lose state across standard navigation flows.

## Requirements

### 1. Zero ErrorBoundaries
- The React ErrorBoundary must never trigger during standard user flows. A lazy-compilation TypeScript error, a null-reference exception in a component, or an unhandled Promise rejection is an instant failure.

### 2. Zero Console Errors
- Playwright E2E tests must attach to the browser console and actively assert that console.error is NEVER called. If a module throws React warnings, Next.js hydration errors, or raw console errors, it fails the Runtime Gate.

### 3. Graceful Degradation
- Simulate 500 Server Errors, network disconnects, or API timeouts. The UI must handle these gracefully with appropriate Toasts or Error States, NOT by crashing or freezing.

### 4. Reload Persistence
- Every action must survive a hard refresh (F5). If creating an entity updates the UI but disappears on reload (due to missing DB persistence or incorrect cache logic), it fails.
