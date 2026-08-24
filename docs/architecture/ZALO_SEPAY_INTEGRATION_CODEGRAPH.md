# HomeLand Zalo SePay Integration Codegraph

Tai lieu nay theo doi rieng tien do tich hop `Zalo Bot -> Customer Chat ID -> Billing -> SePay -> Reconciliation -> Notification`.

Chu thich:

- Xanh: done
- Vang: dang thuc hien
- Mac dinh: chua hoan thanh

```mermaid
flowchart TB
  subgraph ZALO["Zalo Bot"]
    Z1[Bot token sendMessage]
    Z2[Webhook secret storage]
    Z3[Webhook receive and recent chat capture]
    Z4[Test Bot Token getMe]
    Z5[Test Admin Group]
    Z6[Connect Webhook setWebhook]
    Z7[Normalized webhook adapter]
    Z8[DK phone room command binding]
    Z9[Webhook diagnostics and status refresh]
    Z10[Auto-detect admin group from webhook]
  end

  subgraph BILLING["Billing and Payment Request"]
    B1[Invoice PaymentRequest]
    B2[Deposit PaymentRequest]
    B3[Owner bank account routing]
    B4[Unique payment code]
    B5[QR URL generation]
    B6[Shared room obligation semantics]
    B7[Room to receiving-account routing]
    B8[PaymentRequest bank snapshot]
  end

  subgraph SEPAY["SePay"]
    S1[Webhook endpoint]
    S2[Webhook log state machine]
    S3[Authorization ApiKey mode]
    S4[HMAC raw body verification]
    S5[Exact match]
    S6[Short amount review]
    S7[Overpayment resolution]
    S8[Missing code review]
    S9[Wrong bank detection]
    S10[Manual assign and review APIs]
    S11[QR preview by room or account]
    S12[Send test QR to admin group]
  end

  subgraph NOTIFY["Notification Sync"]
    N1[Send QR to customer Zalo]
    N2[Customer payment confirmation]
    N3[Admin payment confirmation]
    N4[Admin mismatch alert]
    N5[Notification retry and DLQ]
  end

  subgraph ADMIN["Admin Integration UI"]
    A1[Zalo settings card]
    A2[SePay settings card]
    A3[Webhook status and health]
    A4[Test QR and reconciliation]
    A5[Unmatched review dashboard]
    A6[Room routing selector]
    A7[QR test modal]
    A8[Bank transaction history and manual review]
  end

  classDef done fill:#dcfce7,stroke:#16a34a,color:#14532d;
  classDef doing fill:#fef3c7,stroke:#d97706,color:#92400e;

  class Z1,Z2,Z3,Z4,Z5,Z6,Z7,Z8,Z9,Z10,B1,B2,B3,B4,B5,B6,B7,B8,S1,S2,S3,S4,S5,S6,S7,S8,S9,S10,S11,S12,N1,N2,N3,N4,N5,A1,A2,A3,A4,A5,A6,A7,A8 done;
```

## Checklist theo phase tai lieu

