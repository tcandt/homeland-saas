# Test Matrix

| ID | Phase | Scenario | Precondition | Expected | Actual | Status | Severity | Bug | Evidence |
|---|---|---|---|---|---|---|---|---|---|
| CBV-P0-001 | 0 | Local health | services running | Web/API/DB available | API 200; web 200; DB/Redis listening | PASS | — | — | local baseline |
| CBV-P0-002 | 0 | Auth + dashboard | active local admin | authenticated dashboard data renders | Dashboard renders KPIs/buildings/activities after API restart | PASS | — | — | browser 1366×720 |
| CBV-P1-002 | 1 | Deposit ledger screen | authenticated admin | deposit statuses/totals load without auth error | 7 deposits and totals rendered | PASS | P1 | — | browser 1366×720 |
| CBV-P1-001 | 1 | Whole-unit browser flow | active test account; desktop ≥1366×720 | complete lifecycle and reconciled totals | setup verified: room PN 31-04 switched to whole-unit; synthetic tenant and contract created; contract deposit DC-HD-PN 31-04-5810 is awaiting collection | PENDING | P1 | — | BROWSER_EVIDENCE.md |
| CBV-P2-001 | 2 | Shared-room A/B isolation | two customers, same room | independent contracts, cycles, deposits, invoices | pending | PENDING | P0 | — | — |
