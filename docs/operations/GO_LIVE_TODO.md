# HomeLand Go-Live TODO

Ngày cập nhật: 2026-09-08
Trạng thái: **BIG UPDATE ĐANG TRIỂN KHAI / LIVE NO-GO**

Đây là nguồn theo dõi duy nhất cho các việc còn lại trước LIVE. Các checklist khác phải dẫn chiếu về file này; không tự đánh dấu LIVE ở tài liệu khác nếu P0 trong file này chưa hoàn thành.

Đặc tả chốt của Big Update: [Kế hoạch triển khai chính thức vòng đời thuê](../reviews/2026-09-08-official-core-lifecycle-implementation-plan.md). Hồ sơ bằng chứng chi tiết nằm tại [kiểm định tổng thể 07/09](../reviews/2026-09-07-final-figjam-logic-audit.md) và [đối chiếu 11 ảnh vận hành](../reviews/2026-09-08-operational-screenshots-addendum.md).

## 1. Quy ước theo dõi

| Giá trị | Ý nghĩa |
|---|---|
| `[x]` | Hoàn thành và đã có bằng chứng kiểm tra được |
| `[ ]` | Chưa hoàn thành |
| `IN PROGRESS` | Đang được triển khai; chưa đủ Definition of Done để đánh dấu hoàn thành |
| `BLOCKED` | Chưa thể làm do thiếu phê duyệt, credential, hạ tầng hoặc bên thứ ba |
| `P0` | Bắt buộc hoàn thành trước khi mở traffic production |
| `P1` | Bắt buộc hoàn thành trước khi kết thúc hypercare hoặc vận hành ổn định |

Owner trong file là vai trò chịu trách nhiệm đề xuất, không phải xác nhận người đã nhận việc:

- `TL`: technical lead/release owner.
- `SEC`: security owner.
- `DEV`: đội phát triển.
- `CORE/DEV1`: chủ sở hữu duy nhất của Big Update, gồm schema, migration, API nghiệp vụ, web UI, adapter và E2E. Từ 09/09/2026, phạm vi DEV2 cũ đã được nhập lại vào DEV1.
- `DEV2`: tên lịch sử của nhánh công việc giao diện trước 09/09/2026; không còn vùng code độc lập hoặc quyền tự xác nhận hoàn thành.
- `CI`: người duy trì kiểm tra tự động và quy tắc bảo vệ PR.
- `INFRA`: hạ tầng/DevOps.
- `DBA`: người chịu trách nhiệm PostgreSQL/Redis/backup.
- `INT`: người chịu trách nhiệm SePay/Hunonic/Zalo/Telegram/SMTP.
- `OPS`: quản lý vận hành.
- `SALES`: nhân sự đặt cọc, hợp đồng và chăm sóc khách thuê.
- `FIN`: kế toán/đối soát.
- `OWNER-A`, `OWNER-B`: hai chủ sở hữu.

Mỗi mục chỉ được đổi sang `[x]` khi đủ `Definition of Done` và đường dẫn/ID bằng chứng. Không đưa password, token, cookie, private key, CCCD, thông tin bank đầy đủ hoặc dữ liệu khách hàng vào Git hay ảnh chụp công khai.

## Big Update — TODO triển khai vòng đời thuê cốt lõi

Các mốc `CORE-*` là dependency mới bắt buộc trước `UAT-*` và `REL-*`. Baseline cũ chỉ chứng minh happy path tại thời điểm chạy; không được dùng để bỏ qua lỗi đã tái hiện trong báo cáo 07–08/09.

### Điều phối sau khi hợp nhất DEV2 vào DEV1

Tài liệu bàn giao và ranh giới file chính thức: [DEV2 — phát triển song song không xung đột CORE-04/05](./PARALLEL_DEV2_HANDOFF.md).

| ID | Trạng thái | Owner | Việc cần làm | Điều kiện hoàn thành |
|---|---|---|---|---|
| `TEAM-01` | [x] | TL | Hợp nhất vùng làm việc DEV2 cũ vào working tree DEV1 | DEV1 kiểm kê toàn bộ thay đổi; không tạo nhánh triển khai song song mới |
| `TEAM-02` | [x] | TL, DEV | Chốt một chủ sở hữu | DEV1 chịu trách nhiệm xuyên suốt backend → adapter → UI → test → tài liệu |
| `TEAM-03` | [x] | DEV1 | Chạy baseline sau hợp nhất | API 389/389 (15 skipped có chủ đích), web unit 106/106, typecheck API/web và build API/web đạt ngày 09/09/2026 |
| `TEAM-04` | [x] | DEV1 | Khóa API contract CORE-04/05 trước khi nối mutation thật | Path, payload, error code, RBAC, idempotency và invalidation đã công bố; web không còn fallback endpoint/ID giả |
| `TEAM-05` | `N/A` | TL | Guard file ownership hai PR | Không còn hai chủ sở hữu song song; thay bằng review scope theo từng mốc CORE |
| `TEAM-06` | `IN PROGRESS` | DEV1 | Nghiệm thu lại toàn bộ phần DEV2 cũ | Không dùng báo cáo DEV2 làm bằng chứng; mỗi lỗi phải có test chạy trên mã hợp nhất |
| `TEAM-07` | `IN PROGRESS` | DEV1 | Hoàn thành lần lượt `CORE-04` → `CORE-10` | Chỉ chuyển mốc khi đầy đủ unit, integration, E2E và evidence; production vẫn NO-GO |

Quy tắc bắt buộc sau hợp nhất: mọi kết quả DEV2 cũ được xem là đầu vào cần kiểm chứng, không phải bằng chứng nghiệm thu. DEV1 chỉ đánh dấu hoàn thành sau khi đọc mã nguồn thực tế và chạy gate trên head hợp nhất. Production không được migration/apply ngoài maintenance window và runbook đã phê duyệt.

### Bảng điều phối 1–10

| ID | Trạng thái | Owner | Phạm vi | Điều kiện hoàn thành |
|---|---|---|---|---|
| `CORE-01` | `IN PROGRESS` | TL, DEV, SEC, DBA | Gate 0: baseline, dữ liệu, tenant, token, SePay và idempotency nền | Regression probes được khóa; backup/restore DB riêng; cross-tenant và retry tiền đạt |
| `CORE-02` | `IN PROGRESS` | DEV, DBA, OPS | Customer + RentalCycle + Occupancy | Khách quay lại dùng hồ sơ cũ; không phòng ma; backfill có dry-run |
| `CORE-03` | `IN PROGRESS` | DEV, FIN | Payment/Receipt/Allocation/Credit/Refund và sổ nguồn | Thu đồng thời không mất tiền; retry không nhân đôi; Nợ = Có |
| `CORE-04` | `IN PROGRESS — CORE/DEV1` | DEV, OPS, SALES | Booking deposit và giữ chỗ | WHOLE/SHARED/capacity/hết hạn nhất quán; không giữ trùng |
| `CORE-05` | `IN PROGRESS — CORE/DEV1` | DEV, FIN, OPS | Chuyển/hủy/hoàn cọc | B<C/B=C/B>C đúng; không ghi đè tiền gốc; không hoàn vượt dư |
| `CORE-06` | [x] | DEV, OPS, SALES | Hợp đồng và nhận phòng | Một activation command; Contract–Occupancy–Room nhất quán; không hiển thị trùng |
| `CORE-07` | `IN PROGRESS — CORE/DEV1` | DEV, INT, FIN, OPS | Hóa đơn đầu kỳ/tháng, Hunonic và chia điện nước | Không lập trùng; snapshot kỳ khóa; tổng chia bằng tổng phòng |
| `CORE-08` | `IN PROGRESS` | DEV, FIN | Thanh toán và tab Tài chính | API/UI đúng room/customer/contract/kỳ thuê; truy vết đủ chứng từ |
| `CORE-09` | [x] | DEV, FIN, OPS | Gia hạn/chuyển/trả phòng/settlement và báo cáo đối soát | GATE-09 PASS; kỳ cũ bất biến; cọc/nợ/điện cuối, trạng thái phòng và đối soát nhất quán |
| `CORE-10` | [ ] | TL, DEV, DBA, OPS, FIN | Migration, E2E 11 ảnh, UAT và rollout | Toàn bộ acceptance gate đạt; UAT ký duyệt; rollout có rollback và evidence |

### `CORE-01` — Gate 0

