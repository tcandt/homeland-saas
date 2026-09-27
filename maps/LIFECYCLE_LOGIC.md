# Luồng nghiệp vụ bổ sung — hiện trạng và thiết kế đề xuất

Ngày đối chiếu/cập nhật: 23/09/2026. Tài liệu phục vụ diagram, không phải bằng chứng đã triển khai hoặc đã pass UAT. Các mũi tên đỏ ở nhóm lifecycle là thứ tự xử lý/nhánh cần hoàn thiện, không khẳng định có lời gọi trực tiếp giữa hai file.

## Trạng thái P31–P36 trong lượt 23/09

| Phase | Trạng thái | Cập nhật có trong source | Còn để đóng phase |
|---|---|---|---|
| P31 | Đang thực hiện | `DEPOSIT_POLICY_V1`; chặn hủy hold đã gắn HĐ ACTIVE; quy tắc ngày nhắc dùng chung. | Owner/FIN/OPS phê duyệt policy, đặc biệt % hoa hồng. |
| P32 | Đang thực hiện | Convert HĐ cọc → HĐ thuê dùng transaction SERIALIZABLE của caller để tạo HĐ DRAFT + cọc SECURITY cùng commit; cặp key `:contract`/`:deposit` replay-safe, draft legacy tạo dở có thể hoàn tất tiếp. Command tạo invoice ENTRY DRAFT theo key canonical ngay trong transaction; activate phát hành chính invoice đó và tạo QR cho tiền thuê kỳ đầu. Nếu B<C, QR cọc lấy `C−B` từ ledger, không lấy lại toàn bộ C. | UI dẫn tới HĐ/cọc mới, E2E crash/webhook và review tiền độc lập. |
| P33 | Đang thực hiện | Cancel hủy HĐ cọc pre-active sang `CANCELLED`; ACTIVE fail-closed; R+K+D=B. | Chứng từ hoàn thực tế, UAT notification/room occupancy. |
| P34 | Đang thực hiện | Payment/allocation theo mỗi reference và CAS trên số dư đã có. Drawer tách cash khỏi QR: thu tiền mặt tạo `MANUAL/CASH`; chọn QR chỉ mở payment request theo số dư còn lại và chờ webhook SePay, không tạo khoản thu manual giả. | E2E concurrent/retry và finance review. |
| P35 | Đang thực hiện | Transaction mới trùng memo với request đã confirmed → `NEEDS_REVIEW`, audit/admin alert, không báo khách lần hai. Admin đã có thể gán giao dịch chuyển hộ/thiếu mã vào hóa đơn đã chọn, sau kiểm tra tenant, tài khoản nhận và số tiền còn nợ. | Màn hình review/credit/refund và DB concurrency E2E. |
| P36 | Đang thực hiện | `PaymentPromise` + scheduler/task/reminder; đầy tiền tự `FULFILLED`. Drawer hóa đơn xem/lập/đổi hẹn bằng idempotency; đến hết ngày hẹn scheduler đổi `OVERDUE`. Service spec xác nhận hẹn không sửa `Invoice.total/paidAmount` và không vượt dư nợ. Migration mới chưa apply. | Review migration, delivery provider/UAT/timezone. |

## 1. Chuyển cọc giữ phòng → cọc hợp đồng dài hạn

