# Invoice Module Gap Report

## Current State Assessment
We are starting Epic 04: Invoice Generation. Based on the Prisma schema and the required Aggregate Design, here is the current gap:

### Existing Entities
- `Invoice`: Exists, but is quite flat. Contains `subtotal`, `discount`, `total`, `paidAmount`, `creditAmount`. Lacks detailed line items.
- `Payment`: Exists, linked directly to `Invoice`.
- `CreditNote`: Exists.

### Missing Entities (Gap)
- `InvoiceItem`: **Missing**. Essential for breaking down the invoice (e.g., rent vs. utilities vs. penalties).
- `UtilityReading`: **Missing**. Need a way to track electricity/water indices per room/month.
- `Penalty` / `Discount`: Currently `discount` is just a decimal on the `Invoice`. Need to determine if these require full entities or can be modeled as `InvoiceItem` with negative/positive amounts.
- `PaymentAllocation`: Currently `Payment` maps 1:1 to `Invoice`. If a single payment can cover multiple invoices, or if we need to track exactly which items a payment covered, we need an allocation mapping table.

### State Differences
- The requested FSM uses `PARTIALLY_PAID` and `WRITTEN_OFF`.
- The DB schema `InvoiceStatus` enum has `PARTIAL` and `CREDITED`.
- We need to either align the codebase to the existing schema values, or migrate the schema. Given we prefer minimal incompatible schema migrations unless absolutely necessary, we should evaluate if we can just rename them in the schema since this module is newly being built.

## Next Actions
- Define the FSM explicitly.
- Define the Schema Impact Review.
- Draft the compatibility matrix and make workflow decisions.
