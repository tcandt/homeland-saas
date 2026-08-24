# HomeLand Code Graph

Tai lieu nay ghi lai ban do code van hanh chinh cua HomeLand SaaS de dung khi review, nang cap va xu ly su co.

## Trang thai tong hop

Chu thich mau:

- Xanh: done
- Vang: dang thuc hien
- Xam/trang: chua hoan thanh

```mermaid
flowchart TB
  subgraph Done["Done"]
    D1[Internal token guard]
    D2[SePay webhook state machine]
    D3[Notification queue claim retry DLQ]
    D4[Zalo customer mapping]
    D5[Test send Email Telegram Zalo]
    D6[Backup precheck and restore drill]
    D7[Host preflight and update rollback]
    D8[Local storage hardening]
    D9[Prometheus metrics and rules]
    D10[Zalo history backfill tooling]
  end

  subgraph Doing["In progress"]
    Y1[Separate notification worker]
    Y2[Off-host backup retention scheduler]
    Y3[Monitoring dashboards and alert tuning]
    Y5[S3 R2 storage provider]
    Y6[Registry based CI CD release automation]
    Y7[SePay reconciliation room and occupancy context]
    Y8[Notification template content audit]
    Y9[Notification queue admin UI]
    Y10[Cross service payment reconciliation auditor]
  end

  subgraph Todo["Not done"]
    T1[Dedicated notification admin UI]
    T2[Automatic restore drill scheduler]
  end

  classDef done fill:#dcfce7,stroke:#16a34a,color:#14532d;
  classDef doing fill:#fef3c7,stroke:#d97706,color:#92400e;
  classDef todo fill:#f3f4f6,stroke:#9ca3af,color:#6b7280;

  class D1,D2,D3,D4,D5,D6,D7,D8,D9,D10 done;
  class Y1,Y2,Y3,Y5,Y6,Y7,Y8,Y9,Y10 doing;
  class T1,T2 todo;
```

## Checklist

Day la checklist con lai theo thu tu uu tien van hanh.

| Pri | Area | Status | Checklist |
|---|---|---|---|
| P1 | Notification worker | <span style="color:#d97706;font-weight:700">Doing</span> | Da co worker service/heartbeat/compose; con dashboard canh bao va DLQ UI sau cung |
| P1 | SePay reconciliation auditor | <span style="color:#d97706;font-weight:700">Doing</span> | Da co cross-service audit panel va API; con tiep duplicate/manual assign deep audit va SLA alert tuning |
| P2 | Backup retention + drill | <span style="color:#d97706;font-weight:700">Doing</span> | Da co backup cycle wrapper; con off-host immutable policy va restore drill schedule that |
| P2 | Monitoring dashboards | <span style="color:#16a34a;font-weight:700">Done</span> | Da co operations dashboard + alert tuning cho SePay, notification worker/queue, backup, Hunonic |
| P2 | Zalo history backfill | <span style="color:#16a34a;font-weight:700">Done</span> | Da co script export recent webhook chats va import reviewed mapping vao customer identity |
| P2 | Storage provider | <span style="color:#d97706;font-weight:700">Doing</span> | Da co storage abstraction + S3-compatible provider + audit script + lifecycle scaffold + preflight guard; con rollout object storage production |
| P3 | Release automation | <span style="color:#d97706;font-weight:700">Doing</span> | Da co GHCR workflow, registry compose bundle cho VPS pull, va update runner auto rollback app manifest |
| P3 | Notification admin UI | <span style="color:#d97706;font-weight:700">Doing</span> | Manual retry/cancel/monitor queue tung channel |
| P2 | Room occupancy selector | <span style="color:#16a34a;font-weight:700">Done</span> | Chon Nguyen can/Phong ghep truoc khi them khach, luu va map sang flow contract/Zalo/SePay |
| P2 | Notification template content audit | <span style="color:#d97706;font-weight:700">Doing</span> | Dua room/building/occupancy vao subject-body template quan trong |
| P2 | SePay room context surface | <span style="color:#d97706;font-weight:700">Doing</span> | Hien thi phong/toa nha/kieu thue tren bang doi soat SePay |

## Tong quan module

```mermaid
flowchart LR
  Web[Next.js Web] --> Api[NestJS API]
  Api --> Prisma[Prisma Service]
  Prisma --> Postgres[(PostgreSQL)]
  Api --> Redis[(Redis cache)]
  Api --> Storage[Local storage hien tai]
  Api --> Scheduler[Nest Scheduler]
  Scheduler --> Reports[Reports]
  Scheduler --> Metrics[Business metrics]
  Scheduler --> NotificationQueue[Notification queue]
  Api --> Monitoring[Prometheus metrics]
  Api --> Integrations[External providers]
  Integrations --> SePay[SePay webhook]
  Integrations --> Zalo[Zalo Bot]
  Integrations --> Telegram[Telegram]
  Integrations --> SMTP[SMTP email]
  Integrations --> Hunonic[Hunonic meters]
```

## Thanh toan SePay

Code chinh:

