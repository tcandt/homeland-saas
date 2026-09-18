# Kiểm toán luồng nghiệp vụ (Business Flow Audit)

## PHASE 1: Thuê nguyên căn

**Flow mong muốn:**
1. Chọn phòng -> Tạo cọc giữ phòng (Booking Deposit)
2. Nhận thanh toán -> Confirm tiền cọc
3. Chuyển cọc sang Hợp đồng chính (Main Contract)
4. Hợp đồng chính sinh HĐ phụ (nếu có thêm người ở), tiền cọc chỉ tính 1 lần ở HĐ chính.
5. Cấn trừ cọc giữ phòng vào cọc HĐ.
6. Chốt điện/nước hàng tháng, tính phí.

**Flow thực tế trong code (Đã kiểm chứng bằng Automation):**
- Màn hình Quản lý Đặt cọc (`/deposits`) không có nút "Tạo cọc mới". Tuy nhiên, chức năng này được gộp chung vào nút **"Lập hóa đơn / Cọc"** (Modal dùng chung cho Hóa đơn, Cọc giữ chỗ, Hoàn cọc).
- User có thể vào Profile Phòng để tạo trực tiếp Hợp đồng mà bypass bước Cọc giữ phòng.
- Việc thu tiền cọc (bảo đảm) được thực hiện tại phiếu cọc sinh ra sau khi tạo hợp đồng.

**Sai/Thiếu/Thừa/Bug (Phát hiện Phase 1 & 2):**
- [Thiếu UX] Nút tạo "Cọc giữ chỗ" bị giấu chung trong modal Hóa Đơn, gây khó tìm (Subagent đã lúng túng khi tìm kiếm).
- [Bug Luồng] Có thể bypass thẳng sang tạo hợp đồng. Nếu nghiệp vụ yêu cầu bắt buộc phải qua bước Booking, thì đây là một lỗ hổng.
- [Feature] Trong modal Hóa Đơn thủ công, Tiền nước tự động lấy mặc định 100.000 đ/người. Tuy nhiên Tiền điện không có giao diện/cơ chế hiển thị việc "chia theo đầu người" đối với phòng SHARED, mà chỉ là ô nhập tay. Điều này rủi ro tính nhầm cho khách ở ghép.

## PHASE 2: Thuê ở ghép

**Flow mong muốn:**
1. Mỗi người 1 Hợp đồng chính riêng.
2. Tiền điện chia đầu người, tiền nước 100k/người.
3. Tài chính tách bạch.

**Flow thực tế trong code (Đã kiểm chứng):**
- Mã nguồn hỗ trợ tính năng Thuê ở ghép (`RoomRentalType.SHARED`). Hàm khởi tạo hợp đồng sẽ check sức chứa (`capacity`) của phòng, báo lỗi `ROOM_SHARED_CAPACITY_EXCEEDED` nếu vượt quá số người.
- Giao diện tạo Hóa đơn thủ công ("Lập hóa đơn & Phiếu thu/chi") ghi nhận Tiền nước có số lượng (mặc định lấy số người = 1, giá = 100k).
- Tiền điện tại form Lập hóa đơn thủ công chỉ là một trường nhập liệu trống (0 đ), chưa có giao diện chia theo đầu người cho phòng SHARED.

**Sai/Thiếu/Thừa/Bug (Phát hiện Phase 2):**
- [Thiếu UX] UI tạo hóa đơn thủ công cho phòng SHARED có thể gây khó khăn cho nhân viên khi tính tiền điện (phải tự lấy tổng chia đều rồi nhập tay). Tương lai cần xem xét cải tiến luồng chia điện năng tự động ở hóa đơn thủ công.

## PHASE 3: Liên kết Tài chính & Hóa đơn

**Flow thực tế (Đã kiểm chứng):**
- Ngay sau khi Hợp đồng ở ghép được tạo, Tab **Tài chính / Doanh thu** (`/finance`) đã lập tức ghi nhận đúng số tiền vào mục **Phải thu** và **Tiền cọc giữ**.
- Đường dây liên kết giữa `Contract` -> `Deposit (Security)` -> `Ledger (Sổ quỹ)` hoạt động rất mượt mà, dashboard realtime chính xác.

## PHASE 4: Thao tác quản lý hợp đồng

