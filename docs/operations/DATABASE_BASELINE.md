# Database Baseline V2 Runbook

## Quyết định

`BASELINE-V2` là snapshot SQL tĩnh, có checksum và inventory đầy đủ của schema chính xác sau historical migration 1–18. Nó không chạy lại chuỗi lịch sử lỗi trên database rỗng: replay trực tiếp vẫn mâu thuẫn tại `20260708042302_expand_contract_status` vì enum đã chứa `PENDING_APPROVAL` (`P3018`). Không sửa 18 migration SQL hoặc checksum để che mâu thuẫn này.

Artifact chuẩn:

- [historical manifest 18/18](../../packages/database/prisma/baseline/migration-manifest.json): thứ tự, checksum, ownership/prerequisite/result của lịch sử bất biến.
- [BASELINE-V2 SQL](../../packages/database/prisma/baseline-v2/baseline-v2.sql): static Prisma schema + toàn bộ custom DDL, checks, functions, triggers và partial unique index `Payment_tenantId_provider_providerRef_nonempty_key`.
- [BASELINE-V2 manifest](../../packages/database/prisma/baseline-v2/baseline-v2.manifest.json): checksum creation, coverage 18/18, inventory tables/columns/enums/defaults/PK/FK/unique/index/check/functions/triggers và canonical fingerprint.
- [`enable-pgvector.sql`](../../packages/database/prisma/baseline/enable-pgvector.sql): extension thuộc historical migration 01; chỉ bootstrap V2 được tự chạy nó trước static schema.

Không dùng `prisma db push`, reset, seed, `DROP`, `TRUNCATE`, manual SQL operator hoặc production database.

## Fresh path

Chỉ database disposable hoàn toàn rỗng (`public_base_tables = 0`) mới được chạy FRESH. Bootstrap tự động:

1. xác minh 18 checksum historical và checksum static V2;
2. tạo pgvector, apply `baseline-v2.sql`;
3. so sánh **toàn bộ** canonical inventory/fingerprint và ContractStatus audit;
4. chỉ khi pass mới `migrate resolve --applied` đúng 18 migration;
5. kiểm tra `migrate status`, `migrate deploy` no-op, `migrate status` lần hai.

Không có bước nào chạy historical SQL lên DB rỗng.

## Existing path

EXISTING là **audit-only**. Nó không apply BASELINE-V2 và không `migrate resolve`. Database phải đã có history đúng 18/18, không failed migration, fingerprint bằng canonical V2 và audit ContractStatus pass. Sai một enum/default/column/constraint/index/function/trigger hoặc dữ liệu `ENDED > 0` là BLOCK với drift cụ thể; không được normalize hoặc ghi migration history để che drift.

ContractStatus yêu cầu chính xác thứ tự: `DRAFT`, `PENDING_APPROVAL`, `APPROVED`, `ACTIVE`, `EXPIRING`, `EXPIRED`, `TERMINATED`, `CANCELLED`; `Contract.status` NOT NULL/default `DRAFT`; ba status index lịch sử phải tồn tại.

## Rehearsal và production

Chỉ CI disposable `localhost:5433/homeland` với toàn bộ guard mới dùng script. Rehearsal bắt buộc gồm FRESH isolated và EXISTING isolate restore/copy, fingerprints khớp tuyệt đối, 18/18 chỉ resolve sau fresh verification và deploy no-op. Lưu commit SHA/checksum/fingerprint/log; xóa container/DB tạm sau rehearsal.

Production apply vẫn **NOT RUN**. Cần maintenance-window approval, database identity phê duyệt, backup/restore point và rehearsal cùng commit. Với schema additive, rollback thực tế là rollback image khi không phụ thuộc schema mới; nếu đã ghi dữ liệu mới thì forward-fix hoặc restore backup. Không rollback bằng sửa historical migration.
