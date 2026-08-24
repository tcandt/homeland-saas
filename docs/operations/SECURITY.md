# Security

## Secret rotation bat buoc

Rotate ngay cac secret da tung xuat hien trong terminal, anh chup, chat hoac file ngoai secret manager:

- `JWT_SECRET`
- PostgreSQL password
- Redis password neu co
- Cloudflare Tunnel token
- Zalo Bot token va webhook secret token
- SePay webhook/API key
- SMTP password
- Hunonic access/secret key

Sau khi rotate, restart service lien quan va xac minh provider webhook/test message van hoat dong.

## Endpoint exposure

Public hop le:

- `GET /api/v1/health`
- `GET /api/v1/health/ready`
- Provider webhook co secret rieng: SePay, Zalo.

Noi bo, bat buoc co `INTERNAL_API_TOKEN`:

- `GET /api/v1/metrics`
- `GET /api/v1/health/seed`
- `GET /api/v1/health/build-info`

Header chap nhan:

```http
X-Internal-Token: <INTERNAL_API_TOKEN>
```

hoac:

```http
Authorization: Bearer <INTERNAL_API_TOKEN>
```

## Attachment storage

- `STORAGE_PROVIDER=local` la mac dinh. Khi chuyen sang object storage, dat `STORAGE_PROVIDER=s3` va cau hinh `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`.
- Production preflight hien se fail neu `STORAGE_PROVIDER=s3` hoac `r2` ma thieu `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, hoac `S3_SECRET_ACCESS_KEY`.
- Production phai cau hinh `STORAGE_DIR` la duong dan tuyet doi tren host/volume ben vung, khong de mac dinh trong container ephemeral.
- Khi dung R2/S3, bucket phai de private mac dinh, bat versioning, va co lifecycle policy cho non-current versions / incomplete multipart uploads.
- Upload folder/file name duoc sanitize o `LocalStorageProvider`; cac path `.`/`..` va path traversal bi chan truoc khi doc/xoa/phuc vu file.
- Provider object storage hien tai proxy file qua API `/api/v1/documents/storage?path=...`, nen bucket van co the de private mac dinh. Neu mo rong sang direct signed URL, van giu rule TTL ngan va khong luu signed URL da het han trong database.
- Co the lay direct URL qua `/api/v1/documents/storage-link?path=...&direct=true` khi provider ho tro; direct URL chi dung runtime, khong ghi de vao DB.
- Script `npm run storage:migrate:prod -- --env-file .env.public-production --apply` dung de copy local objects len object storage va cap nhat DB references.
- Script `npm run storage:policy:prod -- --provider r2 --bucket homeland-production` sinh JSON mau cho lifecycle/versioning rollout.
- Neu chuyen sang R2/S3, van giu nguyen rule: private object mac dinh va backup manifest co checksum.

## Body va upload limits

- JSON/urlencoded mac dinh bi gioi han boi `API_BODY_LIMIT`, hien la `2mb`.
- Upload settings asset gioi han `2MB`.
- Upload documents gioi han boi `DOCUMENT_UPLOAD_LIMIT_BYTES`, mac dinh `20MB`.
- Khong tang global body limit de xu ly file; endpoint upload phai co limit rieng.

## Logging

- Khong log raw webhook payload tu Zalo/SePay neu co the chua PII, noi dung tin nhan, token hoac bank reference nhay cam.
- Log nen gom correlation ID, tenant ID, event name, provider, status va timestamp.
- Logger da redact authorization/cookie/token/password co ban, nhung provider payload van phai duoc sanitize o code goi log.

## Production checks

- Registration public tat.
- Swagger tat tren production hoac chi noi bo/VPN.
- CORS allowlist dung domain production.
- Docker/host chi expose cong bat buoc.
- Grafana/Prometheus/Alertmanager khong public neu chua co auth/TLS/VPN.
- Admin account bat buoc doi mat khau sau reset.
- Tat `ENABLE_E2E_TEST_UTILS` tren production.
- Backup off-host va restore drill PASS truoc khi cap nhat lon.