- [x] `CORE-01.01` Chốt báo cáo hợp nhất, phạm vi cốt lõi, lộ trình 1–10 và acceptance gate.
- [x] `CORE-01.02` Đã chuyển đủ 7 audit probe vào suite chính: bảo toàn cọc gốc, tenant scope invoice, CAS thanh toán, không suy cọc từ hóa đơn, token type, logout revoke và SePay tenant binding; API 331/331 đạt 08/09/2026.
- [x] `CORE-01.03` Đã tạo `npm run audit:core-lifecycle -- --env-file .env` chỉ đọc và test 3/3. Baseline 08/09/2026: 31 finding = 15 critical + 6 high + 10 medium; gồm 10 Occupancy mở với hợp đồng terminal, 5 khách nhiều Occupancy mở, 3 phòng AVAILABLE còn binding, 1 nhóm trùng điện thoại và 2 nhóm trùng CCCD; chưa thấy lệch cọc hoặc invoice/allocation.
- [x] `CORE-01.04` Access/refresh có `tokenType` riêng; access strategy từ chối refresh token; logout bắt buộc access token và thu hồi refresh hash, API 331/331 + typecheck đạt 08/09/2026. Thay đổi này buộc các phiên token cũ đăng nhập lại.
- `IN PROGRESS` `CORE-01.05` Tenant scope đã bao phủ `findUniqueOrThrow`, `findFirstOrThrow`, aggregate/groupBy và upsert; SePay credential chỉ tra payment request thuộc tenant đã xác thực; còn kiểm tra file/source ID.
- `IN PROGRESS` `CORE-01.06` Thanh toán hóa đơn đã dùng CAS trên `paidAmount + creditAmount + status`, xung đột rollback trước khi tạo Payment/Allocation; còn chuẩn hóa idempotency key cho mọi command tiền.
- [x] `CORE-01.07` Backup DB `2026-09-08T02-59-51-364Z` SUCCESS; restore vào `homeland_core_restore_drill_20260908` PASS 10/10 rồi đã xóa DB drill. Nguồn/restore khớp: tenant 25, room 51, customer 22, contract 15, deposit 24, invoice 10, payment 6, occupancy 11; invoice total 59.400.000đ, invoice paid 32.500.000đ, deposit 123.000.000đ, confirmed payment 38.100.000đ. Đây là drill DB cục bộ; off-host/storage vẫn theo checklist BKP riêng.

### `CORE-02` — Customer, RentalCycle và Occupancy

- [x] `CORE-02.01` Đã thêm migration additive `RentalCycle` và FK nullable tới Contract, Deposit, Occupancy, Invoice, Payment, Settlement; tenant scope đã bao phủ model mới. Migration test trên DB cô lập PASS, backup hậu-cleanup `2026-09-08T07-16-03-711Z` SUCCESS và schema dev `db push` thành công 08/09/2026.
- [x] `CORE-02.02` Cleanup 10 Occupancy terminal hoàn tất. Ba finding khách trùng được gom thành 2 cụm, review và merge mềm có AuditLog; 15 RentalCycle đã backfill cùng 22 cọc, 11 Occupancy, 9 hóa đơn, 5 thanh toán. Hậu kiểm: 0 khách trùng, 0 candidate/skip/orphan và detector 0 finding. Backup trước merge `2026-09-08T07-30-23-920Z`, sau merge/trước backfill `2026-09-08T07-31-27-774Z`, sau backfill `2026-09-08T07-43-09-118Z`.
- [ ] `CORE-02.03` API duplicate phone/CCCD trả chính xác hồ sơ cũ để giao diện chọn lại.
- [ ] `CORE-02.04` Dùng Occupancy chưa kết thúc làm nguồn sự thật người đang ở; `Customer.roomId` chỉ là cache tương thích.
- `IN PROGRESS` `CORE-02.05` Command kết thúc đã đóng Occupancy đúng tenant trong cùng transaction và có regression; 10 Occupancy terminal lịch sử đã đóng bằng cleanup có audit ngày 08/09/2026. Còn rà soát toàn bộ nhánh di chuyển/phòng ghép.
- [ ] `CORE-02.06` Chặn WHOLE room có roommate thiếu hợp đồng chính; SHARED room không vượt capacity.
- [x] `CORE-02.07` API trả open Occupancy + phòng, bộ lọc ACTIVE/INACTIVE xét cả Occupancy và UI hiển thị “Ở ghép”; API 326/326 và typecheck đạt 08/09/2026.

### `CORE-03` — Lõi tiền và sổ phân bổ

- [ ] `CORE-03.01` Tách nghĩa vụ phải thu khỏi tiền đã thu; số dư được tính từ giao dịch hiệu lực.
- [x] `CORE-03.02` Thanh toán hóa đơn dùng CAS; request dùng snapshot cũ bị trả `INVOICE_PAYMENT_CONCURRENT_UPDATE` trước khi tạo Payment/Allocation, API 331/331 đạt 08/09/2026.
- [x] `CORE-03.03` Đã loại bỏ cập nhật cọc khỏi luồng `invoice.paid`; regression xác nhận hóa đơn thuê PAID không đổi cọc PENDING, API 331/331 đạt 08/09/2026.
- [ ] `CORE-03.04` Chuẩn hóa Credit/Refund/Receipt và bút toán reversal không sửa giao dịch gốc.
- [ ] `CORE-03.05` Đưa audit/event tài chính sang cùng transaction + outbox/retry idempotent.
- [ ] `CORE-03.06` Test invariant bảo toàn tiền và Nợ = Có cho success/failure/retry/concurrency.

### `CORE-04` — Booking deposit và giữ chỗ

- **Owner code độc quyền:** CORE/DEV1. DEV2 chỉ dựng UI bằng fixture và chờ API contract khóa.
- [x] `CORE-04.01` Hold đã có tenant, RentalCycle chủ sở hữu, deposit, room/resource WHOLE hoặc SHARED slot, hạn hiệu lực, trạng thái và active resource key duy nhất.
- `IN PROGRESS` `CORE-04.02` Command thu cọc đã ghi CASH_IN, khóa hold và chuyển RentalCycle RESERVED trong một serializable transaction; security deposit chỉ thu phần còn thiếu. Integration PostgreSQL thật đã đạt; còn đối soát hold/dữ liệu lịch sử trên staging.
- [x] `CORE-04.03` Đã có quét hết hạn, gia hạn, giải phóng/no-show qua command hủy, thu muộn kiểm tra lại capacity và chuyển phòng/chỗ trong transaction; chuyển khi đã có contract bị chặn sang CORE-06.
- [x] `CORE-04.04` Khóa dòng Room + SERIALIZABLE + active resource key + capacity WHOLE/SHARED đã đạt kiểm thử nhiều connection PostgreSQL thật.
- [x] `CORE-04.05` Hủy chỉ giải phóng hold cùng tenant + RentalCycle + deposit; kiểm thử phòng ghép có Occupancy và nhiều hold xác nhận không ảnh hưởng khách còn lại.
- [x] `CORE-04.06` Operation idempotency, request hash, advisory lock, CAS và retry đúng cả Prisma `P2034` lẫn PostgreSQL `40001` bọc trong `P2010`; cùng key đồng thời chỉ ghi một CASH_IN trên DB thật.
- [x] `CORE-04.07` Đã công bố [API contract CORE-04/05](./CORE_04_05_API_CONTRACT.md): path, payload/response, error code, RBAC hiện hữu, idempotency và query invalidation.

### `CORE-05` — Chuyển, hủy và hoàn cọc

- **Owner code độc quyền:** CORE/DEV1. DEV2 không tạo chuỗi API legacy để mô phỏng command chuyển cọc.
- `IN PROGRESS` `CORE-05.01` Migration additive, ledger append-only/check/trigger và balance từ tổng effect đã có. Script opening balance mặc định dry-run, chỉ apply file FIN duyệt có evidence; migration DB cô lập đạt. Còn FIN đối soát và ký file staging/production.
- `IN PROGRESS` `CORE-05.02` Một command chuyển booking sang security với ma trận B<C, B=C, B>C đã đạt 23 unit tests và toàn bộ nhánh trên PostgreSQL thật; còn UAT nghiệp vụ/FIN trên staging.
- [x] `CORE-05.03` Command giữ nguyên `Deposit.amount` nguồn; tạo TRANSFER_OUT/IN, chỉ thu thêm phần thiếu, tạo CreditNote hoặc Receipt phần thừa; pending refund không ghi cash-out. Ma trận bảo toàn số dư đạt integration DB thật.
- [x] `CORE-05.04` Command hủy bắt buộc phân bổ đủ balance thành REFUND/KEEP/DEDUCT; PENDING/COMPLETED tách riêng và complete dùng CAS. Chứng từ, audit và event outbox được ghi cùng transaction; dispatcher có claim chống tranh chấp, retry/backoff, phục hồi claim kẹt và `outboxEventId` cho consumer khử trùng. Canary downstream vẫn thuộc gate staging `CORE-05.08`.
- [x] `CORE-05.05` Idempotency key + request hash + row/advisory lock + unique key chặn retry; hai complete refund đồng thời trên PostgreSQL thật chỉ một cash-out và không hoàn vượt balance.
- [x] `CORE-05.06` Khách quay lại chỉ tái sử dụng RentalCycle PLANNED/RESERVED chưa có contract hoặc tạo kỳ mới; RentalCycle và phiếu cọc terminal của kỳ cũ không bị nối lại/sửa đổi.
- [x] `CORE-05.07` Collect/refund/complete concurrency và reversal append-only đã có unit + integration; reversal đảo toàn operation, giữ dòng gốc và chặn workflow Receipt/CreditNote chưa được đảo chứng từ.
- `IN PROGRESS` `CORE-05.08` Policy B<C/B=C/B>C, full/partial/over-allocation, rollback giữa transaction và cross-tenant đã đạt; còn fault-injection timeout/network ở staging.
- [x] `CORE-05.09` Đã công bố `GET /deposits/rental-cycles/:rentalCycleId/finance-summary`; DEV2 nhận balance/ledger/invoice/payment/pending operation theo tenant và không tự tính từ status.
- [x] `CORE-05.10` Web đã bỏ `window.prompt`/endpoint fallback/ID hoàn tiền giả; mọi command tiền bắt buộc idempotency key, cancel phân bổ đúng toàn bộ số dư ledger và hoàn pending chỉ hoàn tất bằng `operationId`. API 364/364, web unit 103/103; E2E cọc đạt 7/7 trên Desktop 1920 và 7/7 trên Laptop 1440 ngày 09/09/2026. Playwright còn rò tiến trình webServer sau khi in đủ kết quả và được theo dõi như lỗi harness, không đổi kết quả assertion.

