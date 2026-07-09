# Invoice State Machine (FSM)

## Overview
The Invoice lifecycle follows a strict forward-moving financial process with specific terminal states.

## States
1. `DRAFT`: Initial state. Can be modified, items added/removed.
2. `ISSUED`: Finalized and sent to customer. Cannot be modified. Waiting for payment.
3. `PARTIALLY_PAID`: Some payment received, but balance > 0.
4. `PAID`: Balance is 0. Terminal state.
5. `OVERDUE`: Due date passed while in `ISSUED` or `PARTIALLY_PAID`.
6. `CANCELLED`: Voided. Terminal state. Reverse any generated accounting.
7. `WRITTEN_OFF`: Debt forgiven/abandoned. Terminal state.

## Valid Transitions

| From | To | Trigger / Command | Guard / Conditions |
|------|----|-------------------|--------------------|
| `DRAFT` | `ISSUED` | `POST /invoices/:id/issue` | Must have total > 0 |
| `DRAFT` | `CANCELLED` | `POST /invoices/:id/cancel` | None |
| `ISSUED` | `PARTIALLY_PAID` | `POST /invoices/:id/pay` | Allocated payment < Total |
| `ISSUED` | `PAID` | `POST /invoices/:id/pay` | Allocated payment == Total |
| `ISSUED` | `OVERDUE` | System Cron | `now > dueDate` |
| `ISSUED` | `CANCELLED` | `POST /invoices/:id/cancel` | Requires Manager/Finance role |
| `ISSUED` | `WRITTEN_OFF` | `POST /invoices/:id/writeoff` | Requires Finance role |
| `PARTIALLY_PAID` | `PAID` | `POST /invoices/:id/pay` | Accumulated allocated payment == Total |
| `PARTIALLY_PAID` | `OVERDUE` | System Cron | `now > dueDate` |
| `PARTIALLY_PAID` | `WRITTEN_OFF` | `POST /invoices/:id/writeoff`| Requires Finance role |
| `OVERDUE` | `PARTIALLY_PAID` | `POST /invoices/:id/pay` | Allocated payment < Total |
| `OVERDUE` | `PAID` | `POST /invoices/:id/pay` | Accumulated allocated payment == Total |
| `OVERDUE` | `WRITTEN_OFF` | `POST /invoices/:id/writeoff`| Requires Finance role |

## Terminal States
- `PAID`
- `CANCELLED`
- `WRITTEN_OFF`

Terminal states cannot be transitioned out of. A cancelled invoice cannot receive payments.
