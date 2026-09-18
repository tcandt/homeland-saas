# Bàn giao DEV2 — hồ sơ lịch sử đã hợp nhất vào DEV1

> Trạng thái từ 09/09/2026: **không còn là kế hoạch phân quyền đang hoạt động**. Toàn bộ nhiệm vụ DEV2 đã được nhập lại vào DEV1 để triển khai và nghiệm thu xuyên suốt. Tài liệu này chỉ dùng truy vết phạm vi/lỗi cũ; trạng thái chính thức nằm tại [GO_LIVE_TODO.md](./GO_LIVE_TODO.md).

Ngày chốt phạm vi: 08/09/2026  
Nguồn trạng thái chính: [GO_LIVE_TODO.md](./GO_LIVE_TODO.md)  
Đặc tả nghiệp vụ: [2026-09-08-official-core-lifecycle-implementation-plan.md](../reviews/2026-09-08-official-core-lifecycle-implementation-plan.md)  
Đối chiếu lỗi ảnh: [2026-09-08-operational-screenshots-addendum.md](../reviews/2026-09-08-operational-screenshots-addendum.md)
API contract CORE-04/05: [CORE_04_05_API_CONTRACT.md](./CORE_04_05_API_CONTRACT.md)

## 1. Mục tiêu của việc chia đội

Hai đội có thể làm song song nhưng không cùng sửa một nguồn sự thật:

- **CORE/DEV1 (Codex trong luồng hiện tại)** chịu trách nhiệm dữ liệu, migration và nghiệp vụ tiền: `CORE-04/05`.
- **DEV2** chịu trách nhiệm giao diện, adapter phía web, trạng thái loading/error/empty, accessibility và E2E theo 11 ảnh. DEV2 có thể nhận thêm Documents/Notification ở phase sau bằng PR tách biệt.
- DEV2 không tự thiết kế lại công thức tiền, trạng thái cọc, trạng thái hợp đồng hoặc suy số dư từ UI.
- Mọi thay đổi API/schema do CORE/DEV1 công bố; DEV2 tiêu thụ hợp đồng đã khóa, không tạo API giả trong production code.

## 2. Điểm xuất phát bắt buộc

DEV2 chỉ bắt đầu code sau khi có một `BASE_SHA` chứa đầy đủ mốc `CORE-02` hiện tại. Không làm trực tiếp trên working tree chưa commit và không copy riêng từng file.

| Thông tin | Giá trị |
|---|---|
| `BASE_SHA` | **Chưa chốt — release owner điền sau khi commit/merge checkpoint CORE-02** |
| Nhánh CORE/DEV1 đề xuất | `codex/core-04-05-deposit-ledger` |
| Nhánh DEV2 đề xuất | `codex/dev2-web-uat-lifecycle` |
| Nguồn TODO duy nhất | `docs/operations/GO_LIVE_TODO.md` |
| Trạng thái production | Chưa migration/apply; vẫn `LIVE NO-GO` |

Nếu DEV2 đã mở nhánh trước `BASE_SHA`, phải rebase hoặc tạo lại nhánh từ checkpoint; không merge ngược code cũ làm mất `RentalCycle`, tenant scope hoặc các guard tiền.

## 3. Ranh giới sở hữu file

### 3.1. CORE/DEV1 được quyền sửa độc quyền trong CORE-04/05

DEV2 **không sửa** các đường dẫn sau nếu chưa có xác nhận bằng văn bản trong PR:

```text
packages/database/prisma/**
packages/shared/src/contracts/**
packages/shared/src/invoices/**
packages/shared/src/customers/**
apps/api/src/prisma.service.ts
apps/api/src/contracts/**
apps/api/src/deposits/**
apps/api/src/invoices/**
apps/api/src/payments/**
apps/api/src/monthly-settlement/**
apps/api/src/customers/**
apps/api/src/rooms/**
apps/api/src/finance/**
scripts/core-lifecycle-detector*
scripts/customer-duplicate-review*
scripts/merge-reviewed-customers*
scripts/backfill-rental-cycles*
scripts/repair-terminal-occupancies*
docs/operations/GO_LIVE_TODO.md
package.json
package-lock.json
```

Lý do: đây là vùng đang hình thành ledger cọc, hold lock, command chuyển cọc và invariant tiền/phòng. Hai đội sửa đồng thời có thể làm sai migration, mất idempotency hoặc thay đổi API mà UI không nhận biết.

### 3.2. DEV2 được quyền sửa độc quyền

