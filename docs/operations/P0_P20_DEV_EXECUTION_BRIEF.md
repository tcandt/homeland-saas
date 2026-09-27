# Homeland — Yêu cầu thực thi P0–P20 cho team phát triển

Ngày cập nhật: 26/09/2026  
Phạm vi: chỉ P0–P20 trên dashboard `maps/index.html`  
Source of truth phát hành: [`GO_LIVE_TODO.md`](./GO_LIVE_TODO.md)

## Mục tiêu

Đóng lần lượt các phase P0–P20 của vòng đời thuê: chọn phòng/khách → cọc hoặc hợp đồng → hóa đơn/thu tiền → chốt tháng → gia hạn/tất toán → báo cáo → E2E/UAT/release. Không phase nào được gọi là hoàn thành chỉ vì code đã có hoặc checkbox local đã được tick.

Dashboard để giao việc: [`maps/index.html`](../../maps/index.html). Mỗi phase đang mở có ba task, owner và điều kiện `Xong khi`.

## Quy tắc bắt buộc

1. Chỉ nhận task theo thứ tự dependency dưới đây. Không tự mở P17–P20 để “đóng cho đủ” khi phase nghiệp vụ trước chưa có evidence.
2. Một task tiền/cọc/hóa đơn/hoàn tiền phải giữ nguyên tính nguyên tử, tenant isolation, idempotency và audit. Không dùng refactor cơ hội để mở rộng scope.
3. Không chạy migration/backfill, `db push`, reset database hoặc gửi giao dịch thật vào production. Các việc đó chỉ do người có quyền thực hiện trong gate được chỉ định.
4. Không đưa credential, PII, CCCD, số tài khoản, webhook secret hoặc payload thật chưa mask vào Git, ảnh, log hoặc báo cáo.
5. Checkbox trên `maps/index.html` chỉ lưu local browser để điều phối. Dev chỉ tick sau khi có evidence; release owner mới cập nhật status chính thức trong `GO_LIVE_TODO.md`.
6. Một task bị chặn bởi staging, credential, provider, backup hoặc owner approval phải báo `BLOCKED` ngay, kèm điều kiện cần mở chặn. Không thay bằng mock rồi báo PASS, trừ fixture mock được owner cho phép rõ trong `SCP-01`; khi đó chỉ là software verification, không phải provider/production acceptance.

## Thứ tự thực thi bắt buộc

| Đợt | Thứ tự | Gate để sang đợt sau |
|---|---|---|
| 1 | `P0 → P1` | Context phòng và tenant identity không thể lệch/trùng trên E2E. |
| 2 | `P3 → P4` | Cọc/HĐ/hóa đơn/QR nguyên tử, replay-safe và đúng cycle. |
| 3 | `P5 → P6 → P7` | Finance đồng bộ; thu tiền, NEEDS_REVIEW và hoàn cọc có chứng từ/audit. |
| 4 | `P10 → (P8 + P9)` | Occupancy/RentalCycle là nguồn chuẩn trước UAT WHOLE và SHARED song song. |
| 5 | `P11 → P12` | Hunonic mock snapshot khóa kỳ đạt trước monthly invoice trong đợt này; provider UAT được deferred theo `SCP-01`. |
| 6 | `(P13 + P14) → P16` | Reminder/renewal có evidence, sau đó FIN đối soát báo cáo. |
| 7 | `P17 → P18` | E2E đầy đủ, rồi UAT staging có ký duyệt. |
| 8 | `P19` | `DEFERRED (OWNER)` cho đợt sau: không phát triển backup/restore/rollback hoặc nâng phiên bản trong đợt này. |
| 9 | `P20` | Chỉ production GO/NO-GO sau khi P17/P18 PASS và P19 được mở lại, PASS. |

`P2` và `P15` đã có DoD ở phạm vi core; không sửa để tăng scope. Bắt buộc tái kiểm chúng trong E2E P17.

## Work packages cho dev

### Đợt 1 — Khởi tạo khách thuê

