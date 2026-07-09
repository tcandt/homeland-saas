# Invoice Compatibility Matrix

## Backend Impact
| Area | Impact | Backward Compatible | Required Action |
|------|--------|---------------------|-----------------|
| `Prisma Schema` | Add `InvoiceItem`, `PaymentAllocation`. Rename Enum values | Yes | Run `npx prisma migrate dev` |
| `ContractService` | Invoices created during `Activate` and `Terminate` must use new structure. | Yes | Update `create` payload to include items. |
| `PaymentService` | (Not yet built) Will rely on allocations. | N/A | N/A |
| `API DTOs` | Expose items and strict statuses. | Yes | Update `InvoiceDto` to include `items` array. |
| `Controllers` | Require strict command mapping (`/issue`, `/pay`, `/cancel`, `/writeoff`) | Yes | Remove generic `PATCH` operations. |

## Frontend Impact
| Area | Impact | Backward Compatible | Required Action |
|------|--------|---------------------|-----------------|
| `Contract Detail UI` | Already fetches invoices. Will need to parse nested items. | Yes | Safe defaults if items array missing on legacy data. |
| `Invoice List` | Status badges need to map to new Enums. | Yes | Add `PARTIALLY_PAID` and `WRITTEN_OFF` badge colors. |
| `Invoice Detail`| Requires full breakdown table (Items, utilities, discount, penalty). | N/A | New implementation required. |
