# CORE-04/05 — API contract cọc và giữ chỗ

Ngày khóa bản nháp triển khai: 08/09/2026  
Owner: CORE/DEV1  
Trạng thái production: **CHƯA ĐƯỢC DEPLOY/MIGRATION — LIVE NO-GO**

Runbook production: [CORE_04_05_MAINTENANCE_RUNBOOK.md](./CORE_04_05_MAINTENANCE_RUNBOOK.md)

Tài liệu này là contract để DEV2 dựng adapter/fixture. Chỉ chuyển fixture sang API thật sau khi migration staging, integration test DB thật và UAT đều đạt.

## Quy tắc chung

- Mọi command tiền bắt buộc có `Idempotency-Key` dài 8–128 ký tự. Có thể gửi `idempotencyKey` trong body để hỗ trợ client cũ; header được ưu tiên.
- Cùng key + cùng payload trả lại kết quả cũ và `replayed: true`; cùng key + payload khác trả `IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST`.
- Client timeout không tự sinh key mới. Phải retry đúng key hoặc truy vấn lại operation.
- Tiền dùng VND và số không âm, tối đa hai chữ số thập phân.
- `Deposit.amount` là số tiền dự kiến/gốc; số dư thật lấy từ `DepositLedgerEntry.balanceEffect`.
- `PENDING` refund chưa phải cash-out và chưa được hiển thị “Đã hoàn”.
- Audit log và sự kiện nghiệp vụ cọc được ghi trong cùng transaction với operation/ledger. Sự kiện chỉ được phát từ transactional outbox sau khi transaction commit.

| Endpoint | Permission |
|---|---|
| Thu cọc | `deposit.collect` |
| Chuyển booking → security | `deposit.convert` |
| Hủy/phân bổ số dư | `deposit.cancel` |
| Hoàn tất refund | `deposit.refund` |
| Gia hạn/chuyển hold | `deposit.update` |
| Giải phóng hold | `deposit.cancel` |
| Đảo bút toán đã duyệt | `deposit.refund` |
| Đọc trạng thái command | `deposit.read` |

Tra cứu sau timeout: `GET /deposits/operations/status?idempotencyKey=<key>`. Endpoint chỉ tìm trong tenant đang đăng nhập và không trả `requestHash`.

## 1. Thu cọc và khóa giữ chỗ

`POST /deposits/:depositId/collect`

Header:

```text
Idempotency-Key: collect-<uuid>
```

Body:

```json
{
  "note": "Đã nhận chuyển khoản",
  "holdExpiresAt": "2026-09-10T10:00:00.000Z"
}
```

Với `BOOKING/RESERVATION`, server khóa dòng phòng, dọn hold hết hạn rồi kiểm tra:

- WHOLE: không có Occupancy mở và không có hold hiệu lực khác;
- SHARED: `Occupancy mở + hold hiệu lực < capacity`;
- tạo `RoomHold ACTIVE` và `CASH_IN` trong cùng serializable transaction.

Nếu security deposit đã nhận một phần từ booking, command chỉ thu phần còn thiếu, không thu lại toàn bộ mức cọc.

Response tối thiểu:

```json
{
  "operationId": "...",
  "depositId": "...",
  "rentalCycleId": "...",
  "collectedAmount": 3000000,
  "balance": 5000000,
  "holdId": null,
  "status": "PAID"
}
```

### 1.1. Vòng đời hold sau khi thu cọc

- Gia hạn: `POST /deposits/:depositId/hold/renew`, body `{ "expiresAt": "..." }`.
- Chuyển phòng/chỗ: `POST /deposits/:depositId/hold/transfer`, body `{ "targetRoomId": "...", "expiresAt": "optional" }`.
- Giải phóng vận hành: `POST /deposits/:depositId/hold/release`, body `{ "reason": "..." }`.
- Quét hold quá hạn: `POST /deposits/holds/expire`, body `{ "asOf": "optional" }`.

Ba command theo một deposit đều yêu cầu `Idempotency-Key`. Chuyển phòng khóa hai dòng Room theo thứ tự ID, kiểm tra lại WHOLE/SHARED/capacity, giải phóng hold nguồn và tạo hold đích trong cùng transaction. Nếu kỳ thuê đã có hợp đồng thì trả `ROOM_HOLD_TRANSFER_CONTRACT_EXISTS`; chuyển phòng sau thời điểm này thuộc command activation/amendment của CORE-06.

Quét hết hạn chỉ đổi trạng thái hold và giải phóng resource key, không tự hoàn/giữ/khấu trừ tiền. Trường hợp khách không tới phải đi qua command hủy ở mục 3 để số dư được phân bổ đủ. Thu tiền đến muộn chỉ được thử lại với hạn hold mới ở tương lai; server khóa phòng và kiểm tra capacity lại, không hồi sinh hold cũ.

## 2. Chuyển booking sang security

`POST /deposits/:bookingDepositId/convert-contract`