| ID | Owner | Yêu cầu | Xong khi |
|---|---|---|---|
| P0.1 | DEV | Chuẩn hóa rental intent ở mọi điểm mở popup phòng. | `roomId/buildingId/floorId/rentalType` không cũ sau cancel/reopen. |
| P0.2 | QA | E2E đổi phòng, hủy/chọn lại khi request hồ sơ đang chạy. | Không ghi nhầm khách/phòng; có trace Playwright. |
| P0.3 | QA | Test double-click/retry command tạo thuê. | Chỉ một command được chấp nhận sau reload. |
| P1.1 | DBA | Chạy migration normalized phone/CCCD trên PostgreSQL cô lập. | Constraint/index đúng; log không chứa PII. |
| P1.2 | DEV | Backfill/dupe-review tenant-scoped. | Duplicate có merge/quarantine decision, không tự gộp khách. |
| P1.3 | QA | E2E khách cũ/khách mới ở hai tenant. | Không lộ/chọn nhầm/tạo trùng định danh. |
| P2 | DEV | Giữ ranh giới BOOKING/ở ngay đã đạt. | Regression P17 vẫn có hai intent và chỉ một submit. |

### Đợt 2 — Cọc, hợp đồng và hóa đơn đầu kỳ

| ID | Owner | Yêu cầu | Xong khi |
|---|---|---|---|
| P3.1 | DEV | Kiểm tra transaction BOOKING và ở ngay. | Deposit/Hold/Cycle/Contract/Outbox/Audit cùng commit hoặc rollback. |
| P3.2 | QA | Replay cùng idempotency key và payload khác cùng key. | Replay trả canonical result; payload khác bị từ chối. |
| P3.3 | QA | Ép lỗi giữa transaction/reload popup. | Không còn resource mồ côi. |
| P4.1 | FIN | Chốt expected amount đầu kỳ. | Có ma trận prorate, cọc cấn, thiếu/thừa và reissue. |
| P4.2 | DEV | Chống thu hai lần khi retry/issue lại. | Một invoice family/payment request hiệu lực. |
| P4.3 | QA | E2E popup → invoice → QR → payment code. | QR đúng amount/customer/cycle sau refresh. |

### Đợt 3 — Thu tiền, finance và hoàn cọc

| ID | Owner | Yêu cầu | Xong khi |
|---|---|---|---|
| P5.1 | WEB | Invalidate dữ liệu sau create/pay/refund/expense. | Invoice/deposit/transaction/KPI/P&L refetch đúng scope. |
| P5.2 | QA | Kiểm tra hai tab browser sau mutation tiền. | Không còn số cũ khi tab quay lại foreground. |
| P5.3 | FIN | Đối chiếu UI với finance authoritative. | Mở được source record theo room/cycle/bank/owner. |
| P6.1 | DEV | Test cash+QR, QR cũ, sai memo, thiếu/thừa, transaction trùng. | CONFIRMED/NEEDS_REVIEW đúng rule; không mất tiền. |
| P6.2 | INT | Bắn SePay sandbox có payment code hợp lệ. | Webhook xác thực, match đúng invoice/deposit, có provider reference. |
| P6.3 | FIN | Duyệt NEEDS_REVIEW thủ công. | Allocation/credit/refund/journal không double-post khi retry; upload chứng từ khách chuyển khoản là `SCP-02` deferred. |
| P7.1 | DEV | UAT hoàn toàn bộ/một phần/không hoàn. | `refund + keep + deduct = available balance`. |
| P7.2 | FIN | Đính chứng từ và hoàn tất cash-out. | PENDING không hiển thị đã trả; COMPLETED có audit. |
| P7.3 | QA | Test retry/đồng thời/notification. | Không chi hai lần; khách và Admin thấy trạng thái cuối. |

### Đợt 4 — Source of truth, WHOLE và SHARED

