# Invoice Epic Phase Roadmap

## Phase 1: Schema & Aggregate Foundation
- Modify `schema.prisma`: Add `InvoiceItem`, `PaymentAllocation`. Update `InvoiceStatus`.
- Run migration `npx prisma migrate dev`.
- Fix existing `ContractService` tests and implementation affected by `InvoiceStatus` renaming and item requirements.

## Phase 2: Command Handlers
- Implement `POST /invoices/:id/issue`
- Implement `POST /invoices/:id/pay` (Simulated cash/transfer recording)
- Implement `POST /invoices/:id/cancel`
- Implement `POST /invoices/:id/writeoff`
- Build unit & integration tests mapping to the FSM.

## Phase 3: Frontend UI Components
- Update Invoice List to show correct badges.
- Create Invoice Detail Drawer containing:
  - Invoice metadata.
  - Line items table (calculating Subtotal, Utilities, Penalty, Discount).
  - Payment Allocations list.
  - Action Buttons (Issue, Pay, Cancel, Write Off).
- Wire up React Query mutations.

## Phase 4: Verification & EOS Closure
- Build `invoice-workflow.e2e.spec.ts`.
- Run full Production Build `verify:prod`.
- Update EOS documentation (`BUSINESS_VERIFICATION_MATRIX.md`, `PRODUCTION_SCORE.md`, `MODULE_STATUS.md`).
- Generate `EPIC_04_INVOICE_CLOSURE_REPORT.md`.
