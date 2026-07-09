# Invoice Backend Verification Plan

## E2E Backend Workflow Tests

### Path A: Full Payment
1. Contract becomes `ACTIVE` -> Invoice `DRAFT` created with 1 `RENT` item.
2. `POST /issue` -> Status becomes `ISSUED`.
3. `POST /pay` (amount < total) -> Status becomes `PARTIALLY_PAID`, `PaymentAllocation` created.
4. `POST /pay` (amount = remaining) -> Status becomes `PAID`, `PaymentAllocation` created.

### Path B: Cancellation
1. Invoice `DRAFT` created.
2. `POST /issue` -> Status `ISSUED`.
3. `POST /cancel` -> Status `CANCELLED`.

### Path C: Write Off
1. Invoice `DRAFT` -> `ISSUED`.
2. `POST /pay` -> `PARTIALLY_PAID`.
3. `POST /writeoff` -> `WRITTEN_OFF`.

## Database Verification
- `Invoice.status` matches expected.
- `Invoice.paidAmount` == sum of all `PaymentAllocation` amounts.
- `AuditLog` verifies CREATE/UPDATE actions per state change.
- `InvoiceItem` correctly factors into `Invoice.total` equation.