| Phase | Item | Status | Ghi chu |
|---|---|---|---|
| 1 | Zalo `sendMessage` | <span style="color:#16a34a;font-weight:700">Done</span> | Da co provider gui tin theo `chat_id` |
| 1 | Zalo webhook secret | <span style="color:#16a34a;font-weight:700">Done</span> | Da luu trong `zalo-provider.webhookSecret` |
| 1 | Zalo webhook receive | <span style="color:#16a34a;font-weight:700">Done</span> | Da verify secret va capture recent chat |
| 1 | Zalo `getMe` test | <span style="color:#16a34a;font-weight:700">Done</span> | Da co API test bot token trong settings |
| 1 | Zalo `setWebhook` connect | <span style="color:#16a34a;font-weight:700">Done</span> | Da co API connect webhook + guard khi settings chua luu |
| 1 | Zalo normalizer tach rieng | <span style="color:#16a34a;font-weight:700">Done</span> | Da tach sang `adapters/zalo-normalizer.ts` |
| 1 | Zalo webhook diagnostics | <span style="color:#16a34a;font-weight:700">Done</span> | Da luu `lastWebhook*` + preview keys + UI refresh status |
| 1 | Zalo auto-detect admin group | <span style="color:#16a34a;font-weight:700">Done</span> | Da uu tien group trong `recentWebhookChats`, fallback `lastWebhookChatId` |
| 2 | DK command bind `chat_id` | <span style="color:#16a34a;font-weight:700">Done</span> | Da parse `DK <phone> <room>`, validate room/hop dong/sdt, bind `zaloChatId` |
| 3 | Payment request theo invoice/deposit | <span style="color:#16a34a;font-weight:700">Done</span> | Da co `PaymentRequest` va QR |
| 3 | Shared-room obligation semantics | <span style="color:#16a34a;font-weight:700">Done</span> | Flow thanh toan dang customer-scoped va giu `roomRentalType` + `roomMemberCount` xuyen suot QR, Zalo, doi soat |
| 3 | Room -> receiving-account routing | <span style="color:#16a34a;font-weight:700">Done</span> | Da them bang `RoomPaymentAccountRoute`, fallback owner default / owner fallback / global fallback va doc fallback JSON cu neu chua migrate |
| 3 | Payment request bank snapshot | <span style="color:#16a34a;font-weight:700">Done</span> | Tiep tuc snapshot bang `bankAccountId`, `bankName`, `bankAccountNumber`, `bankAccountName` tren `PaymentRequest` |
| 4 | SePay webhook endpoint | <span style="color:#16a34a;font-weight:700">Done</span> | Da co endpoint + log state machine |
| 4 | SePay HMAC raw-body verify | <span style="color:#16a34a;font-weight:700">Done</span> | Da co mode `hmac` / `dual` va test verify |
| 4 | SePay exact/partial/over/wrong bank | <span style="color:#16a34a;font-weight:700">Done</span> | Da co mismatch va review flow |
| 4 | SePay admin integration status/test | <span style="color:#16a34a;font-weight:700">Done</span> | Da co status/test API va UI test QR + doi soat |
| 4 | SePay QR preview theo room/account | <span style="color:#16a34a;font-weight:700">Done</span> | Da co `previewSePayQr` resolve theo room route hoac account chon tay |
| 4 | SePay send test QR toi admin group | <span style="color:#16a34a;font-weight:700">Done</span> | Da co `POST /payments/sepay/test-qr/send-admin` gui vao `adminGroupChatId` |
| 4 | Lich su giao dich 2 account + tra soat tay | <span style="color:#16a34a;font-weight:700">Done</span> | `/finance/transactions` doc tu `PaymentWebhookLog`, loc theo account, trang thai review va giu giao dich sai noi dung/chua match |
| 5 | Customer payment confirmation qua Zalo | <span style="color:#16a34a;font-weight:700">Done</span> | Workflow gui sau event thanh toan va ton trong `sepay.sendPaymentResultToZalo` |
| 5 | Admin payment confirmation qua Zalo/group | <span style="color:#16a34a;font-weight:700">Done</span> | Da them workflow gui vao `adminGroupChatId` sau SePay commit |
| 6 | Zalo + SePay control-plane UI day du | <span style="color:#16a34a;font-weight:700">Done</span> | Da co card SePay gon, room routing, QR modal, webhook status, send-admin |

## Multi-account flow hien tai

```mermaid
flowchart LR
  R1[Room]
  R2[RoomPaymentAccountRoute table]
  R3[Owner default bank]
  R4[Global fallback bank]
  R5[Resolved receiving account]
  R6[PaymentRequest snapshot]
  R7[SePay webhook accountNumber]
  R8[Exact bank + code + amount]
  R9[Confirm]
  R10[Needs review]

  R1 --> R2
  R1 --> R3
  R3 --> R4
  R2 --> R5
  R3 --> R5
  R4 --> R5
  R5 --> R6
  R7 --> R8
  R6 --> R8
  R8 -->|match| R9
  R8 -->|mismatch| R10
```

## File map

- Zalo:
  - `apps/api/src/communication/communication.controller.ts`
  - `apps/api/src/communication/adapters/zalo-normalizer.ts`
  - `apps/api/src/communication/providers/communication.providers.ts`
  - `apps/api/src/communication/services/zalo-registration.service.ts`
  - `apps/web/components/settings/sections/SettingsZaloIntegration.tsx`
- SePay:
  - `apps/api/src/payments/payments.controller.ts`
  - `apps/api/src/payments/payments.service.ts`
  - `apps/web/components/settings/sections/SettingsSePayIntegration.tsx`
  - `apps/web/components/finance/BankTransactionHistory.tsx`
  - `apps/web/components/finance/SePayReconciliationSummary.tsx`
  - `apps/web/components/finance/SePayReconciliationAuditPanel.tsx`
  - `apps/web/lib/api/settings.api.ts`
  - `packages/database/prisma/migrations/20260824110000_add_room_payment_account_routes/migration.sql`
  - `packages/database/prisma/schema.prisma`
  - `packages/database/prisma/seed.ts`
- Workflow sync:
  - `apps/api/src/automation/workflow/workflow.engine.ts`
  - `apps/api/src/automation/workflow/workflow.registry.ts`
- Shared settings:
  - `apps/api/src/settings/settings.service.ts`
  - `apps/web/lib/api/settings.api.ts`