### `CORE-06` — Hợp đồng và nhận phòng

- [x] `CORE-06.01` Backend chỉ cho tạo DRAFT, chặn đổi status qua PATCH; luồng tải hồ sơ chỉ trình duyệt và quick-create tạo DRAFT. API 326/326, shared 3/3 và typecheck đạt 08/09/2026.
- [x] `CORE-06.02` Activation kiểm tra đúng tenant, trạng thái APPROVED, `signedAt` hợp lệ, ngày bắt đầu không ở tương lai, số dư thực thu từ ledger, cọc PAID/CONVERTED, hold còn hiệu lực, trạng thái phòng và capacity phòng ghép; command bắt buộc `Idempotency-Key` 8–128 ký tự và chặn khóa đã thuộc hợp đồng khác.
- [x] `CORE-06.03` Một transaction khóa dòng Room, claim trạng thái bằng CAS, lưu snapshot nhận phòng/đồng hồ, kích hoạt RentalCycle, tạo ContractParty + Occupancy, cập nhật Room/cọc và lập hóa đơn kỳ đầu. PostgreSQL cô lập xác nhận hai activation tranh chấp chỉ có một lệnh thắng, một hóa đơn, một Occupancy, một ContractParty; retry cùng khóa không nhân đôi.
- [x] `CORE-06.04` Loại hợp đồng hiển thị trùng trong modal theo `contractId`/mã hợp đồng ổn định; web typecheck đạt 08/09/2026.
- [x] `CORE-06.05` Đồng bộ lịch sử hợp đồng dùng ID Occupancy xác định + upsert; CAS activation, khóa dòng Room và capacity phòng ghép nằm trong transaction. PostgreSQL integration xác nhận hai hợp đồng khác nhau tranh chỗ cuối chỉ một hợp đồng ACTIVE, tổng Occupancy không vượt capacity và chỉ tạo một hóa đơn.
- [x] `CORE-06.06` Đã kiểm thử ngày 1 của tháng, giữa tháng năm nhuận, ngày vào tương lai, chữ ký thiếu, retry cùng khóa, khóa bị tái sử dụng, tranh chấp khác khóa, thiếu ledger/hold, vượt capacity và rollback khi tạo hóa đơn lỗi. Focused contract 66/66 và PostgreSQL integration 3/3 đạt ngày 09/09/2026.

### `CORE-07` — Hóa đơn, Hunonic và điện nước

- [x] `CORE-07.01` Invoice đầu kỳ/tháng dùng `billingKind` + `baseInvoiceKey` canonical duy nhất; adjustment debit/credit là chứng từ append-only liên kết root base, bắt buộc tenant + `Idempotency-Key`, request hash/replay, khóa transaction và bảo toàn nghĩa vụ so với tiền đã phân bổ. Base/items không bị ghi đè; lifecycle dùng AuditLog + semantic Outbox nguyên tử, không emit trực tiếp; chốt tháng chỉ replay exact `MONTHLY_BASE`. Focused 52/52, full API 428 pass/0 fail/31 conditional skip, PostgreSQL cô lập 16/16 và API typecheck/build đạt ngày 10/09/2026. Finance và release review `PASS_WITH_WARNINGS`; Journal/account mapping vẫn là gate CORE-03/05/09, không production migration.
- [x] `CORE-07.02` Chốt tháng tạo/update `InvoiceItem` và tổng hóa đơn trong cùng transaction; không còn khoảng trống giữa xóa item và tạo lại. API 367/367 và focused settlement 15/15 đạt 09/09/2026.
- [x] `CORE-07.03` Chuẩn hóa kỳ `YYYY-MM`, từ chối tháng 00/13/định dạng sai; invoice đầu kỳ dùng `firstPaymentDate`, prorate theo số ngày thực 28–31 và năm nhuận với policy `ACTUAL_DAYS_V1`. Test đầu tháng/giữa tháng/năm nhuận/kỳ sai đạt.
- `IN PROGRESS` `CORE-07.04` Code gate đạt `PASS_WITH_WARNINGS` ngày 10/09/2026, không còn P0/P1 sau finance audit và release review độc lập. `BillingSnapshot` chỉ cho phép trạng thái `LOCKED`, bất biến sau tạo, bắt buộc hash/provenance; `InvoiceItem` điện/nước của `MONTHLY_BASE` bắt buộc liên kết snapshot đúng tenant + kỳ; reading Hunonic append-only theo payload hash, không ghi đè mapping đã dùng, cho phép hai observation khác payload cùng timestamp và exact retry idempotent bằng `createMany(skipDuplicates)` + kiểm tra exact hash; settlement khóa chung evidence, CAS nguồn, đối soát đúng meter/kỳ và dùng biên thời gian UTC+7. Migration additive được bọc `BEGIN/COMMIT`, bỏ unique timestamp cũ và giữ unique payload identity. Bằng chứng: focused 40/40, PostgreSQL cô lập 4/4 gọi service thật, full API 442 pass/35 conditional skip, E2E 1 pass/12 conditional skip, API typecheck/build, Prisma validate và `git diff --check` đều PASS; DB/tệp kiểm thử tạm đã xóa. Chưa được đổi sang `[x]` cho tới khi UAT payload Hunonic thật xác nhận `MONTHLY_AGGREGATE_V1`, đơn vị/scale, source period, meter identity và semantics chỉ số đầu/cuối; tuyệt đối chưa apply production.
- `IN PROGRESS` `CORE-07.05` Code gate đạt finance `PASS` và release `PASS_WITH_WARNINGS` ngày 11/09/2026, không còn P0/P1. `Occupancy` là nguồn headcount duy nhất theo biên nửa mở UTC+7; payer hợp đồng được tách khỏi người thực ở và mọi liên kết tenant/customer/contract đều fail-closed. Phòng ghép chia điện/kWh bảo toàn tổng theo số người đủ điều kiện và nước đúng 100.000đ/người; WHOLE/SHARED, terminal, occupancy không gắn hợp đồng và terminal soft-delete đều có guard chống gán nhầm/double charge. Overview Hunonic dùng chế độ read-only, chặn evidence live/legacy chưa xác minh trên toàn scope trước financial write, phát hiện observation mới nhất room-wide kể cả thay công tơ; snapshot dùng create-only `createMany(skipDuplicates) + findUnique`, xác minh concurrent winner và retry snapshot khóa mà không `UPDATE` trigger bất biến. MONTHLY_BASE đã khóa phải khớp đầy đủ payer, rental cycle, kỳ, đúng một dòng RENT, SERVICE/điện/nước, snapshot link và tổng tiền. Bằng chứng: focused 88/88, full API 491 pass/37 conditional skip, API typecheck/build và `git diff --check` PASS; PostgreSQL cô lập 7/7 gồm immutable trigger, create-only conflict, settlement-run concurrency và phòng ghép hai hợp đồng bị ngắt sau hóa đơn đầu rồi retry cùng snapshot. Database kiểm thử tạm đã xóa. Vẫn giữ `IN PROGRESS` cho tới khi backfill/đối soát `actual joinedAt` + tenant/contract binding trên dữ liệu legacy, UAT payload Hunonic thật và maintenance-window gate hoàn tất; không production migration/apply.
- [x] `CORE-07.06` Phân bổ phần lẻ xác định theo đơn vị nhỏ nhất, ưu tiên thứ tự ổn định; tổng kWh (3 số lẻ) và tiền (2 số lẻ) các hợp đồng luôn bằng đúng tổng phòng. Có test 1/3, hợp đồng không đủ điều kiện và phòng ghép.
- [x] `CORE-07.07` `MonthlySettlementRun` khóa duy nhất theo tenant + kỳ + phạm vi, lưu request hash/result và trạng thái RUNNING/COMPLETED/FAILED; lệnh đang chạy bị chặn, lệnh hoàn tất được replay, payload khác bị từ chối và run FAILED được claim lại bằng CAS. Snapshot dùng upsert `update: {}` nên sync Hunonic mới không ghi đè kỳ đã khóa. Unit 20/20 và PostgreSQL concurrency integration 1/1 đạt ngày 09/09/2026.
- `IN PROGRESS` `CORE-07.08` Code gate đạt release review `PASS_WITH_WARNINGS` ngày 12/09/2026, không còn P0/P1. Tab Tổng hợp phân biệt `Snapshot đã khóa`/`Dữ liệu chưa khóa`, hiển thị trực tiếp mã snapshot + kỳ kể cả 0đ; số Hunonic mới chỉ thành reconciliation delta màu đỏ. Query hóa đơn fail-closed khi thiếu kỳ; modal dùng đúng contract detail và gửi đủ phòng/khách/hợp đồng/kỳ. API bảo toàn compatibility khi thiếu `rentalCycleId`, nhưng xác minh tenant + phòng + khách + hợp đồng + kỳ trước khi lưu authoritative cycle. Bằng chứng: API 505 pass/37 conditional skip, Web 115/115, hai typecheck và `git diff --check` PASS. Còn P2: validate và insert chưa cùng transaction nên có cửa sổ TOCTOU hẹp; thiếu mounted integration `RoomPremiumModal → contract detail → InvoiceCreateModal`. E2E Tổng hợp 1/1 trước đó dùng overview mock; vẫn cần DB-backed E2E, UAT Hunonic thật và maintenance-window gate nên chưa đổi `[x]`.