- `apps/api/src/payments/payments.controller.ts`
- `apps/api/src/payments/payments.service.ts`
- `apps/api/src/finance/finance-reporting.service.ts`
- `packages/database/prisma/schema.prisma`

```mermaid
flowchart TD
  A[Invoice or Deposit] --> B[Create PaymentRequest]
  B --> C[Resolve owner default bank]
  C --> D[Build VietQR URL]
  D --> E[Customer transfers money]
  E --> F[SePay webhook]
  F --> G[Validate Apikey from tenant settings]
  G --> H[Upsert PaymentWebhookLog by transaction id]
  H --> I{Payment code found?}
  I -- No --> L[Mark webhook processed]
  I -- Yes --> J{Bank account matches?}
  J -- No --> M[Audit + in-app alert]
  J -- Yes --> K{Amount valid?}
  K -- Short --> N[Audit + alert + do not confirm]
  K -- Exact/Over --> O[Pay invoice or collect deposit]
  O --> P[Confirm PaymentRequest]
  P --> Q[Audit PaymentRequest]
```

Trang thai hien tai: luong webhook/request/source da co bang doi soat va them audit cheo giua `PaymentRequest`, `Payment`, `Invoice`, `Deposit`, `PaymentWebhookLog` de bat case confirmed-source-open, webhook-processed-request-pending, refund-treo, va payment SePay thieu confirmed request. Rui ro con lai P1: duplicate/manual-assign deep audit va SLA alert tuning.

## Notification, Zalo, Email

Code chinh:

- `apps/api/src/communication/communication.service.ts`
- `apps/api/src/communication/communication.scheduler.ts`
- `apps/api/src/communication/providers/communication.providers.ts`
- `apps/api/src/communication/communication.controller.ts`
- `apps/api/src/automation/jobs/job.dispatcher.ts`

```mermaid
flowchart TD
  A[Domain event] --> B[Automation listener]
  B --> C[CommunicationService.dispatch]
  C --> D[Notification]
  C --> E[NotificationQueue]
  Customer[Customer zaloChatId/zaloUserId] --> E
  E --> F[Scheduler retry]
  F --> G{Channel}
  G --> H[In-app]
  G --> I[Zalo Bot]
  G --> J[Telegram]
  G --> K[SMTP Email]
  I --> L[Provider API]
  J --> L
  K --> L
```

Trang thai hien tai: queue da co claim/retry/DLQ, delivery log luu provider message id khi provider tra ve, Zalo webhook capture chat/user gan nhat, Customer da co `zaloChatId`/`zaloUserId` de gui Bot khong dung so dien thoai, va da co script backfill mapping tu webhook history sau khi operator review JSON. Rui ro con lai: provider send van chay trong API/scheduler process va can rollout worker rieng on dinh tren production.

## Backup va luu tru

Code/tai lieu chinh:

- `docs/operations/BACKUP.md`
- `docs/operations/RESTORE.md`
- `docs/operations/DISASTER_RECOVERY.md`
- `apps/api/src/documents/providers/storage/local-storage.provider.ts`
- `scripts/update/*`

```mermaid
flowchart LR
  Postgres[(PostgreSQL)] --> Dump[pg_dump]
  Env[Production env] --> Backup[Backup bundle]
  Storage[Local storage] --> Backup
  Backup --> OffHost[S3/R2/off-host bucket]
  OffHost --> RestoreDrill[Scheduled restore drill]
  RestoreDrill --> Evidence[Restore evidence]
```

Trang thai hien tai: co backup script, backup cycle wrapper cho cron/systemd, restore precheck, restore drill script vao database tam co guard ten DB, va metric backup freshness. Rui ro con lai: can off-host retention immutable policy va bang chung drill dinh ky.

## Release, update, rollback

```mermaid
flowchart TD
  A[Git commit] --> B[CI test + build]
  B --> C[Immutable Docker image by SHA]
  C --> D[Push registry]
  D --> E[VPS pull]
  E --> F[Pre-update backup]
  F --> G[Prisma migrate deploy]
  G --> H[Start API/Web]
  H --> I[Health + smoke]
  I -- Pass --> J[Promote]
  I -- Fail --> K[Rollback app image]
  G -- Migration fail --> L[Stop and manual DB recovery]
```

App rollback co the tu dong khi image moi loi health trong update runner, va VPS production da co them compose registry de pull `API_TAG`/`WEB_TAG` immutable tu GHCR. Database rollback khong nen tu dong mac dinh vi migration co the la bien doi du lieu; can backup truoc update va runbook recovery rieng.

## Security surface

Endpoint public hop le:

- `GET /api/v1/health`
- `GET /api/v1/health/ready`
- Webhook provider co secret rieng: SePay, Zalo.

Endpoint van hanh can token noi bo:

- `GET /api/v1/metrics`
- `GET /api/v1/health/seed`
- `GET /api/v1/health/build-info`

Env can co trong production:

- `JWT_SECRET`
- `INTERNAL_API_TOKEN`
- `DATABASE_URL`
- `REDIS_URL`
- Provider secrets trong Integration Center: SePay, Zalo, Telegram, SMTP, Hunonic.
