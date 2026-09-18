# HomeLand — phụ lục kiểm định 11 ảnh vận hành

> Bản điều phối triển khai chính thức: [kế hoạch vòng đời thuê 08/09/2026](./2026-09-08-official-core-lifecycle-implementation-plan.md). Phụ lục này được giữ làm hồ sơ đối chiếu ảnh và bằng chứng chi tiết.

Ngày đối chiếu: 08/09/2026. Phạm vi: 11 ảnh người dùng cung cấp, mã nguồn hiện tại và sơ đồ FigJam “01 — Kiến trúc HomeLand Phase 2”. Đây là đặc tả sửa lỗi và acceptance gate; chưa phải xác nhận các lỗi đã được sửa trên ứng dụng.

## Kết luận ngắn

- Quy tắc ở ghép **đã có một phần trong mã**: điện được chia theo tỷ lệ `memberCount / tổng memberCount`; nước là `100.000đ × memberCount`. Vì vậy không nên viết lại công thức từ đầu.
- Điểm chưa an toàn là `memberCount` thuộc hợp đồng hiện tại, không phải ảnh chụp số người thực ở trong đúng kỳ. Cần khóa một billing snapshot từ Occupancy và Hunonic trước khi lập hóa đơn.
- Ảnh 1 và 2 không cho thấy tổng tiền điện của PN 31-02 sai lớn: các phần cộng lại gần bằng số Hunonic. Sai lệch nhìn thấy rõ là màn Tổng hợp đang gắn nhãn đơn giá `3.967đ` trong khi Hunonic ghi “Bậc thang EVN”, cùng với nguy cơ số kWh, phương thức giá và số tiền đến từ các snapshot khác nhau.
- Lỗi hợp đồng trùng trong ảnh 3 được xác nhận là lỗi ghép danh sách ở giao diện: cùng hợp đồng chính được thêm từ `tenant` và `sharedTenants`. Cơ sở dữ liệu đã có unique theo mã hợp đồng trong tenant.
- Tab Tài chính trống ở ảnh 4 có hai nguyên nhân mã nguồn đã xác nhận: UI đọc sai shape của hook, và API nhận `roomId` nhưng chưa áp bộ lọc phòng.
- Các ảnh 5–8 cùng chỉ ra một lỗi invariant: Customer, Contract, Occupancy, `Customer.roomId` và `Room.status` có thể không được kết thúc trong cùng transaction. Đây là nhóm ưu tiên cao nhất vì tạo “phòng trống nhưng còn người”.

## Quy tắc chuẩn cho phòng ở ghép

Ký hiệu trong một `usagePeriod` đã khóa:

- `E_room_kWh`, `E_room_amount`: sản lượng và tiền điện của cả phòng từ một Hunonic reading đã khóa.
- `N`: số người đủ điều kiện tính phí trong kỳ, lấy từ Occupancy (`joinedAt`, `leftAt`) hoặc một billing-member snapshot bất biến.
- `n_contract`: số người trong nhóm thuộc một hợp đồng/đầu mối thanh toán.

Quy tắc:

1. Mỗi người chịu `E_room_amount / N` và `E_room_kWh / N`.
2. Một hóa đơn nhóm chịu `E_room_amount × n_contract / N`.
3. Phần lẻ phải được phân bổ xác định theo ID ổn định; tổng tiền/kWh của các hóa đơn phải đúng bằng tổng phòng, không được lệch do làm tròn từng dòng.
4. Nước là `100.000đ × số người đủ điều kiện`. Chính sách tính trọn tháng hay theo ngày với người vào/ra giữa tháng phải là cấu hình rõ ràng; không suy diễn ngầm.
5. Snapshot phải lưu ít nhất: `usagePeriod`, `readingId`, chỉ số đầu/cuối, kWh, phương thức giá, tổng tiền phòng, `N`, danh sách người/contract và tỷ lệ chia.

Hiện trạng: `monthly-settlement.service.ts` đã tính tỷ lệ ở ghép và nước 100.000đ/người, nhưng lấy số người từ `Contract.memberCount`. Test hiện có cũng xác nhận nhánh 1 người + 2 người cho điện 140.000đ/280.000đ và nước 100.000đ/200.000đ. Cần thay nguồn đếm và bổ sung snapshot, không thay đổi ý nghĩa chia đều.