Sau khi nhận `BASE_SHA`, CORE/DEV1 không sửa các vùng dưới đây trong thời gian DEV2 đang làm:

```text
apps/web/components/buildings/RoomPremiumModal.tsx
apps/web/components/buildings/views/**
apps/web/components/tenants/**
apps/web/components/deposits/**
apps/web/components/contracts/**
apps/web/components/invoices/**
apps/web/components/finance/**
apps/web/lib/api/**
apps/web/lib/queries/**
apps/web/lib/mutations/**
apps/web/lib/adapters/**
apps/web/lib/hooks/**
apps/web/tests/**
```

Ngoại lệ: thay đổi adapter dùng chung phải nằm trong PR DEV2, có test và ghi rõ response shape. Không được thay `apiClient` hoặc cơ chế auth toàn cục trong cùng PR giao diện nghiệp vụ.

### 3.3. Vùng DEV2 có thể làm độc lập ở phase sau

Chỉ làm bằng PR riêng, không trộn với UI vòng đời:

```text
apps/api/src/documents/**
apps/web/app/documents/**
apps/web/tests/e2e/regression/documents/**

apps/api/src/communication/**
apps/web/app/notifications/**
apps/web/tests/e2e/regression/notifications/**
```

Không mở rộng sang Auth, backup/restore, Finance ledger hoặc Prisma trong các PR này.

## 4. Phạm vi CORE/DEV1 đang thực hiện

### `C1-HOLD` — Khóa giữ chỗ chống trùng

- Mô hình hold có `tenantId`, `rentalCycleId`, `depositId`, phòng/chỗ, thời hạn và trạng thái.
- WHOLE room: tối đa một hold hiệu lực cho cùng khoảng thời gian.
- SHARED room: không vượt capacity theo Occupancy + hold còn hạn.
- Xử lý hết hạn, hủy, thu tiền đến muộn và retry.
- Dùng unique business key/transaction/lock; không chỉ kiểm tra rồi create rời rạc.

### `C1-LEDGER` — Sổ biến động cọc bất biến

- Ghi nhận cash-in, application, refund, keep, deduct, credit và reversal bằng dòng nguồn.
- Không sửa/xóa giao dịch gốc để làm đẹp số dư.
- Số dư cọc phải tính từ ledger hiệu lực, không lấy `Deposit.status` hoặc `Contract.depositMoney` làm số thực thu.
- Mọi command tiền có idempotency key và audit trong transaction/outbox.

### `C1-CONVERT` — Chuyển booking sang security

- `B < C`: cấn toàn bộ B, tạo nghĩa vụ/phiếu thu thiếu `C-B`.
- `B = C`: cấn toàn bộ B, không tạo thu/hoàn thừa.
- `B > C`: cấn C, phần `B-C` tạo credit hoặc refund theo lựa chọn có chứng từ.
- Không ghi đè `Deposit.amount` đã thu.
- Retry không tạo thu, credit hoặc refund lần hai.

### `C1-CANCEL` — Hủy/hoàn/giữ/khấu trừ

- Hỗ trợ toàn phần và một phần.
- Tách `PENDING` khỏi `COMPLETED`; pending không được tính cash-out.
- Không hoàn vượt số dư; không xử lý terminal deposit lần hai.
- Chỉ giải phóng đúng hold của RentalCycle; không ảnh hưởng khách khác trong phòng ghép.

### Điều kiện bàn giao API cho DEV2

CORE/DEV1 phải cung cấp trước khi DEV2 nối mutation thật:

- endpoint và method;
- request/response JSON mẫu;
- error code ổn định;
- quyền RBAC;
- idempotency key yêu cầu;
- trạng thái hợp lệ và transition bị cấm;
- cách invalidation query sau success;
- test backend PASS và ngày khóa contract.

**Trạng thái khóa 08/09/2026:** contract đã công bố tại [CORE_04_05_API_CONTRACT.md](./CORE_04_05_API_CONTRACT.md); 23 unit policy/service CORE + 3 unit outbox, 11 integration PostgreSQL thật và full API 363 test đạt. Cùng idempotency key đã được xác nhận chỉ tạo một CASH_IN và một outbox event; câu lệnh claim/phát outbox cũng đã chạy qua PostgreSQL thật. DEV2 được nối adapter đọc finance summary và các mutation hold/cọc theo đúng contract, nhưng chỉ bật trên staging sau khi migration + opening balance dry-run đạt. Production vẫn NO-GO.