### `CORE-08` — Thanh toán và Tài chính phòng

- [x] `CORE-08.01` API danh sách hóa đơn áp bộ lọc `roomId`; có unit regression test, API suite 326/326 đạt 08/09/2026.
- [x] `CORE-08.02` Modal phòng đọc đúng mảng hóa đơn từ query; web typecheck đạt 08/09/2026.
- [x] `CORE-08.03` API và Web đã truyền đủ scope `roomId + customerId + contractId + rentalCycleId`; modal phòng ưu tiên kỳ có hợp đồng ACTIVE/EXPIRING rồi mới tới kỳ chuẩn bị/terminal, mặc định đúng khách đang chọn. Invoice unit 13/13, web unit 106/106 và typecheck/build đạt ngày 09/09/2026.
- [x] `CORE-08.04` Chế độ “Tổng phòng” tách riêng và mỗi dòng mở được chứng từ nguồn.
  - Dependency phát hiện khi đọc mã: `getRentalCycleFinanceSummary` đang cộng mọi hóa đơn chưa xóa, chưa tách DRAFT/CANCELLED và dấu của CREDIT_ADJUSTMENT; cần finance audit quy tắc nghĩa vụ theo nhóm hóa đơn gốc/điều chỉnh, tiền đã phân bổ và credit trước khi tổng hợp phòng. Không bù chéo nợ giữa khách/kỳ thuê bằng cách lấy `max` trên tổng phòng.
  - Triển khai endpoint tổng phòng authoritative theo tenant + room, trả từng kỳ/khách/hợp đồng và ID chứng từ; UI có lựa chọn riêng, không tự cộng summary các khách. Nghiệm thu gồm hai khách phòng ghép, cùng khách hai kỳ, chuyển lựa chọn A/B/tổng phòng, từ chối nguồn ngoài tenant/phòng và mở đúng chứng từ.
  - Finance policy đã duyệt 12/09/2026: tính riêng từng họ hóa đơn gốc + debit - credit; DRAFT/CANCELLED có hiệu lực tiền bằng 0; WRITTEN_OFF giữ lịch sử tiền đã thu nhưng phần dư không còn là outstanding; tiền đã thu chỉ lấy `PaymentAllocation` có payment `CONFIRMED` và chưa xóa; credit/overpayment chưa áp dụng không giảm nợ; outstanding clamp theo từng họ rồi mới cộng kỳ/phòng; cọc bằng tổng `DepositLedgerEntry.balanceEffect`; pending refund chỉ là operation chờ. Mọi dòng phải trả `source.entity + source.id`.
  - GATE-08 PASS ngày 12/09/2026: relation con đã tenant-scope, ledger/source metadata đầy đủ, orphan adjustment bị loại/báo riêng; source invoice/payment/deposit/ledger mở đúng context và fail-closed khi đổi phòng/khách/hợp đồng/kỳ. Focused deep-link 11/11 và milestone review không còn P0/P1.
- [x] `CORE-08.05` Modal Tài chính dùng summary authoritative theo RentalCycle; hiển thị giá thuê, cọc/ledger, hóa đơn, payment, credit và dư nợ; query và deep-link khóa đúng `roomId + customerId + contractId + rentalCycleId`. Focused frontend GATE-08 đạt 18/18 ngày 12/09/2026.
- [x] `CORE-08.06` SePay/manual payment đã tenant-bind đúng bank/owner/source; thiếu/thừa/sai nội dung/sai bank vào `NEEDS_REVIEW`; stable idempotency/provider reference, advisory lock, CAS và replay chặn trùng Payment/Allocation/CreditNote/refund. Retry sau financial commit hoàn tất request/log mà không ghi tiền lần hai. PostgreSQL focused retry/partial/concurrency đạt 3/3, refund CAS 1/1 và milestone review PASS ngày 12/09/2026.
- [x] `CORE-08.07` E2E PostgreSQL cô lập phòng SHARED A/B đạt 1/1 ngày 12/09/2026: Invoice/Payment/Deposit/Ledger/Credit/outstanding tách theo Customer/Contract/RentalCycle; tổng phòng giữ hai kỳ riêng và cross-tenant bị chặn.
- [x] `CORE-08.08` Email khách là tùy chọn; chuỗi rỗng chuẩn hóa thành null và shared tests 3/3 đạt 08/09/2026.

### `CORE-09` — Cuối vòng đời và báo cáo đối soát

- [x] `CORE-09.01` Settlement authoritative đã xử lý nợ cũ, điện nước cuối, cấn/hoàn cọc append-only và chống retry/concurrency; cấn cọc phân bổ đúng toàn bộ invoice family, không double-count credit/reversal.
- [x] `CORE-09.02` Finalize đóng đúng Occupancy mục tiêu, giữ ContractParty/lịch sử và roommate SHARED; `expireContract` fail-closed hoặc replay lifecycle canonical, không bypass settlement.
- [x] `CORE-09.03` Renewal tạo Contract/RentalCycle mới, giữ bất biến kỳ và chứng từ cũ; retry/concurrency chỉ tạo một kết quả canonical.
- [x] `CORE-09.04` Chuyển/rời phòng tenant-scope, khóa capacity hai phòng, không duplicate Occupancy và không giải phóng roommate; primary transfer chủ động fail-closed khi chưa đủ settlement/deposit.
- [x] `CORE-09.05` Ledger/cashflow/P&L/owner report dùng chung journal-effect authoritative với semantics POSTED/REVERSED, source mapping và tenant/owner isolation.
- [x] `CORE-09.06` Reconciliation dùng một JournalLine-first dataset cho tenant/owner/building/room/customer/contract/RentalCycle/kỳ; totals/groups/drill-down/source trace cùng financial truth.
- [x] `GATE-09` ngày 13/09/2026: Sol High review PASS sau khi đóng 3 finding; 10 focused spec files đạt 42/42, gồm settlement/lifecycle/renewal/transfer/journal/reporting/reconciliation. Không chạy full regression hoặc CORE-10 tests.

### `CORE-10` — Migration, kiểm thử và rollout

> Gate schema CORE-10.01 đã PASS bằng kiến trúc tách biệt: `homeland_staging_authoritative_v2` là schema authority dựng từ BASELINE-V2; `localhost:5430/homeland` chỉ là legacy data source cho audit/backfill. 18 migration lịch sử và checksum được giữ nguyên; production chưa được apply.

- [x] `CORE-10.01` BASELINE-V2 và manifest 18/18 đã được Sol High review PASS ngày 13/09/2026; không sửa migration/checksum lịch sử. Schema authority `homeland_staging_authoritative_v2` đạt fingerprint `41d9b9c2ce5892f4da23688e2c26ca6dc15fcc3f270ec3b51d5795a227ab0e66`, đủ 72 bảng, 875 cột, 167 constraint, 257 index, 10 function, 10 trigger và migration state sạch 18/18. Backup server-v16 `2026-09-13T03-09-24-779Z` có SHA-256 `903a2927108cb5d69f0d3cad8b299bd3c76615adb9bbe3dd9f5064881830fbaf`; restore cô lập khớp fingerprint/history và DB tạm đã xóa. Legacy `localhost:5430/homeland` không bị sửa, chỉ dùng làm nguồn dữ liệu CORE-10.02. Production apply chưa chạy và vẫn bắt buộc maintenance-window approval.
- [x] `CORE-10.02` Rehearsal dữ liệu trên schema authority đạt Sol High review PASS ngày 13/09/2026 với RUN_ID `core1002-20260913-authority-d`. Source là dump legacy read-only SHA-256 `02b090bbbfdfbaa72137ee7e015f3e78a2ec1db93d5bfc4cb2dab63ec7184c8c`; full-row fingerprint `324c8e0a3e263702646c6eb34904cbace593f9cefe59138b158b6530a1529b97` khóa cả timestamp. Hai dry-run deterministic: 449 nguồn, 400 eligible/insert, 44 reject, 6 review, 2 backfill, 0 conflict/orphan. Keyset batch 25, transaction từng batch, fault sau commit rồi resume và replay cùng RUN_ID đều không duplicate; failed APPLY ghi `TOTAL_FAILED=1`, RESUME thành công ghi `0`. Financial source → expected = target: cọc 128.000.000đ → 100.000.000đ, hóa đơn 65.000.000đ → 44.800.000đ, thu/allocation 38.100.000đ → 28.000.000đ, outstanding 26.900.000đ → 16.800.000đ; delta nằm trong quarantine có ID/lý do. Detector target 0 finding; legacy gốc không bị mutate. DepositLedger/credit/refund và snapshot/run vẫn là review/backfill, không được tự tạo. Production apply chưa chạy.
- [x] `CORE-10.03` Acceptance matrix CORE-04→09 đã được hợp nhất theo current working tree ngày 13/09/2026. Focused rerun các vùng bị invalidated đạt 108/108 (Contracts/Workflow/Payments/Finance), API typecheck PASS và `git diff --check` PASS; fixture chỉ căn theo tenant-scope, ledger, bank và canonical lifecycle, không sửa production. CORE-04/05 đạt 43 PASS + 11 conditional skip; CORE-07 đạt 88 PASS + 7 conditional skip; Web focused đạt 23/23. CORE-08/09 tái sử dụng evidence gate độc lập còn hợp lệ (GATE-08 42/42 + SHARED E2E, GATE-09 42/42) vì production path không đổi sau gate; CORE-08.07 E2E hiện không rerun do thiếu credential/API và được ghi là carry-forward evidence. Không còn P0/P1 test gap trong phạm vi acceptance; `payments.service.spec.ts:1512` không còn chặn typecheck. DepositLedger/credit/refund/BillingSnapshot/MonthlySettlementRun vẫn `BACKFILL_APPROVAL_REQUIRED`, không tự phê duyệt. CORE-10.04 chưa bắt đầu.
- [ ] `CORE-10.04` E2E happy path + mọi ngoại lệ cọc/hợp đồng/hóa đơn/tiền và 11 ảnh vận hành.
- [ ] `CORE-10.05` Dual-read/reconciliation và feature flag theo tenant/tòa nhà trước khi đổi source of truth.
- [ ] `CORE-10.06` Staging UAT OPS/FIN/SALES/OWNER ký duyệt; không còn P0/P1 cốt lõi.
- [ ] `CORE-10.07` Backup pre-cutover, immutable release, smoke, monitoring, GO/NO-GO và rollback drill.
- [ ] `CORE-10.08` Hypercare đối soát tiền/điện/phòng trong 24 giờ, 7 ngày và đóng Big Update.