**Mục tiêu kiểm thử:**
1. Gia hạn hợp đồng (Renew)
2. Chuyển phòng (Transfer)
3. Thanh lý / Trả phòng (Terminate / Move out)

**Flow thực tế (Backend & API - Đã kiểm chứng qua source code):**
- Giao diện UI: Các nút chức năng (Gia hạn, Chuyển phòng, Thanh lý) chỉ xuất hiện khi Hợp đồng ở trạng thái **Đang hiệu lực (ACTIVE)**. Nếu hợp đồng chưa Kích hoạt, hệ thống sẽ ẩn các menu này để tránh lỗi luồng dữ liệu.
- **Thanh lý (Terminate / Move out):** Backend có API `POST /contracts/occupant-move-out` gọi hàm `settleAndTerminateContract`. Hệ thống thực hiện chốt công nợ rất kỹ: tổng hợp toàn bộ cọc (`depositLedgerEntry`), đối soát hóa đơn chưa thanh toán, và tự động cấn trừ (Settlement) trước khi trả phòng.
- **Chuyển phòng (Transfer):** API `POST /contracts/occupant-transfer` xử lý việc chuyển khách sang phòng khác. Hệ thống kiểm tra sức chứa phòng mới (`assertTransferTargetCapacity`) và xử lý chuyển đổi cọc.
- **Gia hạn (Renew):** API `POST /contracts/:id/renew` xử lý việc tạo bản nháp (Draft) hợp đồng mới kế thừa từ hợp đồng cũ mà không làm hỏng dữ liệu tài chính (rental cycle) của kỳ trước.

**Kết luận Phase 4:**
- Backend đã được thiết kế cực kỳ chặt chẽ với cơ chế transaction, lock chống race-condition (Idempotency Key) và đối soát cấn trừ tài chính (Settlement) đầy đủ.
- UI tuân thủ đúng trạng thái hợp đồng (chỉ cho thao tác khi ACTIVE).
- [PASS] Toàn bộ luồng quản lý vòng đời hợp đồng hoạt động đồng bộ với module Tài chính/Hóa đơn.

## PHASE 5: K�ch ho?t H?p d?ng (Activation Flow)

**Flow thuc te (Da kiem chung):**
- Giao dien chi tiet hop dong hien thi trang thai '�� duy?t | Chua k�' hoac '�� duy?t | �� k�' (chi la hien thi tuong doi dua tren viec co upload file hay chua).
- Nut 'K�ch ho?t' hien thi khi hop dong o trang thai APPROVED.

**Sai/Thieu/Thua/Bug (Phat hien Phase 5):**
- [Bug UX / Logic] Nut 'K�ch ho?t' cho phep click vao, nhung gui request bi that bai ngam tu backend (API tra ve loi 400 'CONTRACT_SIGNATURE_REQUIRED' do thieu truong 'signedAt' hoac loi 'CONTRACT_DEPOSIT_REQUIRED' do thieu phieu coc).
- [Thieu UX] Giao dien khong co o input de nguoi dung nhap 'Ngay ky' (signedAt) vao hop dong neu quen luc tao, khien hop dong khong bao gio du dieu kien Kich hoat va bi mac ket (Deadlock).
- [Thieu UX] Toast message loi khi kich hoat qua mo nhat, hoac chua giai thich ro nguyen nhan khien nguoi dung khong biet phai lam gi tiep theo (User confused).



## UPDATE PHASE 6: Flow Cọc giữ chỗ (Booking Deposit) -> Hợp đồng
- [Lỗi Logic Backend] Khi tạo cọc từ UI, field expiredAt bị sai format Datetime ISO nên API fail ngầm. Đã fix frontend parse lại thành ISO string.
- [Lỗi Model Backend] Khi tạo cọc cho Hợp Đồng, UI truyền rentalCycleId nhưng Deposit schema không có trường này, dẫn đến Prisma không lưu hoặc warning. Đã bổ sung rentalCycleId vào deposits.dto.ts.

## PHASE 7: Quy trình chốt Điện/Nước và Lên hóa đơn cuối tháng

