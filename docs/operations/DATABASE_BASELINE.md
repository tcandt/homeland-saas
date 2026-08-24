# Database Baseline Runbook

## Mục tiêu và phạm vi

Runbook này chỉ dùng khi tạo **database PostgreSQL hoàn toàn rỗng** cho staging mới, restore drill hoặc môi trường release-gate. Database đang vận hành đã có bảng và `_prisma_migrations` tiếp tục dùng `prisma migrate status` / `prisma migrate deploy`; không baseline lại.

Chuỗi migration lịch sử hiện tại không thể tự dựng database từ số 0 vì các trạng thái enum hợp đồng đã được hợp nhất ở một migration trước rồi lại được thêm ở migration sau. Không sửa SQL/checksum migration lịch sử: các database đã baseline đang phụ thuộc vào lịch sử đó.

Baseline database rỗng là thao tác tạo schema và migration history. Trước staging/production phải có phê duyệt kỹ thuật, backup/restore point của hạ tầng và biên bản chỉ rõ database đích. Không chạy bằng URL production đang vận hành.

## Cổng từ chối bắt buộc

Dừng ngay nếu có bất kỳ điều kiện nào:

- Database đích không có tên rõ `release_gate`, `staging`, `test` hoặc `ci`.
- Database chứa bất kỳ base table nào trong schema `public`.
- URL đích trùng database đang vận hành hoặc bản restore có dữ liệu.
- PostgreSQL không có extension `vector` khả dụng.
- Commit SHA chưa chốt hoặc checksum migration khác danh sách đã review.
- File SQL output đã tồn tại; không ghi đè artifact cũ.
- Chưa có người review SQL và người phê duyệt apply.

Không dùng `prisma db push`, `--force-reset`, `--accept-data-loss`, seed production, `DROP DATABASE`, `DROP SCHEMA` hoặc `TRUNCATE` trong quy trình này.

## Phân loại database

1. **Database vận hành đã baseline:** có bảng nghiệp vụ và `_prisma_migrations`. Chỉ chạy `prisma migrate status`; nếu up to date thì không làm gì.
2. **Database restore:** được phục hồi từ dump, bao gồm migration history. Xác minh restore và chạy `prisma migrate status`; không baseline.
3. **Database hoàn toàn rỗng:** không có base table trong `public`. Chỉ trường hợp này mới theo phần bootstrap bên dưới.

## Chuẩn bị

Thiết lập URL ngoài Git và lưu commit cần triển khai. Không in password vào biên bản hoặc shell history.

```powershell
$env:DATABASE_URL='postgresql://<user>:<secret>@<host>:5432/<release_gate_or_staging_db>?schema=public'
$releaseSha = git rev-parse HEAD
```

Kiểm tra identity và độ rỗng bằng client PostgreSQL đã được bảo vệ bằng `.pgpass`/secret manager:

```sql
SELECT current_database(), current_user, inet_server_addr(), inet_server_port();

SELECT COUNT(*) AS public_base_tables
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';

SELECT EXISTS (
  SELECT 1 FROM pg_available_extensions WHERE name = 'vector'
) AS vector_available;
```

Kết quả bắt buộc: đúng database đã phê duyệt, `public_base_tables = 0`, `vector_available = true`.

## Xác minh migration đã review

Tại commit hiện tại, mười checksum SHA-256 đã review là:

| Migration | SHA-256 |
|---|---|
| `20260706150701_auth_foundation` | `de6f66324ab7c6caa449ceeb86b1cbf5bbcd96f69b95840ae19bd7a371683d1e` |
| `20260708000000_remove_legacy_ended_status` | `61d1658b84113de9a4709b102f6eafbb1eda9e734de0a456b3037ef67573e759` |
| `20260708042302_expand_contract_status` | `4f9a58f6e09dca855127be278fe182b7915e1009ff4946f056de64c2eca396fb` |
| `20260708065702_migrate_legacy_contract_statuses` | `62bea64fae79dde0f483fcaf8297ff2ca6b5da61cc04c743a96748450e2e46cc` |
| `20260809000000_add_hunonic_meter_sync` | `44e4cdbc0085fdfcfea64c1f1ed8e3fe4bd8bc372791eef8e59865b603917b97` |
| `20260809010000_create_payment_request_tables` | `b11d28ced96f6b6d49d10655a2d5cf63247fe6a6312dfc763049815d9d28004a` |
| `20260809020000_add_owner_expense_allocation` | `c6f8205e5e52061868461cac99b25926dda5eb464c747f04c433754c875834fc` |
| `20260813050000_add_forced_password_change` | `baf6e36dde03d858f8e7f5933f50eea84dff99d96b19571fce0cfbe452d84eca` |
| `20260823060000_harden_payment_webhook_processing` | `6bc6a0c59dbcc6213b0b1dc51770c99ae2ea78af0617464f795e3dcb889ff780` |
| `20260823070000_add_customer_zalo_identity` | `52aa5ca04ffb9aed359e6ab96d1940d3ab9b35923111b671c13d98f34ff304d3` |