### Phase tiếp theo — chưa nằm trên critical path Big Update

- [ ] `NEXT-01` Xác minh email, token family/reuse detection, IP lock phân tán và chính sách mật khẩu nâng cao.
- [ ] `NEXT-02` Thay luồng backup/restore JSON UI, storage S3/R2 runtime và retention/off-site nâng cao.
- [ ] `NEXT-03` Tài liệu/phiên bản/chữ ký số và tenant ownership của file đầy đủ.
- [ ] `NEXT-04` Expense/reimbursement/chia lợi nhuận/P&L/dashboard và export nâng cao.
- [ ] `NEXT-05` Zalo/notification nâng cao, CRM, AI/automation, accessibility và tối ưu hạ tầng nhiều instance.

## 2. Baseline đã hoàn thành

| ID | Trạng thái | Kết quả |
|---|---|---|
| `DONE-01` | [x] | API typecheck/unit PASS `195/195`; Web typecheck/unit PASS `49/49` |
| `DONE-02` | [x] | Production bundle, health và readiness local PASS |
| `DONE-03` | [x] | Desktop Playwright PASS `47/47` |
| `DONE-04` | [x] | Chromium mobile `430/390/375` PASS `18/18`, tổng 168 lượt render light/dark |
| `DONE-05` | [x] | Persona/RBAC PASS cho `admin`, `adminA`, `adminB`, `manager` trên release-gate DB |
| `DONE-06` | [x] | Happy path vòng đời cũ từng PASS; **không phải** acceptance cho Big Update vì audit 07–08/09 đã phát hiện lỗi tiền, tenant, snapshot và trạng thái |
| `DONE-07` | [x] | Safety/preflight tests PASS `21/21` sau khi liên kết central go-live TODO |
| `DONE-08` | [x] | Runbook baseline database rỗng và 7 checksum migration đã review |
| `DONE-09` | [x] | SBOM workflow, Gitleaks guard và runtime audit policy đã có trong CI |
| `DONE-10` | [x] | Các mốc `d6e392c`, `04f7cdd`, `e3633b1` đã push lên `origin/main` |

Các kết quả trên chứng minh release candidate local. Chúng không thay thế staging, credential thật, giao dịch thật, backup/restore và phê duyệt GO.

### Tổng quan phần còn lại

Không xem toàn bộ dòng chưa hoàn thành là lỗi code. Baseline local đã hoàn tất 10 mốc; phần còn lại chủ yếu là cấp hạ tầng/credential, nghiệm thu với dữ liệu thật, diễn tập vận hành và ký duyệt. Trạng thái chỉ được cập nhật khi có evidence tương ứng.

| Workstream | P0 còn mở | Đang BLOCKED | Kết luận hiện tại |
|---|---:|---:|---|
| Governance/phạm vi phát hành | 5 | 0 | Chưa gán người thật và lịch go-live |
| Security/runtime/supply chain | 6 | 3 | Chờ GitHub, phê duyệt runtime và triage audit |
| Hạ tầng production/staging | 14 | 0 | Chưa có production topology và staging immutable |
| Dữ liệu/backup/restore | 9 | 0 | Chưa có inventory, off-host backup và restore drill |
| SePay/hai ngân hàng | 7 | 0 | Chưa nghiệm thu giao dịch thật và đối soát hai owner |
| Hunonic/điện/giá điện | 7 | 0 | Chưa nghiệm thu key mới, mapping, sync và giá bằng dữ liệu thật |
| Zalo/Telegram/SMTP | 5 | 0 | Chưa nghiệm thu gửi, retry và escalation trên môi trường thật |
| UAT nghiệp vụ/kế toán/persona/thiết bị | 10 | 0 | Chưa ký staging acceptance và chưa test thiết bị thật |
| Account/bàn giao/audit | 5 | 0 | Chưa cấp credential production riêng cho từng người |
| Monitoring/incident readiness | 6 | 0 | Chưa có dashboard, on-call và diễn tập cảnh báo |
| Cutover/mở traffic | 10 | 0 | Chỉ thực hiện sau khi mọi P0 phía trên PASS |
| **Tổng P0** | **84** | **3** | **87 mục chưa hoàn thành; LIVE NO-GO** |

Sau LIVE còn 10 mục P1 hypercare từ T+1 giờ đến T+30 ngày/định kỳ. Những mục này không thay thế bất kỳ P0 nào trước khi mở traffic.

## 3. Critical path bắt buộc

Thực hiện theo thứ tự. Một phase không được coi là đạt nếu dependency ở phase trước chưa hoàn thành.

1. Governance và security/runtime.
2. Hạ tầng production và staging.
3. Dữ liệu ban đầu, backup và restore drill.
4. Nghiệm thu SePay, Hunonic và notification.
5. UAT nghiệp vụ/kế toán/persona trên staging.
6. Cutover, smoke production và quyết định GO/NO-GO.
7. Hypercare 24 giờ và ổn định 7 ngày.

## 4. P0 - Governance và phạm vi phát hành

| ID | Trạng thái | Owner | Dependency | Việc cần làm | Definition of Done / bằng chứng |
|---|---|---|---|---|---|
| `GOV-01` | [ ] | TL, OWNER-A, OWNER-B | Không | Chỉ định release owner, security owner, DBA, integration owner, người GO/NO-GO và người rollback | Biên bản có tên, số liên hệ, vai trò chính/dự phòng; mọi vai trò đã xác nhận nhận việc |
| `GOV-02` | [ ] | TL, OPS | `GOV-01` | Chọn ngày/giờ go-live, change-freeze, thời lượng maintenance và cửa sổ rollback | Lịch phát hành đã được hai owner và vận hành chấp thuận; có múi giờ và deadline quyết định NO-GO |
| `GOV-03` | [ ] | TL | Security + staging PASS | Chốt release SHA/version/image tag immutable sau cùng | SHA trên Git bằng SHA build-info; API/Web image digest được ghi vào release record |
| `GOV-04` | [ ] | TL | `GOV-03` | Mở evidence package ngoài Git cho release | Có thư mục/record chứa CI, security, backup, staging, UAT, integration, GO/NO-GO; không chứa secret/PII |
| `GOV-05` | [ ] | TL, FIN, OPS | Toàn bộ P0 | Tổ chức cuộc họp GO/NO-GO | Checklist P0 100%, rủi ro còn lại được chấp nhận bằng văn bản, có chữ ký TL/FIN/OPS/OWNER-A/OWNER-B |

## 5. P0 - Security, runtime và supply chain

| ID | Trạng thái | Owner | Dependency | Việc cần làm | Definition of Done / bằng chứng |
|---|---|---|---|---|---|
| `SEC-01` | `BLOCKED` | TL, SEC | Quyền GitHub | Mở GitHub Actions mới nhất của HEAD và xác nhận mọi required job | Lưu run ID/URL; lint, typecheck, unit, integration, build API/Web, Gitleaks, SBOM, Trivy và E2E đều PASS; không suy ra xanh từ local |
| `SEC-02` | `BLOCKED` | TL, SEC, DEV | Phê duyệt đổi phiên bản | Chốt Node runtime thống nhất cho local, CI, Docker và production | ADR ghi phiên bản được phê duyệt, tương thích Next/Nest/Prisma/Puppeteer/ZXing; Docker/CI dùng cùng major; không tự nâng khi chưa duyệt |
| `SEC-03` | `BLOCKED` | SEC, DEV | `SEC-02` | Triage `17 high`, `23 moderate`, `3 low` từ runtime audit gần nhất | Danh sách direct/transitive, đường khai thác, package owner, bản vá/mitigation và deadline; không bỏ qua high/critical bằng allowlist chung |
| `SEC-04` | [ ] | SEC, DEV | `SEC-03` | Sửa toàn bộ high/critical runtime advisory trên branch riêng | `npm audit --omit=dev` có `0 critical`, `0 high`; full regression PASS; lockfile được review; không đổi framework ngoài phạm vi phê duyệt |
| `SEC-05` | [ ] | SEC, INT | Credential Hunonic mới | Rotate Hunonic mobile signing key đã từng xuất hiện trong lịch sử Git | Key cũ bị revoke tại provider; key mới nằm trong secret manager; login/sync PASS; Gitleaks không phát hiện key mới |
| `SEC-06` | [ ] | SEC, INFRA | Secret manager | Lập inventory và rotate toàn bộ secret production | PostgreSQL, Redis, JWT, SePay, Hunonic, Zalo, Telegram, SMTP có owner, created/expiry/rotation date; không dùng giá trị example/local |
| `SEC-07` | [ ] | SEC, INFRA | `SEC-06` | Cấu hình least privilege và network access cho secret/service account | DB app user không có quyền tạo/drop database; integration token đúng scope; secret chỉ được đọc bởi service cần dùng |
| `SEC-08` | [ ] | SEC | `SEC-01` | Xử lý trạng thái CodeQL/GHAS hoặc scanner thay thế đã phê duyệt | Có kết quả SAST cho đúng SHA; P0/P1 security finding đã đóng hoặc có risk acceptance có thời hạn |
| `SEC-09` | [ ] | SEC, TL | `SEC-04..08` | Chạy security gate cuối | Gitleaks, SBOM validate, license scan, SAST, Trivy FS/image, runtime audit đều có artifact; policy job PASS |

