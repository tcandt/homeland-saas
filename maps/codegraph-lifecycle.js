/* Requested lifecycle paths. Proposal nodes are explicitly distinct from existing implementation. */
(function(){
  const graph=window.HOMELAND_GRAPH_EXTRA;if(!graph)return;
  const a='apps/api/src/', doc='maps/LIFECYCLE_LOGIC.md';
  const sections=[
    ['convert','Cọc giữ phòng → cọc dài hạn / hợp đồng mới',[
      ['Số dư cọc giữ phòng',a+'deposits/deposit-core.service.ts','','B = số dư ledger còn hiệu lực, không phải số tiền cọc ban đầu. SECURITY là nghĩa vụ cọc hợp đồng; không phải doanh thu thuê.'],
      ['Tính tiền cần thu',a+'deposits/deposit-core.policy.ts','','C = cọc dài hạn yêu cầu. Chuyển min(B,C); thu thêm max(C−B,0); dư max(B−C,0). B=2tr, C=5tr: thu thêm 3tr cọc; tiền thuê/phí đầu kỳ là nghĩa vụ riêng, tránh tính hai lần.'],
      ['Chuyển SECURITY',a+'deposits/deposit-core.service.ts','','convertToSecurity: TRANSFER_OUT/IN; cọc nguồn CONVERTED_TO_CONTRACT; SECURITY PAID nếu đủ, PENDING nếu thiếu. Dư chọn CREDIT/REFUND; pending refund chưa là tiền đã chi.'],
      ['Hợp đồng thuê mới',a+'contracts/contracts.service.ts','','createRentalFromBookingHold tạo Contract DRAFT, số HD-THUE, snapshot và invoice ENTRY DRAFT canonical cùng transaction với chuyển SECURITY. Command retry-safe tạo QR cọc chỉ cho max(C−B,0) theo ledger; activate phát hành đúng ENTRY invoice và trả QR tiền thuê đầu kỳ nếu Settings bank hợp lệ.'],
      ['Ký / nhận phòng / tin',doc,'ĐỀ XUẤT','Giữ chứng từ cọc cũ bất biến; liên kết HĐ thuê mới, duyệt/ký/activate theo policy. Gửi khách bảng đã cấn cọc/còn phải thu/tiền thuê/ngày vào ở; admin nhận việc chuẩn bị. Event deposit.converted_to_security đã có, cần kiểm chứng đủ từng kênh.']
    ]],
    ['cancel','Hủy cọc — hoàn tất cả / một phần / không hoàn',[
      ['Yêu cầu hủy + số dư',a+'deposits/deposit-core.service.ts','','Core cancel hiện yêu cầu cọc PAID. Cọc chưa thu đi đường legacy/command khác cần kiểm chứng riêng. Khóa cọc + idempotency; lý do và quyền duyệt bắt buộc.'],
      ['Phân bổ B = R+K+D',a+'deposits/deposit-core.policy.ts','','Hoàn tất cả: R=B, K=D=0. Hoàn một phần: 0<R<B, phần còn lại phân loại giữ K/khấu trừ D. Không hoàn: R=0, K+D=B. Không được hoàn vượt số dư.'],
      ['Pending → chi thật',a+'deposits/deposit-core.service.ts','','Receipt PENDING không ghi REFUND cash-out. completePendingRefund ghi một lần sau chi thật; lưu chứng từ/người duyệt. Core cancel đặt Deposit CANCELLED, RoomHold CANCELLED, đóng kỳ PLANNED/RESERVED.'],
      ['Hợp đồng nào bị hủy?',a+'deposits/deposit-core.service.ts','','Từ 23/09 Core cancel chuyển HĐ cọc DRAFT/PENDING_APPROVAL/APPROVED đúng deposit sang CANCELLED và giữ lịch sử. Guard policy chặn HĐ ACTIVE; ACTIVE phải settlement/terminate. Không tự giải phóng phòng nếu còn occupancy/hold khác.'],
      ['Thông báo theo trạng thái',a+'automation/workflow/workflow.registry.ts','','deposit.refund_requested khi chờ hoàn; deposit.refunded sau hoàn; deposit.cancelled nếu không hoàn; deposit.deducted khi khấu trừ. Phải phân biệt “đã duyệt hoàn” với “đã chuyển tiền”; chống gửi trùng theo operation/event/channel.']
    ]],
    ['partial','Tổng hợp → thanh toán một phần / tiền mặt + QR / chuyển khoản hộ',[
      ['Tổng hợp kỳ thuê',a+'monthly-settlement/monthly-settlement.service.ts','','Room/Contract/RentalCycle + BillingSnapshot → hóa đơn. Hiển thị phải thu, tiền được phân bổ, credit, còn nợ; cọc giữ hộ tách khỏi doanh thu thuê.'],
      ['Tiền mặt + chuyển khoản',a+'invoices/invoices.service.ts','','Mỗi lần nhận tiền là Payment riêng + PaymentAllocation. pay có providerRef/idempotency + khóa/CAS. Drawer tạo MANUAL/CASH cho tiền mặt; chọn QR chỉ mở request theo số dư và chờ SePay webhook. Ví dụ 5tr, cash 2tr, QR 3tr: tổng thu 5tr, không tạo lại nghĩa vụ. Còn E2E concurrent.'],
      ['QR còn nợ / sai nội dung / giao dịch trùng',a+'payments/payments.service.ts','','Tạo QR theo số dư hiện tại. Webhook vào lúc QR cũ còn hiệu lực phải kiểm tra lại dư nợ; tiền thừa không ép vào invoice. Trùng kỹ thuật cùng provider transaction id bị unique log + idempotency/lock chặn allocation/notification lần hai. Từ 23/09, bank reference mới trùng memo với request CONFIRMED → NEEDS_REVIEW + audit/admin alert, không auto-merge hoặc báo khách. Giao dịch chuyển hộ/thiếu mã có thể được admin gán vào nguồn đã chọn sau kiểm tra tenant + tài khoản nhận + dư nợ; memo đã thuộc nguồn khác bị chặn. Giao dịch tiền thật thứ hai vẫn cần review credit/refund.'],
      ['Hẹn trả + nhắc phần còn',a+'invoices/invoices.service.ts','','PaymentPromise lưu amount/dueDate/note/idempotency riêng, không đổi nghĩa vụ invoice. Drawer xem/lập/đổi hẹn; đủ tiền tự FULFILLED. Scheduler tính hết ngày hẹn rồi chuyển OVERDUE, nhắc khách/admin và tạo Task theo số dư hiện tại. Migration chưa apply; UAT/delivery còn thiếu.'],
      ['Xác nhận / ngoại lệ',a+'automation/workflow/workflow.registry.ts','','invoice.payment.recorded và invoice.paid có workflow; gửi tiền lần này + lũy kế + còn nợ. Giao dịch chưa match chỉ báo admin, chưa báo khách đã thanh toán. Payment payer có thể khác customer; cần evidence người chuyển hộ.']
    ]],
    ['expiry','Hợp đồng sắp hết hạn → gia hạn hoặc tất toán',[
      ['Ngày nhắc theo tenant',a+'automation/rules/rule.scheduler.ts','','Scheduler đọc notifications và tìm hợp đồng gần ngày hết hạn. Chốt timezone, số ngày trước hạn, kênh khách/admin và opt-out.'],
      ['Rule condition',a+'automation/rules/rule.registry.ts','','Từ 23/09 registry dùng reminder-policy/thresholdDays từ scheduler thay vì tự hard-code 3/7/30; bỏ nhắc nếu invoice đã hết dư nợ hoặc trạng thái terminal. Còn UAT timezone/delivery.'],
      ['Gia hạn',a+'contracts/contracts.service.ts','','renewContract là command riêng. Giữ lịch sử kỳ cũ, tạo hợp đồng/kỳ mới theo implementation; không sửa ngày cũ để xóa dấu vết. Gửi đề nghị và xác nhận sau khi commit.'],
      ['Không gia hạn',a+'contracts/contracts.service.ts','','settlement-preview → chốt utility/nợ/cọc → terminate/move-out. Pending refund không đồng nghĩa đã chi; phòng chỉ AVAILABLE khi lifecycle cho phép.'],
      ['Theo dõi tác vụ',doc,'ĐỀ XUẤT','Tin trước hạn: chọn gia hạn/trả phòng; ghi nhận phản hồi và deadline. Quá hẹn phản hồi → task admin; thông báo kết quả sau command thành công. Scheduler không tự gia hạn hoặc tự coi khách đã ra khỏi phòng.']
    ]],
    ['commission','Doanh thu / chi phí / chia hoa hồng Sales',[
      ['Báo cáo authoritative',a+'finance/finance-reporting.service.ts','','Tách doanh thu theo kỳ, tiền thực thu, cọc phải trả, chi phí và công nợ. Không lấy AnalyticsService demo làm cơ sở trả hoa hồng.'],
      ['Policy hoa hồng',doc,'ĐỀ XUẤT','Chưa thấy commission model/service trong phạm vi đã tra. Cần settings theo tenant: % hay cố định, cơ sở tính, tiền thuê hợp lệ, kỳ áp dụng, điều kiện đủ, trần, hiệu lực, người duyệt. Không tự chọn mức %.'],
      ['Công thức / chia Sales',doc,'ĐỀ XUẤT','Hoa hồng = basis hợp lệ × rate × tỷ lệ phân bổ sales; tổng tỷ lệ phân bổ =100%. Ví dụ minh họa: cơ sở 5tr ×10%=500k, chia 60/40 →300k/200k. Cọc/utility/VAT có tính hay không phải chốt policy; mặc định đề xuất loại cọc.'],
      ['Duyệt / chi / clawback',doc,'ĐỀ XUẤT','Accrual → approved → paid; partial payment nếu policy theo tiền thực thu thì accrual theo phần thu. Refund/cancel tạo reversal/clawback, không xóa lịch sử; khóa trùng contract/payment/policy version.'],
      ['Báo cáo hoa hồng',doc,'ĐỀ XUẤT','Đối soát salesId → hợp đồng → allocation/payment → policy snapshot → hoa hồng → chứng từ chi. Tránh tính chi phí hai lần giữa accrued và paid. Tab Settings cấu hình, Finance duyệt/chi, Sales xem quyền hạn của mình.']
    ]],
    ['templates','Mẫu tin cấu hình — Zalo / Telegram / Email',[
      ['Event + payload chuẩn',a+'communication/communication.service.ts','','Đã có NotificationTemplate + Handlebars; không phải toàn bộ hardcode. Chuẩn hóa customerName, roomCode, amount, paidAmount, remainingAmount, dueDate và operationId từ dữ liệu đã commit.'],
      ['Settings Template Editor',doc,'ĐỀ XUẤT','Editor theo event/channel/tenant: lời chào → nội dung → lời cảm ơn; chọn biến được phép, preview dữ liệu mẫu, validate biến bắt buộc, test tới recipient được xác nhận, publish version/rollback. Không cho thực thi JS trong mẫu.'],
      ['Bỏ override mẫu tenant',a+'communication/communication.service.ts','CẦN SỬA','dispatch có nhánh ép default cho INVOICE_ZALO_PAYMENT_REQUEST / DEPOSIT_ZALO_PAYMENT_REQUEST dù đã có tenant template. Cần rà cả dispatchDirect và fallback trước khi thay đổi.'],
      ['Render → queue → send',a+'communication/templates/template.engine.ts','','Theo kênh: email subject/HTML escape, Telegram parse-mode escape, Zalo giới hạn độ dài/payload. Đóng băng templateVersion + context + rendered message; retry không dựng lại nội dung khác.'],
      ['Delivery evidence',doc,'ĐỀ XUẤT','QUEUED/SENDING/provider-accepted/FAILED tách khỏi khách đã đọc. Lưu provider ID, retry/backoff, dead-letter, gửi lại có quyền, dedupe theo event/recipient/channel. Mẫu ở tài liệu đi kèm.']
    ]],
    ['realtime','Liên kết realtime — Popup → invoice/deposit/contract → history → notification',[
      ['Webhook / nhận tiền mặt',a+'payments/payments.service.ts','','Webhook xác thực và định danh giao dịch; tiền mặt qua command có quyền. Cùng invariants ledger/allocation/idempotency, không cập nhật các tab bằng chuỗi HTTP độc lập.'],
      ['Commit + Outbox',a+'deposits/deposit-outbox.publisher.ts','','DB là nguồn sự thật; outbox durable sau commit. Publisher interval 1s; retry có thể lâu hơn. Không đợi Zalo thành công mới coi giao dịch tiền đã commit.'],
      ['Push realtime UI',doc,'ĐỀ XUẤT','Đã có SSE notification stream, chưa chứng minh fan-out invalidation đủ mọi màn hình tiền. Đề xuất event tenant-scoped + IDs/version → invalidate RoomPopup, Invoice, Deposit, Contract, Finance/history; refetch authoritative. Reconnect có replay hoặc resync.'],
      ['Polling hiện tại', 'apps/web/lib/queries/payments.queries.ts','HIỆN TẠI','PaymentRequest PENDING refetchInterval=5000ms; webhook không tự làm cache mọi màn hình mới tức thì. Cần bỏ phụ thuộc polling chính khi push đã được triển khai, giữ fallback.'],
      ['Đo độ trễ / retry',doc,'ĐỀ XUẤT','Không cam kết zero-delay qua mạng/provider. Đề xuất SLO đo từ commit→UI và commit→provider-accepted riêng; khách thấy “đã nhận tiền, thông báo đang gửi”. Duplicate/out-of-order/disconnect/multi-tab phải có test.']
    ]]
  ];
  sections.forEach(([id,title,items],index)=>{
    const y=3560+index*300;
    graph.colors[id]=['#f0f6ff','#486b9e'];
    graph.groups.push([id,title,30,y,2540,250]);
    items.forEach((n,i)=>graph.nodes.push(['life-'+id+'-'+i,n[0],n[1],id,70+i*500,y+100,n[2],n[3]]));
    items.slice(1).forEach((n,i)=>{const x=300+i*500;graph.edges.push(['life-'+id+'-'+i,'life-'+id+'-'+(i+1),'bước / nhánh cần đối chiếu',`M${x} ${y+139} H${x+270}`,x+135,y+128,'gap']);});
  });
  graph.height=3560+sections.length*300;
})();