## Đối chiếu từng ảnh (Cập nhật từ 11 ảnh thực tế người dùng cung cấp)

| Ảnh | Hiện tượng & Lời người dùng thực tế | Kết luận kỹ thuật & Phân định DEV2 | Mức ưu tiên / tiêu chí đạt |
|---|---|---|---|
| **1–2** | **PN 31-02 Tổng hợp vs Hunonic**: Điện chia tỷ lệ 4 khách (tổng 9 người, các dòng 204k, 307k, 102k, 307k), nước 100k/người. Cột điện ghi nhãn `3.967đ` trong khi Hunonic ghi “Bậc thang EVN”. | Đơn giá hiển thị cần lấy từ snapshot kỳ chốt, không lấy nhãn đơn giá cố định đè lên biểu phí bậc thang. CORE cung cấp snapshot version; DEV2 phân định badge Live vs Snapshot. | **P0 nếu sai tiền; P1 nếu chỉ sai nhãn.** Cùng `readingId + usagePeriod + pricingMode` sinh số tiền; tổng các phần bằng đúng tổng phòng. |
| **3** | **PN 31-02 Hợp đồng trùng**: Hai dòng cùng mã hợp đồng `HD-PN 31-02-3720` hiển thị cho khách Nguyễn Trà My. | Lỗi nối mảng ở giao diện: Ghép `roomData.tenant` và `roomData.sharedTenants` thiếu dedupe theo `contract.id`. DEV2 dedupe hoàn toàn trên UI. | **P1.** Một `contractId` chỉ xuất hiện đúng 1 dòng trên toàn bộ UI; đại diện HĐ chính/phụ là thuộc tính trong dòng. |
| **4** | **PN 31-02 Tab Tài chính**: *"Chỗ tài chính chưa thể hiện được số tiền của khách tên gì giá thuê giá bao nhiêu"*. Danh sách hóa đơn và lịch sử thanh toán báo trống, giá niêm yết cố định 1.850.000đ. | Modal đọc sai envelope hóa đơn (`data.items` thay vì `data`), chưa có bộ chọn lọc khách trong phòng ghép và chưa hiển thị giá thuê riêng từng khách. DEV2 bổ sung bộ chọn khách và chế độ "Tổng phòng". | **P0/P1.** Chọn khách/hợp đồng nào phải hiển thị chính xác nghĩa vụ, cọc, hóa đơn và công nợ của khách đó; chế độ Tổng phòng có nhãn rõ ràng. |
| **5** | **PN 32-02 Danh sách khách thuê**: *"Khách Hoàng Đình Thống đang là ở cùng phòng khách 32.02 nhưng ở ngoài lại hiển thị trạng thái Chưa thuê (N/A Chưa có tòa)"*. | `TenantGrid` trước đây chỉ đọc `contract`, thiếu bóc tách `openOccupancy` và quan hệ phòng ở cùng. DEV2 đọc `openOccupancy` để gán trạng thái "Ở ghép" và phòng/tòa chính xác. | **P1.** Người ở cùng có open Occupancy phải hiển thị "Ở ghép" và đúng phòng/tòa, không để "Chưa thuê". |
| **6** | **Xóa khách THIỆN NHÂN**: *"Không xóa dữ liệu được báo lỗi đang gắn vào phòng này P24-10 nhưng trong phòng không hề có thông tin"*. | Khách còn dính `Customer.roomId` cũ khi hợp đồng/occupancy đã kết thúc (phòng ma). CORE đảm bảo transaction dọn dẹp sạch; DEV2 bổ sung UX cảnh báo/hướng dẫn giải phóng phòng. | **P0.** Không xóa cứng lịch sử; một transaction đóng occupancy giải phóng phòng; UI hướng dẫn rõ ràng. |
| **7** | **Mặt bằng Tầng 3**: *"Ở dưới có thông tin THIỆN NHÂN nhưng ở trên phòng không sáng xanh (báo Đang trống)"*. | Bộ chuyển đổi trạng thái giữa Sơ đồ mặt bằng 2D/3D và Bảng phòng không đồng nhất (một bên xét status string, một bên xét mảng người ở). DEV2 chuẩn hóa adapter trạng thái dùng chung. | **P1.** Sơ đồ 2D/3D và bảng phòng phản ánh cùng trạng thái màu sắc; phòng có khách đang ở phải sáng màu "Đã thuê". |
| **8** | **P24-10 Nguyên căn**: *"Vào bên trong không phải là chủ HD nhưng chỉ là người ở cùng => Thiếu tính logic nếu không có chủ HD thì sẽ không có người ở cùng"*. | Vi phạm bất biến phòng nguyên căn (WHOLE room invariant). DEV2 hiển thị cảnh báo đỏ và khóa thêm người ở cùng nếu phòng nguyên căn chưa có Đại diện HĐ chính. | **P0.** Phòng nguyên căn không được chỉ có người ở cùng mồ côi; bắt buộc có Đại diện HĐ chính trước khi thêm thành viên. |
| **9** | **Cập nhật khách thuê**: *"Bị bắt nhập Gmail mặc định khi cập nhật thông tin khách thuê thì bị yêu cầu (Invalid email), lúc nhập thông tin thuê thì không bị yêu cầu mục này => Nên loại bỏ yêu cầu này"*. | Schema/form validation bắt lỗi khi trường email là chuỗi rỗng `""`. DEV2 chuẩn hóa form: chuỗi rỗng tự động chuyển thành null/optional; thông báo tiếng Việt có dấu. | **P2.** Email hoàn toàn tùy chọn ở cả tạo mới và cập nhật; không báo "Invalid email" khi để trống. |
| **10** | **Khách cũ quay lại**: *"Thiếu tính logic chỗ này đối với khách thuê đã kết thúc HĐ thì khi thêm mới lại bị tính là trùng lặp thông tin, nhưng tìm trong mục hồ sơ khách có sẵn thì không tồn tại thông tin khách thuê này"*. | 1. Báo trùng nhưng ô SĐT bị gắn nhãn sai "Vui lòng nhập số điện thoại".<br>2. Nút "Chọn hồ sơ khách có sẵn" không prefill từ khóa.<br>3. Khách cũ bị chặn nếu còn dính cờ `customer.roomId` cũ dù HĐ đã kết thúc. DEV2 sửa flow chuyển tiếp mượt mà. | **P1.** Click chọn hồ sơ cũ tự động tìm kiếm đúng khách; cho phép chọn lại khách cũ đã kết thúc HĐ để tạo kỳ thuê mới. |
| **11** | **Đặt cọc kỳ mới**: *"Đang tính vì khách này đã thanh toán hoàn cọc nên hệ thống không cho nhập lại thông tin => Set logic là khi khách đã kết thúc HĐ gia hạn lại hoặc đăng ký mới lại thì phải cho nhập thông tin lưu lịch sử nhưng không ghi đè lên hệ thống hồ sơ cũ"*. | Phiếu cọc cũ đã hoàn (`Đã hoàn cọc`) là terminal record không được ghi đè. Hệ thống cần cho phép tạo phiếu cọc mới / hợp đồng mới gắn kỳ thuê mới (`RentalCycle`). DEV2 hỗ trợ luồng tạo mới gắn khách cũ và bảo lưu lịch sử. | **P1.** Cọc cũ giữ nguyên lịch sử terminal; cho phép tạo phiếu cọc mới cho kỳ mới của cùng khách hàng; không chặn luồng đăng ký mới. |

