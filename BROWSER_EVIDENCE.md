# BROWSER EVIDENCE

## Lần chạy 1: Phase 1 (Tạo Hợp Đồng Nhanh)
- Đã chạy màn hình: Dashboard -> Rooms -> Room 31-05
- Login thành công với `admin@homeland.vn`.
- Đã test flow: Tạo hợp đồng trực tiếp từ hồ sơ phòng (Bỏ qua Đặt cọc giữ phòng).
- Kết quả: Tạo thành công Hợp đồng `HD-PN 31-05-5179` với tiền thuê 5M, cọc 5M.
- **Vấn đề nhận thấy**: Test case "Đặt cọc giữ phòng" chưa được kích hoạt, hệ thống cho phép bypass đặt cọc để tạo hợp đồng trực tiếp. Cần kiểm tra lại luồng Convert Deposit.

- Screenshot chứng cứ:
  - ![Contract Form](file:///C:/Users/TINH-NGUYEN/.gemini/antigravity-ide/brain/654cb86c-fd30-4d19-aebb-5d3a20361ce1/deposits_created_verify_1789309905191.png)

(Tiếp tục cập nhật cho các flow chi tiết hơn...)
