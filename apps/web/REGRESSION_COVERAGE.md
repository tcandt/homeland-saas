# Level 2 Regression Coverage Matrix

| Module | CRUD | Permission | Error | Persistence | Cross Module |
|--------|------|------------|-------|-------------|--------------|
| Customers | ✅ | ✅ | ✅ | ✅ | ✅ |
| Contracts | ✅ | ✅ | ✅ | ✅ | ✅ |
| Deposits | ✅ | ✅ | ✅ | ✅ | ✅ |
| Invoices | ✅ | ✅ | ✅ | ✅ | ✅ |
| Finance | ✅ | ✅ | ✅ | ✅ | ✅ |
| Documents | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ |
| Notifications| ⏳ | ⏳ | ⏳ | ⏳ | ⏳ |
| Automation | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ |
| AI | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ |

**Goal**: Full vertical regression ensuring real business workflows function correctly with cross-module consistency and strict RBAC isolation.

## Status Updates
- **Finance Core Regression**: PASS ✅
  - repeat-each=3: PASS (21/21)
  - API Ledger, Cashflow, P&L verified: PASS
  - Export CSV calls real API & verifies response headers: PASS
  - UI Data rendering verified: PASS
- **Sales Core Regression**: PASS ✅
  - repeat-each=3: PASS
  - total runs: 21/21
  - pgvector schema restored: PASS
  - no flaky auth cache: PASS
  - ledger side-effect verified via API journalEntry.description: PASS
  - UI virtualization no longer weakens assertion: PASS
- **Sales RBAC Regression**: PASS ✅