| ID | Owner | Yêu cầu | Xong khi |
|---|---|---|---|
| P10.1 | DEV | Inventory consumer còn dùng `customer.roomId` như source chính. | Có owner/test regression cho mỗi caller. |
| P10.2 | DEV | Chuyển consumer sang Occupancy/RentalCycle. | Projection chỉ hiển thị; binding thiếu fail-closed. |
| P10.3 | DBA | Lập dry-run/backfill legacy. | Có reconciliation/quarantine và approval trước apply. |
| P8.1 | DEV | Guard payer/occupant WHOLE trong create/transfer/terminate. | Một đại diện nhận nghĩa vụ, thành viên không thành payer sai. |
| P8.2 | FIN | Expected bill WHOLE. | Điện/nước/phí/headcount đúng biên kỳ, QR gửi payer. |
| P8.3 | OPS | UAT đổi đại diện/thành viên. | History/chứng từ/audit cũ bất biến. |
| P9.1 | DEV | Race test suất cuối SHARED. | Capacity/Hold/Occupancy không vượt giới hạn hoặc trùng HĐ. |
| P9.2 | FIN | Đối chiếu phân bổ từng hợp đồng. | Tổng phân bổ bằng tổng phòng, không cross-charge. |
| P9.3 | OPS | UAT roommate từ vào ở tới rời phòng. | Người rời không đóng occupancy/hóa đơn roommate. |

### Đợt 5 — Hunonic và hóa đơn tháng

| ID | Owner | Yêu cầu | Xong khi |
|---|---|---|---|
| P11.1 | INT | Duy trì fixture Hunonic mock có provenance. | Fixture bao phủ meter/kỳ/unit/scale/đầu-cuối/rate mode; UAT provider thật là `SCP-01` deferred. |
| P11.2 | DEV | Xử lý missing/changed/late reading. | Dữ liệu chưa xác minh fail-closed; LOCKED snapshot bất biến. |
| P11.3 | QA | Test retry và close-month đồng thời. | Một snapshot/run canonical; exact retry replay. |
| P12.1 | FIN | Tạo expected billing WHOLE/SHARED từ mock snapshot. | Rent/điện/nước 100k/phí/rounding được ký đối chiếu; upload chứng từ khách chuyển khoản là `SCP-02` deferred. |
| P12.2 | DEV | Phát hành `MONTHLY_BASE` từ snapshot khóa. | Payer/cycle/period/snapshot link/QR đủ và đúng. |
| P12.3 | QA | Rerun job, đổi occupancy, overdue ba ngày. | Không overwrite ISSUED/PAID; mỗi reminder tối đa một lần/ngày. |

### Đợt 6 — Nhắc hạn, gia hạn và báo cáo

| ID | Owner | Yêu cầu | Xong khi |
|---|---|---|---|
| P13.1 | INT | UAT Zalo/Admin/kênh bật thật. | Có message ID, delivery/retry và dữ liệu mask đúng. |
| P13.2 | QA | Test UTC+7, duplicate và overdue. | Đầu tháng 08:00/daily/escalation ba ngày đúng. |
| P13.3 | OPS | Duyệt template/quy trình notify lỗi. | Có owner escalation và evidence delivery cuối. |
| P14.1 | DEV | Task tenant-backed sau gia hạn. | Có contract/cycle/customer/assignee/deadline/status audit. |
| P14.2 | OPS | Evidence tạm trú sau gia hạn. | File/timestamp server-backed, không dùng localStorage. |
| P14.3 | QA | E2E renewal liên tiếp. | Kỳ/HĐ cũ bất biến; retry tạo đúng một successor. |
| P15 | DEV + FIN | Giữ DoD tất toán hiện hành. | P17 tái kiểm nợ/phí/cọc/occupancy/history terminal. |
| P16.1 | FIN | Chốt dataset đối soát report. | Basis/filter cashflow/P&L/revenue/aging/cọc nhất quán. |
| P16.2 | QA | Playwright drill-down/export dữ liệu lớn. | Filter giữ tới source record và file export. |
| P16.3 | DEV | Kiểm tra cap client/performance. | Aggregate authoritative, đúng và phù hợp dữ liệu thật. |

### Đợt 7 — E2E, UAT và release