- B = số dư cọc giữ phòng còn hiệu lực trên ledger; C = cọc dài hạn yêu cầu.
- Chuyển min(B,C); thu bổ sung max(C−B,0); dư max(B−C,0), phải chọn CREDIT hoặc REFUND.
- Ví dụ B=2 triệu, C=5 triệu: thiếu 3 triệu cọc. Nếu tiền thuê đầu kỳ là 4 triệu thì tổng cần thu mới là 7 triệu trước các credit/điều chỉnh hợp lệ; tuyệt đối không thu lại 2 triệu đã chuyển.
- `DepositCoreService.convertToSecurity`: ledger transfer, cọc nguồn CONVERTED_TO_CONTRACT; cọc đích PAID/PENDING theo thiếu tiền; event deposit.converted_to_security.
- `ContractsService.createRentalFromBookingHold`: tạo HĐ thuê DRAFT mới, snapshot liên kết HĐ cọc và invoice ENTRY DRAFT canonical trong cùng transaction. Đã thêm idempotency key, serializable lock và replay-safe theo cùng request. Command gọi `DepositCoreService.convertToSecurityInTransaction`; với B<C sẽ tạo PaymentRequest/QR chỉ cho phần còn thiếu của SECURITY từ ledger. Khi activate, chính invoice ENTRY được phát hành và QR tiền thuê đầu kỳ được trả nếu Settings bank hợp lệ. Nếu gặp draft legacy đã tạo nhưng chưa có conversion snapshot, retry cùng request sẽ hoàn tất liên kết thay vì tạo HĐ thứ hai.
- HĐ cọc cũ giữ nguyên lịch sử. `Deposit.CONVERTED_TO_CONTRACT` không đồng nghĩa `Contract.status`; chỉ lifecycle duyệt/activate mới làm HĐ thuê có hiệu lực.
- PDF/ký HĐ mới cần từ snapshot chính xác. Duyệt/activate dùng lifecycle sẵn có; không tự activate chỉ vì đã chuyển tiền cọc.

## 2. Hủy giữ phòng

| Trường hợp | Hoàn R | Giữ K / khấu trừ D |
|---|---|---|
| Hoàn toàn bộ | B | 0 |
| Hoàn một phần | 0 < R < B | K+D=B−R |
| Không hoàn | 0 | K+D=B |

Core cancel yêu cầu PAID; R+K+D phải bằng B. Receipt PENDING là nghĩa vụ chờ hoàn, chưa phải cash-out. Hoàn thực tế mới completePendingRefund, ghi chứng từ và REFUND một lần.

Core cancel đổi Deposit/RoomHold CANCELLED, đóng RentalCycle PLANNED/RESERVED và từ 23/09 chuyển HĐ cọc `DRAFT`/`PENDING_APPROVAL`/`APPROVED` đúng deposit sang `CANCELLED` (vẫn giữ lịch sử). HĐ `ACTIVE` bị chặn ngay từ policy và phải đi settlement/terminate. Trạng thái Room vẫn cần tính lại theo occupancy/hold khác ở UAT.

Thông báo: refund_requested → “đang chờ hoàn”; refunded → “đã hoàn”; cancelled không hoàn → nêu khoản giữ/lý do; deduct → chứng từ khấu trừ. Không dùng lời “đã hoàn” khi còn PENDING.

## 3. Thanh toán một phần, tiền mặt + QR, người chuyển hộ

