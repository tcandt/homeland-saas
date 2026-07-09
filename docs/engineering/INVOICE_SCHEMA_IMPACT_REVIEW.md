# Invoice Schema Impact Review

## Proposed Schema Additions & Modifications

### 1. New Model: `InvoiceItem`
Required to satisfy the aggregate invariant: `Invoice total = Items + Utilities + Penalty - Discount`.
```prisma
model InvoiceItem {
  id          String   @id @default(cuid())
  tenantId    String
  invoiceId   String
  type        InvoiceItemType
  description String
  quantity    Decimal  @db.Decimal(14,2)
  unitPrice   Decimal  @db.Decimal(14,2)
  amount      Decimal  @db.Decimal(14,2)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  invoice     Invoice  @relation(fields: [invoiceId], references: [id], onDelete: Cascade)

  @@index([tenantId, invoiceId])
}

enum InvoiceItemType {
  RENT
  UTILITY_WATER
  UTILITY_ELECTRICITY
  SERVICE
  PENALTY
  DISCOUNT
  OTHER
}
```

### 2. Enum `InvoiceStatus` Modification
Current FSM requires: `DRAFT`, `ISSUED`, `PARTIALLY_PAID`, `PAID`, `OVERDUE`, `CANCELLED`, `WRITTEN_OFF`.
Existing Enum in Prisma: `DRAFT`, `ISSUED`, `PARTIAL`, `PAID`, `OVERDUE`, `CANCELLED`, `CREDITED`.

**Action**: 
- Rename `PARTIAL` -> `PARTIALLY_PAID`
- Rename `CREDITED` -> `WRITTEN_OFF`

### 3. New Model: `PaymentAllocation`
To handle the logic `Allocated payment <= Invoice total` cleanly when one Payment covers multiple Invoices or partial items.
```prisma
model PaymentAllocation {
  id          String   @id @default(cuid())
  tenantId    String
  paymentId   String
  invoiceId   String
  amount      Decimal  @db.Decimal(14,2)
  createdAt   DateTime @default(now())

  payment     Payment  @relation(fields: [paymentId], references: [id], onDelete: Cascade)
  invoice     Invoice  @relation(fields: [invoiceId], references: [id], onDelete: Cascade)

  @@index([tenantId, invoiceId])
  @@index([tenantId, paymentId])
}
```

### 4. Relation Updates
- Add `items InvoiceItem[]` to `Invoice` model.
- Add `allocations PaymentAllocation[]` to `Invoice` and `Payment` models.
- If necessary, link `UtilityReading` to `InvoiceItem` or directly to `Invoice`.

## Backward Compatibility Assessment
- **InvoiceItem & PaymentAllocation**: Additions only, 100% backward compatible.
- **InvoiceStatus Renaming**: Might cause Prisma to recreate the enum types. Since no `PARTIAL` or `CREDITED` invoices have been generated yet in production (as Invoice/Payment module isn't active), this is **Safe & Compatible** with existing data.

**Conclusion**: No destructive/incompatible migrations blocking execution. We can proceed autonomously.