| ID | Owner | Yêu cầu | Xong khi |
|---|---|---|---|
| P17.1 | OPS | Cấp staging URL, persona credential, isolated DB. | Fixture/run ID/cleanup có record; không dùng production. |
| P17.2 | QA | Chạy CORE-10.04 toàn ma trận lifecycle. | Happy path và ngoại lệ tiền/cọc/HĐ có trace/log PASS. |
| P17.3 | QA + DEV | Lưu 11 ảnh và rerun finding. | Ảnh có URL/run ID/timestamp; P0/P1 retest PASS. |
| P18.1 | OPS | Sync ba tháng dữ liệu ẩn danh. | Mapping mẫu, mask PII, đối chiếu số lượng trước/sau. |
| P18.2 | INT + FIN | UAT SePay payment-code match; Hunonic dùng mock theo `SCP-01`. | SePay đối soát >=99%; mismatch có owner/resolution. Hunonic provider không được ghi PASS trong đợt này. |
| P18.3 | OPS + FIN + SALES + OWNER | Ký acceptance staging. | Không còn P0/P1; scope/date/known risks có chữ ký. |
| P19.1 | INFRA | `DEFERRED (OWNER)`: production preflight immutable release. | Mở lại đợt sau; config/secret/migration/health/monitoring PASS không lộ secret. |
| P19.2 | DBA | `DEFERRED (OWNER)`: backup off-host + isolated restore drill. | Mở lại đợt sau; manifest/checksum/RPO/RTO/financial totals đúng. |
| P19.3 | TL + INFRA | `DEFERRED (OWNER)`: rollback manual, smoke, alert và nâng phiên bản. | Mở lại đợt sau; về đúng SHA, service healthy, on-call xác nhận. |
| P20.1 | TL | Đối chiếu mọi P0 trong source of truth. | Evidence PASS/risk approval cho từng mục. |
| P20.2 | TL + INFRA | Khóa SHA/tag/release/on-call. | Artifact immutable, dashboard/alerts xanh, rollback tag sẵn sàng. |
| P20.3 | FIN + OPS + OWNER | GO/NO-GO và mở traffic. | Chỉ production GO sau P17/P18 PASS, P19 được mở lại/PASS và đủ chữ ký. |

## Yêu cầu bàn giao cho mỗi task

Dev không chỉ gửi “đã xong”. Mỗi task phải nộp đúng mẫu sau:

```text
TASK: Pxx.y
OWNER:
SCOPE/FILES:
CHANGE: mô tả ngắn logic đã đổi
TEST: lệnh đã chạy + kết quả pass/fail/skip
E2E/UAT: run ID, URL môi trường và ảnh/trace đã mask (nếu áp dụng)
EVIDENCE: đường dẫn report, log, audit ID hoặc PR/commit
RISK/BLOCKER: không có | mô tả + owner cần mở chặn
DECISION REQUESTED: chỉ điền khi cần FIN/OPS/OWNER quyết định
```

Release owner chỉ tick task trên dashboard sau khi review evidence; chỉ release owner mới đổi phase/status trong `GO_LIVE_TODO.md`.

## Điều kiện báo BLOCKED

Phải báo `BLOCKED`, thay vì tự giả lập PASS, nếu gặp một trong các tình huống:

- Thiếu staging URL, isolated DB, persona credential hoặc quyền provider.
- Chưa có payment code SePay match thật; với Hunonic, chỉ báo blocked khi scope yêu cầu provider UAT hoặc fixture mock không đáp ứng `SCP-01`.
- Thiếu approval cho backfill/migration/maintenance window.
- P19 đang `DEFERRED (OWNER)`; trước production GO bắt buộc mở lại khi chưa có off-host backup, restore target cô lập hoặc người ký release.
- Kết quả E2E/UAT có P0/P1 failure, sai tiền, tenant leak, double post, hoặc snapshot bị ghi đè.

## Kết luận release

Trạng thái hiện tại là **LIVE NO-GO**. P20 không phải task code; nó là quyết định vận hành sau khi P17, P18 và P19 đều có evidence PASS, đồng thời mọi P0 trong `GO_LIVE_TODO.md` đã được release owner xác nhận.