## 5. TODO chi tiết giao DEV2

### `D2-00` — Thiết lập và bảo vệ nhánh

- [ ] Nhận `BASE_SHA` từ release owner và ghi vào PR description.
- [ ] Xác nhận working tree sạch trước khi bắt đầu.
- [ ] Chạy baseline: web typecheck, unit test và các E2E liên quan.
- [ ] Không cập nhật dependency/lockfile nếu không có ticket riêng.
- [ ] Mỗi PR chỉ thuộc một nhóm `D2-*`; không gộp Documents/Notification vào PR UI vòng đời.

**Definition of Done:** baseline command/output và SHA được lưu trong PR; không có file thuộc vùng CORE/DEV1.

### `D2-01` — Bộ adapter chuẩn, không suy nghiệp vụ trong component

- [ ] Chuẩn hóa adapter đọc envelope API (`data`, `items`, `meta`) tại `apps/web/lib/adapters/`.
- [ ] Bổ sung kiểu hiển thị `rentalCycleId`, `customerId`, `contractId`, `roomId` ở lớp API/adapter sau khi CORE khóa response.
- [ ] Mọi selector tài chính phải nhận đủ scope; không mặc định chọn hóa đơn đầu tiên của phòng.
- [ ] Không dùng `status === PAID` để suy “đã có tiền cọc”; chỉ hiển thị số backend trả.
- [ ] Không tự cộng `Deposit.amount` để suy số dư nếu API chưa trả ledger balance.
- [ ] Thêm unit test cho response rỗng, response envelope, nhiều khách cùng phòng và dữ liệu thiếu optional field.

**Không được làm:** đổi DTO backend, sửa Prisma, thêm fallback lấy dữ liệu từ localStorage để che API thiếu.

### `D2-02` — Tab Tài chính theo đúng khách và kỳ thuê (ảnh 4)

- [ ] Mặc định mở theo khách đang chọn, không phải tổng cả phòng.
- [ ] Bộ lọc bắt buộc: `roomId + customerId + contractId + rentalCycleId` khi API đã hỗ trợ.
- [ ] Có nút/chế độ “Tổng phòng” tách biệt và ghi rõ đây là tổng hợp.
- [ ] Hiển thị tối thiểu: giá thuê hợp đồng, cọc giữ phòng, cọc bảo đảm, đã cấn, đã hoàn, credit, tổng hóa đơn, đã thanh toán và dư nợ.
- [ ] Mỗi dòng có liên kết mở chứng từ nguồn; không chỉ hiển thị tổng tiền.
- [ ] Empty state phân biệt “chưa có chứng từ” với “tải lỗi” và “không có quyền”.
- [ ] Loading không được tạm hiển thị `0đ` gây hiểu nhầm đã thanh toán đủ.
- [ ] Phòng ghép chuyển khách A/B không giữ lại cache của khách trước.

**CORE đã công bố:** `GET /deposits/rental-cycles/:rentalCycleId/finance-summary` và field ledger balance trong contract 08/09/2026. DEV2 chuyển fixture sang adapter thật trên staging; không tự đổi shape hoặc suy số tiền từ status.

### `D2-03` — Khách quay lại và chọn hồ sơ cũ (ảnh 10–11)

- [ ] Khi API trả duplicate candidate, mở `TenantSourcePickerModal`/`TenantDeduplicateModal` để chọn hồ sơ cũ.
- [ ] Hiển thị dữ liệu che bớt: tên, SĐT, CCCD, trạng thái thuê gần nhất; không hiển thị toàn bộ định danh trong toast/log.
- [ ] Cho phép tạo RentalCycle mới từ hồ sơ cũ đã kết thúc; không sửa chứng từ kỳ cũ.
- [ ] Phiếu cọc đã hoàn/hủy/chuyển chỉ hiển thị lịch sử, không bị mở lại.
- [ ] Nếu hồ sơ đang ở phòng khác, chặn ở UI theo error code backend và hướng dẫn trả/chuyển phòng.
- [ ] Nếu lookup lỗi mạng, không tự chuyển sang “tạo khách mới”.

**Chờ CORE:** API `duplicate candidates / select existing customer / startRentalCycle`. DEV2 không được tự merge khách ở browser.

### `D2-04` — Nhất quán trạng thái khách/phòng trên giao diện (ảnh 5–8)

