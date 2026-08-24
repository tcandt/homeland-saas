# Backup Strategy

## Mục tiêu

- RPO mục tiêu giai đoạn đầu: tối đa `24 giờ`; khi giao dịch tăng, giảm xuống `1 giờ` bằng WAL/PITR hoặc dịch vụ PostgreSQL managed.
- RTO mục tiêu giai đoạn đầu: tối đa `4 giờ`.
- Full backup PostgreSQL hằng ngày, giữ tối thiểu `30 ngày`.
- Attachment/chứng từ và cấu hình triển khai được backup cùng lịch, nhưng secret lưu trong secret manager riêng.
- Có ít nhất một bản mã hóa nằm ngoài máy chủ production và ngoài cùng failure domain.

Backup chưa được coi là thành công nếu chưa kiểm tra manifest và chưa có restore drill định kỳ.

## Phạm vi

1. PostgreSQL database và migration history.
2. Attachment/chứng từ ở storage root hoặc object storage.
3. Cấu hình deployment không chứa secret: image tag, commit SHA, compose version và migration hiện tại.
4. Grafana dashboards/alert rules đã version trong Git.
5. Secret chỉ backup bằng cơ chế của secret manager; không đưa secret thật vào Git hoặc biên bản.

## Tạo backup PostgreSQL

Thao tác này ảnh hưởng tài nguyên hệ thống và phải được phê duyệt trước khi chạy trên production. Dùng biến môi trường/`.pgpass` được bảo vệ, không đặt password trực tiếp trong command history.

```powershell
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
pg_dump --format=custom --no-owner --no-acl --file "homeland-$stamp.dump" $env:DATABASE_URL
pg_restore --list "homeland-$stamp.dump"
Get-FileHash "homeland-$stamp.dump" -Algorithm SHA256
```

Sau đó mã hóa và chuyển file tới off-host storage có retention/immutable policy. Không xóa bản cũ ngoài chính sách retention đã phê duyệt.

## Script backup production

Repo co script an toan, khong destructive:

```bash
node scripts/production-backup.js \
  --env-file .env.public-production \
  --output-dir .codex-backups/production \
  --storage-dir storage
```

Script se:

- Nap env file vao process, khong in secret.
- Tao thu muc theo timestamp.
- Chay `pg_dump --format=custom --no-owner --no-acl`.
- Copy env file vao backup bundle neu co `--env-file`.
- Copy local storage neu thu muc ton tai.
- Tinh SHA256 cho dump/env/storage manifest.
- Ghi `manifest.json` va `.codex-backups/production/latest-manifest.json`.

Neu da cau hinh `BACKUP_RCLONE_DEST`, script se goi:

```bash
rclone copy <backup-dir> <BACKUP_RCLONE_DEST>/<backup-id>
```

`BACKUP_MANIFEST_PATH` cua API nen tro toi `.codex-backups/production/latest-manifest.json` de Prometheus co metric `backup_age_seconds` va `backup_last_success`.

## Retention report va cleanup local

Repo co them script retention report:

```bash
node scripts/production-backup-retention.js \
  --output-dir .codex-backups/production \
  --keep-daily 7 \
  --keep-weekly 4 \
  --keep-monthly 12
```

Mac dinh script chi:

- Doc tat ca thu muc backup co `manifest.json`.
- Xep lop giu lai theo policy daily/weekly/monthly.
- Ghi `.codex-backups/production/latest-retention-report.json`.
- Bao backup nao co the xoa, backup nao dang duoc giu, backup thanh cong off-host gan nhat.

Chi khi them `--apply`, script moi xoa cac backup local da bi danh dau `prunable`. Khuyen nghi production chay dry-run hang ngay, review report/alert truoc, sau do moi bat `--apply` bang scheduler rieng co approval van hanh.

API co the doc them:

- `BACKUP_RETENTION_REPORT_PATH=.codex-backups/production/latest-retention-report.json`

de Prometheus xuat:

- `backup_off_host_last_success`
- `backup_retention_local_copies`
- `backup_retention_prunable_copies`

## Chu trinh backup hieu luc cho cron/systemd

De tranh scheduler production phai tu noi nhieu command roi mat log/trang thai, repo co them wrapper:

```bash
node scripts/production-backup-cycle.js \
  --env-file .env.public-production \
  --output-dir .codex-backups/production \
  --storage-dir /srv/homeland/storage \
  --keep-daily 7 \
  --keep-weekly 4 \
  --keep-monthly 12 \
  --max-age-hours 24 \
  --require-off-host
```

Script nay se chay theo thu tu:

1. `production-backup.js`
2. `production-backup-retention.js`
3. `production-restore-check.js`

Ket qua tra ve mot JSON tong hop de cron/systemd, log shipper hoac alerting parser doc duoc ngay. Khi muon cho phep xoa local backup da het retention, them `--apply-retention`.

Vi du cron:

```cron
15 1 * * * cd /srv/homeland && node scripts/production-backup-cycle.js --env-file .env.public-production --output-dir .codex-backups/production --storage-dir /srv/homeland/storage --require-off-host >> /var/log/homeland-backup-cycle.log 2>&1
```

## Kiem tra backup truoc update

Truoc khi deploy/migrate production, chay:

