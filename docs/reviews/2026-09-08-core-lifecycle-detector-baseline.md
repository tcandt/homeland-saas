# Baseline detector vòng đời cốt lõi — 08/09/2026

## Phạm vi và nguyên tắc

- Lệnh: `npm run audit:core-lifecycle -- --env-file .env`
- Chế độ: chỉ đọc; script không có cờ sửa dữ liệu.
- Không lưu số điện thoại, CCCD/CMND hoặc bí mật tích hợp vào báo cáo.
- Thời điểm baseline: `2026-09-08T02:51:46.034Z`.

## Kết quả

| Mức độ | Số lượng |
| --- | ---: |
| Critical | 15 |
| High | 6 |
| Medium | 10 |
| **Tổng** | **31** |

| Mã phát hiện | Số lượng | Hướng xử lý |
| --- | ---: | --- |
| `OPEN_OCCUPANCY_WITH_TERMINAL_CONTRACT` | 10 | Sửa command kết thúc hợp đồng để đóng Occupancy trong cùng transaction; cleanup cũ phải dry-run và review. |
| `CUSTOMER_MULTIPLE_OPEN_OCCUPANCIES` | 5 | Đóng bản ghi cũ sau khi đối chiếu hợp đồng/phòng; không xóa lịch sử. |
| `ROOM_AVAILABLE_WITH_ACTIVE_BINDINGS` | 3 | Tính lại trạng thái phòng sau khi xử lý Occupancy; không sửa riêng Room.status trước. |
| `CUSTOMER_ROOM_CACHE_MISMATCH` | 10 | Đồng bộ lại cache `Customer.roomId` từ Occupancy còn hiệu lực sau khi quyết định bản ghi đúng. |
| `DUPLICATE_CUSTOMER_PHONE` | 1 nhóm | Đưa vào hàng chờ hợp nhất hồ sơ có người duyệt; giữ alias/lịch sử liên kết. |
| `DUPLICATE_CUSTOMER_IDENTITY` | 2 nhóm | Đưa vào hàng chờ hợp nhất hồ sơ có người duyệt; tuyệt đối không tự gộp theo CCCD. |

Không phát hiện chênh lệch tổng cọc hợp đồng hoặc `Invoice.paidAmount` so với Allocation đã xác nhận trong baseline này. Kết quả không đồng nghĩa dữ liệu tiền đã được nghiệm thu; vẫn phải thực hiện đối soát và restore drill theo Gate 0.

## Thứ tự xử lý dữ liệu

1. Sửa nguyên nhân tạo Occupancy mở sau khi hợp đồng terminal và thêm regression.
2. Tạo cleanup dry-run, xuất before/after dự kiến và yêu cầu người vận hành duyệt từng nhóm mơ hồ.
3. Đóng Occupancy sai, sau đó mới tính lại `Customer.roomId` và `Room.status`.
4. Xử lý khách trùng bằng quy trình merge có lịch sử; không xóa hồ sơ trực tiếp.
5. Chạy lại detector và chỉ chấp nhận migration khi các finding critical đã về 0 hoặc có ngoại lệ được phê duyệt.

## Trạng thái phòng ngừa sau baseline

- `syncContractHistory` đã chuyển sang ID Occupancy xác định theo tenant + hợp đồng + khách và `upsert`, nên retry cùng nguồn không tạo thêm dòng ngẫu nhiên.
- Command kết thúc hợp đồng đóng Occupancy theo đúng tenant trong cùng transaction; regression xác nhận `leftAt` và `leaveReason` được ghi.
- Đây mới là chặn phát sinh mới. 31 finding baseline vẫn còn nguyên cho đến khi restore drill hoàn tất và bản cleanup dry-run được người vận hành duyệt.

## Bằng chứng backup/restore trước cleanup

- Backup ID: `2026-09-08T02-59-51-364Z`; chỉ gồm DB, không đóng gói `.env` hoặc storage.
- Restore target cô lập: `homeland_core_restore_drill_20260908`; guard tên DB và checksum đều đạt; target đã được xóa sau drill.
- Restore gate: PASS 10/10. Một cảnh báo tương thích duy nhất `SET transaction_timeout` giữa PostgreSQL client 18 và server 16 được nhận diện theo allowlist chặt; mọi lỗi restore khác vẫn làm gate thất bại.
- Record count nguồn/restore khớp: TenantOrg 25, Room 51, Customer 22, Contract 15, Deposit 24, Invoice 10, Payment 6, Occupancy 11.
- Tổng tiền nguồn/restore khớp: hóa đơn 59.400.000đ; đã thu trên hóa đơn 32.500.000đ; cọc 123.000.000đ; payment CONFIRMED 38.100.000đ.

## Kết quả cleanup Occupancy

- Dry-run: 10 ứng viên, 0 bản ghi mơ hồ, 0 bản ghi bị bỏ qua.
- Apply: đóng 10 Occupancy có hợp đồng terminal trong một transaction; CAS yêu cầu bản ghi vẫn mở và hợp đồng vẫn terminal tại thời điểm ghi.
- Mỗi Occupancy sửa có `AuditLog`; sau đó `Customer.roomId` và `Room.status` được tính lại từ Occupancy/hợp đồng còn hiệu lực.
- Detector sau cleanup: 3 finding, đều mức High; Critical giảm 15 → 0, Medium giảm 10 → 0.
- Ba finding còn lại là 1 nhóm trùng điện thoại và 2 nhóm trùng CCCD/CMND. Các nhóm này phải được người vận hành đối chiếu trước khi merge; hệ thống không tự xóa hoặc gộp hồ sơ.
- Điểm khôi phục nếu cần: backup ID `2026-09-08T02-59-51-364Z`.

## RentalCycle additive

- Đã tạo enum trạng thái `PLANNED / RESERVED / ACTIVE / CLOSED / CANCELLED` và bảng `RentalCycle` với khách, phòng, ngày dự kiến vào, ngày vào/kết thúc thực tế và lý do đóng.
- Đã thêm FK nullable từ Contract, Deposit, Occupancy, Invoice, Payment và ContractSettlement. Thiết kế nullable giúp triển khai schema trước, backfill sau và không tự suy diễn bản ghi mơ hồ.
- Migration SQL đã PASS trên database cô lập dựng từ schema hiện tại; target kiểm thử đã được xóa.
- Backup hậu-cleanup `2026-09-08T07-16-03-711Z` đã SUCCESS trước khi đồng bộ schema dev.
- Đã thêm quy trình review/merge có gom cụm liên thông, che PII, chặn xung đột phòng, yêu cầu người duyệt/bằng chứng/câu xác nhận và giữ hồ sơ phụ bằng soft-delete.
- Ba finding khách trùng được quy thành 2 cụm; sau merge còn 0 finding khách trùng. Backup trước merge: `2026-09-08T07-30-23-920Z`.
- Backfill đã tạo 15 RentalCycle và liên kết 22 cọc, 11 Occupancy, 9 hóa đơn, 5 thanh toán; 0 skip và 0 orphan. Backup sau merge/trước backfill: `2026-09-08T07-31-27-774Z`.
- API đã nối RentalCycle cho cọc giữ chỗ mới, hợp đồng mới, chuyển trạng thái hợp đồng, Occupancy, hóa đơn tháng/quyết toán và thanh toán.
- Hậu kiểm cuối: backfill dry-run còn 0 candidate; detector mở rộng kiểm tra binding RentalCycle trả 0 finding.