## Mô hình Tài chính phòng cần hiển thị

Tab Tài chính phải có hai scope riêng:

- **Theo khách/hợp đồng**: `customerId + contractId + rentalCycleId`; dùng mặc định khi mở từ một khách trong phòng ghép.
- **Tổng phòng**: tổng hợp các hợp đồng đang hiệu lực, nhưng mỗi dòng phải truy ngược được về khách và hợp đồng nguồn.

Chuỗi dữ liệu bắt buộc:

`Customer → Rental cycle → Cọc giữ phòng → Cấn/chuyển/hoàn cọc → Hợp đồng + cọc bảo đảm → Invoice + InvoiceItem → Payment/Allocation/Credit/Refund → Receipt/Journal → Doanh thu/Chi phí → Báo cáo`

“Thiết lập phòng” chỉ lưu chính sách: cách chia điện, giá nước/người, chính sách prorate, ngày chốt/hạn thanh toán và tài khoản nhận tiền. Không lưu số dư khách hàng hoặc lịch sử giao dịch trong cấu hình phòng.

## Invariant và acceptance gate trước Phase 2 testing

1. Một khách có một Customer identity; mỗi lần thuê là một rental cycle mới.
2. Một `contractId` chỉ xuất hiện một lần trong mọi danh sách.
3. Contract terminal không được còn open Occupancy hoặc `Customer.roomId` hiện hành.
4. Room chỉ AVAILABLE khi không còn primary contract, open occupancy hoặc booking hold hợp lệ.
5. WHOLE room không có roommate hoạt động thiếu primary contract, trừ ngoại lệ có loại và thời hạn rõ.
6. Mỗi invoice điện tham chiếu đúng một meter snapshot; không trộn live reading với invoice đã khóa.
7. Tổng tiền/kWh chia cho phòng ghép phải bảo toàn tổng sau làm tròn.
8. Tài chính lọc đúng `tenantId + roomId + customerId + contractId`; không được sửa UI trước khi bổ sung filter API.
9. Payment, refund và chuyển cọc phải có source ID/idempotency key; không ghi đè lịch sử terminal.
10. Email trống hợp lệ; duplicate phone/CCCD dẫn đến chọn hồ sơ cũ thay vì tạo bản ghi mới.

