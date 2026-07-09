# Invoice Workflow Decisions

1. **Strict Command Pattern**: Generic `PATCH /invoices/:id` is banned. State transitions will happen exclusively via explicit POST endpoints (`/issue`, `/pay`, `/cancel`, `/writeoff`) to ensure side-effects (Audit, Notifications) are triggered robustly.
2. **Immutability of Issued Invoices**: Once `ISSUED`, an invoice's items and total cannot be changed. If a mistake is made, it must be `CANCELLED` and a new one generated.
3. **Payments Handling**: Actual payment gateway processing belongs in Epic 05. For Epic 04, the `/pay` endpoint simulates recording an offline/manual payment. It will create the required `PaymentAllocation` automatically.
4. **Contract Dependency**: Initial issue logic currently inside `ContractService.activate` must be updated to insert a valid `InvoiceItem` (e.g., `RENT`) instead of just a raw subtotal, maintaining aggregate invariants.