Body:

```json
{
  "securityRequired": 5000000,
  "contractId": "optional-contract-id",
  "securityDepositId": "optional-existing-security-deposit-id",
  "excessAction": "CREDIT",
  "refundStatus": "PENDING"
}
```

Quy tắc:

| Trường hợp | Kết quả |
|---|---|
| `B < C` | Chuyển toàn bộ B; trả `additionalCashRequired = C-B`; security còn `PENDING` |
| `B = C` | Chuyển B; không thu/hoàn thêm; security `PAID` |
| `B > C` + `CREDIT` | Chuyển C; phần `B-C` thành CreditNote có ledger nguồn |
| `B > C` + `REFUND` | Chuyển C; phần `B-C` tạo Receipt; chỉ ghi ledger REFUND khi Receipt COMPLETED |

Khi `B>C`, `excessAction` là bắt buộc. Không ghi đè số tiền gốc của booking deposit.

Hold của kỳ thuê không bị giải phóng khi booking đổi thành security. Server chuyển `depositId` của hold sang phiếu security và giữ nguyên `ACTIVE + activeResourceKey`; CORE-06 mới kết thúc hold khi activation/nhận phòng thành công.

Response tối thiểu:

```json
{
  "operationId": "...",
  "rentalCycleId": "...",
  "bookingDepositId": "...",
  "securityDepositId": "...",
  "contractId": null,
  "bookingBalance": 7000000,
  "securityRequired": 5000000,
  "transferAmount": 5000000,
  "additionalCashRequired": 0,
  "excessAmount": 2000000,
  "excessAction": "REFUND",
  "creditNoteId": null,
  "refundReceiptId": "...",
  "refundStatus": "PENDING",
  "pending": true
}
```

## 3. Hủy và phân bổ toàn bộ số dư

`POST /deposits/:depositId/commands/cancel`

Body:

```json
{
  "reason": "Khách hủy giữ chỗ",
  "refundAmount": 3000000,
  "keepAmount": 1000000,
  "deductAmount": 1000000,
  "refundStatus": "PENDING"
}
```

Invariant bắt buộc:

```text
refundAmount + keepAmount + deductAmount = availableBalance
```

Thiếu hoặc vượt một đồng đều bị từ chối. KEEP/DEDUCT được ghi ledger ngay; REFUND chỉ ghi khi chứng từ hoàn tiền chuyển sang COMPLETED. Hold chỉ được giải phóng theo đúng `depositId + rentalCycleId`.

## 4. Hoàn tất cash-out đang chờ

`POST /deposits/operations/:operationId/refund/complete`

Body rỗng; vẫn bắt buộc `Idempotency-Key` mới dành cho thao tác complete. Server khóa operation, CAS Receipt `PENDING → COMPLETED`, thêm đúng một dòng REFUND và đóng operation nguồn.

## 5. Error code ổn định

| Code | HTTP dự kiến | Ý nghĩa/UI action |
|---|---:|---|
| `IDEMPOTENCY_KEY_INVALID` | 400 | Không submit; tạo key hợp lệ |
| `IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST` | 409 | Dừng; không đổi payload cho key cũ |
| `DEPOSIT_OPERATION_IN_PROGRESS` | 409 | Hiển thị đang xử lý; poll/retry cùng key |
| `DEPOSIT_NOT_FOUND` | 400/404 | Refresh dữ liệu; không tự tạo phiếu mới |
| `DEPOSIT_RENTAL_CYCLE_REQUIRED` | 400 | Dừng và đưa vào queue đối soát dữ liệu cũ |
| `DEPOSIT_ALREADY_PROCESSED` | 409 | Refresh operation/deposit |
| `DEPOSIT_CONCURRENT_UPDATE` | 409 | Retry cùng key |
| `ROOM_HOLD_CONFLICT` | 409 | Phòng nguyên căn đã có người/hold |
| `ROOM_CAPACITY_EXCEEDED` | 409 | Phòng ghép hết chỗ |
| `ROOM_HOLD_EXPIRY_INVALID` | 400 | Yêu cầu chọn hạn tương lai |
| `ROOM_HOLD_NOT_ACTIVE` | 400 | Refresh; hold đã hết hạn/giải phóng hoặc không thuộc phiếu này |
| `ROOM_HOLD_RENEWAL_MUST_EXTEND` | 400 | Hạn mới phải sau hạn hiện tại |
| `ROOM_HOLD_TARGET_SAME_ROOM` | 400 | Không tạo lệnh chuyển tới chính phòng hiện tại |
| `ROOM_HOLD_TRANSFER_CONTRACT_EXISTS` | 409 | Dùng quy trình amendment/activation CORE-06 |
| `DEPOSIT_EXCESS_ACTION_REQUIRED` | 400 | Bắt buộc chọn CREDIT hoặc REFUND |
| `DEPOSIT_CONTRACT_SCOPE_MISMATCH` | 400 | Sai khách/phòng/kỳ thuê; dừng |
| `SECURITY_DEPOSIT_SCOPE_MISMATCH` | 400 | Không dùng phiếu security của kỳ khác |
| `SECURITY_DEPOSIT_ALREADY_FUNDED` | 409 | Không chuyển thêm vào security đã có số dư |
| `DEPOSIT_RESOLUTION_MUST_EQUAL_AVAILABLE_BALANCE` | 400 | Sửa ma trận hoàn/giữ/khấu trừ |
| `DEPOSIT_REFUND_EXCEEDS_BALANCE` | 400 | Dừng cash-out và đối soát ledger/receipt |
| `DEPOSIT_REFUND_CONCURRENT_UPDATE` | 409 | Refresh, không tạo lệnh hoàn mới |
| `DEPOSIT_LEDGER_ENTRY_NOT_FOUND` | 400 | Không tìm thấy dòng nguồn trong tenant hiện tại |
| `DEPOSIT_LEDGER_ENTRY_ALREADY_REVERSED` | 409 | Operation nguồn đã được đảo; không tạo lần hai |
| `DEPOSIT_REVERSAL_NEGATIVE_BALANCE` | 400 | Đảo operation sẽ làm ít nhất một số dư âm |
| `DEPOSIT_REVERSAL_DOCUMENT_WORKFLOW_REQUIRED` | 400 | Receipt/CreditNote phải đảo bằng workflow chứng từ chuyên biệt |

