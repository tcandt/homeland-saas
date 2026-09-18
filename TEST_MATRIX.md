| Phase | Case | Bước test | Kết quả mong đợi | Kết quả thực tế | Trạng thái (PASS/FAIL) | Severity |
|---|---|---|---|---|---|---|
| 1. Thuê nguyên| 1 | P1 | Tạo Cọc giữ phòng (Booking Deposit) | /deposits | Có thể tạo cọc giữ chỗ qua Modal Hóa đơn | FAIL / PASS (UX kém, bị ẩn trong Hóa đơn) |
| 2 | P1 | Chuyển đổi Cọc -> Hợp đồng (Convert) | /deposits/:id/convert | Cấn trừ tiền Booking sang Security Deposit | PENDING (Cần test tiếp) |
| 3 | P1 | Tạo Hợp đồng bỏ qua Cọc giữ phòng | /contracts | Cho phép tạo trực tiếp | PASS (Nhưng có thể là Bug nghiệp vụ) |
| 4 | P1 | Hệ thống tự sinh Security Deposit | backend | Sau khi HĐ tạo, phải tự sinh Deposit | PASS |
| 5 | P1 | Tương tác Hợp đồng - Cọc (Đóng cọc) | /deposits | Thu tiền cọc, trạng thái update | PASS |

## Phase 2: Thuê ở ghép (Shared Room)

| ID | Mức độ | Scenario | Route / Module | Kết quả mong đợi | Status thực tế |
|---|---|---|---|---|---|
| 6 | P1 | Thay đổi loại phòng thành Ở ghép | /rooms/:id | Đổi thành SHARED, giữ lại capacity | PASS |
| 7 | P1 | Tạo nhiều Hợp đồng cho 1 phòng | /contracts | Khách A, Khách B đều có hợp đồng riêng | PASS (Backend check capacity tốt) |
| 8 | P2 | Lập hóa đơn - Tính tiền Nước | /invoices | Nước nhân theo đầu người (100k) | PASS (Gợi ý đúng 1 người * 100k) |
| 9 | P1 | Lập hóa đơn - Tính tiền Điện | /invoices | Điện chia theo đầu người | FAIL (Chỉ là ô nhập tay 0đ, không có UI hỗ trợ chia) |

## Phase 3: Liên kết Tài chính (Finance Linkage)

| ID | Mức độ | Scenario | Route / Module | Kết quả mong đợi | Status thực tế |
|---|---|---|---|---|---|
| 10 | P1 | Ghi nhận Phải thu khi tạo Hợp đồng | /finance | Phải thu tăng tương ứng Tổng tiền hợp đồng | PASS |
| 11 | P1 | Ghi nhận Tiền cọc giữ (Deposit) | /finance | Cọc tăng tương ứng số tiền Deposit | PASS |
| 12 | P1 | Link Hóa đơn vào Doanh thu | /finance | Hóa đơn tạo ra làm thay đổi Cashflow | PASS |

## Phase 4: Thao tác quản lý Hợp đồng (Lifecycle)

| ID | Mức độ | Scenario | Route / Module | Kết quả mong đợi | Status thực tế |
|---|---|---|---|---|---|
| 13 | P1 | Ẩn/Hiện action theo trạng thái HĐ | UI (Contract Detail) | Chỉ cho Renew/Transfer/Terminate khi HĐ Đang hiệu lực | PASS |
| 14 | P1 | Thanh lý hợp đồng (Terminate) | /contracts/occupant-move-out | Chốt công nợ, trừ cọc, đổi trạng thái phòng | PASS (Code xử lý chặt chẽ qua Settlement) |
| 15 | P1 | Chuyển phòng (Transfer) | /contracts/occupant-transfer | Chuyển cọc sang phòng mới, check capacity phòng mới | PASS |
| 16 | P2 | Gia hạn hợp đồng (Renew) | /contracts/:id/renew | Tạo bản draft HĐ mới, kế thừa thông tin | PASS |

| CORE-10.04 | Lu?ng K�ch ho?t H?p d?ng (Activation) | L?i UX/Logic nghiem trong: Nut Kich hoat hien thi nhung gui request loi do thieu signedAt. Backend chan nhung UI khong co noi de nhap signedAt -> Deadlock cho hop dong nao quen nhap ngay ky. | FAIL |