- Mỗi lần nhận là Payment riêng, giữ provider/payment method và reference; allocation vào đúng invoice/rentalCycle. Cash command vẫn cần idempotency và phân quyền.
- 5 triệu phải thu: nhận tiền mặt 2 triệu → PARTIALLY_PAID, còn 3 triệu; QR mới cho 3 triệu. Drawer không còn cho “xác nhận chuyển khoản QR” bằng payment manual: chỉ mở QR và chờ webhook. Webhook cập nhật Payment/Allocation sau kiểm tra dư nợ tại thời điểm xử lý.
- QR cũ chuyển 5 triệu sau khi đã nhận 2 triệu: xử lý 2 triệu thừa theo credit/refund/review; không tạo dư nợ âm hoặc sửa số tiền giao dịch bank.
- Người khác chuyển hộ nhưng nội dung đúng: xác minh request/bank/tenant, người trả không nhất thiết là khách thuê. Sai hoặc thiếu nội dung: webhook giữ `NEEDS_REVIEW`; admin đối soát chứng từ rồi có thể manual assign theo hóa đơn/cọc đã chọn. Command kiểm tra tenant, tài khoản nhận và dư nợ; memo đã được gắn cho nguồn khác bị chặn. Không tự suy khách từ tên hoặc số tiền.
- **Giao dịch trùng phải tách hai loại:**
  - **Trùng kỹ thuật:** cùng `provider + providerRef`/mã giao dịch ngân hàng, hoặc cùng webhook event đã xử lý. Dùng unique key, idempotency, lock/CAS; bản ghi sau chuyển `DUPLICATE/IGNORED`, liên kết `duplicateOfPaymentId` hoặc payment gốc, không tạo allocation/ledger/refund/notification thành công lần hai. Vẫn giữ raw payload, correlation ID và audit để đối soát.
  - **Trùng nội dung nhưng là hai giao dịch khác nhau:** cùng payment code/memo, cùng số tiền hoặc cùng người gửi nhưng `bankReference`/thời điểm khác. Không được auto-merge hay coi là duplicate chỉ vì nội dung giống nhau. Đưa cả giao dịch chưa chắc chắn vào `NEEDS_REVIEW`; đối chiếu bank/owner/tenant, payment request còn dư, số tiền, payer và chứng từ. Nếu xác nhận giao dịch thứ hai là tiền thật thì tạo `Payment` riêng và xử lý phần vượt thành `CREDIT`/`REFUND_PENDING`/`OVERPAYMENT` theo policy; nếu không chứng minh được thì giữ unmatched, không ghi doanh thu.
- Thông báo: duplicate kỹ thuật chỉ cảnh báo admin/đối soát, không gửi khách “đã nhận tiền” lần hai. Giao dịch trùng nội dung sau khi manual assign canonical mới gửi xác nhận số tiền được phân bổ; nếu thành overpayment thì thông báo số dư tín dụng hoặc quy trình hoàn, không báo đã tất toán sai. Mọi chuyển trạng thái `NEEDS_REVIEW`, `DUPLICATE`, `OVERPAYMENT`, `CREDIT`, `REFUND_PENDING` phải có actor, lý do, evidence và operation/event ID.
- Hẹn phần còn lại có `PaymentPromise` riêng (migration `20260923100000_add_payment_promises`, **chưa apply**): amount không vượt dư nợ tại lúc ghi, ngày hẹn/người ghi/lý do/idempotency được lưu; một hẹn mới cancel hẹn cũ đang mở để không nhắc hai lần. Drawer hóa đơn cho xem/lập/đổi hẹn và nói rõ đây không phải đã thu tiền. Khi invoice PAID thì promise `FULFILLED`. Scheduler đánh dấu `OVERDUE` trong ngày hẹn, nhắc khách/admin và tạo task với số dư hiện tại. Promise không tự dời `Invoice.dueDate`, không tạo Payment/Allocation và không che quá hạn.
- Notification sau mỗi allocation: số tiền lần này, lũy kế, còn nợ, ngày hẹn/đến hạn. Chưa match thì chỉ cảnh báo admin, chưa báo khách đã trả. Test riêng webhook replay, cùng memo khác bank reference, cùng bank reference khác payload, thanh toán lần hai thật sau khi invoice đã đủ và hai tenant dùng cùng payment code.

## 4. Sắp hết hạn / gia hạn / tất toán

Scheduler và registry cùng đọc `reminder-policy` với giá trị tenant hoặc fallback 3/3/30; các record `notifications` và `contract-rules` được gộp theo tenant thay vì ghi đè lẫn nhau. Rule luôn kiểm tra dư nợ hiện tại và trạng thái terminal trước khi gửi. Gửi khách và admin trước N ngày, ghi phản hồi; gia hạn dùng renew command tạo HĐ/cycle mới, duyệt tạo reservation hold và kích hoạt chỉ sau khi kỳ nguồn đã quyết toán/terminal, cọc kỳ mới đủ số dư. Chuyển thành viên phòng ghép dùng giá `monthlyPrice` của phòng đích, giữ bằng chứng ký nguồn, không chuyển ledger/cọc lịch sử. Không gia hạn → preview settlement → chốt nợ/utility/cọc → terminate → turnover phòng. Không tự coi hết hạn là đã dọn đi và không âm thầm chuyển số dư cọc giữa hai kỳ.

