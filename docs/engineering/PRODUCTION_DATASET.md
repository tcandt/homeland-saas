# Production Dataset

> Standard seed dataset for all E2E and Business Flow verification runs.
> Every test run must use this dataset so results are repeatable and comparable.
> Do NOT use random data as primary identifiers for business flow tests — use deterministic seeds.

---

## Rules

1. **Deterministic IDs**: Use fixed seeds (not `Date.now()`) for cross-flow references.
2. **Idempotent**: Running the seed twice must not duplicate records — use `upsert`.
3. **Isolated per tenant**: All data belongs to the E2E tenant, not shared with real tenants.
4. **Cleaned after test**: Post-suite teardown removes all E2E records (soft-delete).
5. **Cross-flow continuity**: Flow 4 (Contract) reuses the Room from Flow 2 and the Customer from Flow 3.

---

## Tenant

```json
{
  "name": "E2E Test Company",
  "slug": "e2e-test",
  "planType": "PROFESSIONAL"
}
```

---

## Users

| Role | Email | Password | Purpose |
|------|-------|----------|---------|
| Admin (Owner) | `e2e-admin@test.homeland` | `E2eAdmin@2026` | Full access |
| Sales | `e2e-sales@test.homeland` | `E2eSales@2026` | RBAC restriction tests |
| Accountant | `e2e-acc@test.homeland` | `E2eAcc@2026` | Finance flow tests |

---

## Property Dataset

### Building

```json
{
  "name": "Tòa E2E Test",
  "code": "E2E-BLD-01",
  "address": "123 Đường Test, Quận 1, TP.HCM",
  "type": "APARTMENT",
  "status": "ACTIVE",
  "totalFloors": 3,
  "totalRooms": 6
}
```

### Floor

```json
[
  { "name": "Tầng 1", "level": 1, "code": "E2E-F1" },
  { "name": "Tầng 2", "level": 2, "code": "E2E-F2" }
]
```

### Rooms

```json
[
  {
    "name": "101",
    "code": "E2E-R-101",
    "type": "STANDARD",
    "status": "AVAILABLE",
    "price": 5000000,
    "area": 25,
    "capacity": 2,
    "floor": "Tầng 1"
  },
  {
    "name": "102",
    "code": "E2E-R-102",
    "type": "DELUXE",
    "status": "AVAILABLE",
    "price": 7000000,
    "area": 35,
    "capacity": 3,
    "floor": "Tầng 1"
  },
  {
    "name": "201",
    "code": "E2E-R-201",
    "type": "STANDARD",
    "status": "AVAILABLE",
    "price": 5500000,
    "area": 25,
    "capacity": 2,
    "floor": "Tầng 2"
  }
]
```

---

## Customer Dataset

```json
[
  {
    "fullName": "Nguyễn Văn Test",
    "phone": "0901234567",
    "email": "nguyenvantest@mail.com",
    "cccd": "012345678901",
    "address": "456 Đường Dữ Liệu, Quận 3",
    "purpose": "Primary tenant for Contract E2E"
  },
  {
    "fullName": "Trần Thị E2E",
    "phone": "0912345678",
    "email": "tranthie2e@mail.com",
    "cccd": "098765432101",
    "address": "789 Đường Kiểm Thử, Quận 5",
    "purpose": "Secondary tenant for RBAC / isolation tests"
  }
]
```

---

## Contract Dataset

```json
{
  "room": "E2E-R-101",
  "customer": "Nguyễn Văn Test",
  "startDate": "2026-08-01",
  "endDate": "2027-07-31",
  "monthlyRent": 5000000,
  "depositAmount": 10000000,
  "depositPaidDate": "2026-07-25",
  "terms": "Standard 12-month rental agreement.",
  "status": "ACTIVE"
}
```

---

## Invoice Dataset

```json
[
  {
    "contract": "E2E-R-101 / Nguyễn Văn Test",
    "period": "2026-08",
    "rent": 5000000,
    "electricity": 300000,
    "water": 100000,
    "internet": 150000,
    "total": 5550000,
    "dueDate": "2026-08-10",
    "status": "UNPAID"
  }
]
```

---

## Payment Dataset

```json
{
  "invoice": "2026-08 / E2E-R-101",
  "amount": 5550000,
  "method": "BANK_TRANSFER",
  "receivedDate": "2026-08-05",
  "note": "E2E payment verification"
}
```

---

## Accounting Expected Entries (post-payment)

| Account | Debit | Credit | Description |
|---------|-------|--------|-------------|
| Cash / Bank | 5,550,000 | — | Payment received |
| Rental Revenue | — | 5,000,000 | Monthly rent |
| Service Revenue | — | 550,000 | Electricity + Water + Internet |

---

## Expected Audit Events (per flow)

| Flow | Action | Module | User |
|------|--------|--------|------|
| Flow 2 | CREATE | Building | e2e-admin |
| Flow 2 | CREATE | Floor | e2e-admin |
| Flow 2 | CREATE | Room | e2e-admin |
| Flow 3 | CREATE | Customer | e2e-admin |
| Flow 4 | CREATE | Contract | e2e-admin |
| Flow 4 | UPDATE (status→ACTIVE) | Contract | e2e-admin |
| Flow 5 | CREATE | Invoice | e2e-admin |
| Flow 6 | CREATE | Payment | e2e-admin |
| Flow 6 | UPDATE (status→PAID) | Invoice | e2e-admin |
| Flow 7 | CREATE | JournalEntry | system |

---

## Seed Script Location

> To be implemented: `apps/web/tests/e2e/helpers/seed.ts`

```ts
// Usage pattern (not yet implemented):
import { seedProductionDataset, teardownProductionDataset } from '../helpers/seed';

test.beforeAll(async () => {
  await seedProductionDataset();
});

test.afterAll(async () => {
  await teardownProductionDataset();
});
```

**Status: ⏳ Script not yet implemented. Dataset defined for planning purposes.**
