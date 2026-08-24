# HomeLand Upgrade Roadmap

Muc tieu: dua he thong tu trang thai co the chay production sang trang thai van hanh on dinh, co kha nang phat hien loi som, cap nhat an toan, rollback ung dung, backup/restore duoc kiem chung.

## P0 - Truoc khi mo rong van hanh

1. Rotate secret da tung xuat hien trong terminal/anh/chat.
   - `JWT_SECRET`
   - SePay webhook/API key
   - Zalo Bot token va secret token
   - SMTP password
   - Cloudflare tunnel token
   - PostgreSQL/Redis password neu da lo

2. Khoa endpoint van hanh.
   - `/api/v1/metrics`, `/api/v1/health/seed`, `/api/v1/health/build-info` phai dung `INTERNAL_API_TOKEN`.
   - Prometheus scrape dung header `X-Internal-Token` hoac `Authorization: Bearer`.
   - `/health` va `/health/ready` van public de load balancer/Cloudflare check.
   - Trang thai code: da them `InternalTokenGuard`.

3. Backup bat buoc truoc update.
   - `pg_dump` database.
   - Backup `.env.public-production`.
   - Backup storage local hien tai.
   - Luu ngoai VPS: S3-compatible hoac Cloudflare R2.
   - Ghi checksum va test restore tren database tam.

4. Kiem tra dung luong.
   - VPS hien tai chi con khoang 3.7GB trong log gan nhat, khong du thoai mai de build web/api tai cho.
   - Khuyen nghi build image tren CI/desktop, push registry, VPS chi pull image.
   - Giu nguong canh bao disk: warning 75%, critical 85%.
   - Trang thai code: da them `npm run host-check:prod` de kiem tra disk, Docker service va restart policy container truoc update.

## P1 - Thanh toan va doi soat

1. SePay webhook state machine.
   - Them trang thai `RECEIVED`, `PROCESSING`, `PROCESSED`, `FAILED`, `IGNORED`, `NEEDS_REVIEW`.
   - Claim webhook bang transaction/lock theo `providerTransactionId`.
   - Moi transaction chi duoc ghi nhan mot lan.
   - Loi trong luc xu ly phai de lai retryable state, khong mat webhook.
   - Trang thai code: da them migration `20260823060000_harden_payment_webhook_processing` voi status/attempt/lastError va DB claim qua `updateMany`.

2. Payment invariant.
   - `PaymentRequest.CONFIRMED` phai co mot trong cac bang chung: `Payment` invoice hoac `Deposit.PAID`.
   - `Payment.providerRef` nen unique theo tenant/provider/ref khi ref khong rong.
   - Them test dong thoi: 2 webhook cung transaction, 2 webhook khac transaction nhung cung payment code, thieu tien, thua tien, sai bank.
   - Trang thai code: da them partial unique index cho `Payment(tenantId, provider, providerRef)` khi `providerRef` khong rong va test duplicate same-process.

3. Reconciliation dashboard.
   - Hien `unmatched`, `wrong bank`, `short amount`, `overpaid`, `duplicate`, `manual assigned`.
   - Co SLA canh bao neu webhook chua xu ly qua nguong.
   - Trang thai code: da co audit panel/API doi chieu cheo giua request, webhook, invoice, deposit va payment SePay; phan duplicate detection va SLA alert tuning con tiep tuc.

## P1 - Zalo Bot, email, notification

1. Tach worker queue.
   - Dung Redis hien co voi BullMQ hoac co che claim job DB neu chua muon them dependency.
   - API request chi enqueue, worker xu ly send.
   - Retry exponential backoff, DLQ, manual retry/cancel.
   - Trang thai code: da them DB claim truoc khi gui queue item, `DEAD_LETTER` khi het retry, `COMMUNICATION_IMMEDIATE_DELIVERY=false` de production co the chuyen sang enqueue-only, scheduler xu ly ca `QUEUED` va recover item ket `SENDING`, compose production da co `notification_worker` rieng va heartbeat metric/build-info.

2. Zalo Bot.
   - Luu `chat_id`/`user_id` tu webhook vao customer/user mapping.
   - Webhook validate secret token bang constant-time compare.
   - Khong log raw body.
   - Nut test gui tin nhan can yeu cau `chat_id`/`user_id`, khong dung so dien thoai.
   - Trang thai code: webhook da validate secret token bang constant-time compare, khong log raw body, capture `chat_id`/`user_id` gan nhat vao settings de UI hien thi/copy/gui thu. Customer da co `zaloChatId`/`zaloUserId`; form khach thue luu mapping va luong gui Zalo uu tien hai field nay thay vi so dien thoai.

3. Email.
   - Tao transporter pool theo tenant/provider config.
   - Timeout ro rang cho SMTP connect/send.
   - Template subject/body co preview.
   - Log provider message id, bounce/fail reason neu provider ho tro.
   - Trang thai code: da them SMTP pool/cache theo tenant config, provider timeout cho Zalo/Telegram, va nut/API gui thu Email/Telegram/Zalo trong Settings.