## 5. Doanh thu, chi phí, hoa hồng

Không coi cọc giữ hộ là doanh thu tiền thuê. Báo cáo phải phân biệt doanh thu theo kỳ, cash-in, chi phí ghi nhận, cash-out, phải thu/phải trả, deposit liability. Dùng FinanceReportingService và sổ nguồn; AnalyticsService hiện đã đọc `getProfitLossHistory` và `getBuildingProfitSummary` theo tenant/kỳ, không còn số liệu mẫu và không dùng làm nguồn chia tiền.

**Đề xuất mới, chưa chọn mức %:** CommissionPolicy theo tenant và phiên bản hiệu lực: cơ sở tính (ký HĐ / tiền thuê thực thu), % hoặc cố định, khoản loại trừ (cọc, utility, VAT), thời gian áp dụng, sales attribution, chia nhiều sales, trần, quyền duyệt, refund/clawback.

Hoa hồng = basis hợp lệ × rate × share. Ví dụ minh họa, không phải cấu hình mặc định: 5 triệu × 10%=500.000; chia 60/40 → 300.000 và 200.000. Tổng share phải 100%. Nếu tính theo thực thu, trả một phần chỉ tạo accrual tương ứng. Hoàn tiền tạo reversal, không xóa lịch sử. Quy trình accrued → approved → paid, trace tới PaymentAllocation/Contract/policy snapshot/chứng từ chi; không ghi chi phí hai lần.

## 6. Chuyển sang cấu hình mẫu tin

Đã có NotificationTemplate và Handlebars. `CommunicationService.dispatch` có nhánh override mẫu tenant bằng default đối với hai mã yêu cầu QR Zalo; cần rà cả dispatchDirect. Không cần thay toàn bộ engine, cần nối editor và thống nhất precedence: published tenant/channel template → default fallback.

Editor đề xuất: event, kênh, đối tượng, subject, body, biến cho phép, preview, validate, publish/version/rollback, test gửi có xác nhận. Không thực thi mã trong mẫu. Encode theo Email HTML/Telegram/Zalo; validate độ dài và biến bắt buộc. Snapshot context + rendered content + version để retry nhất quán.

Mẫu xác nhận thanh toán (đề xuất tên biến chuẩn):

```handlebars
Xin chào KH {{customerName}},
HomeLand đã ghi nhận {{paymentAmountText}} cho hóa đơn {{invoiceCode}}, phòng {{roomCode}}.
Tổng đã thanh toán: {{paidAmountText}}.
Số tiền còn lại: {{remainingAmountText}}.
{{#if promisedPaymentDateText}}Ngày hẹn thanh toán tiếp: {{promisedPaymentDateText}}.{{/if}}
{{#if paymentUrl}}Thông tin thanh toán phần còn lại: {{paymentUrl}}{{/if}}
Xin cảm ơn.
```

Biến phải do backend tạo từ dữ liệu đã commit, không tin trực tiếp từ nội dung webhook; số tiền định dạng riêng để tránh lỗi helper mặc định. Thiếu tên/date có fallback được duyệt, không hiện `undefined`. Sự kiện chuyển cọc/hủy/hoàn/hết hạn dùng template riêng, không dùng một SYSTEM_ALERT cho mọi ý nghĩa.

## 7. Realtime có đo lường, không hứa zero-delay

Webhook/command tiền mặt → transaction nghiệp vụ + outbox → event sau commit → UI invalidation/resync + worker notification. UI và nhà cung cấp là hai consumer riêng; Zalo lỗi không rollback tiền.