## Thứ tự sửa đề xuất

1. Đóng lỗ hổng vòng đời Contract–Occupancy–Customer.roomId–Room.status và chạy script đối soát dữ liệu ma.
2. Sửa API lọc tài chính theo room/customer/contract; sau đó sửa shape dữ liệu UI.
3. Khóa snapshot Hunonic theo kỳ và cơ chế reconciliation invoice; chỉ tiếp tục gửi hóa đơn khi delta bằng 0 hoặc đã được duyệt.
4. Thay `memberCount` động bằng billing-member snapshot từ Occupancy, thêm phân bổ phần lẻ xác định.
5. Dedupe hợp đồng UI theo `contractId` và chặn invariant WHOLE/SHARED.
6. Sửa trạng thái danh sách khách từ open Occupancy/active Contract.
7. Hoàn thiện luồng khách quay lại, cọc mới và CTA chọn đúng hồ sơ cũ.
8. Chuẩn hóa optional email và thông báo tiếng Việt.
9. Backfill dữ liệu nguồn/snapshot còn thiếu; mọi script phải dry-run, có báo cáo và rollback.
10. Chạy E2E với bộ dữ liệu 11 ảnh, đối soát số tiền và bật Phase 2 testing sau khi toàn bộ gate đạt.

## Vị trí mã nguồn đối chiếu

- `apps/api/src/monthly-settlement/monthly-settlement.service.ts`: tỷ lệ chia ở ghép, nước/người, Hunonic overview, invoice override và close-month item.
- `apps/api/src/monthly-settlement/monthly-settlement.service.spec.ts`: test chia điện/nước hiện có.
- `apps/web/lib/adapters/building.adapter.ts` và `apps/web/components/buildings/RoomPremiumModal.tsx`: nguồn hợp đồng trùng và tab Tài chính.
- `apps/api/src/invoices/invoices.service.ts`: tham số `roomId` chưa được áp vào `where`.
- `apps/api/src/customers/customers.service.ts` và `apps/web/components/tenants/TenantGrid.tsx`: trạng thái khách thiếu room/occupancy.
- `apps/api/src/contracts/contracts.service.ts`: generic status update và lifecycle sync chưa đồng nhất.
- `packages/shared/src/customers/customers.dto.ts`: email optional nhưng chưa preprocess chuỗi rỗng.
- `packages/database/prisma/schema.prisma`: unique mã hợp đồng và các quan hệ Contract/Occupancy/Customer/Room.

Xem thêm hồ sơ kiểm định tổng thể ngày 07/09/2026: [2026-09-07-final-figjam-logic-audit.md](./2026-09-07-final-figjam-logic-audit.md).