## 6. Đảo bút toán và finance summary

`POST /deposits/ledger/:entryId/reverse` chọn một dòng nguồn nhưng server đảo **toàn bộ các dòng cùng operation** trong một transaction. Mỗi dòng đảo có `type=REVERSAL`, `reversalOfId` duy nhất và effect ngược dấu; dòng gốc không bị sửa/xóa. Operation có Receipt/CreditNote bị chặn để tránh lệch chứng từ ngoài ledger.

`GET /deposits/rental-cycles/:rentalCycleId/finance-summary` là nguồn hiển thị duy nhất cho DEV2. Response gồm customer, room, contracts, từng deposit với balance từ ledger, tổng ledger theo loại, invoice total/paid/credit/outstanding, confirmed payments và pending operations. Endpoint luôn scope theo tenant đăng nhập.

### 6.1. Transactional outbox và retry sự kiện

- Mỗi operation tiền tạo `OutboxEvent` trong cùng transaction, với unique key theo `operationId + eventName`; rollback transaction thì không có event mồ côi.
- Dispatcher claim theo lô bằng `FOR UPDATE SKIP LOCKED`, tăng số lần thử, phát bất đồng bộ rồi mới đánh dấu `PUBLISHED`.
- Event lỗi chuyển `FAILED`, retry theo exponential backoff, tối đa 10 lần; claim `PROCESSING` kẹt quá 5 phút được đưa lại về hàng đợi.
- Cam kết giao là **at-least-once**. Consumer phải khử trùng theo `outboxEventId`; không dựa vào thời gian nhận hoặc tự suy rằng chỉ nhận đúng một lần.
- `DISABLE_DEPOSIT_OUTBOX=true` chỉ dừng dispatcher để bảo trì; không làm mất event `PENDING/FAILED`. Không sửa tay trạng thái thành `PUBLISHED`.
- Trạng thái `PUBLISHED` chỉ xác nhận event đã được phát lên event bus nội bộ, không chứng minh có consumer đăng ký hoặc workflow/nhà cung cấp bên ngoài đã hoàn tất. Consumer/workflow downstream vẫn phải có retry, idempotency và giám sát riêng.

## 7. Invalidation cho DEV2

Sau success, invalidate theo ID trả về:

- deposit source và target;
- RentalCycle;
- room hold/capacity;
- contract nếu có;
- finance summary theo RentalCycle;
- receipts/credits khi có.

Không invalidate bằng cách xóa toàn bộ cache tenant nếu có thể cập nhật theo key cụ thể.

## 8. Gate trước staging/production

- Migration chỉ additive, review SQL/checksum.
- Backfill ledger dữ liệu cũ dùng `npm run backfill:deposit-ledger` ở chế độ dry-run. Chỉ apply file đã duyệt có `depositId + tenantId + approvedBalance + evidenceRef + decision=APPROVE` cùng câu xác nhận `BACKFILL_REVIEWED_DEPOSIT_OPENING_BALANCES`; không suy “đã thu tiền” chỉ từ `Deposit.status`.
- Integration test PostgreSQL thật: hai request khác key cùng giữ một phòng; hai complete cùng lúc; retry timeout; cross-tenant.
- Outbox: cùng key chỉ có một event; lỗi listener được retry; consumer khử trùng theo `outboxEventId`; không còn `PROCESSING` quá SLA.
- Backup và restore drill trước maintenance window.
- Feature flag/tenant rollout; reconciliation trước và sau cutover.
- Production không dùng `db push`, không reset, không seed.