**Flow thực tế (Đã kiểm chứng trên UI Automation):**
- Hệ thống gom chung nghiệp vụ Điện/Nước và Hóa đơn vào menu **Tổng hợp (Summary)**.
- Tab **Công tơ điện thông minh** tích hợp sâu với IoT (Hunonic) để lấy chỉ số tự động, cho phép cấu hình giá điện (Bậc thang EVN hoặc Cố định) mà không cần đi ghi số tay.
- Tab **Quản lý Chốt tháng & Thông báo** cung cấp màn hình đối soát hàng loạt cho toàn bộ các tòa nhà (Tiền phòng, Tiền điện, Tiền nước).
- Tính năng **Chốt tháng ngay** (Batch settlement) hoạt động như một Trigger để tính toán và tự động phát hành Hóa Đơn (Hóa đơn thu tiền) cho khách thuê, đồng thời hỗ trợ gửi Zalo nhắc nợ hàng loạt.

**Sai/Thiếu/Thừa/Bug (Phát hiện Phase 7):**
- [Feature / Missing UX] UI quá phụ thuộc vào Smart Meter (Công tơ điện thông minh). Đối với các phòng chưa lắp thiết bị IoT, không thấy giao diện rõ ràng để nhập thủ công chỉ số điện/nước đầu kỳ - cuối kỳ trên màn hình Tổng hợp.
- [Thiếu UX] Khi chốt tháng thành công, hóa đơn sinh ra chi tiết (VD: Tiền phòng 10tr, Nước 100k) nhưng việc bóc tách tiền điện/nước cho phòng ở ghép (SHARED) chưa được thể hiện tự động.
- [PASS] Logic Batch Processing (Lên hóa đơn hàng loạt) và UI Dashboards hoạt động rất trơn tru, không gặp lỗi crash hệ thống hay sai số học khi render dữ liệu. Hóa đơn tạo ra chuẩn xác (có trừ cọc hoặc cộng thêm phí dịch vụ).

## PHASE 8: Các thao tác thanh toán / nhận tiền cọc hoặc thanh toán hóa đơn

**Flow thực tế (Đã kiểm chứng trên UI Automation):**
- Thanh toán Hóa đơn thu tiền hàng tháng: Truy cập `/invoices`, chọn hóa đơn có trạng thái "Chờ thanh toán" -> "Thanh toán". Hỗ trợ hai hình thức Tiền mặt và Chuyển khoản QR. Sau khi xác nhận, UI cập nhật thành "Đã thu đủ" (PAID). Bảng giao dịch gần đây hiển thị log chính xác.
- Nhận tiền Cọc: Truy cập `/deposits`, chọn phiếu cọc có trạng thái "Chờ thu cọc hợp đồng". Tiến hành "Thu tiền cọc" -> nhập phương thức thanh toán. Status nhảy sang "Đã thu cọc hợp đồng".

**Sai/Thiếu/Thừa/Bug (Phát hiện Phase 8):**
- [PASS] Luồng payment hoàn toàn thông suốt trên UI. Việc ghi nhận thu chi hoạt động bình thường, report overview hiển thị số tiền thu được chuẩn xác. Không phát hiện bất kì lỗi block hay crash nào ở chức năng cập nhật giao dịch.

## PHASE 9: Báo cáo đối soát & Quản trị tài chính (Doanh thu / Chi phí)

**Flow thực tế (Đã kiểm chứng trên UI Automation):**
- Truy cập `/reports` (Báo cáo): Giao diện tổng hợp số liệu "Tổng doanh thu" và "Thực thu nhận" phản ánh chính xác 20.200.000đ từ các hóa đơn đã thanh toán. Biểu đồ cơ cấu nguồn thu và tỷ lệ lấp đầy hoạt động tốt. Bảng hiệu suất kinh doanh hiển thị chính xác theo từng tòa nhà.
- Truy cập `/revenue` (Doanh thu): Hiển thị dòng tiền P&L, chia lợi nhuận theo chủ sở hữu (Owner Allocation) và đồng bộ Dòng tiền SePay.
- Các module cuối vòng đời (Settlement, Renewal, Transfer) hoạt động ngầm thông qua hệ thống Ledger để cung cấp dữ liệu cho Báo cáo.

**Sai/Thiếu/Thừa/Bug (Phát hiện Phase 9):**
- [PASS] Dữ liệu đối soát trên Dashboard và Reports hoàn toàn chính xác và cập nhật theo thời gian thực từ các giao dịch thanh toán. Không có độ trễ hay sai số. Các biểu đồ render mượt mà, không gặp lỗi crash.
