# Quy trình hợp nhất khách trùng và triển khai RentalCycle

Ngày cập nhật: 08/09/2026  
Phạm vi: dữ liệu cốt lõi `Khách → Kỳ thuê → Cọc → Hợp đồng → Lưu trú → Hóa đơn → Thanh toán → Quyết toán`.

## 1. Nguyên tắc an toàn

- Không gộp khách chỉ vì trùng riêng số điện thoại hoặc CCCD/CMND.
- Các cảnh báo giao nhau phải được gom thành một cụm liên thông để mỗi hồ sơ chỉ được xử lý một lần.
- Không cho merge nếu các hồ sơ đang có Occupancy mở hoặc hợp đồng hoạt động tại nhiều phòng khác nhau.
- Hồ sơ phụ được soft-delete với `MERGED_INTO:<primaryCustomerId>`; không xóa vật lý.
- Hợp đồng, cọc, hóa đơn, Occupancy, RentalCycle, credit và ContractParty được chuyển trong cùng transaction.
- ContractParty trùng vai trò vẫn giữ snapshot pháp lý; chỉ tháo liên kết khách khỏi snapshot bị trùng.
- Mọi lần merge có AuditLog, người duyệt, bằng chứng và danh sách xung đột đã xác nhận.

## 2. Quy trình review/merge

### Bước 1 — xuất báo cáo chỉ đọc

```powershell
npm run review:duplicate-customers -- --env-file .env
```

Báo cáo trả về số finding, số cụm liên thông, hồ sơ gợi ý làm bản chính, số liên kết và `decisionTemplate`. SĐT/CCCD được che bớt trong output.

### Bước 2 — lập tệp quyết định ngoài Git

Mỗi quyết định phải có đủ:

- `componentId`, `tenantId` đúng báo cáo hiện tại;
- một `primaryCustomerId`;
- toàn bộ hồ sơ còn lại trong `duplicateCustomerIds`;
- `approvedBy`, tối thiểu một `evidence`;
- toàn bộ `conflictCodes` trong `acknowledgedConflictCodes`.

Không lưu tệp quyết định chứa dữ liệu khách vào Git. Thư mục `scratch/` đang được ignore và chỉ phù hợp cho thao tác local có kiểm soát.

### Bước 3 — kiểm tra quyết định, chưa ghi dữ liệu

```powershell
npm run merge:reviewed-customers -- --env-file .env --decision-file <đường-dẫn-json>
```

### Bước 4 — backup và merge

```powershell
npm run backup:prod -- --env-file .env
npm run merge:reviewed-customers -- --env-file .env --decision-file <đường-dẫn-json> --apply --confirm MERGE_REVIEWED_CUSTOMERS
```

### Bước 5 — hậu kiểm

```powershell
npm run review:duplicate-customers -- --env-file .env
npm run audit:core-lifecycle -- --env-file .env
```

Điều kiện đạt: `componentCount = 0`, `totalFindings = 0` hoặc mọi ngoại lệ còn lại có ticket/phê duyệt riêng.

## 3. Quy trình RentalCycle additive

### Triển khai schema

- Chạy migration additive `20260908143000_add_rental_cycle_links` trên staging/production qua Prisma Migrate.
- Không dùng `db push`, reset hoặc seed trên production.
- Các FK mới nullable để schema có thể đi trước dữ liệu và rollback ứng dụng an toàn.

### Dry-run backfill

```powershell
npm run backfill:rental-cycles -- --env-file .env
```

Backfill tự động chỉ nhận:

- hợp đồng có binding tenant–khách–phòng nhất quán;
- cọc/hóa đơn/thanh toán gắn hợp đồng rõ ràng;
- cọc chưa có `contractId` chỉ khi đúng một hợp đồng có cùng tenant–khách–phòng;
- không có chữ ký hợp đồng trùng cần review.

Bản ghi không chắc chắn được đưa vào `skipped` hoặc `reviewQueue`, không đoán.

### Apply backfill

```powershell
npm run backup:prod -- --env-file .env
npm run backfill:rental-cycles -- --env-file .env --apply --confirm BACKFILL_RENTAL_CYCLES
```

Mỗi kỳ thuê và toàn bộ FK liên quan được ghi trong một transaction; script dùng ID xác định theo hợp đồng và CAS trên `rentalCycleId = null`.

### Hậu kiểm

Chạy lại backfill dry-run và detector. Điều kiện đạt:

- `candidateCount = 0`;
- `skippedCount = 0`;
- `orphanDepositCount = 0`;
- `orphanInvoiceCount = 0`;
- detector không có `*_RENTAL_CYCLE_BINDING_MISMATCH` hoặc `CONTRACT_WITHOUT_RENTAL_CYCLE`.

## 4. Kết quả local ngày 08/09/2026

- 3 finding khách trùng được gom thành 2 cụm; merge 3 hồ sơ phụ vào 2 hồ sơ chính.
- Sau merge: 0 finding khách trùng và 0 finding detector.
- Tạo 15 RentalCycle; liên kết 22 cọc, 11 Occupancy, 9 hóa đơn và 5 thanh toán.
- Không có hợp đồng bị skip, cọc/hóa đơn mồ côi hoặc hàng chờ mơ hồ.
- Hậu kiểm backfill: 0 candidate; detector: 0 finding.
- Restore point trước merge: `2026-09-08T07-30-23-920Z`.
- Restore point sau merge/trước backfill: `2026-09-08T07-31-27-774Z`.
- Backup xác nhận sau backfill: `2026-09-08T07-43-09-118Z`.

Đây là dữ liệu local/dev. Production vẫn phải chạy migration, dry-run, backup, apply và hậu kiểm theo đúng maintenance window đã phê duyệt.