```bash
npm run restore-check:prod -- \
  --manifest .codex-backups/production/latest-manifest.json \
  --max-age-hours 24 \
  --require-off-host
```

Script se:

- Xac minh manifest moi nhat co `SUCCESS`.
- Xac minh backup khong qua nguong tuoi da chon.
- Kiem tra file dump/env/storage manifest va SHA256.
- Kiem tra off-host location neu dung `--require-off-host`.
- Goi `pg_restore --list` de dam bao dump doc duoc, tru khi dung `--skip-pg-restore-list`.

Khi chay dry-run khong co database, chi de test script:

```bash
node scripts/production-backup.js --skip-db --storage-dir storage
```

## Backup attachment

- Chụp snapshot hoặc export object storage nhất quán với thời điểm database dump.
- Lưu manifest gồm tên object, kích thước, checksum và thời gian.
- Không ghi đè bản backup trước; dùng prefix/version theo timestamp.
- Kiểm tra ngẫu nhiên file ảnh/PDF có thể đọc được sau khi tải từ off-host storage.

## Restore drill cô lập

Restore drill không được trỏ vào database đang vận hành.

1. Tạo PostgreSQL instance/database tạm biệt lập với production.
2. Xác nhận đích restore là instance tạm và ghi lại connection identity.
3. Chạy `pg_restore --list` và kiểm tra checksum trước restore.
4. Restore dump vào database trống tạm bằng `pg_restore --clean` chỉ khi đích tạm đã được phê duyệt rõ ràng.
5. Chạy `prisma migrate status`, health/readiness và smoke read-only trên bản restore.
6. Đối chiếu số lượng owner, building, room, contract, invoice, payment, expense, Hunonic reading và audit log.
7. Mở ngẫu nhiên attachment/chứng từ từ bản restore.
8. Ghi thời gian restore thực tế, lỗi phát sinh và RTO đạt được.
9. Dọn môi trường tạm chỉ sau phê duyệt riêng; không tự động xóa.

Repo co script restore drill co guard an toan. Database dich phai co ten chua `restore`, `test`, `drill`, `tmp` hoac `scratch`, va phai xac nhan dung ten database bang `--confirm-target-db`.

```bash
npm run restore-drill:prod -- \
  --manifest .codex-backups/production/latest-manifest.json \
  --max-age-hours 24 \
  --require-off-host \
  --database-url "$RESTORE_DRILL_DATABASE_URL" \
  --confirm-target-db homeland_restore_drill
```

Script se chay restore precheck, restore dump vao database tam bang `pg_restore --clean --if-exists --no-owner --no-acl`, sau do chay `prisma migrate status` tren database restore. Khong dung script nay voi database `homeland`, `postgres`, `production` hoac `prod`.

## Audit rollout object storage

Sau khi migrate local file len R2/S3 bang `storage-migrate-to-object-store.js`, chay them audit de biet con lai bao nhieu local ref, bao nhieu ref da len `s3://`, va local file nao con thieu:

```bash
node scripts/storage-audit.js \
  --env-file .env.public-production \
  --storage-dir /srv/homeland/storage
```

Audit nay khong sua du lieu. No dung de xac nhan rollout object storage truoc khi xoa local storage cu hoac bat lifecycle policy.

## Lifecycle va versioning cho R2/S3

Object storage phase khong duoc xem la hoan tat neu bucket chua bat versioning va chua co lifecycle rule cho non-current version / incomplete multipart upload.

Repo co script scaffold policy:

```bash
node scripts/generate-object-storage-lifecycle-policy.js \
  --provider r2 \
  --bucket homeland-production \
  --noncurrent-days 30 \
  --abort-multipart-days 7
```

Script nay khong goi provider API. No sinh JSON mau de copy vao Cloudflare R2 hoac AWS S3 console/terraform.

Thu tu rollout khuyen nghi:

1. Bat versioning tren bucket.
2. Ap dung lifecycle rule cho non-current version va incomplete multipart upload.
3. Chay `npm run storage:audit:prod` de lay baseline local/s3 refs.
4. Chay `npm run storage:migrate:prod -- --env-file .env.public-production --apply`.
5. Chay lai `npm run storage:audit:prod` va dam bao local refs con lai da duoc giai trinh.
6. Chi khi audit sach va backup off-host PASS moi xem xet don dep local storage cu.

## Restore khi có sự cố

- Chặn write và giữ bằng chứng trước khi quyết định restore.
- Xác định phạm vi mất dữ liệu, recovery point và các giao dịch cần nhập lại.
- Ưu tiên rollback app hoặc forward-fix nếu database vẫn toàn vẹn.
- Restore production cần phê duyệt của cả owner vận hành và người chịu trách nhiệm kỹ thuật.
- Luôn restore/test trên bản sao trước; chỉ chuyển traffic khi đối chiếu tài chính, owner-bank và audit đạt.
- Sau restore, rotate credential nếu có khả năng secret bị lộ và chạy lại toàn bộ reconciliation.

## Biên bản backup/restore

```text
Backup ID / timestamp / commit SHA:
Database server identity:
File size / SHA256 / off-host location:
Attachment manifest:
Retention expiry:
Người tạo / người kiểm tra:
Restore target identity:
Restore start / finish / duration:
Prisma status / health / smoke:
Đối chiếu bản ghi và tài chính:
Kết luận PASS / FAIL:
```