Kiểm tra local:

```powershell
Get-FileHash packages\database\prisma\migrations\*\migration.sql -Algorithm SHA256
```

Nếu có migration mới sau commit trên, dừng và cập nhật runbook/checksum qua code review trước. Không tự thêm migration vào danh sách khi đang deploy.

## Tạo và review schema SQL

Dùng tên output mới theo timestamp/SHA và từ chối ghi đè:

```powershell
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$sql = ".tmp-baseline-schema-$releaseSha-$stamp.sql"
if (Test-Path -LiteralPath $sql) { throw "Refusing to overwrite $sql" }

.\node_modules\.bin\prisma.cmd migrate diff `
  --from-empty `
  --to-schema-datamodel packages/database/prisma/schema.prisma `
  --script `
  --output $sql

Get-FileHash -LiteralPath $sql -Algorithm SHA256
```

Hai người review file SQL trước apply. Bắt buộc xác nhận SQL chỉ tạo extension/type/table/index/FK thuộc datamodel hiện tại và không có `DROP`, `TRUNCATE`, `DELETE`, `UPDATE`, seed hoặc tham chiếu database khác.

## Apply vào database rỗng

Chỉ sau phê duyệt action-time cho đúng database đích:

```powershell
.\node_modules\.bin\prisma.cmd db execute `
  --file $sql `
  --schema packages/database/prisma/schema.prisma
```

Kiểm tra schema đã tạo trước khi ghi migration history:

```powershell
.\node_modules\.bin\prisma.cmd validate --schema packages/database/prisma/schema.prisma
```

Sau đó đánh dấu đúng từng migration đã review là applied. Đây là ghi migration history, không chạy lại SQL lịch sử:

```powershell
$reviewed = @(
  '20260706150701_auth_foundation',
  '20260708000000_remove_legacy_ended_status',
  '20260708042302_expand_contract_status',
  '20260708065702_migrate_legacy_contract_statuses',
  '20260809000000_add_hunonic_meter_sync',
  '20260809010000_create_payment_request_tables',
  '20260809020000_add_owner_expense_allocation',
  '20260813050000_add_forced_password_change',
  '20260823060000_harden_payment_webhook_processing',
  '20260823070000_add_customer_zalo_identity'
)

foreach ($migration in $reviewed) {
  .\node_modules\.bin\prisma.cmd migrate resolve `
    --applied $migration `
    --schema packages/database/prisma/schema.prisma
  if ($LASTEXITCODE -ne 0) { throw "Baseline failed at $migration" }
}

.\node_modules\.bin\prisma.cmd migrate status `
  --schema packages/database/prisma/schema.prisma
```

Kết quả bắt buộc: `10 migrations found` và `Database schema is up to date`. Không seed production trong bước baseline.

## Nghiệm thu sau baseline

1. Lưu commit SHA, SQL checksum, mười migration checksum, database identity, người review và timestamp.
2. Chạy health/readiness bằng artifact đúng commit.
3. Với release-gate/staging, tạo account/dataset theo quy trình riêng đã phê duyệt; không dùng seed development cho production.
4. Chạy `verify:prod` với `RELEASE_GATE_DATABASE_URL` và credential của database kiểm thử.
5. Với restore drill, đối chiếu dữ liệu sau restore thay vì baseline/seed.
6. Không xóa database hoặc SQL artifact nếu chưa có phê duyệt cleanup riêng.

## Sự cố giữa chừng

- Dừng ngay, giữ nguyên database và log làm bằng chứng.
- Không chạy reset, drop schema/database hoặc sửa `_prisma_migrations` bằng SQL tay.
- Nếu `db execute` thất bại, tạo database rỗng mới sau phê duyệt và điều tra SQL; không tái sử dụng đích nửa chừng.
- Nếu `migrate resolve` thất bại, không tiếp tục danh sách. Đối chiếu schema, migration history và checksum trước khi quyết định forward-fix.
- Database production đang vận hành không được chuyển sang quy trình baseline để xử lý lỗi deploy.

## Tự động hóa CI

`scripts/ci-bootstrap-database.js` thực hiện cùng nguyên tắc nhưng bị khóa cứng cho GitHub Actions, `RUN_DESTRUCTIVE_E2E=true` và database disposable `localhost:5433/homeland`. Script từ chối database không rỗng và từ chối checksum thay đổi. Không nới các guard này để dùng cho staging/production.
