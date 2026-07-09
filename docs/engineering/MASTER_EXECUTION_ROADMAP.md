# Master Execution Roadmap

> Epic execution order for the Homeland SaaS platform.

| Epic ID | Domain | Status | Notes |
|---------|--------|--------|-------|
| 01 | Auth | ✅ CLOSED | Core RBAC and JWT flow stable. |
| 02 | Property & Customer | ✅ CLOSED | Buildings, Floors, Rooms, Customers active. |
| 03 | Contract Workflow | ✅ CLOSED | Lifecycle state machine from Draft to Terminate fully enforced. |
| 04 | Invoice Generation | ⏳ NEXT | Must hook into contract activation and termination. |
| 05 | Payment Receipt | ⏳ PENDING | Depends on Invoice Generation. |
| 06 | Accounting Update | ⏳ PENDING | Depends on Payment Receipt. |
| 07 | Dashboard & Reports | ⏳ PENDING | Depends on Accounting. |
| 08 | Notifications | ⏳ PENDING | Background crons and SSE. |
