# Runbook maintenance window — CORE-04/05

Ngày soạn: 08/09/2026  
Owner thực thi: TL + DBA + CORE/DEV1 + FIN + OPS  
Trạng thái: **DRAFT / PRODUCTION NO-GO**

Runbook này không phải quyền chạy production. Chỉ thực thi sau khi có change ticket, người phê duyệt, release SHA bất biến, staging UAT và lịch maintenance window.

## 1. Điều kiện vào cửa sổ bảo trì

- [ ] `BASE_SHA`, release SHA/tag và checksum migration đã chốt.
- [ ] Không còn thay đổi schema khác chen giữa migration RentalCycle và CORE-04/05.
- [ ] Integration test PostgreSQL thật đạt cho lock WHOLE/SHARED, idempotency, CAS refund và cross-tenant.
- [ ] Có báo cáo đối soát từng cọc lịch sử với chứng từ thu/hoàn; không suy số dư từ `Deposit.status`.
- [ ] Script opening-balance có dry-run, file review được FIN ký và tổng Nợ/Có được chốt.
- [ ] Backup pre-cutover thành công và restore drill trên DB riêng đạt.
- [ ] Có feature flag tắt command CORE-04/05 theo tenant/tòa nhà.
- [ ] OPS/SALES/FIN xác nhận thời điểm ngừng tạo/thu/chuyển/hoàn cọc trong UI cũ.
- [ ] Dashboard/log/alert và người trực rollback đã sẵn sàng.

Thiếu một mục thì quyết định là **NO-GO**.

## 2. Trước maintenance window

1. Khóa merge và xác nhận CI đúng release SHA.
2. Xuất detector/read-only report:
   - cọc PAID không có bằng chứng thu;
   - cọc đã refund/cancel nhưng số chứng từ không khớp;
   - một RentalCycle có nhiều booking/security không giải thích được;
   - Occupancy/hold/capacity bất nhất;
   - customer/room/contract/rentalCycle lệch tenant.
3. FIN phân loại từng dòng `CONFIRMED / REJECTED / NEEDS_REVIEW`.
4. Chạy dry-run opening balance trên bản restore; tổng theo tenant và tổng toàn hệ thống phải khớp báo cáo đã ký.
   - Xuất review queue: `npm run backfill:deposit-ledger -- --env-file <staging.env> --tenant-id <tenantId>`.
   - FIN điền file review ngoài Git; mỗi dòng APPROVE phải có `approvedBalance` và `evidenceRef`.
   - Kiểm tra file mà chưa ghi: `npm run backfill:deposit-ledger -- --env-file <staging.env> --tenant-id <tenantId> --review-file <review.json>`.
5. Không gửi artifact chứa SĐT/CCCD/token hoặc chuỗi kết nối database.

## 3. Trong maintenance window

1. Bật maintenance/read-only cho các command cọc, hợp đồng và thanh toán liên quan.
2. Chờ request đang chạy hoàn tất; chụp số lượng transaction/operation đang mở.
3. Tạo backup pre-cutover và lưu ID/checksum ngoài Git.
4. Chạy preflight đúng release SHA.
5. Áp migration bằng `prisma migrate deploy` từ immutable release artifact. **Không dùng `db push`, reset hoặc seed.**
6. Kiểm tra tồn tại:
   - `RoomHold`;
   - `DepositOperation`;
   - `DepositLedgerEntry`;
   - `OutboxEvent` và index claim theo `status + availableAt`;
   - unique key idempotency/active resource;
   - trigger `DepositLedgerEntry_append_only`.
7. Chạy opening-balance theo lô nhỏ đã duyệt; mỗi lô có run ID, checksum, số dòng và tổng tiền:
   `npm run backfill:deposit-ledger -- --env-file <production.env> --tenant-id <tenantId> --review-file <review.json> --apply --confirm BACKFILL_REVIEWED_DEPOSIT_OPENING_BALANCES`.
8. Chạy reconciliation lại; không tiếp tục nếu tổng trước/sau lệch ngoài đúng chuyển động dự kiến.
9. Bật feature flag cho tenant canary nội bộ trước; không bật toàn bộ ngay.

## 4. Smoke test canary

- [ ] Hai request đồng thời giữ cùng WHOLE room: đúng một thành công.
- [ ] SHARED room không vượt capacity khi collect đồng thời.
- [ ] Retry cùng key không tạo ledger/Receipt/CreditNote lần hai.
- [ ] Cùng key khác payload trả conflict.
- [ ] `B<C`, `B=C`, `B>C CREDIT`, `B>C REFUND PENDING/COMPLETED` đúng ma trận.
- [ ] Security deposit sau transfer chỉ thu `C-B`.
- [ ] Booking → security vẫn giữ đúng hold ACTIVE cho tới activation CORE-06.
- [ ] Gia hạn/chuyển phòng/giải phóng hold không đổi số dư và không ảnh hưởng hold khác trong phòng ghép.
- [ ] Hủy bắt buộc `refund + keep + deduct = balance`.
- [ ] Hai complete refund đồng thời: đúng một cash-out.
- [ ] Tenant A không đọc/đổi operation, hold hoặc ledger tenant B.
- [ ] Ledger từ chối UPDATE/DELETE ngoài purge được phê duyệt.
- [ ] Reversal đảo toàn operation, không sửa dòng gốc; operation có Receipt/CreditNote bắt buộc dùng workflow chứng từ.
- [ ] Operation thành công có đúng event outbox; rollback không để event mồ côi; cùng idempotency key không tạo event lần hai.
- [ ] Dispatcher phát được event canary; consumer khử trùng theo `outboxEventId`; không có `PROCESSING` quá 5 phút.
- [ ] Tab tài chính hiển thị từ API summary, không suy từ status.

## 5. GO/NO-GO

GO chỉ khi migration và checksum đúng; detector/reconciliation bằng 0 hoặc có waiver ký rõ; smoke test đạt; không có duplicate ledger/hold/cash-out; latency/error rate trong ngưỡng; FIN + OPS + TL ký duyệt.

Nếu đạt, mở traffic theo tenant/tòa nhà từng bước và giữ đội trực hypercare.

## 6. Rollback/forward-fix

- Ưu tiên tắt feature flag và đưa command về maintenance/read-only.
- Có thể đặt `DISABLE_DEPOSIT_OUTBOX=true` để dừng phát trong lúc cô lập sự cố; không xóa hàng đợi và không đánh dấu tay `PUBLISHED`.
- Không rollback bằng cách xóa ledger hoặc sửa dòng gốc.
- Không chạy down migration sau khi đã có dữ liệu CORE-04/05.
- Giao dịch sai phải dùng REVERSAL/forward-fix có chứng từ và audit.
- Nếu migration lỗi trước khi ghi dữ liệu: dừng deploy, giữ backup và đánh giá restore theo change ticket.
- Nếu lỗi sau khi ghi dữ liệu: giữ nguyên database, chụp operation IDs, ngăn command mới và chạy reconciliation; TL/DBA/FIN quyết định forward-fix hoặc restore toàn hệ thống.

## 7. Hypercare

- Đối soát sau 1 giờ, 24 giờ và 7 ngày.
- Theo dõi hold hết hạn, operation PENDING quá SLA, receipt PENDING, outbox PENDING/FAILED/PROCESSING quá SLA, conflict rate và balance âm.
- Mỗi bất thường phải có tenant, operation ID, source ID và số tiền đã che PII.
- Chỉ kết thúc hypercare khi FIN/OPS xác nhận tổng cọc, hoàn, giữ, khấu trừ và credit khớp.