- [ ] TenantGrid, TenantSidebar và mobile cùng dùng một adapter trạng thái.
- [ ] Ưu tiên `openOccupancy` do API trả; `Customer.roomId` chỉ dùng nhãn cache, không quyết định “đang thuê”.
- [ ] Mặt bằng, bảng phòng và modal phải dùng cùng status mapping.
- [ ] Không tô phòng “Trống” nếu API còn open Occupancy/active contract/hold.
- [ ] WHOLE room có người ở cùng nhưng thiếu chủ hợp đồng: hiển thị cảnh báo đỏ và không cho thêm người tiếp.
- [ ] SHARED room hiển thị số chỗ đã dùng/còn lại từ backend; không tự tính bằng chiều dài mảng UI nếu có phân trang.
- [ ] Sau move-out, invalidate đúng customer, room, contract và occupancy queries.

**Không được làm:** tự PATCH `Room.status` hoặc `Customer.roomId` để sửa màu trên giao diện.

### `D2-05` — Hợp đồng không hiển thị trùng (ảnh 3)

- [ ] Giữ dedupe theo `contractId`, fallback mã chỉ để tương thích dữ liệu cũ.
- [ ] Một hợp đồng xuất hiện từ `tenant`, `sharedTenants` hoặc query contracts vẫn chỉ có một dòng.
- [ ] Không gộp hai hợp đồng khác ID chỉ vì cùng khách/phòng.
- [ ] Thêm regression desktop/mobile cho modal PN 31-02 hoặc fixture tương đương.
- [ ] Sau refetch/reopen modal vẫn không nhân đôi.

**Trạng thái:** đã có sửa bước đầu; DEV2 chịu trách nhiệm khóa regression/UI acceptance, không sửa database contract.

### `D2-06` — Form khách thuê và email tùy chọn (ảnh 9)

- [ ] Create và update đều chấp nhận email trống.
- [ ] Chuỗi chỉ có khoảng trắng gửi thành `undefined/null`, không gửi email giả.
- [ ] Email có giá trị sai vẫn báo lỗi tiếng Việt có dấu.
- [ ] SĐT/CCCD trùng phải đi vào flow chọn hồ sơ, không chỉ báo lỗi đỏ cụt đường.
- [ ] Không ghi PII đầy đủ vào console, telemetry hoặc screenshot test.

**Trạng thái:** backend/shared schema đã sửa email optional; DEV2 khóa UI regression.

### `D2-07` — Giao diện cọc/hold theo command mới

- [ ] Chuẩn bị màn hình cho `B<C`, `B=C`, `B>C` nhưng chỉ nối API sau khi `C1-CONVERT` khóa contract.
- [ ] Trước xác nhận phải hiển thị: số booking thực còn, mức security yêu cầu, thiếu/thừa, hành động phần thừa.
- [ ] Chọn `REFUND / CREDIT / KEEP / DEDUCT` phải có lý do và chứng từ theo policy backend.
- [ ] Nút submit khóa khi request đang chạy; retry dùng cùng idempotency key.
- [ ] Timeout phải chuyển sang “đang kiểm tra kết quả”, không tự gửi request mới với key khác.
- [ ] PENDING refund không hiển thị là “Đã hoàn tiền”.
- [ ] Terminal deposit không có nút thu/chuyển/hoàn lần nữa.
- [ ] Error code capacity/hold conflict hiển thị đúng phòng/chỗ và yêu cầu refresh.

**Không được làm:** chuỗi nhiều API legacy để mô phỏng một command nguyên tử.

**CORE đã công bố:** collect, convert, cancel allocation, complete refund, renew/transfer/release hold, operation status và reversal/finance summary. DEV2 không cần chờ thiết kế endpoint mới; mọi thiếu field phải mở ticket contract thay vì ghép dữ liệu phía browser.

### `D2-08` — Hiển thị Hunonic và chia điện/nước (ảnh 1–2)

- [ ] Hiển thị rõ “Dữ liệu trực tiếp” và “Snapshot đã khóa”; không trộn hai nguồn trên cùng tổng tiền.
- [ ] Badge phương thức giá lấy từ snapshot hóa đơn, không lấy setting hiện tại.
- [ ] Nếu live khác snapshot, hiển thị delta/cảnh báo; không tự sửa hóa đơn.
- [ ] Phòng ghép hiển thị tổng phòng và phần từng khách; tổng phần chia phải bằng tổng snapshot.
- [ ] Nước hiển thị `100.000đ/người` cùng số người snapshot và policy kỳ.
- [ ] Không dùng số người hiện tại để diễn giải hóa đơn kỳ cũ.

