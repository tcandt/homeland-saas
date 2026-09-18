# HomeLand — kiểm định cuối sơ đồ kỹ thuật trước khi sửa

> Bản điều phối triển khai chính thức: [kế hoạch vòng đời thuê 08/09/2026](./2026-09-08-official-core-lifecycle-implementation-plan.md). Báo cáo này được giữ làm hồ sơ bằng chứng chi tiết.

> Bổ sung ngày 08/09/2026: [đối chiếu 11 ảnh vận hành, quy tắc điện/nước ở ghép, lỗi hợp đồng trùng, tài chính phòng và dữ liệu phòng ma](./2026-09-08-operational-screenshots-addendum.md).

Ngày đối chiếu: 07/09/2026, múi giờ Việt Nam. Phiên bản package: 1.2.9. Mã nguồn: `e0a2dc02b330f08ecf2dff21fdb1cda78f08ec94`. Working tree sạch ở thời điểm bắt đầu kiểm tra.

Sơ đồ được đọc trực tiếp: [FigJam HomeLand](https://www.figma.com/board/WCjgu6BFbz9oHrcl5Jkkar). Có 26 vùng, 192 khối nội dung, 255 đường nối, 18 bảng ERD và 37 nhãn cảnh báo P0/P1. Schema hiện có 65 model; đây là phạm vi bao phủ của hình, không phải tỷ lệ đúng/sai của hệ thống.

## 1. Kết luận và giới hạn bằng chứng

**Sơ đồ chưa đủ chính xác và đầy đủ để dùng làm đặc tả triển khai cuối cùng.** Khung nghiệp vụ chính có ích, nhưng có cảnh báo sai phạm vi, thiếu đường đi thực tế từ giao diện, và trộn quy trình đề xuất với quy trình hiện đang chạy. Không nên triển khai nguyên văn toàn bộ các ô đỏ.

Lần này chỉ kiểm định và lập hồ sơ. Không thay đổi mã nghiệp vụ, không sửa board, không cập nhật server, không chạy migration/seed/restore vào dữ liệu hiện tại. Các file mới trong `docs/reviews` là tài liệu và kiểm chứng cô lập.

Bằng chứng đã chạy:

- `npm.cmd test --workspace=api`: **41 tệp / 319 test đạt**.
- Năm tệp test cho production backup, restore check, restore drill, Docker update safety và scheduler layout: **20 test đạt**. Các test này dùng tệp tạm/mô phỏng; không phải bằng chứng đã khôi phục DB production thành công.
- [Bảy kiểm chứng độc lập][PROBE]: **7/7 tái hiện được hành vi lỗi hiện tại**. Đây là kiểm chứng service/guard với lưu trữ giả lập, không phải acceptance test xác nhận lỗi đã được sửa.
- Đã đọc cấu trúc toàn board và kiểm tra ảnh vùng cảnh báo bảo trì: chữ có dấu, màu cảnh báo còn hiển thị.

Chưa thực hiện E2E trên staging với PostgreSQL thật, không kiểm tra dữ liệu đang tồn tại trên server, cấu hình thực tế của tenant, webhook ngân hàng thật hoặc diễn tập khôi phục thật. Do đó, kết luận bên dưới là về mã nguồn tại commit đã nêu; không khẳng định server đang triển khai đúng commit/cấu hình này hoặc mọi lỗi đã phát sinh trên dữ liệu thật.

## 2. Đối chiếu đủ 37 cảnh báo hiện có trên board

Quy ước: **Đúng** = có bằng chứng trực tiếp trong đường code nêu; **Một phần** = đúng ở một nhánh hoặc thiếu điều kiện; **Sai** = nhận định bị bác bỏ bởi lớp xử lý hiện có; **Chính sách** = hành vi có thật nhưng chưa đủ căn cứ gọi là lỗi/P0. P0 trên board đang được dùng quá rộng; nên ưu tiên theo tác động mất dữ liệu, vượt quyền và sai số tiền, không theo số lượng ô đỏ.

Trong báo cáo, `CONVERTED` là cách viết ngắn của trạng thái mã nguồn `CONVERTED_TO_CONTRACT`; không phải một enum mới. B là số cọc giữ phòng thực còn khả dụng, C là mức cọc hợp đồng phải bảo đảm.

### Đăng ký, đăng nhập, bảo mật

| Node | Nhận định hiện tại | Kết quả và điều chỉnh cần ghi trên sơ đồ |
|---|---|---|
| 3:135 | Không xác minh email | **Đúng / phụ thuộc cấu hình đăng ký**: register tạo User ACTIVE. Có cổng bật/tắt public registration. Khi đăng ký công khai bị tắt, không nên mô tả đây là lỗ hổng công khai đang hoạt động. [A1][A3] |
| 3:138 | Mật khẩu min 12, không complexity | **Chính sách**: schema chỉ kiểm tra độ dài; riêng tài khoản cấp cho nhân viên cho phép mật khẩu tạm 6 ký tự. Thiếu kiểm tra complexity không tự động là P0; vấn đề cần chốt là chính sách nhất quán, mật khẩu tạm và cơ chế hoãn đổi. [A2] |
| 3:141 | Login 500/phút | **Một phần**: giới hạn route đúng, nhưng còn khóa sau 5 lần sai trong 15 phút. Phải vẽ cả hai lớp và các ngoại lệ IP, không kết luận chỉ có giới hạn 500. [A3][A4] |
| 3:144 | Khóa IP trong RAM | **Đúng**: Map cục bộ, không bền qua restart và không chia sẻ giữa tiến trình. [A4] |
| 3:147 | JWT tin role/status cũ | **Đúng, cần diễn đạt chính xác**: strategy trả claims mà không đọc trạng thái/quyền hiện tại. `status` không được lấy từ DB ở mỗi request; refresh có đọc ACTIVE nhưng bearer hiện có chưa bị thu hồi tương ứng. [A5][A6] |
| 3:150 | Không token family/reuse detection | **Một phần**: đã có refresh rotation và một refresh hash trên User; chưa có lịch sử family/session và phát hiện tái sử dụng. Không được ghi thành “chưa có refresh rotation”. [A6] |
| 3:153 | Hoãn đổi mật khẩu cả phiên | **Đúng / chính sách cần quyết định**: endpoint defer phát hành token mới, refresh tiếp tục duy trì việc hoãn. Nếu mật khẩu tạm bắt buộc đổi trước khi vận hành thì đây là đường vượt chính sách. [A6] |

### Bảo trì, cập nhật, sao lưu

| Node | Nhận định hiện tại | Kết quả và điều chỉnh cần ghi trên sơ đồ |
|---|---|---|
| 4:276 | Dump thiếu nhiều bảng/tệp | **Đúng cho backup thủ công từ UI**: JSON chỉ lấy 7 nhóm; còn thiếu journal, receipt, expense, allocations, occupancy, settlement, settings, documents và các quan hệ khác. Không đúng nếu áp dụng cho bộ `production-backup.js` dùng pg_dump. [O1][O5] |
| 4:279 | Backup lấy mọi tenant | **Đúng cho UI**: gọi các `findMany({})` bằng Prisma gốc. Backup toàn instance không tự nó sai; sai khi gắn với quyền/khôi phục theo tenant mà không xác định phạm vi. [O1] |
| 4:282 | Restore một tenant từ dump mọi tenant | **Đúng**: xóa theo tenant người gọi, rồi tạo lại dữ liệu nguyên bản trong dump. Không có bước lọc tenant hoặc kiểm định đồ thị quan hệ. [O2] |
| 4:285 | Nuốt lỗi restore từng bản ghi | **Đúng**: catch từng thao tác và catch ngoài transaction; trả `success: true` cả khi lỗi hoặc không có data.json. Counts lấy độ dài đầu vào, không phải số bản ghi khôi phục đã kiểm chứng. Với PostgreSQL, lỗi SQL có thể làm transaction bị abort; không được hứa rằng phần thành công còn lại đã commit. [O2] |
| 4:288 | JSON local không checksum/mã hóa/off-host | **Đúng cho UI, sai nếu khái quát cả hệ thống**: production CLI đã có SHA256, manifest, storage copy và tùy chọn off-host. Có code hỗ trợ chưa chứng minh máy chủ đã cấu hình đúng; mã hóa cần bằng chứng riêng. [O1][O5][O6] |
| 4:291 | snapshotId chưa chuẩn hóa | **Đúng**: ghép path trực tiếp. Cần bổ sung cả DELETE backup: đường xóa có `rmSync(... recursive)` với snapshotId chưa kiểm tra nằm trong thư mục hợp lệ. Không thử xóa/restore trong đợt audit. [O2][O3] |
| 4:294 | Job chỉ ở RAM | **Đúng cho trạng thái job trong API**; runner có manifest và wrapper production đã có khóa `flock`. Không nên nói không có khóa hay dấu vết phục hồi ở mọi lớp. [O4][O7] |
| 4:297 | Rollback code không rollback schema | **Đúng về giới hạn rollback tự động, không mặc nhiên là bug**. Cần migration tương thích ngược, kiểm tra trước cập nhật và phương án phục hồi dữ liệu; không biến “down migration tự động” thành yêu cầu mặc định. Runner hiện có giữ image/metadata và health checks. [O7][O8] |

### Cọc giữ phòng, chuyển hợp đồng, hoàn/hủy

| Node | Nhận định hiện tại | Kết quả và điều chỉnh cần ghi trên sơ đồ |
|---|---|---|
| 5:457 | Thu cọc không RESERVED phòng | **Đúng ở collect**: chỉ đổi Deposit PAID, audit và emit. Chưa kiểm tra quyền giữ chỗ theo thời gian, capacity/WHOLE/SHARED và tranh chấp. [R1] |
| 5:460 | convert-contract chỉ đổi status | **Đúng cho endpoint này**; nhưng create/update contract còn có một đường chuyển cọc ngầm trong `syncContractDeposit`. Phải vẽ cả hai, đặc biệt đường ghi đè số tiền. [R2][R4] |
| 5:463 | Approve tạo Deposit mới | **Đúng**: approve tạo thêm Deposit và không tái sử dụng cọc đã liên kết; không truyền type nên schema mặc định BOOKING. Rủi ro cọc trùng hoặc chọn nhầm bản ghi khi activate. [R3][DB1] |
| 5:466 | Không có bảng cấn cọc/số dư | **Một phần**: chưa có sổ phân bổ cọc bất biến; nhưng đã có liên kết contractId, Receipt, settlement details và các phép tính. Một bảng tên `DepositApplication` là phương án thiết kế, không phải yêu cầu duy nhất. [R4][R11][DB1] |
| 5:469 | Hủy cọc không mở phòng | **Đúng ở cancel deposit**; cancel contract/move-out đã có cập nhật Room. Không được mở AVAILABLE vô điều kiện khi còn người ở/hợp đồng/giữ chỗ khác. [R6][R13] |
| 5:472 | Event kế toán không idempotency | **Đúng ở chuỗi EventEmitter → workflow → journal**: chưa có outbox và khóa nguồn sự kiện duy nhất. Nhưng SePay webhook đã có log unique/claim, expense/reversal có kiểm tra riêng. [F3][F4][F5][P5] |
| 5:475 | Hoàn một phần vẫn REFUNDED terminal | **Đúng về trạng thái, thiếu ngữ nghĩa**: endpoint refund ghi phần còn lại là “giữ lại”; không phải mô hình cho phép hoàn nhiều đợt. Cần phân biệt “đã giải quyết cọc” với “đã chi tiền”, kiểm tra khoản giữ lại đã hạch toán và số dư còn nghĩa vụ. [R5] |

### Hợp đồng và hóa đơn đầu kỳ

| Node | Nhận định hiện tại | Kết quả và điều chỉnh cần ghi trên sơ đồ |
|---|---|---|
| 6:642 | Activate lập đủ một tháng | **Đúng với activateContract**. Nhánh UI create ACTIVE lại không đi qua activate, nên có thể không tạo hóa đơn đầu kỳ này. [R7][R8][R10] |
| 6:645 | Hóa đơn activate thiếu period/usagePeriod | **Đúng**; item cũng không ghi servicePeriod. Không khái quát sang hóa đơn chốt tháng vì chốt tháng đã gắn các kỳ. [R7][M1] |
| 6:648 | Không billing key duy nhất | **Đúng về khóa nghiệp vụ**: chỉ unique `(tenantId, code)`, chưa unique kỳ/hợp đồng/loại hóa đơn. Cần giữ khả năng có hóa đơn điều chỉnh và quyết toán hợp lệ trong cùng tháng. [DB1] |
| 6:651 | PATCH sửa status trực tiếp | **Đúng và chưa đủ**: POST cũng nhận status, DTO default ACTIVE, UI gửi ACTIVE. Chặn PATCH đơn lẻ sẽ không khép được luồng. [R8][R9][R10] |
| 6:654 | Không snapshot công tơ đầu vào | **Đúng ở bước activate**; Hunonic đã có readings và khóa kỳ tháng, checkout có utilitySnapshot. Cần bổ sung snapshot tại ngày nhận phòng gắn đúng contract/occupancy, không vẽ thành “chưa có dữ liệu công tơ”. [R7][M1][DB1] |
| 6:657 | Due date cố định +7 ngày | **Đúng ở activate, là chính sách**: chốt tháng lại +5 ngày; firstPaymentDate tồn tại nhưng nhánh activate chưa sử dụng. Cần thống nhất rule theo hợp đồng/kỳ, không gọi mọi due+7 là P1 mặc định. [R7][M1] |

### Liên kết tài chính và báo cáo

| Node | Nhận định hiện tại | Kết quả và điều chỉnh cần ghi trên sơ đồ |
|---|---|---|
| 8:1598 | Danh sách Invoice không lọc tenant | **Sai trong đường request đã có CLS tenant**: repository lấy `prisma.tx`; count/findMany được inject tenant. Đây là cảnh báo phải gỡ/đính chính. Còn trường hợp thiếu CLS trả Prisma gốc cần chặn rõ ràng. [P1][P2] |
| 8:1601 | Detail/mutation chỉ dùng ID | **Một phần**: Invoice detail dùng `findUniqueOrThrow`, không nằm trong allowlist inject tenant — đã tái hiện khoảng trống. Nhiều update/delete bằng `prisma.tx` có tenant filter; deposit/contract detail qua findFirst cũng được scope. Cần kiểm tra từng operation, raw Prisma và transaction callback. [P1][P2][P3] |
| 8:1604 | sourceId PaymentRequest/Journal không FK | **Đúng về schema**, chưa đủ để kết luận lỗi P0 độc lập. Đó là liên kết đa loại nguồn; cần cơ chế bảo đảm đúng nguồn/tenant và truy vết, có thể dùng bảng nguồn chung hoặc liên kết typed. [DB2] |
| 8:1607 | Receipt tìm bằng tiền tố mã | **Đúng với refund cọc/quyết toán**. Có tenant filter nhưng mã/tên task thay được, không phải quan hệ bất biến. [R2][R13] |
| 8:1610 | Workflow journal không idempotent | **Đúng**, trùng căn nguyên với 5:472. Nên gộp thành một lỗi nền tảng để tránh tạo hai hạng mục sửa cùng vấn đề. [F3][F4] |
| 8:1613 | Partial payment chưa vào ledger đến PAID | **Đúng ở InvoicesService.pay**: từng lần thu đã tạo Payment/Allocation, chỉ khi đủ mới phát invoice.paid với tổng paidAmount. Dòng tiền và ledger có thể lệch kỳ. Phải kiểm tra cả lựa chọn tài khoản theo cash/bank và phân loại khoản thu. [P4][F4] |
| 8:1616 | Revenue building/room trả [] | **Đúng với `/reports/revenue-by-building` và `/reports/revenue-by-room`**. Các endpoint `/finance/buildings/profit-summary`, owner profit đã có xử lý dữ liệu thật. Không phải toàn bộ báo cáo chưa xây dựng. [F1][F2] |
| 8:1619 | Cashflow chart hard-code | **Đúng trong ReportsService.getCashFlow**: T1 cố định và T2 lấy tổng toàn kỳ. `CashFlowChart.tsx` cũng có dữ liệu mẫu nhưng không tìm thấy nơi import component này; không lấy component không dùng làm bằng chứng lỗi UI đang hiển thị. [F1][F6] |
| 8:1622 | Audit ngoài transaction | **Đúng ở nhiều command**, không phải mọi audit. Nếu lỗi sau khi nghiệp vụ commit, caller có thể thấy lỗi và retry tạo tác dụng phụ lần hai. Cần audit/outbox đồng bộ cho command tiền và trạng thái quan trọng. [R1][R3][P4][M1] |

## 3. Sai lệch quan trọng mới hoặc đang bị sơ đồ bỏ sót

### Các vấn đề đã có kiểm chứng cô lập

1. **R1 — Ghi đè tiền cọc thực thu:** cọc BOOKING PAID 1.000.000, hợp đồng depositMoney 5.000.000 → `syncContractDeposit` cập nhật amount thành 5.000.000 và CONVERTED; không có thu thêm 4.000.000 trong lệnh này. Đây là sai số tiền cần ưu tiên cao. Có thể lan sang số hoàn khi trả phòng. [R4][PROBE]
2. **R2 — Khoảng trống tenant của Invoice detail:** query `findMany` được thêm tenant, `findUniqueOrThrow` không được thêm. Cần test HTTP hai tenant trên DB cô lập để hoàn tất bằng chứng end-to-end. [P1][P3][PROBE]
3. **R3 — Thu tiền đồng thời bị mất cập nhật:** hai lệnh đọc cùng paidAmount ban đầu, ghi tuyệt đối sau transaction. Probe thu 300 và 400 tạo tổng allocation 700 nhưng paidAmount chỉ còn 300 hoặc 400. Unique transaction của SePay không bảo vệ hai lần thu khác ID hoặc thu tay cạnh tranh. [P4][PROBE]
4. **R4 — Thu tiền thuê tự xác nhận đã thu cọc:** khi hóa đơn PAID, `deposit.updateMany` đổi mọi cọc PENDING cùng hợp đồng thành PAID mà không yêu cầu dòng cọc trên hóa đơn hoặc giao dịch thu cọc. Không thể dùng trạng thái này làm bằng chứng khách đã nộp đủ cọc. [P4][PROBE]
5. **R5 — Refresh token dùng được tại API:** token do `AuthService.login` phát hành được passport JWT strategy dành cho API chấp nhận. Access/refresh cùng secret và không phân loại token. Probe không sử dụng token/tài khoản thật. [A1][A5][PROBE]
6. **R6 — Logout có thể không thu hồi token:** route logout là Public, guard bỏ authenticate; CurrentUser thường undefined, service logout(undefined) không cập nhật refresh hash. [A3][A7][PROBE]
7. **R7 — SePay không ràng buộc cấu hình xác thực với tenant đích:** dùng `.some()` trên cấu hình mọi tenant rồi tìm request theo paymentCode/account, không mang tenant đã xác thực sang lookup. Probe cho thấy khóa A được chấp nhận và lookup request B; dùng request EXPIRED để dừng trước tác vụ tiền. Không khẳng định đã thực hiện giả mạo thanh toán trên server. Ngoài ra, một cấu hình authMode=none có thể làm bước xác thực chung luôn đạt. [P5][PROBE]

### Các vấn đề xác nhận từ đường code, cần integration regression khi sửa

- **Tạo hợp đồng đang ở từ UI là đường độc lập:** DTO/API/UI cho tạo ACTIVE; thao tác tạo hợp đồng và cập nhật phòng trong UI là nhiều request. Cần đưa đường này lên sơ đồ, thống nhất command vận hành và xử lý thất bại giữa các bước. [R8][R9][R10]
- **Activate chưa chứng minh “đã ký và đủ tiền”:** chỉ kiểm tra APPROVED, Room RESERVED, tồn tại một Deposit PAID/CONVERTED. Không đối chiếu số tiền thực thu, signedAt/chữ ký, ngày bắt đầu, chủ sở hữu hold hoặc lựa chọn đúng deposit. Node 6:680 đang trình bày điều kiện mục tiêu như điều kiện có thật. [R7]
- **Sơ đồ hủy cọc đang đảo thứ tự commit:** hình nối Receipt/Task → event → Journal → CANCELLED; code đặt CANCELLED cùng receipt/task trong DB trước rồi mới emit. Chưa chi hoàn tiền vẫn có thể CANCELLED; Receipt PENDING phải chờ complete mới có cash-out. Task chỉ có khi còn việc hoàn tiền chờ xử lý, không phải mọi refund đều tạo task. KEEP/DEDUCT có thể giữ/khấu trừ một phần rồi hoàn phần còn lại. [R6]
- **Số dư cọc quyết toán lấy nghĩa vụ hợp đồng:** `buildSettlementPreview` lấy depositBalance từ contract.depositMoney, không phải tổng giao dịch thu trừ các lần sử dụng/hoàn. Phải đối soát dữ liệu cọc hiện hữu trước khi tự động quyết toán. [R11]
- **Chốt tháng có đường hỏng giữa xóa và tạo lại item:** deleteMany InvoiceItem rồi update Invoice không cùng transaction. Khi bước sau lỗi, item cũ có thể mất. Phòng nguyên căn có cùng roomCode ở hai tòa có thể trùng invoiceCode vì mã không chứa building/room ID. [M1][M2][DB1]
- **Lịch chốt tháng có nguy cơ chạy ở cả API và worker:** module scheduler được import chung; MonthlySettlementScheduler không kiểm tra shouldRunGeneralSchedulers, trong khi các scheduler khác có. Compose production định nghĩa cả api và notification-worker. Cần khóa theo tenant/kỳ và điều kiện runtime role; đây là phân tích cấu hình/code, chưa phải log chứng minh đã chạy trùng trên server. [M3][M4][O9]
- **Chứng từ trực tiếp chưa kiểm tra tenant sở hữu tệp:** các route storage và storage-link có quyền download nhưng nhận path trực tiếp, provider chỉ kiểm tra nằm trong storage root. Chưa ràng buộc path/document với tenant người gọi. [D1][D2]
- **Ký thay người trong cùng tenant chưa có kiểm soát rõ:** SignatureRequestsController không RequirePermissions; service tìm party theo partyId trong request nhưng không gắn người đang đăng nhập hoặc token người ký với party. Tenant check có, xác minh danh tính người ký chưa thấy trong đường này. [D3][D4]
- **Storage cấu hình và triển khai không khớp:** validation chấp nhận s3/r2 nhưng StorageModule vẫn bind LocalStorageProvider. Trên sơ đồ phải ghi provider hiện được sử dụng và phân biệt tính năng mới ở cấu hình/script với provider runtime. [D5][D6]
- **Báo cáo chưa thống nhất cùng nguồn và trạng thái sổ:** ReportsService lọc POSTED và tính hai chiều trong P&L; FinanceReportingService.getProfitLoss chỉ cộng CREDIT revenue/DEBIT expense, không trừ chiều ngược và không cùng bộ lọc trạng thái. Refund/reversal có thể ra kết quả khác nhau. Một số tổng chi phí dùng max(journal, operational), không phải đối soát từng khoản. [F1][F2]
- **Chi phí PAID có thể thiếu journal:** approveExpense(markPaid=true) cập nhật PAID trước khi postExpenseJournal; thiếu tài khoản thì post trả null. Có kiểm tra trùng/deterministic code cho expense nhưng chưa atomic giữa trạng thái chi và journal. [F7]
- **GET danh sách cọc có tác dụng phụ:** list gọi syncMissingContractDeposits; có thể tự tạo SECURITY PENDING hoặc REFUNDED cho hợp đồng không có cọc và nuốt lỗi. Đây là đường đồng bộ/backfill cần ghi rõ và chuyển sang cơ chế quản trị có kiểm chứng. [R14]

## 4. Những luồng bắt buộc bổ sung vào mô hình

| Phần | Nội dung hiện thiếu/cần tách để đủ thiết kế và testing |
|---|---|
| Kiến trúc triển khai | Next.js/API/worker; cron ai thực thi; EventEmitter nội bộ so với NotificationQueue bền; khóa ở Redis, DB hay flock phải ghi đúng theo từng nhiệm vụ. Mũi tên Payment webhook trên board 1:97 hiện API → SePay; callback phải biểu diễn SePay → API, outbound tạo QR/yêu cầu thanh toán là nhánh riêng. |
| Người dùng | Đăng ký bị tắt, trùng email, ACTIVE/DISABLED/LOCKED, quên/reset mật khẩu, cấp nhân viên/mật khẩu tạm, đổi quyền/khóa người dùng khi đang đăng nhập, logout, refresh/replay. Login hiện chỉ lookup email, nhánh phone đang comment dù UI/API mô tả email hoặc phone. [A1] |
| Khách và chỗ ở | Người đại diện, đồng đại diện, người ở cùng; WHOLE so với SHARED; capacity theo hợp đồng/occupancy; ngày bắt đầu/kết thúc; phòng CLEANING/MAINTENANCE/INACTIVE; trùng lịch và giữ chỗ có chủ sở hữu. Không áp quy tắc một hợp đồng cho mọi phòng SHARED. |
| Cọc giữ phòng | BOOKING/RESERVATION/SECURITY, DRAFT/PENDING/PAID; expiredAt, gia hạn, hết hạn, khách không tới, thanh toán đến muộn, chuyển phòng/chuyển người, tranh chấp hai khách cùng giữ chỗ. Schema có expiredAt nhưng chưa thấy job giải phóng hold tương ứng trong luồng cọc đã đọc. |
| “Đặt cọc rồi có thể ở” | Phải chốt có cho nhận phòng tạm trước hợp đồng chính hay không. Nếu có, cần loại thỏa thuận/trạng thái occupancy tạm, ngày tính tiền, chỉ số đầu vào, trách nhiệm cọc và cách kết thúc. Chưa được coi PAID booking đồng nghĩa đủ điều kiện vào ở. |
| Hai lối vào hợp đồng | Từ booking đã thu; từ khách ký/nộp SECURITY trực tiếp không có booking. Cả hai phải về cùng các điều kiện ký, thu tiền, nhận phòng và hóa đơn. |
| Chuyển cọc | B<C/B=C/B>C; chỉ dùng B thực còn khả dụng; giữ nguyên giao dịch gốc; phần thiếu thu thêm, phần thừa credit hoặc refund theo lựa chọn; cùng tenant/khách/hợp đồng; retry không cấn lần hai. |
| Hủy và hoàn | Hủy yêu cầu chưa thu; hủy cọc đã thu; REFUND/KEEP/DEDUCT toàn bộ hoặc một phần; Receipt PENDING/COMPLETED; chứng từ chi; hoàn thất bại/làm lại; ngăn hoàn vượt số dư; hủy booking không đồng nghĩa hủy hợp đồng thuê. |
| Thanh toán | QR hết hạn/hủy; sai mã/sai tài khoản, thiếu tiền/thừa tiền, hai webhook khác ID, callback lặp, xử lý thủ công NEEDS_REVIEW, chuyển dư sang credit/hoàn sau/hoàn xong; bank route theo phòng/chủ nhà/ngày hiệu lực. Project đã có nhiều nhánh này trong PaymentsService nhưng board chưa thể hiện. [P5] |
| Hóa đơn đầu kỳ | Ngày 1/ngày bất kỳ/tháng 28-29-30-31 ngày; ngày đầu có tính tiền không; chỉ số bàn giao; quy tắc làm tròn; phí nào theo ngày/người/lần; firstPaymentDate; hợp đồng bắt đầu trong tương lai. 30 ngày hay ngày thực tế phải được lưu trong chính sách có hiệu lực, không tự đổi dữ liệu lịch sử. |
| Chốt tháng | Tiền phòng tháng M thu trước; điện/nước/dịch vụ M-1 theo code hiện tại; khách tháng đầu không chịu sử dụng trước khi vào; thuê ghép phân bổ theo người; mức nước hiện đang 100.000/người; cutoff 23:50 cuối tháng; billing 08:00 ngày 1; khóa/mở lại kỳ có audit. [M1][M3] |
| Cuối vòng đời | Hết hạn, gia hạn, trả sớm, một người rời phòng ghép, đổi đại diện, chuyển phòng; preview/confirm quyết toán; điện/nước cuối; nợ hóa đơn cũ; bù cọc/hoàn; bảo toàn ContractParty/Occupancy/snapshot; dọn/sửa phòng trước khi cho thuê lại. Không cần tái viết các cơ chế history/settlement đã có. [R11][R13] |
| Tài chính | Chi phí DRAFT/APPROVED/PAID/CANCELLED, chủ nhà ứng chi/hoàn ứng/khấu trừ lợi nhuận, chứng từ; tài khoản tiền mặt/ngân hàng; credit và reversal; các khoản cọc còn nghĩa vụ không được mất khỏi báo cáo chỉ vì CONVERTED. ReportsService.depositLiability hiện chỉ lọc PAID. [F1][F7] |
| Tài liệu và liên lạc | Document/version/source, người ký và nhật ký ký; liên kết hợp đồng đã ký với activation; file thuộc tenant; Zalo bind khách, notification queue, delivery/retry; gửi thất bại không được làm thất thoát ghi nhận tiền. [D1][D3][D4] |
| ERD và kiểm thử | Bổ sung Tenant/User/Role/Permission, Building/Owner/BankAccount/RoomPaymentAccountRoute, CreditNote, ContractParty, webhook logs, documents/signatures, meter/period settings, notification queue/delivery và các model đề xuất. Phân biệt đường FK thật với liên kết sourceId/code/JSON; đánh dấu bảng đề xuất chưa tồn tại. |

Không cần vẽ mọi model AI/CRM vào luồng cọc. Nếu gọi board là “toàn bộ hệ thống”, cần thêm sơ đồ ranh giới và liên kết đến sales/leads, AI tool permissions, automation rules, giám sát và export; không để người đọc hiểu 18 bảng là schema đầy đủ.

## 5. Lộ trình sửa theo thứ tự vận hành 1–10

Đây là thứ tự phụ thuộc triển khai, không phải chờ sửa hết rồi mới test. Mỗi mốc phải có regression cho lỗi tương ứng, kiểm chứng trên DB cô lập khi cần transaction/lock, cập nhật sơ đồ và bằng chứng trước khi qua mốc sau.

| Mốc | Công việc ưu tiên | Điều kiện hoàn thành cụ thể |
|---:|---|---|
| **1** | **Chốt baseline và bảo vệ dữ liệu.** Gắn SHA cho sơ đồ; thống nhất policy cọc, vào ở tạm, prorate, kỳ dịch vụ, duyệt/chi tiền. Kiểm định pipeline backup production hiện có; chặn đường UI restore/delete không an toàn; lập bộ số dư ban đầu và danh sách dữ liệu nghi sai. | Có backup DB+tệp+manifest kiểm tra được, restore drill vào DB riêng và đối soát số liệu; bản quy tắc và danh sách migration/reconciliation được duyệt. Không dùng script `phase2:verify` lên DB đang vận hành vì script có db:push và seed. |
| **2** | **Khép quyền và tenant.** Sửa access/refresh type, logout/revoke, user status/role; tenant cho mọi query/nguồn/tệp; xác thực SePay gắn đúng tenant; kiểm soát ký và thao tác quản trị. | Token refresh không vào API; logout/reset/khóa tài khoản có hiệu lực theo policy; test hai tenant bao gồm detail, relations, file, webhook, export; không đọc hoặc ghi chéo. |
| **3** | **Chuẩn hóa ghi nhận tiền và chống xử lý lặp.** Tách nghĩa vụ phải thu với tiền đã thu; payment/receipt/allocation, ledger, audit/outbox; khóa/CAS cho thu đồng thời; loại bỏ đánh dấu cọc PAID từ hóa đơn tiền thuê. | Retry cùng giao dịch chỉ tác động một lần; 300+400 phải là 700 ở payment/allocation/paidAmount; thất bại giữa bước không để trạng thái tiền lệch; mỗi lần partial thu được ghi sổ đúng thời điểm. |
| **4** | **Khách → phòng/chỗ → cọc giữ phòng.** Reservation có thời hạn/chủ sở hữu, WHOLE/SHARED/capacity, thu cọc/hết hạn, mở chỗ khi hợp lệ. | Hai yêu cầu cạnh tranh không giữ trùng tài nguyên; hold đang còn của chính khách được nhận diện; hết hạn/hủy chỉ giải phóng đúng chỗ; không làm rời người đang ở phòng ghép. |
| **5** | **Hủy cọc và hoàn/giữ/khấu trừ.** Chuẩn hóa quyết định xử lý, số dư, refund pending/completed, duyệt chi/chứng từ, phần tiền giữ lại. | Các nhánh toàn phần/một phần đều bảo toàn số tiền; chưa chi không ghi cash-out; hoàn lần hai không vượt dư; trạng thái booking và trạng thái chi tiền độc lập nhưng truy vết được. |
| **6** | **Cọc → hợp đồng hoặc SECURITY trực tiếp.** Một command tạo/liên kết/cấn; giữ nguyên số thu gốc; xử lý B<C/B=C/B>C; khép POST/PATCH ACTIVE; nối ký và điều kiện duyệt. | Ví dụ B=1 triệu/C=5 triệu vẫn ghi gốc 1 triệu, thiếu 4 triệu; không sinh cọc trùng khi approve; thiếu tiền chưa đủ điều kiện kích hoạt; retry conversion không cấn lại. |
| **7** | **Nhận phòng và hóa đơn đầu kỳ.** Ngày 1/giữa tháng/bất kỳ ngày; prorate theo policy đã chốt, meter opening snapshot, fee lines, due date, kỳ hóa đơn, occupancy. | Signed/paid/room ownership được xác minh; nhận phòng và nghĩa vụ đầu kỳ nhất quán; tiền đúng tháng 28–31 ngày và năm nhuận; không trùng invoice với monthly settlement. |
| **8** | **Vận hành tháng và kết thúc lưu trú.** Scheduler một lần/tenant/kỳ, điện nước/phân bổ ghép, hóa đơn thu trước/thu sau, nhắc nợ; gia hạn/chuyển/trả phòng/settlement; cleaning/maintenance. | Hai worker không chốt trùng; xóa/tạo lại item atomic; không dùng công tơ trước ngày vào; nợ cũ và cọc thực dư được quyết toán; giữ lịch sử người ở, hợp đồng, chỉ số. |
| **9** | **Chi phí → doanh thu → báo cáo/tổng hợp.** Đối soát receipt/payment với journal, chủ nhà/bank/building/room/kỳ, expense approval/payment/reimbursement, credit/reversal; nối endpoint báo cáo đúng; bỏ dữ liệu mẫu. | Cùng bộ dữ liệu, ledger/cashflow/P&L/báo cáo chủ nhà và export khớp; reversal/hoàn tiền phản ánh đúng; không đếm cọc hai lần hoặc bỏ cọc CONVERTED còn nghĩa vụ. |
| **10** | **Nghiệm thu và triển khai có kiểm soát.** E2E toàn vòng đời; test đồng thời, retry, lỗi mạng, cross-tenant; diễn tập migration dữ liệu cũ, rollback tương thích, quan sát log/metrics sau rollout. | Các mốc 1–9 đạt; không còn lỗi nghiêm trọng mở trong luồng tiền/quyền/dữ liệu; đối soát trước/sau migration bằng chứng đầy đủ; UAT nghiệp vụ được chấp thuận rồi mới rollout. |

**Phụ thuộc dễ gây lỗi khi sửa:** nếu mốc 4 đổi phòng thành RESERVED ngay khi thu booking, `approveContract` hiện chỉ nhận AVAILABLE sẽ từ chối chính khách đã giữ phòng. Phải thiết kế chấp nhận “RESERVED bởi đúng booking này” cùng mốc 6; không sửa rời một dòng trạng thái.

## 6. Các bất biến để nghiệm thu

1. **Bảo toàn cọc:** tổng tiền cọc thực nhận = đã hoàn thực tế + đã cấn sang khoản phải thanh toán + đã giữ/khấu trừ theo quyết định + số dư còn nghĩa vụ. Các vế phải không đếm trùng: khoản khấu trừ đã nằm trong cấn hóa đơn không cộng thêm lần nữa. Chuyển cọc giữ phòng sang cọc hợp đồng chỉ chuyển tiểu khoản, không giảm tổng số dư nghĩa vụ cọc. Không lấy depositMoney hoặc tên trạng thái làm chứng cứ đã thu.
2. **Chuyển booking sang security:** là tái phân bổ nghĩa vụ trên tiền đã có; không tạo thêm cash-in hay doanh thu. Chỉ khoản khách nộp thêm mới là dòng tiền mới.
3. **Bảo toàn hóa đơn:** paidAmount phải khớp tổng payment allocation hiệu lực theo mô hình; creditAmount khớp credit đã áp; còn phải thu = total − paid − credit; không cho ghi đè số dư do concurrency.
4. **Bảo toàn chi hoàn:** refund PENDING là nghĩa vụ cần thực hiện; chỉ khi hoàn xong/chứng từ xác nhận mới ghi cash-out. Retry không chi hay hạch toán hai lần.
5. **Bảo toàn sổ:** mỗi chứng từ kinh tế có dấu vết nguồn/tenant; tổng Nợ = tổng Có; event đã commit phải được xử lý lại được; reversal không xóa giao dịch gốc và không làm báo cáo đếm đôi.
6. **Quyền sở hữu:** mọi ID nguồn, quan hệ, file, webhook, credit và dòng sổ phải thuộc tenant hợp lệ. Trường hợp job toàn hệ thống phải có scope rõ, không tự động bỏ tenant vì thiếu CLS.
7. **Quyền sử dụng phòng:** WHOLE không chồng thời gian trái policy; SHARED không vượt số chỗ; kết thúc một occupancy không giải phóng người/chỗ của khách khác.
8. **Kỳ và thời gian:** phân biệt servicePeriod, billingPeriod, ngày ghi nhận tiền, ngày ghi sổ và ngày tạo bản ghi. Chốt theo múi giờ đã thống nhất; giữ snapshot policy cho dữ liệu lịch sử.

## 7. Quy cách chỉnh sơ đồ ở lượt triển khai

- Tách **hiện tại đã kiểm chứng**, **lỗi/rủi ro có bằng chứng**, **quy trình mục tiêu**. Đỏ cho lỗi xác nhận; vàng cho policy hoặc điều kiện chưa kiểm chứng; xanh cho phần kiểm soát đã có và test tương ứng. Màu không thay cho giải thích điều kiện.
- Mỗi command phải thể hiện người/quyền gọi, endpoint, điều kiện trước, dữ liệu commit cùng nhau, event phát sau commit, nhánh lỗi/retry và trạng thái sau.
- Đính kèm mã nguồn SHA, mã phát hiện, file/hàm, test ID và mốc sửa. Gộp 5:472 với 8:1610 thành cùng vấn đề kế toán bất biến/idempotency.
- Đổi mũi tên callback SePay, thứ tự hủy cọc và các gateway thiếu nhánh “không hợp lệ/chưa đủ tiền/hết hạn/thất bại”. Nhánh chưa thanh toán nên poll/tái dùng request đang hiệu lực, không mặc định tạo QR mới mỗi vòng.
- Hình backup phải có hai nhánh UI JSON và production CLI; hình report phải ghi đúng endpoint; hình state machine phải chứa đường create ACTIVE đang có để người triển khai biết đường cần đóng.

## 8. Nguồn mã và cách chạy lại

Các liên kết dưới đây trỏ vào dòng bắt đầu phần bằng chứng ở workspace hiện tại. Node ID trong bảng là ID đọc từ FigJam, có thể mở bằng `?node-id=<ID thay dấu : bằng ->`.

Chạy lại kiểm chứng audit từ root project:

```powershell
node node_modules/vitest/vitest.mjs run docs/reviews/2026-09-07-final-audit.probe.test.ts --config apps/api/vitest.config.ts
```

File probe cố ý khẳng định hành vi lỗi hiện tại. Khi sửa xong phải thay kỳ vọng bằng bất biến mong muốn và đưa regression vào test nghiệp vụ; không dùng “probe xanh” làm điều kiện thông qua bản sửa.

[PROBE]: D:/homeland-new/homeland-saas/docs/reviews/2026-09-07-final-audit.probe.test.ts
[A1]: D:/homeland-new/homeland-saas/apps/api/src/auth/auth.service.ts:29
[A2]: D:/homeland-new/homeland-saas/packages/shared/src/auth/auth.dto.ts:22
[A3]: D:/homeland-new/homeland-saas/apps/api/src/auth/auth.controller.ts:23
[A4]: D:/homeland-new/homeland-saas/apps/api/src/shared/security/ip-security.service.ts:16
[A5]: D:/homeland-new/homeland-saas/apps/api/src/auth/strategies/jwt.strategy.ts:20
[A6]: D:/homeland-new/homeland-saas/apps/api/src/auth/auth.service.ts:260
[A7]: D:/homeland-new/homeland-saas/apps/api/src/auth/guards/jwt-auth.guard.ts:18
[O1]: D:/homeland-new/homeland-saas/apps/api/src/system-update/system-update.service.ts:347
[O2]: D:/homeland-new/homeland-saas/apps/api/src/system-update/system-update.service.ts:416
[O3]: D:/homeland-new/homeland-saas/apps/api/src/system-update/system-update.service.ts:389
[O4]: D:/homeland-new/homeland-saas/apps/api/src/system-update/system-update.service.ts:101
[O5]: D:/homeland-new/homeland-saas/scripts/production-backup.js:65
[O6]: D:/homeland-new/homeland-saas/scripts/production-restore-drill.js:142
[O7]: D:/homeland-new/homeland-saas/deploy/public-production/update-public-production.sh:33
[O8]: D:/homeland-new/homeland-saas/scripts/docker-update-safety.test.js:1
[O9]: D:/homeland-new/homeland-saas/deploy/public-production/docker-compose.public-production.yml:45
[R1]: D:/homeland-new/homeland-saas/apps/api/src/deposits/deposits.service.ts:363
[R2]: D:/homeland-new/homeland-saas/apps/api/src/deposits/deposits.service.ts:928
[R3]: D:/homeland-new/homeland-saas/apps/api/src/contracts/contracts.service.ts:224
[R4]: D:/homeland-new/homeland-saas/apps/api/src/contracts/contracts.service.ts:91
[R5]: D:/homeland-new/homeland-saas/apps/api/src/deposits/deposits.service.ts:405
[R6]: D:/homeland-new/homeland-saas/apps/api/src/deposits/deposits.service.ts:674
[R7]: D:/homeland-new/homeland-saas/apps/api/src/contracts/contracts.service.ts:277
[R8]: D:/homeland-new/homeland-saas/packages/shared/src/contracts/contracts.dto.ts:27
[R9]: D:/homeland-new/homeland-saas/apps/api/src/contracts/contracts.controller.ts:54
[R10]: D:/homeland-new/homeland-saas/apps/web/components/buildings/RoomPremiumModal.tsx:1399
[R11]: D:/homeland-new/homeland-saas/apps/api/src/contracts/contracts.service.ts:1441
[R13]: D:/homeland-new/homeland-saas/apps/api/src/contracts/contracts.service.ts:631
[R14]: D:/homeland-new/homeland-saas/apps/api/src/deposits/deposits.service.ts:306
[M1]: D:/homeland-new/homeland-saas/apps/api/src/monthly-settlement/monthly-settlement.service.ts:731
[M2]: D:/homeland-new/homeland-saas/apps/api/src/monthly-settlement/monthly-settlement.service.ts:95
[M3]: D:/homeland-new/homeland-saas/apps/api/src/monthly-settlement/monthly-settlement.scheduler.ts:23
[M4]: D:/homeland-new/homeland-saas/apps/api/src/monthly-settlement/monthly-settlement.module.ts:22
[P1]: D:/homeland-new/homeland-saas/apps/api/src/prisma.service.ts:28
[P2]: D:/homeland-new/homeland-saas/apps/api/src/shared/repositories/base.repository.ts:12
[P3]: D:/homeland-new/homeland-saas/apps/api/src/invoices/invoices.service.ts:71
[P4]: D:/homeland-new/homeland-saas/apps/api/src/invoices/invoices.service.ts:185
[P5]: D:/homeland-new/homeland-saas/apps/api/src/payments/payments.service.ts:2036
[F1]: D:/homeland-new/homeland-saas/apps/api/src/reports/reports.service.ts:8
[F2]: D:/homeland-new/homeland-saas/apps/api/src/finance/finance-reporting.service.ts:66
[F3]: D:/homeland-new/homeland-saas/apps/api/src/shared/events/domain-event.publisher.ts:9
[F4]: D:/homeland-new/homeland-saas/apps/api/src/automation/workflow/workflow.engine.ts:27
[F5]: D:/homeland-new/homeland-saas/apps/api/src/finance/journal-entry.service.ts:61
[F6]: D:/homeland-new/homeland-saas/apps/web/components/finance/CashFlowChart.tsx:3
[F7]: D:/homeland-new/homeland-saas/apps/api/src/finance/finance-reporting.service.ts:1927
[DB1]: D:/homeland-new/homeland-saas/packages/database/prisma/schema.prisma:405
[DB2]: D:/homeland-new/homeland-saas/packages/database/prisma/schema.prisma:819
[D1]: D:/homeland-new/homeland-saas/apps/api/src/documents/documents.controller.ts:37
[D2]: D:/homeland-new/homeland-saas/apps/api/src/documents/providers/storage/local-storage.provider.ts:57
[D3]: D:/homeland-new/homeland-saas/apps/api/src/documents/signature-requests.controller.ts:9
[D4]: D:/homeland-new/homeland-saas/apps/api/src/documents/documents.service.ts:178
[D5]: D:/homeland-new/homeland-saas/apps/api/src/documents/providers/storage/storage.module.ts:1
[D6]: D:/homeland-new/homeland-saas/apps/api/src/shared/config/environment.validation.ts:46