## 6. P0 - Hạ tầng production và staging

| ID | Trạng thái | Owner | Dependency | Việc cần làm | Definition of Done / bằng chứng |
|---|---|---|---|---|---|
| `INF-01` | [ ] | INFRA, TL | `GOV-01` | Chốt topology production/staging, sizing và failure domain | Sơ đồ web/API/PostgreSQL/Redis/storage/reverse proxy; CPU/RAM/disk/IOPS; staging tách credential và database production |
| `INF-02` | [ ] | INFRA | Domain được chọn | Cấu hình DNS và HTTPS cho web/API | Certificate hợp lệ, auto-renew test, TLS policy đạt, HTTP redirect HTTPS, domain hiển thị đúng build |
| `INF-03` | [ ] | DBA, INFRA | `INF-01` | Provision PostgreSQL production có extension `vector` | Database identity ghi nhận; `vector` available; app user least privilege; timezone/encoding đúng; connection limit đủ |
| `INF-04` | [ ] | DBA, INFRA | `INF-01` | Provision Redis production có auth và giới hạn mạng | Redis không public, password/TLS/VPN theo kiến trúc, persistence/eviction policy được duyệt, health PASS |
| `INF-05` | [ ] | INFRA, OPS | `INF-01` | Provision attachment/object storage | Storage root bền vững, không nằm trong container ephemeral; quota/retention/checksum/access policy được kiểm tra |
| `INF-06` | [ ] | INFRA, SEC | `INF-02..05`, `SEC-06` | Tạo production env trong secret manager | `NODE_ENV=production`, registration/Swagger tắt, HTTPS/CORS đúng, scheduler chủ động, không có secret trong repo/compose output |
| `INF-07` | [ ] | INFRA | `INF-06` | Chạy production preflight chỉ đọc | `npm.cmd run preflight:prod -- --env-file <secure-file-outside-git>` trả `Configuration: PASS`; report không in secret |
| `INF-08` | [ ] | INFRA | `INF-01` | Cấu hình firewall/reverse proxy/rate limit/body limit | Chỉ port bắt buộc được mở; webhook route hoạt động; upload hợp lệ; header correlation/proxy IP đúng; không lộ internal port |
| `INF-09` | [ ] | INFRA | `INF-01` | Đồng bộ thời gian và timezone | NTP active; timestamp DB/API/log/SePay/Hunonic cùng chuẩn; kiểm tra lệch thời gian dưới ngưỡng đã duyệt |
| `STG-01` | [ ] | INFRA, TL | `SEC-09`, `INF-01..09` | Build và deploy immutable API/Web images lên staging | Image digest gắn đúng SHA; `/health`, `/health/ready`, `/health/build-info` PASS; không dùng `latest` để nghiệm thu |
| `STG-02` | [ ] | DBA, TL | `STG-01` | Baseline/migrate staging theo runbook | Database identity đúng; baseline chỉ khi DB rỗng; `7/7` migration up to date; SQL/checksum/reviewer lưu trong evidence |
| `STG-03` | [ ] | TL, OPS | `STG-02` | Tạo account/dataset staging riêng, không seed production | Có bốn persona staging và dữ liệu UAT không chứa PII thật; password chuyển qua kênh bảo mật |
| `STG-04` | [ ] | DEV, TL | `STG-03` | Chạy toàn bộ `verify:prod` trên staging/release-gate DB | Encoding, safety, typecheck, unit, health, persona preflight, desktop `47/47`, mobile `18/18` PASS cho đúng SHA |
| `STG-05` | [ ] | INFRA, TL | `STG-04` | Diễn tập rollback application trên staging | Rollback về immutable tag trước không sửa schema dữ liệu; health/smoke PASS; thời gian rollback và owner được ghi nhận |

## 7. P0 - Dữ liệu, backup và restore

| ID | Trạng thái | Owner | Dependency | Việc cần làm | Definition of Done / bằng chứng |
|---|---|---|---|---|---|
| `DAT-01` | [ ] | OPS, FIN, DBA | Staging sẵn sàng | Lập inventory dữ liệu mở đầu | Chốt owner/building/room/customer/contract/deposit/invoice/expense/meter/bank cần đưa vào production; có tổng số kỳ vọng |
| `DAT-02` | [ ] | OWNER-A, OWNER-B, OPS | `DAT-01` | Xác nhận owner-building mapping | Tính: LK01-31/LK08-25; Thể: LK01-32/LK08-24 hoặc giá trị Settings mới; hai owner ký xác nhận |
| `DAT-03` | [ ] | FIN, OWNER-A, OWNER-B | `DAT-01` | Chốt số dư đầu kỳ và công nợ | Tiền cọc đang giữ, hóa đơn chưa thu, khoản hoàn chờ, chi phí ứng hộ, tiền cần khấu trừ lợi nhuận có chứng từ và tổng kiểm soát |
| `DAT-04` | [ ] | FIN, DBA | `DAT-03` | Đối chiếu dữ liệu nguồn và dữ liệu nạp | Tổng cọc/công nợ/thu/chi theo owner và bank khớp; bản ghi trùng/thiếu được xử lý bằng script review, không sửa tay không log |
| `BKP-01` | [ ] | DBA, INFRA | Storage off-host | Chọn off-host backup destination và retention | Có encryption, immutable/version policy, quyền restore tách biệt, retention tối thiểu theo BACKUP.md |
| `BKP-02` | [ ] | DBA | `BKP-01`, staging | Tạo PostgreSQL dump và attachment manifest | Dump custom format theo timestamp; `pg_restore --list` PASS; SHA-256 và object manifest được lưu; không ghi đè backup trước |
| `BKP-03` | [ ] | DBA, TL | `BKP-02` | Restore drill trên môi trường cô lập | Restore PASS, migration status/health/smoke PASS, record count và tài chính đối chiếu đúng, RPO/RTO đo được |
| `BKP-04` | [ ] | DBA, OPS | `BKP-03` | Chốt backup schedule và owner kiểm tra | Lịch tự động, cảnh báo backup stale/fail, người kiểm tra hằng ngày/tuần và thủ tục restore được ký nhận |
| `DAT-05` | [ ] | DBA, FIN, OPS | `DAT-04`, `BKP-03` | Dry-run cutover dữ liệu trên staging | Thời lượng nằm trong maintenance window; report before/after khớp; có rollback/forward-fix plan; không dùng reset/force |

## 8. P0 - Nghiệm thu SePay và hai tài khoản ngân hàng

| ID | Trạng thái | Owner | Dependency | Việc cần làm | Definition of Done / bằng chứng |
|---|---|---|---|---|---|
| `SEP-01` | [ ] | INT, SEC, OWNER-A, OWNER-B | `SEC-06`, staging | Cấu hình hai bank account và SePay credential | Mỗi bank active có owner đúng, account label/mã nhận diện đúng, secret ngoài Git, admin vận hành không sửa token |
| `SEP-02` | [ ] | INT, INFRA | `SEP-01`, HTTPS staging | Cấu hình webhook và signature validation | HTTPS endpoint nhận đúng, reject signature sai, log correlation ID, retry không tạo giao dịch trùng |
| `SEP-03` | [ ] | FIN, INT | `SEP-02` | Test giao dịch giá trị nhỏ cho OWNER-A | QR/payment code đúng bank A; webhook match đúng invoice/deposit; cash/accounting/audit cập nhật một lần |
| `SEP-04` | [ ] | FIN, INT | `SEP-02` | Test giao dịch giá trị nhỏ cho OWNER-B | QR/payment code đúng bank B; webhook match đúng invoice/deposit; cash/accounting/audit cập nhật một lần |
| `SEP-05` | [ ] | FIN, INT | `SEP-03..04` | Test thiếu, thừa, sai bank, sai nội dung, outgoing và gán tay | Mỗi tình huống vào đúng hàng chờ/trạng thái; action availability đúng; không tự ghi nhận doanh thu sai owner |
| `SEP-06` | [ ] | FIN, INT | `SEP-05` | Test hoàn tiền thừa/chờ hoàn/hoàn tất | Refund amount/note/audit đúng; không tăng cash collected; pending -> completed đúng một lần |
| `SEP-07` | [ ] | FIN, OWNER-A, OWNER-B | `SEP-03..06` | Đối soát website với sao kê hai bank | Tổng thu theo bank/owner/payment code khớp; chênh lệch bằng 0 hoặc có ticket có owner/deadline |

