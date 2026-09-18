# HomeLand — kế hoạch triển khai chính thức vòng đời thuê

Trạng thái: **Bản chốt để triển khai**  
Ngày chốt: 08/09/2026  
Nguồn hợp nhất: [kiểm định tổng thể 07/09](./2026-09-07-final-figjam-logic-audit.md) và [đối chiếu 11 ảnh vận hành 08/09](./2026-09-08-operational-screenshots-addendum.md).

Bảng trạng thái thực thi duy nhất: [HomeLand Go-Live TODO](../operations/GO_LIVE_TODO.md#big-update--todo-triển-khai-vòng-đời-thuê-cốt-lõi).

## 1. Mục tiêu và phạm vi

Đợt triển khai chính thức tập trung vào một vòng đời xuyên suốt:

`Khách hàng → Kỳ thuê → Cọc giữ phòng → Hợp đồng/cọc bảo đảm → Nhận phòng → Hóa đơn → Thanh toán → Quyết toán/kết thúc → Lịch sử giao dịch → Doanh thu/chi phí → Báo cáo`

Kết quả phải đạt:

- Một hồ sơ khách hàng được dùng lại qua nhiều lần thuê, không nhân bản khách cũ.
- Mọi khoản cọc, hóa đơn và thanh toán truy ngược được về đúng khách, phòng, hợp đồng và kỳ thuê.
- Không còn phòng “trống nhưng có người”, hợp đồng hiển thị trùng hoặc khách đang ở lại hiện “chưa thuê”.
- Tiền thực thu không bị suy ra từ trạng thái; mọi cấn cọc, hoàn tiền và thanh toán có dòng giao dịch nguồn.
- Điện/nước ở ghép bảo toàn tổng tiền của phòng và dùng dữ liệu đã khóa đúng kỳ.

Các phần không phục vụ trực tiếp vòng đời trên vẫn được ghi nhận tại mục 8 và chuyển sang phase tiếp theo.

## 2. Kiến trúc nghiệp vụ chốt

### 2.1. Khóa liên kết toàn vòng đời

Tạo khái niệm **Kỳ thuê (`RentalCycle`)** làm khóa liên kết từ lúc giữ phòng đến khi kết thúc. Mỗi lần khách quay lại tạo kỳ thuê mới nhưng dùng lại `Customer.id` cũ.

Một kỳ thuê tối thiểu có:

- `tenantId`, `customerId`, `roomId`;
- trạng thái chuẩn bị/đang thuê/đã kết thúc/đã hủy;
- ngày dự kiến vào, ngày vào thực tế, ngày kết thúc thực tế;
- liên kết booking deposit, contract, occupancy, invoice, payment và settlement.

Dữ liệu cũ được backfill theo hợp đồng/phòng/khách. Bản ghi không xác định chắc chắn phải đưa vào hàng đợi đối soát, không tự đoán.

### 2.2. Nguồn sự thật

| Dữ liệu | Nguồn sự thật |
|---|---|
| Danh tính khách | `Customer`; phone/CCCD dùng để tìm và chọn lại hồ sơ, không tạo trùng |
| Ai đang ở phòng | `Occupancy` chưa có `leftAt`; `Customer.roomId` chỉ là cache tương thích và phải đồng bộ trong cùng transaction |
| Quyền sử dụng phòng | Booking hold còn hạn + Contract đang hiệu lực + Occupancy đang mở |
| Tiền cọc thực còn | Tổng giao dịch cọc thực thu − đã cấn − đã hoàn − đã giữ/khấu trừ; không lấy `Contract.depositMoney` làm tiền đã thu |
| Công nợ hóa đơn | `Invoice.total − PaymentAllocation − credit hiệu lực` |
| Tiền đã thu/chi | Payment/Receipt đã xác nhận và bút toán nguồn; không suy từ trạng thái hợp đồng/cọc |
| Điện/nước kỳ tháng | Billing snapshot đã khóa theo phòng, kỳ, công tơ và danh sách người ở |
| Báo cáo | Journal đã ghi sổ, đối soát về chứng từ nguồn |

### 2.3. Ranh giới lệnh bắt buộc

Không cho giao diện tự ghép nhiều API để tạo trạng thái nghiệp vụ. Dùng các command idempotent, transaction nguyên tử:

1. `startRentalCycle` — chọn/tạo khách, chọn phòng và kiểm tra khả dụng.
2. `collectBookingDeposit` — ghi nhận tiền cọc và tạo/quản lý hold có hạn.
3. `convertDepositAndCreateContract` — cấn cọc giữ phòng, thu thiếu hoặc tạo credit/hoàn phần thừa; không ghi đè tiền gốc.
4. `activateContractAndMoveIn` — xác minh điều kiện ký/tiền/phòng, mở Occupancy, chụp công tơ đầu vào và lập nghĩa vụ đầu kỳ.
5. `closeBillingPeriod` — khóa kỳ, snapshot Hunonic/người ở, lập hóa đơn tháng một lần.
6. `allocatePayment` — ghi Payment và Allocation an toàn khi đồng thời/retry.
7. `settleContractAndMoveOut` — chốt công nợ, điện nước cuối, cấn/hoàn cọc, đóng Occupancy và tính lại Room.status.

Event, audit và notification chỉ phát sau khi transaction nghiệp vụ đã commit; tác vụ tài chính phải dùng outbox hoặc cơ chế retry không tạo tác dụng phụ lần hai.

## 3. Luồng cốt lõi phải triển khai

### A. Khách hàng và chỗ ở

- Duplicate phone/CCCD phải trả về đúng `Customer.id` và nút chọn hồ sơ cũ.
- Khách đã kết thúc hợp đồng được tạo kỳ thuê mới; lịch sử cũ giữ nguyên.
- WHOLE room không có người ở cùng đang hoạt động nếu thiếu hợp đồng chính, trừ loại ở tạm có thời hạn được phê duyệt.
- SHARED room kiểm tra số chỗ theo Occupancy đúng khoảng thời gian, không chỉ theo `memberCount`.
- Một `contractId` chỉ hiển thị một dòng; loại trùng ở giao diện theo ID bất biến.

### B. Cọc giữ phòng và cọc hợp đồng

- Booking/Reservation có chủ sở hữu, thời hạn, phòng/chỗ giữ và trạng thái thu tiền độc lập.
- Thu cọc phải tạo giao dịch tiền; đổi trạng thái không được tự sinh tiền đã thu.
- Chuyển sang cọc hợp đồng xử lý đủ ba trường hợp `B < C`, `B = C`, `B > C`.
- Giữ nguyên số tiền thực thu gốc. Phần thiếu là lần thu mới; phần thừa là credit hoặc refund có chứng từ.
- Hủy/hoàn/giữ/khấu trừ có thể toàn phần hoặc một phần; `PENDING` không được ghi là đã chi.
- Phiếu cọc cũ đã REFUNDED/CANCELLED/CONVERTED không được mở lại khi khách quay lại.

### C. Hợp đồng, nhận phòng và kết thúc

- Chặn đường tạo/cập nhật trực tiếp sang ACTIVE; chỉ command activation được đổi trạng thái.
- Activation kiểm tra đúng khách, phòng/hold, chữ ký hoặc điều kiện ký, số cọc thực thu và ngày bắt đầu.
- Cùng transaction phải tạo/cập nhật ContractParty, mở Occupancy, cập nhật phòng và lưu chỉ số bàn giao.
- Kết thúc/gia hạn/chuyển phòng không xóa lịch sử. Terminal contract phải đóng Occupancy và bỏ liên kết phòng hiện hành.
- Room chỉ AVAILABLE khi không còn hold hợp lệ, hợp đồng sử dụng phòng hoặc Occupancy đang mở.

### D. Hóa đơn và điện nước

- Hóa đơn đầu kỳ hỗ trợ ngày 1, giữa tháng và mọi ngày hợp lệ; cách prorate được lưu theo policy có hiệu lực.
- Hóa đơn tháng phân biệt `billingPeriod` và `usagePeriod`; tiền phòng có thể thu trước, điện/nước thu sau.
- Invoice base phải có khóa nghiệp vụ chống lập trùng theo tenant, contract/kỳ/loại; hóa đơn điều chỉnh dùng liên kết riêng.
- Thao tác thay item và cập nhật tổng hóa đơn nằm trong cùng transaction.
- Chốt tháng chỉ chạy một lần cho mỗi tenant/kỳ, dù có API và worker cùng hoạt động.

Phòng ở ghép:

- Điện: tổng kWh và tiền của phòng chia theo số người đủ điều kiện trong snapshot của kỳ; nhóm N người chịu N phần.
- Nước: `100.000đ × số người đủ điều kiện`; chính sách tính trọn tháng hay theo ngày phải cấu hình rõ.
- Phần lẻ được phân bổ xác định để tổng các hóa đơn bằng đúng tổng phòng.
- Snapshot lưu mã chỉ số Hunonic, kỳ, chỉ số đầu/cuối, kWh, phương thức giá, tổng tiền, danh sách người, tỷ lệ chia và phiên bản policy.
- Không trộn số tiền từ invoice đã khóa với kWh/phương thức giá đang trực tiếp. Nếu lệch, hiển thị reconciliation delta và yêu cầu duyệt.

### E. Thanh toán và tab Tài chính

- SePay/manual payment phải gắn đúng tenant và đúng nguồn yêu cầu thanh toán.
- Khóa idempotency theo giao dịch nhà cung cấp; dùng atomic increment/CAS hoặc tính lại từ Allocation để không mất cập nhật khi thu đồng thời.
- Không được đánh dấu cọc PENDING thành PAID chỉ vì hóa đơn tiền thuê đã PAID.
- Tab Tài chính mặc định lọc theo `tenantId + roomId + customerId + contractId + rentalCycleId`.
- Chế độ “Tổng phòng” là tổng hợp riêng và mọi dòng đều mở được chứng từ khách/hợp đồng nguồn.
- Hiển thị tối thiểu: giá thuê, cọc giữ phòng, cọc bảo đảm, đã cấn/hoàn, hóa đơn, đã thanh toán, credit, dư nợ và lịch sử giao dịch.
- Sửa API filter trước, sau đó sửa UI đang đọc sai cấu trúc `data.items`.

### F. Sổ kế toán và báo cáo cốt lõi

- Mỗi Payment/Receipt/Refund/Deposit application có `sourceId`, `tenantId` và idempotency key.
- Bút toán luôn cân Nợ/Có; reversal tạo bút toán đảo, không sửa/xóa giao dịch gốc.
- Doanh thu, chi phí, công nợ và nghĩa vụ cọc dùng cùng một bộ trạng thái đã ghi sổ.
- Báo cáo giai đoạn này chỉ cần đủ để đối soát vòng đời khách/phòng; biểu đồ và phân tích nâng cao chuyển phase sau.

## 4. Thứ tự triển khai chính thức 1–10

| Mốc | Phạm vi | Điều kiện qua mốc |
|---:|---|---|
| **1** | **Gate 0: bảo vệ dữ liệu và tiền.** Backup/restore drill DB riêng; chốt policy; sửa tenant scope tối thiểu, SePay tenant binding, access/refresh/logout và idempotency nền. | Có baseline số dư, backup khôi phục được; test hai tenant và retry tiền đạt. |
| **2** | **Customer + RentalCycle + Occupancy.** Dùng lại khách cũ; chuẩn hóa người ở/phòng; script dry-run phát hiện dữ liệu ma/trùng. | Không còn trường hợp phòng trống nhưng có người; khách đang ở có đúng phòng/trạng thái. |
| **3** | **Lõi tiền và sổ phân bổ.** Payment/Receipt/Allocation/credit/refund; chống concurrent lost update; audit/outbox. | Hai lần thu 300 + 400 luôn ra 700; retry không ghi hai lần; Nợ = Có. |
| **4** | **Booking deposit và giữ chỗ.** Hold theo WHOLE/SHARED/capacity, hết hạn/hủy/thu muộn. | Hai khách không giữ trùng cùng tài nguyên; giải phóng đúng phòng/chỗ. |
| **5** | **Chuyển/hủy/hoàn cọc.** B<C/B=C/B>C, partial refund/keep/deduct, chứng từ chi. | Bảo toàn tiền cọc; không ghi đè số thu gốc; không hoàn vượt dư. |
| **6** | **Hợp đồng và nhận phòng.** Một activation command, ký/đủ tiền/snapshot đầu vào, chống hợp đồng UI trùng. | Không còn đường ACTIVE trực tiếp; một contractId một dòng; Contract–Occupancy–Room nhất quán. |
| **7** | **Hóa đơn đầu kỳ và tháng.** Prorate, billing key, transaction item, Hunonic và snapshot số người. | Không lập trùng; điện/nước bảo toàn tổng; snapshot kỳ khóa khớp hóa đơn. |
| **8** | **Thanh toán và Tài chính phòng.** Filter API đúng scope, sửa UI, lịch sử giao dịch và công nợ. | Mở từng khách/phòng thấy đúng cọc, hóa đơn, thanh toán, dư nợ; không lộ chéo tenant. |
| **9** | **Kết thúc/gia hạn/chuyển phòng và báo cáo đối soát.** Settlement, điện cuối, cấn/hoàn cọc, room turnover. | Kỳ cũ bất biến; khách quay lại tạo kỳ mới; báo cáo khớp ledger và chứng từ. |
| **10** | **Migration + E2E + rollout.** Backfill có dry-run/rollback; kiểm thử 11 ảnh, concurrency, retry, lỗi mạng và cross-tenant. | Toàn bộ gate mục 6 đạt, UAT nghiệp vụ ký duyệt rồi mới triển khai production. |

## 5. Chiến lược dữ liệu và triển khai

1. Chỉ migration additive ở bước đầu: thêm khóa/liên kết/snapshot, chưa xóa trường cũ.
2. Chạy detector read-only và xuất danh sách: phòng ma, Occupancy mở sai, khách trùng, contract hiển thị trùng, cọc lệch, invoice/payment lệch.
3. Backfill theo lô nhỏ với mã lần chạy, dry-run, before/after totals và khả năng đảo.
4. Chạy dual-read/đối soát trong thời gian chuyển tiếp; chỉ đổi source of truth khi số liệu khớp.
5. Bật feature flag theo tenant/tòa nhà; theo dõi delta tiền, lỗi webhook, hóa đơn trùng và invariant phòng.
6. Không chạy seed, `db push` hoặc script không xác định phạm vi trên dữ liệu vận hành.

## 6. Acceptance gate bắt buộc

1. Một khách quay lại vẫn là một `Customer`, nhưng có kỳ thuê/hợp đồng/cọc mới.
2. Một `contractId` chỉ hiện một lần; phòng WHOLE/SHARED không vượt quy tắc người ở.
3. Contract terminal không còn Occupancy mở hoặc liên kết phòng hiện hành.
4. Room AVAILABLE không có hold, hợp đồng hay người ở đang hiệu lực.
5. Tổng cọc thực thu = đã cấn + đã hoàn + đã giữ/khấu trừ + số dư còn nghĩa vụ.
6. Tổng PaymentAllocation hiệu lực khớp `Invoice.paidAmount`; concurrent/retry không làm mất hoặc nhân đôi tiền.
7. Invoice điện tham chiếu một snapshot Hunonic; tổng kWh/tiền chia ở ghép bằng tổng phòng sau làm tròn.
8. Nước đúng 100.000đ/người theo policy của kỳ; người vào/ra giữa tháng được xử lý nhất quán.
9. Tab Tài chính lọc đúng khách/phòng/hợp đồng/kỳ thuê và truy ngược được về chứng từ nguồn.
10. Mọi ID, file, webhook, payment và journal bị chặn khi truy cập chéo tenant.
11. Hủy/hoàn PENDING không ghi cash-out; hoàn thành và reversal không xóa lịch sử.
12. Báo cáo vòng đời khách/phòng khớp hóa đơn, thanh toán, ledger và số dư cọc.

Không qua bất kỳ gate tiền, tenant hoặc invariant phòng nào thì không rollout production.

## 7. Những lỗi cụ thể được đóng trong phase cốt lõi

- Ghi đè tiền cọc thực thu khi chuyển sang hợp đồng.
- Thu tiền đồng thời làm sai `paidAmount`.
- Hóa đơn thuê PAID tự biến cọc thành PAID.
- API tài chính chưa lọc phòng và UI đọc sai shape dữ liệu.
- Trộn snapshot Hunonic/hóa đơn; thiếu snapshot người chia điện nước.
- Hợp đồng hiển thị trùng.
- Khách ở cùng hiện “chưa thuê”; phòng trống nhưng còn khách; phòng nguyên căn thiếu chủ hợp đồng.
- Khách cũ bị chặn tạo kỳ thuê mới hoặc bị tạo hồ sơ trùng.
- Chốt tháng có thể chạy trùng hoặc mất invoice item giữa xóa/tạo.
- Tenant binding của invoice detail, SePay/payment và chứng từ tài chính cốt lõi.

Email tùy chọn là sửa nhanh kèm phase cốt lõi nhưng không chặn các migration tài chính.

## 8. Phase tiếp theo — vẫn ghi nhận nhưng chưa ưu tiên triển khai

- Hoàn thiện xác minh email, chính sách mật khẩu, token family/reuse detection và khóa IP phân tán sau khi các lỗ hổng token/logout cốt lõi đã đóng.
- Thay thế luồng backup/restore JSON trên giao diện; mã hóa/off-site, quản trị snapshot và diễn tập phục hồi định kỳ.
- Quản lý tài liệu/phiên bản, tenant ownership của file, định danh người ký và quy trình chữ ký đầy đủ.
- Expense/reimbursement/chủ nhà nâng cao, P&L đa chiều, cashflow chart, export và dashboard phân tích.
- Zalo delivery/retry nâng cao, notification dead-letter, CRM/sales, AI/automation và monitoring toàn hệ thống.
- Hỗ trợ storage S3/R2 runtime, tối ưu scheduler/worker và hạ tầng nhiều instance.
- Nâng cấp UX không ảnh hưởng số tiền: trình bày, bộ lọc nâng cao, accessibility và báo cáo trực quan.

Các hạng mục phase sau không được dùng làm lý do trì hoãn gate bảo mật tenant, tiền hoặc dữ liệu cốt lõi ở phase hiện tại.

## 9. Quy tắc quản lý thực thi

- Mỗi mốc có migration, command/service, API, UI, unit test, integration test và E2E tương ứng.
- Mỗi lỗi phải gắn mã phát hiện, test tái hiện trước sửa và test hồi quy sau sửa.
- Không sửa giao diện để che dữ liệu sai ở backend; source of truth và transaction phải được sửa trước.
- Không đổi trạng thái hoặc số dư bằng script trực tiếp nếu chưa có báo cáo dry-run và tổng đối soát.
- FigJam và tài liệu này phải được cập nhật cùng pull request khi state machine hoặc policy thay đổi.

Đây là bản điều phối chính thức. Hai báo cáo nguồn tiếp tục giữ vai trò hồ sơ bằng chứng và tra cứu chi tiết, không dùng riêng lẻ để quyết định thứ tự triển khai.
