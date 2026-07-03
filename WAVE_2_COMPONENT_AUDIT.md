# Wave 2 Component Audit Report

This report tracks the remaining raw UI primitives and custom implementations across `apps/web` after Wave 1 and Wave 2 refactoring efforts.

## Summary of Findings

- **Raw `<button>`**: ~238 instances remaining (mostly in `components/settings`, `components/tasks`, `components/auth`, etc.)
- **Raw `<input>`**: >50 instances remaining
- **Raw `<select>`**: >20 instances remaining
- **Custom `Drawer` implementations**: Several instances found (e.g., in `components/tasks/OperationsDetailDrawer.tsx` still using overlay divs instead of primitive `Drawer`)
- **Custom `Badge` implementations**: Found in several un-migrated components using `span` with arbitrary color classes.

## Next Steps
Before proceeding to Sprint 3.10.3 (Security & Performance Audit), we must initiate **Wave 3: Settings & Tasks Refactoring** to clear all remaining violations to meet the 0 raw primitives requirement.