**Chờ CORE-07:** billing snapshot, reconciliation delta và policy version. DEV2 chỉ dựng presentational state/fixture trước khi contract được khóa.

### `D2-09` — E2E đối chiếu 11 ảnh

- [ ] Tạo bảng case ID `IMG-01..IMG-11`; mỗi test ghi rõ ảnh nguồn, dữ liệu setup, thao tác và expected.
- [ ] Test tối thiểu: hợp đồng trùng, tab tài chính đúng khách, khách ở cùng hiện active, phòng map đúng màu, email optional, chọn khách cũ, cọc terminal không chặn kỳ mới.
- [ ] Thêm case hai khách phòng ghép và chuyển qua lại tab tài chính để phát hiện cache lẫn dữ liệu.
- [ ] Thêm case network slow/error cho lookup khách và submit command.
- [ ] Chạy desktop 1920/1440 và mobile 430/390; không cập nhật snapshot chỉ để làm test xanh.
- [ ] Screenshot/evidence không chứa SĐT, CCCD hoặc tài khoản thật.

**Definition of Done:** test hành vi PASS; ảnh chỉ là evidence phụ, không thay assertion dữ liệu.

### `D2-10` — Accessibility, responsive và thông báo lỗi

- [ ] Modal/drawer có focus trap, Escape/Close, tiêu đề liên kết ARIA và phục hồi focus.
- [ ] Không chỉ dùng màu đỏ/xanh để truyền trạng thái; thêm icon/text.
- [ ] Bảng tài chính/cọc dùng được bằng bàn phím và có nhãn cột ở mobile.
- [ ] Toast dùng tiếng Việt có dấu, chứa action tiếp theo và không lộ PII/secret.
- [ ] Không hiển thị số tiền cũ trong lúc chuyển filter; skeleton giữ layout ổn định.

### `D2-NEXT-01` — Documents/chữ ký, chỉ khi D2-01..10 không bị chặn

- [ ] Rà tenant ownership của file/template/signature request.
- [ ] Không cho tải file chéo tenant bằng ID đoán được.
- [ ] Lưu người ký, thời điểm, phiên bản tài liệu và checksum.
- [ ] E2E RBAC và file-not-found; không sửa Contract state machine.

### `D2-NEXT-02` — Notification, PR độc lập

- [ ] Chuẩn hóa trạng thái queued/sent/failed/retrying/dead-letter trên UI.
- [ ] Retry không tạo thông báo/giao dịch nghiệp vụ lần hai.
- [ ] Mọi recipient lấy từ backend đã duyệt; không hard-code số/chat ID.
- [ ] Không sửa Payment/Deposit/Invoice khi notification thất bại.

## 6. Ma trận lỗi ảnh và đội chịu trách nhiệm

| Ảnh | Lỗi/nhu cầu | Nguồn sự thật cần sửa | CORE/DEV1 | DEV2 | Trạng thái hiện tại |
|---:|---|---|:---:|:---:|---|
| 1 | Điện phòng ghép phải chia tổng phòng; nước 100.000đ/người | Billing snapshot + Occupancy kỳ | ✓ | Hiển thị/test | Công thức có một phần; snapshot chưa hoàn tất |
| 2 | Tổng hợp khác Hunonic/phương thức giá | Snapshot reading/pricing/version | ✓ | Badge/delta/test | Chưa đóng CORE-07 |
| 3 | Hợp đồng hiển thị trùng | `contractId` bất biến | Guard dữ liệu | ✓ | Đã sửa bước đầu, cần E2E |
| 4 | Tab tài chính không có tiền đúng khách | API scope + ledger balance | ✓ | ✓ UI | Filter/shape đã sửa bước đầu; summary đầy đủ chưa có |
| 5 | Người ở cùng hiện “Chưa thuê” | Open Occupancy | ✓ | ✓ UI | Backend đã sửa bước đầu; cần E2E |
| 6 | Không xóa được khách do binding phòng ma | Contract/Occupancy transaction | ✓ | UX lỗi | Cleanup local đạt; cần UAT command thật |
| 7 | Bảng có khách nhưng mặt bằng không đổi màu | Room status từ binding hiệu lực | ✓ | ✓ UI | Dữ liệu local sạch; cần một adapter UI |
| 8 | Phòng nguyên căn chỉ có “người ở cùng” | WHOLE invariant/chủ hợp đồng | ✓ | Cảnh báo/chặn UI | Chưa đóng CORE-02.06/06.03 |
| 9 | Update bắt email dù create không bắt | Shared schema + form normalization | Đã sửa | ✓ regression | Backend PASS; UI cần khóa test |
| 10 | Khách cũ bị báo trùng nhưng không tìm thấy | Duplicate lookup/select existing | ✓ | ✓ picker | Merge dữ liệu local xong; API chọn lại chưa xong |
| 11 | Cọc đã hoàn làm khách không tạo kỳ mới | RentalCycle mới + deposit terminal bất biến | ✓ | ✓ flow | RentalCycle backfill xong; command kỳ mới chưa đủ |