## 9. P0 - Nghiệm thu Hunonic, điện và giá điện

| ID | Trạng thái | Owner | Dependency | Việc cần làm | Definition of Done / bằng chứng |
|---|---|---|---|---|---|
| `HUN-01` | [ ] | INT, SEC | `SEC-05`, staging | Cấu hình access/secret mới và login mobile API | Login/signed request PASS, không in token/cookie, key cũ bị revoke |
| `HUN-02` | [ ] | OPS, INT | `HUN-01`, `DAT-02` | Xác nhận mapping công tơ -> tòa/phòng | Toàn bộ meter LK01-31/LK01-32 map duy nhất; Văn Phòng LK01-32 đúng meter; orphan/duplicate bằng 0 |
| `HUN-03` | [ ] | INT, DBA | `HUN-02` | Chạy manual sync 6 tháng gần nhất | Đủ kỳ, không duplicate theo unique key, số bản ghi/room/month có report, retry idempotent |
| `HUN-04` | [ ] | INT, OPS | `HUN-03` | Chạy scheduler 1 giờ/lần tối thiểu 24 giờ staging | Không overlap job, không duplicate, last-sync/failed-sync hiển thị, lỗi provider retry có backoff/log |
| `HUN-05` | [ ] | DBA, OPS | `HUN-03` | Xác nhận retention/query 3 năm | Filter/search month/year/room/meter nhanh và đúng; backup bao phủ readings; khóa kỳ không bị sync ghi đè |
| `HUN-06` | [ ] | FIN, OPS | `HUN-02..05` | Nghiệm thu giá EVN/tự thiết lập theo một/nhiều công tơ | Mode lưu bền, giá custom không về 0, giá hiển thị toàn cột, invoice/room profile dùng cùng kết quả |
| `HUN-07` | [ ] | FIN, OPS | `HUN-06` | Đối chiếu ít nhất 3 phòng x 3 kỳ bằng tính tay | Chỉ số đầu/cuối, kWh, đơn giá, tiền điện và rounding khớp; có người kiểm và chữ ký |

## 10. P0 - Notification và kênh liên lạc

| ID | Trạng thái | Owner | Dependency | Việc cần làm | Definition of Done / bằng chứng |
|---|---|---|---|---|---|
| `NOT-01` | [ ] | INT, SEC | `SEC-06`, staging | Cấu hình Zalo, Telegram và SMTP production/staging | Credential đúng môi trường, secret ngoài Git, recipient test được duyệt, không gửi PII tới nhóm công khai |
| `NOT-02` | [ ] | OPS, INT | `NOT-01` | Review template và trigger | Cọc, hóa đơn, đến hạn/quá hạn, hợp đồng sắp hết, thanh toán, hoàn tiền có nội dung tiếng Việt đúng và đúng đối tượng |
| `NOT-03` | [ ] | INT | `NOT-02` | Test gửi thành công trên cả ba kênh | Message ID/status/timestamp lưu; link/amount/customer mask đúng; không gửi trùng |
| `NOT-04` | [ ] | INT, OPS | `NOT-03` | Test provider timeout/failure/retry/dead-letter | Retry có giới hạn/backoff; lỗi hiển thị queue; operator có thể xử lý lại; audit không mất |
| `NOT-05` | [ ] | OPS, FIN | `NOT-03..04` | Xác nhận SLA và escalation notification | Có owner cho message fail/quá hạn; quy định không dùng notification thành bằng chứng thanh toán thay SePay/bank |

## 11. P0 - UAT nghiệp vụ, kế toán, persona và thiết bị

| ID | Trạng thái | Owner | Dependency | Việc cần làm | Definition of Done / bằng chứng |
|---|---|---|---|---|---|
| `UAT-01` | [ ] | OPS, SALES, FIN | `STG-04`, integrations staging | Chạy luồng chuẩn end-to-end | Chọn phòng -> cọc -> SePay -> hợp đồng -> hóa đơn -> điện/nước -> thanh toán -> chi phí -> quyết toán -> vệ sinh -> trống; không sửa DB tay |
| `UAT-02` | [ ] | OPS, FIN | `UAT-01` | Chạy ngoại lệ cọc | Cọc chưa thu, hoàn toàn phần/một phần, giữ cọc, khấu trừ phí, pending refund/completed refund đúng chứng từ/audit |
| `UAT-03` | [ ] | OPS, FIN | `UAT-01` | Chạy trả phòng sớm và quyết toán | Tiền thuê theo ngày, hỗ trợ/hoàn tiền phòng, điện/nước sớm, công nợ/cọc, CLEANING/MAINTENANCE/AVAILABLE đúng |
| `UAT-04` | [ ] | FIN | `SEP-*`, `HUN-*`, `UAT-01..03` | Nghiệm thu kế toán và chia lợi nhuận | Tổng thu/chi/còn lại, người ứng tiền, owner chịu chi, hoàn ứng/khấu trừ, deposit held/refund/credit khớp sổ kiểm soát |
| `UAT-05` | [ ] | OWNER-A | `UAT-04` | Owner A nghiệm thu dashboard/tòa/bank/lợi nhuận | Chỉ thấy/quản lý đúng phạm vi đã duyệt; số liệu và audit đúng; ký acceptance |
| `UAT-06` | [ ] | OWNER-B | `UAT-04` | Owner B nghiệm thu dashboard/tòa/bank/lợi nhuận | Chỉ thấy/quản lý đúng phạm vi đã duyệt; số liệu và audit đúng; ký acceptance |
| `UAT-07` | [ ] | OPS, TL | `STG-03` | Nghiệm thu RBAC account thật | Admin vận hành không sửa token; owner A/B sửa token; manager không vào Settings; sales/finance đúng quyền nếu đưa vào vận hành |
| `UAT-08` | [ ] | OPS | `STG-04` | UAT thiết bị Android/iOS thật | Chrome Android và Safari iOS: login, theme, Buildings 3D/2.5D, phòng, hợp đồng, chi phí, table/modal/toast không vỡ/overflow |
| `UAT-09` | [ ] | DEV, OPS | WebKit browser được phê duyệt/cài | Chạy Playwright WebKit hoặc BrowserStack/device farm | Public/auth route light/dark PASS; lỗi khác Chromium được đóng; artifact gắn đúng SHA |
| `UAT-10` | [ ] | OPS, FIN, TL | `UAT-01..09` | Ký staging acceptance | Danh sách testcase PASS, issue còn lại không có P0/P1, acceptance có TL/OPS/FIN/OWNER-A/OWNER-B |

## 12. P0 - Account, bàn giao và audit

| ID | Trạng thái | Owner | Dependency | Việc cần làm | Definition of Done / bằng chứng |
|---|---|---|---|---|---|
| `ACC-01` | [ ] | TL, OPS, SEC | Production sẵn sàng | Tạo account production riêng | `admin`, `adminA`, `adminB`, `manager` và sales/finance nếu dùng; không dùng chung account; email/role đúng |
| `ACC-02` | [ ] | SEC, OPS | `ACC-01` | Bàn giao mật khẩu tạm qua password manager | Mỗi account mật khẩu riêng, must-change bật, không gửi trong Git/chat/log; người nhận xác nhận |
| `ACC-03` | [ ] | Mỗi user | `ACC-02` | Đổi mật khẩu lần đầu và đăng nhập lại | Must-change tắt sau đổi; refresh token cũ bị thu hồi; audit có đúng user/IP/user-agent |
| `ACC-04` | [ ] | OPS, SEC | `ACC-03` | Test quy trình khóa/thu hồi account | Disable account trả 401/403; refresh token bị revoke; SOP nhân sự nghỉ/đổi vai trò được ghi nhận |
| `ACC-05` | [ ] | OPS, TL | `ACC-03..04` | Review audit log | Login success/fail, tiền, hợp đồng, phòng, owner, Settings/token truy được đúng actor/correlation ID; không chứa secret |

## 13. P0 - Monitoring, cảnh báo và incident readiness

| ID | Trạng thái | Owner | Dependency | Việc cần làm | Definition of Done / bằng chứng |
|---|---|---|---|---|---|
| `OBS-01` | [ ] | INFRA | Production network | Prometheus scrape API metrics | Target UP qua private network; metric HTTP/latency/error có label hợp lệ; endpoint không public |
| `OBS-02` | [ ] | INFRA, SEC | `OBS-01` | Bảo vệ Grafana/Prometheus/Loki/Tempo/Alertmanager | TLS/auth/VPN, password mặc định đã đổi, secret trong secret manager |
| `OBS-03` | [ ] | INFRA, OPS | `OBS-01` | Cấu hình dashboard và alert thiết yếu | API down/5xx/latency, DB/Redis readiness, disk, backup stale, webhook unmatched/duplicate, Hunonic sync fail, notification queue |
| `OBS-04` | [ ] | OPS, INFRA | `OBS-03`, `GOV-01` | Cấu hình người trực và escalation | Primary/backup, kênh critical/warning, SLA acknowledge/resolve và quyền dừng reconciliation/write |
| `OBS-05` | [ ] | INFRA, OPS | `OBS-04` | Test alert fire và resolved | Critical alert tới ít nhất hai người/kênh; resolved tới đúng nơi; timestamp/correlation/evidence đầy đủ |
| `OBS-06` | [ ] | TL, OPS, FIN | `OBS-05` | Diễn tập incident tài chính | Tình huống payment duplicate/sai owner: dừng xử lý, giữ evidence, đối soát, forward-fix, thông báo owner; không sửa DB tay |