## P2 - Luu tru file va backup

1. Chuyen local storage sang S3-compatible hoac Cloudflare R2.
   - File hop dong, hoa don, chung tu, avatar.
   - Signed URL cho file private.
   - Versioning va retention.
   - Trang thai code: da them `STORAGE_PROVIDER` abstraction, local va S3-compatible provider (phu hop R2 path-style), route proxy tai API, `storage-link` cho direct URL, env config va script migrate local -> object storage; object lifecycle/versioning van la buoc tiep theo.

2. Backup tu dong.
   - Daily full backup.
   - Retention: 7 daily, 4 weekly, 12 monthly.
   - Restore drill tu dong hang tuan tren database tam.
   - Alert neu backup stale hoac restore fail.
   - Trang thai code: da them `production-backup.js`, `production-backup-retention.js`, `production-backup-cycle.js` cho cron/systemd, metric backup freshness/off-host/retention, `production-restore-check.js` de verify manifest/checksum/`pg_restore --list` truoc moi update, `production-restore-drill.js` de restore vao database tam co guard ten DB, va timer template systemd cho backup cycle/restore drill.

## P2 - Monitoring va alert

Can co dashboard/alert cho:

- API uptime, 5xx, latency p95/p99.
- DB readiness, connection pool, slow query.
- Redis readiness.
- Disk usage.
- Backup stale/failed.
- SePay webhook unmatched/duplicate/failed.
- Notification queue depth/DLQ.
- Zalo/Telegram/SMTP provider error rate.
- Hunonic sync fail/stale.

## P3 - Release va rollback

1. Version duy nhat.
   - Root/app version nen thong nhat.
   - Docker image tag theo semver + commit SHA.
   - `/health/build-info` tra ve version, commit, build time, image tag.

2. CI/CD.
   - Build image tren CI.
   - Push registry.
   - VPS pull image.
   - Chay preflight, migrate, health, smoke.
   - Neu health/smoke fail sau restart thi rollback app image truoc do.
   - Trang thai code: update runner da co backup/restore-check gate va auto rollback app manifest neu restart/health fail; workflow `.github/workflows/ci-cd-pipeline.yml` da build/push GHCR va co rollback jobs, bundle `deploy/public-production/docker-compose.registry-production.yml` da cho phep VPS pull theo `API_TAG`/`WEB_TAG` immutable.

3. Database migration.
   - Khong auto rollback database mac dinh.
   - Moi migration production phai co backup, forward-fix plan, va restore plan.
   - Migration them cot/bang nen backward compatible voi image cu khi co the.

## Checklist uu tien

| Pri | Item | Status | Ghi chu |
|---|---|---|---|
| P0 | Security + backup + disk policy | <span style="color:#16a34a;font-weight:700">Done</span> | Internal token guard, host check, backup/restore precheck da co |
| P1 | SePay state machine + concurrency tests | <span style="color:#16a34a;font-weight:700">Done</span> | Webhook claim, retry state, duplicate guard da co |
| P1 | SePay reconciliation auditor | <span style="color:#d97706;font-weight:700">Doing</span> | Da co audit panel/API cross-service, con duplicate/manual-assign deep audit va SLA tuning |
| P1 | Notification worker + DLQ | <span style="color:#d97706;font-weight:700">Doing</span> | Da co queue claim/retry va worker service/heartbeat; con dashboard + runbook rollout production |
| P1 | Zalo event mapping + test UX | <span style="color:#16a34a;font-weight:700">Done</span> | Customer co `zaloChatId`/`zaloUserId`, send test da co |
| P1 | Email/SMTP pool + timeout/template | <span style="color:#16a34a;font-weight:700">Done</span> | Da co provider timeout + test send |
| P2 | Zalo history backfill | <span style="color:#16a34a;font-weight:700">Done</span> | Da co script export webhook chats va import reviewed mapping theo tenant/customer/phone/email |
| P2 | R2/S3 storage | <span style="color:#d97706;font-weight:700">Doing</span> | Da co provider abstraction + S3-compatible provider + direct URL + migration script + audit script + lifecycle policy scaffold + preflight guard; con rollout production va evidence cleanup local storage |
| P2 | Monitoring alerts | <span style="color:#16a34a;font-weight:700">Done</span> | Da co dashboard overview/slo/operations va alert tuning cho worker, queue, backup, SePay, Hunonic |
| P2 | Backup retention + restore drill | <span style="color:#d97706;font-weight:700">Doing</span> | Da co backup/precheck/drill script, retention report/prune local va backup cycle wrapper; con immutable/off-host policy enforcement |
| P3 | Release automation + app rollback | <span style="color:#d97706;font-weight:700">Doing</span> | Da co GHCR workflow + registry compose pull bundle + update runner rollback; con can evidence rollout VPS production thuc te |