## 7. Hợp đồng tích hợp giữa hai đội

DEV2 không nối mutation thật cho đến khi nhận một bảng contract theo mẫu:

| Trường | Ví dụ yêu cầu |
|---|---|
| Command | `convertDepositAndCreateContract` |
| Method/path | Do CORE cung cấp, không tự đoán |
| Request | Có `rentalCycleId`, nguồn cọc, mức cọc yêu cầu, xử lý phần thừa |
| Idempotency | Header/field và quy tắc reuse do CORE cung cấp |
| Success | IDs nguồn + balance sau lệnh + trạng thái tài nguyên |
| Error | Mã ổn định: conflict/capacity/insufficient/already-processed/concurrent-update |
| Query invalidation | rental cycle, deposit, contract, room, customer, finance summary |
| Permission | Mã RBAC cụ thể |

Nếu thiếu bất kỳ dòng nào, DEV2 mở ticket `API-CONTRACT-MISSING`, dùng fixture để dựng UI và không merge logic gọi API suy đoán.

## 8. Quy tắc Git và merge

1. Mỗi đội làm trên nhánh riêng từ cùng `BASE_SHA`.
2. Không dùng chung worktree/thư mục chạy dev; mỗi đội dùng worktree riêng và database riêng.
3. DEV2 không chạy migration/backfill/seed vào DB của CORE/DEV1.
4. Không force-push nhánh của đội khác; không cherry-pick một phần migration.
5. PR DEV2 phải có kiểm tra tự động xác nhận không chạm vùng cấm.
6. CORE/DEV1 merge schema/API trước; DEV2 rebase lên commit API contract rồi mới chuyển fixture sang API thật.
7. Nếu conflict thuộc vùng sở hữu của đội kia, dừng và yêu cầu đội sở hữu giải quyết; không tự chọn một phía.
8. `GO_LIVE_TODO.md` do release owner/CORE cập nhật sau khi kiểm tra evidence DEV2; DEV2 không tự đánh `[x]`.
9. Không gộp thay đổi snapshot hàng loạt với sửa logic; snapshot update phải có ảnh đối chiếu và lý do.
10. Mọi PR phải ghi rollback: tắt UI/feature flag, revert commit hoặc forward-fix; không rollback bằng xóa dữ liệu.

## 9. Gate DEV2 bắt buộc trước bàn giao

```powershell
npm run check:encoding
npm run typecheck --workspace=web
npm run test --workspace=web
npm run lint --workspace=web
npm run test:e2e --workspace=web -- <danh-sách-spec-liên-quan>
git diff --check
```

Ngoài PASS/FAIL, DEV2 phải bàn giao:

- `BASE_SHA`, head SHA và danh sách file đổi;
- case ID đã chạy, browser/viewport và evidence;
- API contract version đang tiêu thụ;
- lỗi còn mở, mức độ, owner và dependency;
- xác nhận không chạm vùng CORE/DEV1;
- không có PII/secret trong Git, console hoặc artifact.

## 10. Điều kiện dừng và báo ngay

DEV2 phải dừng phần liên quan, không tự workaround, khi:

- API chưa trả `rentalCycleId` hoặc số dư nguồn nhưng UI cần hiển thị tiền;
- cùng một ID trả dữ liệu khác tenant/phòng/khách;
- command timeout không có cách truy vấn kết quả bằng idempotency key;
- backend trả status mâu thuẫn với invariant đã chốt;
- cần sửa schema/service thuộc vùng CORE để làm UI chạy;
- test chỉ có thể xanh bằng cách bỏ assertion, hard-code dữ liệu hoặc cập nhật snapshot không giải thích được;
- phát hiện mất tiền, nhân đôi chứng từ, hoàn vượt dư hoặc giải phóng nhầm phòng/chỗ.

Khi báo, cung cấp request ID, error code, payload đã che PII, bước tái hiện và expected; không gửi token/cookie/CCCD/SĐT đầy đủ.