## 14. P0 - Cutover và mở LIVE

| ID | Trạng thái | Owner | Dependency | Việc cần làm | Definition of Done / bằng chứng |
|---|---|---|---|---|---|
| `REL-01` | [ ] | TL | Mọi staging/UAT/security P0 PASS | Đóng change-freeze và chốt SHA/tag/digest | Working tree release sạch, CI đúng SHA xanh, release note/known issue/rollback tag có trong evidence |
| `REL-02` | [ ] | DBA, INFRA | `BKP-03`, `REL-01` | Tạo backup ngay trước cutover | Dump/attachment manifest/checksum/off-host upload PASS; backup ID và restore point ghi nhận |
| `REL-03` | [ ] | DBA, TL | `REL-02` | Kiểm tra migration trước deploy | `prisma migrate status`, database identity, disk capacity, maintenance/write policy được xác nhận; không dùng reset/db push |
| `REL-04` | [ ] | INFRA, TL | `REL-03` | Deploy immutable API/Web image | Đúng digest đã staging; env production; migration opt-in một lần nếu cần rồi trả `RUN_DB_MIGRATIONS=false` |
| `REL-05` | [ ] | INFRA, TL | `REL-04` | Chạy technical smoke | Health/readiness/build-info, login, CORS/TLS, route chính, log 5xx, DB/Redis/storage PASS |
| `REL-06` | [ ] | OPS, FIN | `REL-05` | Chạy production persona smoke | Bốn persona login/đổi mật khẩu/quyền đúng; chỉ tạo dữ liệu/giao dịch nhỏ đã phê duyệt |
| `REL-07` | [ ] | FIN, INT | `REL-06` | Chạy một giao dịch nhỏ mỗi owner | SePay bank A/B, invoice/payment/audit/dashboard khớp; không duplicate; hoàn test nếu quy trình yêu cầu |
| `REL-08` | [ ] | OPS, INT | `REL-06` | Chạy Hunonic + notification production smoke | Sync một phạm vi nhỏ không ghi đè kỳ khóa; gửi test Zalo/Telegram/SMTP tới recipient đã duyệt |
| `REL-09` | [ ] | TL, FIN, OPS, OWNER-A, OWNER-B | `REL-01..08`, `GOV-05` | Ký GO và mở traffic | Tất cả P0 `[x]`, dashboard/alerts xanh, backup dùng được; thời điểm GO và người phê duyệt ghi nhận |
| `REL-10` | [ ] | TL, INFRA | Bất kỳ smoke fail | Thực thi NO-GO/rollback | Dừng traffic/write liên quan, rollback image tag, giữ schema/evidence, health PASS; không reset/restore nếu chưa phê duyệt sự cố |

## 15. P1 - Hypercare và vận hành ổn định

| ID | Trạng thái | Owner | Deadline | Việc cần làm | Definition of Done / bằng chứng |
|---|---|---|---|---|---|
| `HC-01` | [ ] | OPS, INFRA | T+1h | Theo dõi health/5xx/latency/DB/Redis/disk | Không critical alert chưa xử lý; baseline metric được lưu |
| `HC-02` | [ ] | FIN, INT | Mỗi giờ trong 24h | Kiểm tra SePay unmatched/duplicate/sai bank | Queue trong SLA; mọi chênh lệch có ticket/owner; không có tiền ghi trùng |
| `HC-03` | [ ] | OPS, INT | Mỗi giờ trong 24h | Kiểm tra Hunonic sync và notification queue | Job đúng lịch, không duplicate, failed queue trong SLA |
| `HC-04` | [ ] | DBA | T+24h | Xác nhận backup production đầu tiên | Dump/manifest/checksum/off-host PASS; backup freshness alert xanh |
| `HC-05` | [ ] | FIN, OWNER-A, OWNER-B | T+24h | Đối soát tổng thu/chi/còn lại theo owner/bank | Hai owner xác nhận; chênh lệch bằng 0 hoặc có RCA/ticket |
| `HC-06` | [ ] | OPS, TL | T+24h | Review audit/login/permission | Không shared account, không unauthorized Settings/token change, không secret trong log |
| `HC-07` | [ ] | OPS, TL | T+3 ngày | Đào tạo và bàn giao SOP | Sales/manager/finance/owner thực hiện được luồng chuẩn, ngoại lệ, incident và escalation |
| `HC-08` | [ ] | TL, OPS, FIN | T+7 ngày | Kết thúc hypercare | Không P0/P1 mở, SLO đạt, backup/alerts/integrations ổn định, ký biên bản chuyển BAU |
| `HC-09` | [ ] | SEC, TL | T+30 ngày | Review quyền và secret rotation | Account/role còn đúng; token hết hạn được rotate; offboard test PASS |
| `HC-10` | [ ] | DBA, INFRA | Theo quý | Restore drill định kỳ | RPO/RTO đo và đạt; đối chiếu dữ liệu/tài chính PASS; action item có owner |

## 16. Lịch thực hiện khuyến nghị

### T-14 đến T-7

- Hoàn thành `GOV-*`, `SEC-*`, `INF-*`.
- Dựng staging và chạy `STG-01..05`.
- Chốt inventory dữ liệu và mapping owner/bank/meter.

### T-7 đến T-3

- Hoàn thành backup/restore drill và dry-run dữ liệu.
- Nghiệm thu SePay, Hunonic, notification.
- Chạy UAT chuẩn/ngoại lệ/kế toán/thiết bị thật.
- Đóng mọi bug P0/P1 và chạy lại full gate.

### T-2 đến T-1

- Change-freeze, chốt release SHA/digest.
- Chạy CI/security cuối, backup pre-cutover rehearsal.
- Bàn giao credential và xác nhận on-call/rollback.
- Họp GO/NO-GO sơ bộ; còn P0 là NO-GO.

### T0

- Thực hiện `REL-01..08` theo maintenance window.
- Họp GO/NO-GO cuối; chỉ `REL-09` khi toàn bộ P0 `[x]`.
- Nếu có bất kỳ trigger NO-GO, thực hiện `REL-10`, không cố sửa dữ liệu trực tiếp.

### T+1 đến T+7

- Thực hiện `HC-01..08`.
- Chỉ kết thúc hypercare khi kế toán, owner, integration, backup và monitoring ổn định.

## 17. Trigger NO-GO bắt buộc

Không mở hoặc phải dừng LIVE khi có một trong các điều kiện:

- GitHub required job/security gate đỏ hoặc chưa xác nhận đúng SHA.
- Runtime audit còn critical/high chưa được risk acceptance có thời hạn và phê duyệt đúng thẩm quyền.
- Secret production dùng giá trị local/example, key Hunonic cũ chưa revoke hoặc phát hiện secret trong Git/log.
- Staging full gate không PASS, build-info khác release SHA hoặc image không immutable.
- Backup chưa off-host, `pg_restore --list` lỗi hoặc restore drill chưa PASS.
- SePay sai bank/owner, webhook duplicate, giao dịch nhỏ không đối soát được.
- Hunonic duplicate/thiếu dữ liệu, mapping meter sai, kỳ khóa bị ghi đè hoặc giá điện tính sai.
- Dashboard tổng thu/chi/còn lại không khớp kế toán/sao kê/owner.
- Bốn persona/RBAC/must-change/audit chưa PASS bằng credential thật.
- Health/readiness/DB/Redis/storage lỗi, critical alert không tới người trực hoặc không có rollback owner.
- Có bug P0/P1 nghiệp vụ, mất dữ liệu, sai tiền, sai cọc, sai hợp đồng hoặc sai trạng thái phòng chưa đóng.

## 18. Evidence package tối thiểu

| Nhóm | Bằng chứng bắt buộc |
|---|---|
| Release | SHA, version, API/Web image digest, build-info |
| CI/Security | Actions run URL/ID, audit JSON, SBOM checksum, Gitleaks/SAST/Trivy/license result |
| Database | Identity, migration status, baseline/migration review, backup ID/checksum, restore drill |
| Staging | Health, full production gate, desktop/mobile artifacts, rollback drill |
| SePay | Hai bank/owner test, webhook idempotency, exception/refund, reconciliation |
| Hunonic | Credential rotation, meter mapping, 6-month sync, hourly sync, pricing/retention/locked period |
| Notification | Zalo/Telegram/SMTP success/failure/retry logs |
| UAT | Standard/exception/accounting/persona/device test cases và chữ ký |
| Operations | Monitoring dashboard, fire/resolved alert, on-call/escalation, incident drill |
| Go-live | Pre-cutover backup, smoke, GO/NO-GO record, hypercare 24h/7d |

## 19. Việc cần làm ngay tiếp theo

1. Gán người thật cho `GOV-01` và chốt quyền truy cập GitHub Actions.
2. Phê duyệt hướng xử lý Node/dependency cho `SEC-02`; không đổi phiên bản trước phê duyệt.
3. Mở run CI mới nhất và lấy artifact audit để thực hiện `SEC-01`, `SEC-03`.
4. Rotate Hunonic mobile key theo `SEC-05`.
5. Chọn hạ tầng/domain/secret manager, thực hiện `INF-01..09`.
6. Deploy staging immutable, baseline DB và chạy full gate `STG-01..05`.
7. Sau đó mới nghiệm thu tiền/điện/notification, dữ liệu, backup, UAT và cutover.