PaymentRequest PENDING vẫn có polling 5 giây, outbox interval 1 giây; Header đã duy trì SSE notification stream và inbox dùng chung cache `notifications-list`, với fallback polling 60 giây khi stream lỗi. Điều này chỉ giải quyết realtime của inbox, chưa chứng minh invalidation bao phủ mọi tab nghiệp vụ. **Đề xuất tiếp:** domain event tenant-scoped có eventId/version/roomId/customerId/contractId/rentalCycleId/depositId/invoiceId/paymentId; push tới Popup tài chính, hóa đơn, cọc, hợp đồng, history, tổng hợp; refetch nguồn authoritative. Multi-instance cần broker/fan-out, reconnect có replay hoặc full resync, chống duplicate/out-of-order.

Đo riêng commit→UI, commit→provider accepted, retry/dead-letter. Provider accepted không đồng nghĩa khách đã đọc. Không cam kết tuyệt đối không delay do mạng, downtime, retry và rate-limit.

## 8. Settings, bảo mật phiên và backup

- `AuthService` lưu `auth-security` theo `AppSetting` scope USER: Email OTP 2FA, `sessionVersion` và inactivity timeout. OTP chỉ lưu HMAC, hết hạn sau 5 phút và khóa sau giới hạn lần thử.
- API Settings tổng quát chặn đọc/ghi trực tiếp `auth-security` và `system-backup-schedule`; hai key nội bộ chỉ thay đổi qua endpoint chuyên dụng để không bypass OTP hoặc quyền backup.
- Login có 2FA trả challenge ngắn hạn, chỉ cấp access/refresh token sau khi OTP hợp lệ. `JwtStrategy` đối chiếu `sessionVersion`; lệnh “đăng xuất thiết bị khác” tăng version để token cũ bị từ chối và cấp cặp token mới cho thiết bị hiện tại.
- `AuthGuard` tải timeout từ backend sau khi đăng nhập; localStorage chỉ là cache offline của giá trị USER, không còn là nguồn cấu hình chính.
- Lịch backup lưu `system-backup-schedule` theo scope TENANT. Cron 02:00 Asia/Ho_Chi_Minh chỉ tạo một snapshot thật khi có ít nhất một tenant bật lịch; danh sách rỗng không còn sinh snapshot baseline giả.
- Đã xóa `SettingsSidebar` và 6 section Settings cũ sau khi import graph xác nhận không có caller runtime; `app/settings/page.tsx` là nguồn điều hướng duy nhất.

## 9. Bản đồ miền nghiệp vụ

`maps/maps.html` hiện có một tab tổng thể và 11 tab độc lập theo thứ tự: Đặt cọc → Hợp đồng → Báo cáo → Chi phí → Thông báo → Khách thuê → Tổng hợp → Tòa nhà → Doanh thu → Lịch sử giao dịch → Nhật ký vận hành. Mỗi node có source evidence và trạng thái màu. Các điểm đã xử lý trong lần cập nhật này: EXP01 (khóa create expense về PENDING), NOT01 (inbox dùng SSE cache chung), REV01 (analytics nối reporting authoritative), TX01 (unified transaction feed từ reconciliation), AUD01 (audit retry và throw lỗi cuối). Đây là bản đồ logic/read-only, không phải chứng nhận giao dịch runtime hay thay đổi dữ liệu production.

## Gate trước khi triển khai tiền

Chốt policy hợp đồng cọc, basis/%/share hoa hồng, ngày hẹn, quyền duyệt hoàn, template precedence và SLO. Test B<C/B=C/B>C; full/partial/no refund; cash+QR concurrent; QR cũ/overpay; wrong content/manual assign/replay; hủy nhắc sau PAID; outbox crash/reconnect; tenant isolation. Money/ledger/concurrency phải review độc lập theo quy tắc project. Lượt này có code P31–P36 nhưng không đóng milestone, không apply migration và không thay production.
