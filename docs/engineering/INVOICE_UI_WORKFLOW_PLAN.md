# Invoice UI Workflow Plan

## UI State Machine
- Badges must clearly reflect status: `DRAFT` (Gray), `ISSUED` (Blue), `PARTIALLY_PAID` (Orange), `PAID` (Green), `OVERDUE` (Red), `CANCELLED` (Red/Strikethrough), `WRITTEN_OFF` (Purple).
- The action buttons will be context-aware:
  - `DRAFT`: Show [Issue]
  - `ISSUED`: Show [Record Payment], [Cancel], [Write Off]
  - `PARTIALLY_PAID`: Show [Record Payment], [Write Off]
  - `PAID` / `CANCELLED` / `WRITTEN_OFF`: Read-only.

## Detail Drawer Layout
1. **Header**: Code, Status Badge, Customer Name.
2. **Summary**: Total, Paid Amount, Remaining Balance, Due Date.
3. **Line Items Section**: Table of `InvoiceItem` records.
4. **Allocations Section**: Table of `PaymentAllocation` records (Date, Amount, Payment Ref).
5. **Footer**: Context-aware action buttons.

## Data Integration
- `GET /invoices` (List view)
- `GET /invoices/:id` (Detail view)
- `POST /invoices/:id/...` (Mutations)
- Use standard React Query hooks + invalidate queries on success.
- Evidence required: All buttons must have `data-testid`.
