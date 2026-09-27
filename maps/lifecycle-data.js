/* Homeland business map. Static source inspection; not runtime/E2E certification. */
window.HOMELAND_LIFECYCLE = (() => {
  const sources = {
    sidebar:['apps/web/components/layout/Sidebar.tsx','Các module và route nghiệp vụ trong sidebar.'],
    depApi:['apps/api/src/deposits/deposits.controller.ts','Create/collect/cancel; renew, transfer, release, expire hold.'],
    dep:['apps/api/src/deposits/deposit-core.service.ts','Deposit ledger, refund, conversion, lock và idempotency.'],
    depPolicy:['apps/api/src/deposits/deposit-core.policy.ts','Kế hoạch chuyển và hủy cọc theo số dư.'],
    holdJob:['apps/api/src/deposits/deposit-hold.scheduler.ts','Quét hold hết hạn mỗi 5 phút.'],
    contractApi:['apps/api/src/contracts/contracts.controller.ts','Create, booking conversion, approve, activate, renew, terminate.'],
    contract:['apps/api/src/contracts/contracts.service.ts','Contract, occupancy, settlement và room lifecycle.'],
    contractAdapter:['apps/api/src/contracts/contracts.adapter.ts','History và adapter dữ liệu hợp đồng.'],
    reports:['apps/api/src/reports/reports.service.ts','Cashflow, P&L, revenue, deposit liability, aging, export.'],
    reportsPage:['apps/web/app/reports/page.tsx','Bộ lọc và màn hình báo cáo.'],
    financeApi:['apps/api/src/finance/finance.controller.ts','Ledger, finance, expense, bank transaction và reconciliation APIs.'],
    finance:['apps/api/src/finance/finance-reporting.service.ts','Chi phí, journal, reports, transaction history, owner allocation.'],
    expensePage:['apps/web/app/finance/expenses/page.tsx','Màn hình chi phí.'],
    commApi:['apps/api/src/communication/communication.controller.ts','Inbox, SSE, template, queue và provider endpoints.'],
    comm:['apps/api/src/communication/communication.service.ts','Template, enqueue, delivery, retry và cancel.'],
    commJob:['apps/api/src/communication/communication.scheduler.ts','Retry queue định kỳ.'],
    providers:['apps/api/src/communication/providers/communication.providers.ts','In-app, email, Telegram và Zalo providers.'],
    zalo:['apps/api/src/communication/services/zalo-registration.service.ts','Liên kết Zalo khách thuê.'],
    adminZalo:['apps/api/src/communication/services/admin-zalo-alerts.service.ts','Thông báo nhóm Zalo Admin.'],
    commPage:['apps/web/app/notifications/page.tsx','Inbox frontend polling mỗi 15 giây.'],
    customerApi:['apps/api/src/customers/customers.controller.ts','Customer APIs và deduplicate/merge.'],
    customer:['apps/api/src/customers/customers.service.ts','Chuẩn hóa, chống trùng, room projection, delete guard.'],
    tenantPage:['apps/web/app/tenants/page.tsx','Màn hình khách thuê.'],
    tenantDrawer:['apps/web/components/tenants/TenantDetailDrawer.tsx','Profile, room, contract, deposit, invoice và audit.'],
    settleApi:['apps/api/src/monthly-settlement/monthly-settlement.controller.ts','Overview, finalize usage, close month và notification.'],
    settle:['apps/api/src/monthly-settlement/monthly-settlement.service.ts','Occupancy, allocation, BillingSnapshot, invoice, payment request.'],
    settleJob:['apps/api/src/monthly-settlement/monthly-settlement.scheduler.ts','Chốt usage cuối tháng; gửi 08:00 ngày 01; follow-up.'],
    hunonic:['apps/api/src/hunonic/hunonic.service.ts','Đồng bộ/chốt chỉ số và khóa kỳ điện.'],
    summaryPage:['apps/web/app/summary/page.tsx','/summary là monthly settlement.'],
    building:['apps/api/src/buildings/buildings.service.ts','Building, owner/cost center và delete guard.'],
    floor:['apps/api/src/floors/floors.service.ts','Floor CRUD và delete guard.'],
    room:['apps/api/src/rooms/rooms.service.ts','Room, rental type, capacity, state và contract projection.'],
    buildingsPage:['apps/web/app/buildings/page.tsx','Cây tòa nhà/tầng/phòng.'],
    dashboard:['apps/api/src/dashboard/dashboard.service.ts','Dashboard dữ liệu vận hành/tài chính.'],
    analytics:['apps/api/src/analytics/analytics.service.ts','Revenue/finance analytics fail-closed UNAVAILABLE.'],
    financePage:['apps/web/app/finance/page.tsx','Màn hình Doanh thu.'],
    paymentApi:['apps/api/src/payments/payments.controller.ts','Webhook, payment request, manual assignment, overpayment.'],
    payment:['apps/api/src/payments/payments.service.ts','SePay, matching, allocation, refund/credit/carry-forward.'],
    bankHistory:['apps/web/components/finance/BankTransactionHistory.tsx','Lịch sử ngân hàng/SePay và match status.'],
    transactionPage:['apps/web/app/finance/transactions/page.tsx','Route hiện render BankTransactionHistory.'],
    auditApi:['apps/api/src/shared/audit/audit.controller.ts','API lọc audit.'],
    audit:['apps/api/src/shared/audit/audit.service.ts','AuditLog tenant/user/request/IP/before/after.'],
    activitiesPage:['apps/web/app/activities/page.tsx','Màn hình Nhật ký vận hành.'],
    auditClient:['apps/web/lib/api/audit.api.ts','Frontend audit query.']
  };
  const issue=(kind,id,title,body,next)=>({kind,id,title,body,next});
  const n=(id,col,row,title,sub,summary,steps,output,refs,issues=[],jump=null,href=null)=>({id,col,row,title,sub,summary,steps,output,refs,issues,jump,href,status:issues.some(i=>i.kind==='error')?'error':issues.some(i=>i.kind==='gap')?'gap':issues.some(i=>i.kind==='review')?'review':issues.some(i=>i.kind==='fixed')?'fixed':'code'});
  const e=(from,to,label='',dashed=false)=>({from,to,label,dashed});
  const chapters = [
    {id:'overview',number:'A–Z',navLabel:'Tổng thể liên kết',title:'Bản đồ tổng thể 11 miền nghiệp vụ',description:'Đi theo đúng thứ tự yêu cầu. Bấm một ô để mở tab chi tiết; đường nét đứt là liên kết dữ liệu sang miền khác.',nodes:[
      n('deposits',1,0,'Đặt cọc','Giữ phòng / hoàn','Giữ tài nguyên phòng và ghi nghĩa vụ cọc.',['Tạo hold và QR.','Thu, chuyển hoặc hủy/hoàn.'],'Deposit, RoomHold, DepositLedger.',['depApi','dep'],[],'deposits'),
      n('contracts',1,1,'Hợp đồng','Pháp lý / occupancy','Biến ý định thuê thành quan hệ pháp lý và quyền ở.',['DRAFT → duyệt → ký → ACTIVE.','Gia hạn hoặc quyết toán.'],'Contract, RentalCycle, Occupancy.',['contractApi','contract'],[],'contracts'),
      n('reports',1,2,'Báo cáo','Nguồn số liệu chuẩn','Cashflow, P&L, doanh thu, công nợ và liability cọc.',['Chọn kỳ/phạm vi.','Xuất cùng định nghĩa chỉ số.'],'Report và export.',['reports'],[],'reports'),
      n('expenses',1,3,'Chi phí','Duyệt / chi','Khoản chi đi cùng journal và owner allocation.',['Tạo, duyệt, trả.','Reversal nếu hủy khoản đã chi.'],'Expense + journal.',['finance'],[],'expenses'),
      n('notifications',1,4,'Thông báo','Khách / Admin','Sự kiện thành tin in-app, Zalo, email/Telegram có retry.',['Template → queue → provider.','Theo dõi delivery.'],'Queue + Delivery.',['comm'],[],'notifications'),
      n('tenants',1,5,'Khách thuê','Hồ sơ xuyên suốt','Customer dùng lại qua nhiều chu kỳ, không phải sổ tiền.',['Chuẩn hóa/chống trùng.','Liên kết vai trò và Zalo.'],'Customer.',['customer'],[],'tenants'),
      n('settlement',1,6,'Tổng hợp','Chốt tháng','Tiền phòng, điện, nước, phí thành snapshot và hóa đơn.',['Hunonic chốt điện.','Nước 100.000/người.'],'BillingSnapshot + Invoice.',['settle'],[],'settlement'),
      n('buildings',1,7,'Tòa nhà','Tài sản / sức chứa','Building, floor, room là phạm vi hold, occupancy và phân tích.',['Owner/cost center.','WHOLE/SHARED + capacity.'],'Building, Floor, Room.',['building','room'],[],'buildings'),
      n('revenue',1,8,'Doanh thu','Thu ≠ ghi nhận','Tách phải thu, tiền đã thu, revenue journal và liability cọc.',['Đối soát collection.','Trừ expense thành net profit.'],'Ledger/cashflow/profit.',['finance','reports'],[],'revenue'),
      n('transactions',1,9,'Lịch sử giao dịch','SePay / đối soát','Theo vết webhook tới allocation và các ca sai mã, thiếu/thừa, trùng.',['Chống replay transaction ID.','Manual review ca lệch.'],'WebhookLog/Payment/Allocation.',['payment','bankHistory'],[],'transactions'),
      n('activities',1,10,'Nhật ký vận hành','Ai / làm gì','Audit nối command với user, request và before/after.',['Ghi log theo module/action.','Drill-down entity.'],'AuditLog.',['audit'],[],'activities')
    ],edges:[e('deposits','contracts'),e('contracts','reports'),e('reports','expenses','P&L',true),e('expenses','notifications','event',true),e('notifications','tenants','recipient',true),e('tenants','settlement'),e('settlement','buildings','theo phòng',true),e('buildings','revenue','theo tòa',true),e('revenue','transactions','đối soát',true),e('transactions','activities','audit',true)]},

    {id:'p0p20',number:'P0–20',navLabel:'Kế hoạch P0–P20',title:'P0–P20 · từ popup phòng tới go-live',description:'Bản rút gọn 21 hạng mục theo năm chặng. Chọn một chặng để xem logic, đầu ra và việc còn lại; bảng đầy đủ mở tại index.html.',nodes:[
      n('p0-p4',1,0,'P0–P4 · Khởi tạo khách thuê','5 hạng mục · 74% bình quân','Khóa context phòng, chuẩn hóa khách, rồi sinh đúng deposit/contract/invoice.',['P0: context phòng.','P1–P2: khách và mục tiêu thuê.','P3–P4: hợp đồng, cọc, hóa đơn.'],'P2 hoàn thành; P0/P1/P3/P4 đang thực hiện.',['contract','dep','customer'],[],null,'index.html#p0'),
      n('p5-p10',1,1,'P5–P10 · Dòng tiền','Mô hình thuê · 74% bình quân','Đồng bộ tài chính, đối soát thanh toán và tách WHOLE/SHARED trên Occupancy/RentalCycle.',['P5–P7: query, payment, refund.','P8–P10: đại diện, khách ghép, source of truth.'],'Tất cả đang thực hiện; còn ca tiền lệch và consumer projection.',['finance','payment','contract','room'],[],null,'index.html#p5'),
      n('p11-p12',1,2,'P11–P12 · Chốt tháng & điện nước','2 hạng mục · 80% bình quân','Khóa snapshot Hunonic rồi tính tiền phòng, điện, nước và phí theo occupancy.',['P11: khóa chỉ số điện.','P12: invoice WHOLE/SHARED, QR và nhắc thanh toán.'],'Đang thực hiện; cần hoàn tất edge case và overdue follow-up.',['hunonic','settle'],[],null,'index.html#p11'),
      n('p13-p16',1,3,'P13–P16 · Đến hạn','Báo cáo · 87% bình quân','Kết thúc kỳ bằng nhắc hạn, gia hạn hoặc tất toán; mọi số liệu báo cáo cùng basis.',['P13–P14: reminder và renewal.','P15–P16: terminal settlement và báo cáo.'],'P15 hoàn thành; các mục còn lại đang thực hiện.',['contract','comm','reports'],[],null,'index.html#p13'),
      n('p17-p20',1,4,'P17–P20 · Release gate','4 hạng mục · chưa đạt go-live','Chỉ phát hành sau E2E, UAT, preflight backup/rollback và sign-off.',['P17: full E2E có ảnh/log.','P18–P20: UAT, preflight, ký duyệt.'],'P17/P19/P20 đang bị chặn; production vẫn LIVE NO-GO.',['contract','payment','settle','reports'],[],null,'index.html#p17')
    ],edges:[e('p0-p4','p5-p10'),e('p5-p10','p11-p12'),e('p11-p12','p13-p16'),e('p13-p16','p17-p20')]},

    {id:'deposits',number:'01',navLabel:'Đặt cọc',title:'Đặt cọc · giữ phòng · chuyển cọc · hủy hoàn',description:'Quyền giữ phòng, số dư cọc và chứng từ hoàn là ba lớp riêng. Hold hết hạn không đồng nghĩa tiền đã hoàn.',nodes:[
      n('intent',1,0,'Chọn khách và phòng','WHOLE / SHARED','Xác định customer, room, loại thuê và cycle dự kiến.',['WHOLE độc quyền.','SHARED giữ một suất capacity.'],'Ý định đủ dữ liệu.',['customer','room']),
      n('create',1,1,'Tạo booking + hold','DRAFT / PENDING','Tạo Deposit và RoomHold có hạn dưới kiểm tra tài nguyên.',['Idempotency ngăn tạo lặp.','Ghi audit/outbox.'],'Deposit + ACTIVE hold.',['depApi','dep']),
      n('request',1,2,'Tạo QR cọc','PaymentRequest','Sinh payment code, amount và ngân hàng đúng cọc rồi gửi kênh đã liên kết.',['QR tới đúng payer.','Delivery lỗi vẫn được theo dõi.'],'PaymentRequest.',['payment','providers'],[],'notifications'),
      n('collect',1,3,'Xác nhận đã thu','PAID + COLLECT','Webhook hoặc tiền mặt hợp lệ ghi ledger COLLECT.',['Transaction ID idempotent.','Balance đọc từ ledger, không chỉ amount.'],'Cycle RESERVED; cọc có balance.',['dep','payment']),
      n('continue',0,4,'Khách tiếp tục thuê','Chuyển SECURITY','Chuyển booking balance sang security deposit trong transaction.',['TRANSFER_OUT/IN.','Thiếu thu thêm; thừa credit/refund.'],'Đi tab Hợp đồng.',['dep','depPolicy'],[],'contracts'),
      n('change',1,4,'Đổi kế hoạch','Renew / transfer / release','Gia hạn, chuyển phòng hoặc giải phóng hold dưới khóa.',['Transfer khóa phòng cũ/mới.','Release/expire không tự cash-out.'],'Hold đổi; tiền giữ nguyên ledger.',['depApi','holdJob']),
      n('cancel',2,4,'Khách hủy','Full / partial / none','Chia toàn bộ available balance thành refund, keep hoặc deduct.',['Full: refund = balance.','Partial: tổng allocation = balance.','None: keep/deduct toàn bộ.'],'CANCELLED, không xóa lịch sử.',['dep','depPolicy']),
      n('refund',2,5,'Hoàn tiền có chứng từ','PENDING → COMPLETED','Receipt PENDING chưa phải đã trả; complete mới ghi cash-out.',['Operation ID chống chi hai lần.','Attachment bắt buộc khi hoàn tất.'],'REFUND ledger + receipt + outbox.',['dep']),
      n('downstream',1,6,'Đồng bộ miền liên quan','HĐ / report / notify','Hợp đồng đọc balance, báo cáo đọc liability, khách/Admin nhận trạng thái delivery.',['Không báo refunded khi receipt pending.','Không coi cọc là revenue.'],'Một nguồn số dư, nhiều consumer.',['reports','comm'],[],'contracts')
    ],edges:[e('intent','create'),e('create','request'),e('request','collect'),e('collect','continue','vào ở'),e('collect','change','đổi'),e('collect','cancel','hủy'),e('change','continue','tiếp tục',true),e('change','cancel','dừng',true),e('cancel','refund','có hoàn'),e('continue','downstream'),e('refund','downstream')]},

    {id:'contracts',number:'02',navLabel:'Hợp đồng',title:'Hợp đồng · vào ở · gia hạn · kết thúc',description:'Contract/RentalCycle/Occupancy là trục authoritative; Customer.roomId chỉ là projection vận hành.',nodes:[
      n('origin',1,0,'Khởi tạo DRAFT','Thuê ngay / booking','Tạo mới hoặc convert booking cùng customer, room và cycle.',['Không sao chép chữ ký cũ.','Replay không tạo HĐ thứ hai.'],'Contract DRAFT.',['contractApi','contract']),
      n('parties',1,1,'Bên thuê và người ở','Payer / occupants','Khai báo đại diện thanh toán, thành viên, ngày ở, giá, điều khoản.',['Ghép: obligation theo contract.','Nguyên căn: đại diện nhận nghĩa vụ phòng.'],'Parties/occupants rõ vai.',['contract','customer']),
      n('deposit',1,2,'Đối chiếu cọc','Đủ / thiếu / thừa','Đọc DepositLedger; chuyển booking hoặc tạo SECURITY.',['Thiếu: QR bổ sung.','Thừa: credit/refund.'],'Cọc đủ activation.',['dep','depPolicy'],[],'deposits'),
      n('approval',1,3,'Submit → approve','Capacity gate','Duyệt dưới khóa; WHOLE độc quyền, SHARED kiểm occupancy + hold/capacity.',['Không bypass approval.','Giữ room RESERVED phù hợp.'],'APPROVED.',['contract']),
      n('signature',1,4,'Ký và lưu bằng chứng','signedAt / file','Ngày ký và attachment là bằng chứng trước activation.',['Không ký trước logic cho phép.','Giữ version/history.'],'Sẵn sàng activate.',['contract','contractAdapter']),
      n('activate',1,5,'Activate + Occupancy','ACTIVE','Kiểm lại cọc, hold, room, capacity trong transaction.',['Cycle/contract ACTIVE.','Room OCCUPIED, mở occupancy.'],'Quyền ở bắt đầu.',['contract','room']),
      n('billing',1,6,'Phát hành nghĩa vụ','ENTRY → monthly','Invoice đầu kỳ theo ngày thực; kỳ sau từ Tổng hợp.',['QR cọc và QR thuê là nghĩa vụ riêng.','Lỗi QR còn trace/retry.'],'Invoice + PaymentRequest.',['contract','settle'],[],'settlement'),
      n('renew',0,7,'Gia hạn ở tiếp','HĐ/cycle mới','Gia hạn tạo DRAFT kế tiếp, không sửa đè HĐ đã ký.',['Start sau endDate cũ.','Duyệt/ký/activate lại.'],'Lịch sử cũ giữ nguyên.',['contract']),
      n('end',2,7,'Hết hạn / trả sớm','Settlement → terminal','Preview nợ/phí/cọc, đóng đúng occupancy rồi expire/terminate.',['Thu thiếu hoặc hoàn dư.','Khách ghép rời không đóng người khác.'],'Terminal + history/công nợ.',['contract','contractAdapter'],[],'reports')
    ],edges:[e('origin','parties'),e('parties','deposit'),e('deposit','approval'),e('approval','signature'),e('signature','activate'),e('activate','billing'),e('billing','renew','ở tiếp'),e('billing','end','kết thúc'),e('renew','approval','duyệt lại',true)]},

    {id:'reports',number:'03',navLabel:'Báo cáo',title:'Báo cáo · nguồn số liệu · kỳ · xuất file',description:'Invoice revenue, cash movement, posted journal và deposit liability có basis khác nhau; không gộp thành một con số mơ hồ.',nodes:[
      n('scope',1,0,'Chọn kỳ và phạm vi','Tenant / building / room','Áp dụng tenant, khoảng thời gian và asset filter nhất quán.',['Chọn timezone/kỳ.','Giữ filter khi export.'],'Report query rõ scope.',['reportsPage','reports']),
      n('cashflow',0,1,'Cashflow','Cash accounts','Đọc journal trên cash accounts để phản ánh tiền vào/ra đã hạch toán.',['Thu = inflow.','Chi/refund = outflow.'],'Net cash movement.',['reports','finance']),
      n('profit',1,1,'Profit & Loss','Posted journal','P&L đọc posted lines; booking-hold revenue bị loại để cọc không thành doanh thu.',['Revenue/expense theo kỳ.','Cash không thay profit.'],'Net profit.',['reports']),
      n('revenue',2,1,'Doanh thu theo tài sản','Building / room','Invoice-based breakdown theo tòa/phòng, khác cashflow.',['Ghi rõ billed/paid metric.','Không so khác basis như cùng KPI.'],'Revenue breakdown.',['reports','building']),
      n('deposits',0,2,'Nghĩa vụ cọc','Ledger balance','Cọc còn giữ là liability theo balanceEffect và reversal.',['Không cộng Deposit.amount tĩnh.','Refund/keep/deduct đổi balance.'],'Deposit liability.',['reports','dep']),
      n('aging',1,2,'Công nợ phải thu','Aging buckets','Invoice issued/partial/overdue được phân nhóm theo hạn.',['Đối chiếu allocations.','Không giấu NEEDS_REVIEW.'],'Receivable aging.',['reports','payment']),
      n('quality',2,2,'Kiểm tra chênh lệch','Orphan / mismatch','So invoice, payment, journal và webhook review trước khi chốt.',['Cảnh báo PAID thiếu journal.','Giữ link chứng từ.'],'Danh sách cần xử lý.',['finance']),
      n('export',1,3,'Xuất báo cáo','XLSX / PDF','Export dùng cùng filter/định nghĩa với màn hình và ghi generatedAt.',['Không coi file là snapshot khóa kỳ nếu chưa khóa.','Có drill-down/source.'],'File quản trị/đối soát.',['reports','reportsPage'],[],'revenue')
    ],edges:[e('scope','cashflow'),e('scope','profit'),e('scope','revenue'),e('cashflow','deposits'),e('profit','aging'),e('revenue','quality'),e('deposits','export'),e('aging','export'),e('quality','export')]},

    {id:'expenses',number:'04',navLabel:'Chi phí',title:'Chi phí · duyệt · trả · journal · owner',description:'Khoản chi PAID phải chuyển trạng thái và ghi journal nguyên tử; không được là đường tắt từ payload create.',nodes:[
      n('draft',1,0,'Tạo khoản chi','DRAFT','Nhập asset, category, amount, vendor, owner và chứng từ.',['Amount dương, đúng tenant.','DRAFT chưa giảm tiền.'],'Expense DRAFT.',['financeApi','expensePage'],[issue('fixed','EXP01','Đã khóa trạng thái create','API chỉ nhận PENDING khi tạo; APPROVED/PAID phải đi qua endpoint duyệt/trả với quyền riêng và journal transaction.','Theo dõi thêm policy quyền finance.create/approve/pay trong UAT.')]),
      n('review',1,1,'Kiểm tra và duyệt','APPROVED','Xác minh chứng từ, phạm vi và owner chịu chi.',['Khóa amount khi PAID/posted.','Audit before/after.'],'APPROVED.',['finance']),
      n('pay',1,2,'Đánh dấu đã chi','PAID','Luồng approve markPaid hiện cập nhật PAID và post journal cùng transaction.',['paidAt/paidBy.','Debit expense, credit cash/payable.'],'PAID + posted journal.',['finance']),
      n('owner',0,3,'Phân bổ owner','Trả hộ / cost center','Khoản trả hộ tạo quan hệ phải thu/trả giữa owner.',['Không trộn tenant.','Trace về expense.'],'Owner allocation.',['finance','building']),
      n('cancel',2,3,'Hủy khoản đã chi','Reversal','PAID không được xóa/cancel thẳng; phải đảo journal và giữ lý do.',['Giữ bản gốc.','Tạo bút toán đảo.'],'CANCELLED + reversal.',['finance']),
      n('settle',0,4,'Đối soát owner','Settlement status','Tính số còn phải hoàn từ expense đủ điều kiện.',['Chỉ APPROVED/PAID theo rule.','Drill-down từng khoản.'],'Owner payable/receivable.',['finance']),
      n('report',1,4,'Đưa vào P&L','Kỳ / tòa nhà','Posted expense giảm profit; metadata cho breakdown vận hành.',['DRAFT không vào actual expense.','Soát PAID orphan.'],'Expense report/net profit.',['reports','finance'],[],'reports'),
      n('audit',2,4,'Audit và thông báo','Admin / operator','Duyệt, trả, hủy và reversal ghi actor; delivery tách khỏi journal.',['Giữ chứng từ.','Gửi workflow theo cấu hình.'],'Operational trace.',['audit','comm'],[],'activities')
    ],edges:[e('draft','review'),e('review','pay'),e('pay','owner'),e('pay','cancel','đảo'),e('owner','settle'),e('settle','report'),e('cancel','report'),e('pay','audit','event',true)]},

    {id:'notifications',number:'05',navLabel:'Thông báo',title:'Thông báo · queue · Zalo khách · nhóm Admin',description:'Thành công nghiệp vụ và thành công delivery là hai trạng thái khác nhau.',nodes:[
      n('event',1,0,'Sự kiện nghiệp vụ','Outbox / result','Cọc, HĐ, invoice, payment, quá hạn tạo event có tenant/context.',['Chỉ phát sau commit.','Event key chống trùng.'],'Notification intent.',['comm','payment']),
      n('recipient',1,1,'Xác định người nhận','Customer / Admin','Tra Zalo registration, payer và chat nhóm Admin.',['Phone không phải chat_id.','Tách tin khách/Admin.'],'Recipient hợp lệ.',['zalo','adminZalo']),
      n('template',1,2,'Template + preference','Published version','Chọn template, validate biến và áp dụng kênh.',['Thiếu biến fail rõ.','Giữ version rollback.'],'Payload.',['comm']),
      n('queue',1,3,'Đưa vào queue','PENDING','Tạo item theo tenant/channel/provider.',['Retry count/scheduledAt.','Admin retry/cancel.'],'Queue item.',['commApi','comm']),
      n('deliver',1,4,'Provider gửi','In-app / Zalo / email','Gửi message/QR và tạo delivery.',['Zalo dùng chat/user id.','Admin group nhận cảnh báo.'],'SENT hoặc FAILED.',['providers','adminZalo']),
      n('retry',0,5,'Retry / dead-letter','Định kỳ 5 phút','Scheduler quét lỗi; retry không tạo side effect tài chính.',['Giữ error/số lần.','Vượt ngưỡng cần can thiệp.'],'Final delivery/dead letter.',['commJob','comm']),
      n('inbox',2,5,'Inbox web','SSE + fallback','Header mở SSE authenticated và cập nhật chung SWR cache; inbox không còn poller 15 giây riêng.',['Hiển thị in-app notifications.','Fallback polling chỉ khi stream lỗi.'],'User inbox realtime.',['commApi','commPage'],[issue('fixed','NOT01','Đã nối inbox vào luồng SSE chung','Header duy trì SSE/reconnect và cache key notifications-list; trang inbox bỏ poller 15 giây trùng lặp.','Theo dõi reconnect/tenant isolation trên môi trường production.')]),
      n('feedback',1,6,'Phản hồi đúng domain','Khách + Admin','Chỉ báo PAID sau allocation và REFUNDED sau receipt complete.',['Review case chỉ cảnh báo Admin.','Delivery vẫn audit riêng.'],'Thông điệp khớp trạng thái.',['payment','dep'],[],'activities')
    ],edges:[e('event','recipient'),e('recipient','template'),e('template','queue'),e('queue','deliver'),e('deliver','retry','FAILED'),e('deliver','inbox','IN_APP'),e('retry','deliver','retry',true),e('inbox','feedback'),e('deliver','feedback')]},

    {id:'tenants',number:'06',navLabel:'Khách thuê',title:'Khách thuê · định danh · vai trò · nhiều chu kỳ',description:'Customer là hồ sơ gốc; tiền và quyền ở truy qua deposit/contract/occupancy/cycle.',nodes:[
      n('capture',1,0,'Nhập hồ sơ','Identity / phone','Thu tên, giấy tờ, phone, địa chỉ và liên hệ.',['Chuẩn hóa phone/identity.','Đúng tenant.'],'Customer candidate.',['customerApi','customer']),
      n('dedupe',1,1,'Kiểm tra trùng','Idempotent create','Tìm theo định danh chuẩn; merge có kiểm soát.',['Replay không tạo bản hai.','Merge giữ history links.'],'Một Customer chuẩn.',['customer']),
      n('role',1,2,'Chọn vai trò thuê','Ghép / nguyên căn','Khách có HĐ riêng, đại diện nguyên căn hoặc occupant cùng HĐ.',['HĐ riêng có nghĩa vụ riêng.','Occupant không tự có bộ cọc/invoice.'],'Role trong contract.',['contract','room']),
      n('zalo',1,3,'Liên kết Zalo','Chat/user id','Đăng ký nhận QR, invoice, reminder và kết quả.',['Xác nhận đúng Customer.','Không gửi nhầm payer.'],'Zalo registration.',['zalo','providers'],[],'notifications'),
      n('active',1,4,'Gắn HĐ và phòng','Authoritative relations','Contract/Occupancy/Cycle quyết định khách ở đâu và obligation mở.',['roomId chỉ là projection.','Sync sau activate/move/transfer.'],'Current rental state.',['customer','contract']),
      n('detail',0,5,'Hồ sơ 360°','Drawer','Gom profile, room, HĐ, cọc, invoice, audit để đọc.',['Balance vẫn lấy module nguồn.','Deep-link chứng từ.'],'Một cửa tra cứu.',['tenantDrawer','tenantPage']),
      n('move',2,5,'Chuyển / rời phòng','Occupancy history','Đóng/mở đúng occupancy mà không xóa Customer history.',['Ghép rời không đóng người khác.','Transfer kiểm capacity.'],'Occupancy timeline.',['contract']),
      n('delete',1,6,'Ngừng hồ sơ','Soft delete guard','Chặn delete khi còn contract non-terminal; soft delete giữ báo cáo.',['Xử lý obligation trước.','Giữ audit/chứng từ.'],'Inactive + preserved history.',['customer'],[],'activities')
    ],edges:[e('capture','dedupe'),e('dedupe','role'),e('role','zalo'),e('zalo','active'),e('active','detail'),e('active','move'),e('detail','delete'),e('move','delete')]},

    {id:'settlement',number:'07',navLabel:'Tổng hợp',title:'Tổng hợp tháng · điện nước · invoice · nhắc tiền',description:'/summary là monthly settlement: usage → snapshot → close → invoice → notification → payment.',nodes:[
      n('scope',1,0,'Chọn kỳ và tòa','Month / building','Tải overview và các phòng/HĐ cần chốt.',['Loại occupancy ngoài kỳ.','Hiện blocker trước close.'],'Settlement scope.',['summaryPage','settleApi']),
      n('occupancy',1,1,'Chụp người ở','Contract / occupancy','Resolve HĐ và headcount hợp lệ trong kỳ.',['Nguyên căn chọn đại diện.','Ghép phân bổ đúng member/HĐ.'],'Billing subjects.',['settle','contract']),
      n('usage',1,2,'Chốt điện Hunonic','Cuối tháng','Ngày 28–31 lúc 23:59:59 finalize usage; lưu reading và khóa kỳ.',['Kiểm meter mapping.','Không sửa âm thầm kỳ khóa.'],'Final electricity.',['settleJob','hunonic']),
      n('allocate',1,3,'Phân bổ tiền','Nước 100.000/người','Nước theo headcount; điện nguyên căn vào đại diện, điện ghép chia eligible subjects.',['Rent theo contract.','Phí phát sinh có source.'],'Allocation per contract.',['settle']),
      n('snapshot',1,4,'BillingSnapshot','Immutable inputs','Chụp occupancy, meter, rate, allocation để tái hiện invoice.',['Block thiếu dữ liệu.','Close không đọc live để sửa cũ.'],'Immutable snapshot.',['settle']),
      n('close',1,5,'Đóng tháng','Invoice items','closeMonth phát hành rent/electric/water/fee items idempotently.',['Link cycle/room/customer.','Không tạo trùng khi retry.'],'Invoice ISSUED.',['settle','settleApi']),
      n('notify',1,6,'08:00 ngày 01','QR qua Zalo','Scheduler gửi invoice/payment request tới payer đã đăng ký.',['Lưu delivery.','Retry riêng.'],'Khách nhận QR.',['settleJob','providers'],[],'notifications'),
      n('remind',0,7,'Nhắc mỗi ngày','Quá 3 ngày → Admin','Follow-up quét 30 phút nhưng giới hạn theo rule/ngày; quá 3 ngày cảnh báo Admin.',['Không nhắc paid.','Giữ last reminder state.'],'Customer reminder/Admin alert.',['settleJob','comm']),
      n('paid',2,7,'Đã nhận tiền','Client + Admin','Sau allocation đủ mới báo thành công tới Zalo khách và nhóm Admin.',['Sai/thiếu mã còn review.','Chỉ báo sau side effect.'],'PAID + notifications.',['payment','adminZalo'],[],'transactions')
    ],edges:[e('scope','occupancy'),e('occupancy','usage'),e('usage','allocate'),e('allocate','snapshot'),e('snapshot','close'),e('close','notify'),e('notify','remind','chưa trả'),e('notify','paid','đã trả'),e('remind','paid','nhận tiền')]},

    {id:'buildings',number:'08',navLabel:'Tòa nhà',title:'Tòa nhà · tầng · phòng · sức chứa · trạng thái',description:'Trạng thái phòng phản ánh hold/contract/occupancy, không phải nhãn chỉnh tay độc lập.',nodes:[
      n('owner',1,0,'Owner / cost center','Finance scope','Đặt owner/cost center cho revenue, expense, settlement.',['Mọi entity có tenantId.','Owner allocation truy về tòa.'],'Ownership scope.',['building','finance']),
      n('building',1,1,'Tạo tòa nhà','Địa chỉ / config','Container cho tầng, phòng, meter và report.',['Không xóa khi quan hệ active.','Giữ operational metadata.'],'Building.',['building','buildingsPage']),
      n('floor',1,2,'Khai báo tầng','Hierarchy','Tầng thuộc đúng building/tenant và có delete guard.',['Giữ history khi referenced.','Mã/tên nhất quán.'],'Floor.',['floor']),
      n('room',1,3,'Khai báo phòng','WHOLE / SHARED','Đặt code, rental type, capacity, giá và meter mapping.',['WHOLE độc quyền.','SHARED theo capacity.'],'Room rentable.',['room']),
      n('availability',1,4,'Tính khả dụng','Hold + occupancy','Create/approve/activate kiểm thực trạng dưới khóa.',['Tính hold còn hạn.','Tính occupant + memberCount.'],'Availability decision.',['room','contract']),
      n('state',1,5,'Đồng bộ room state','AVAILABLE/RESERVED/OCCUPIED','Lifecycle cọc/HĐ cập nhật projection sau commit.',['Hold → RESERVED.','Occupancy → OCCUPIED.'],'Room status.',['contract','dep']),
      n('detail',0,6,'Chi tiết phòng','HĐ / roommates','Hiển thị visible contracts, parties và roommates.',['Không gộp obligations HĐ ghép.','Deep-link source.'],'Operational view.',['room','buildingsPage']),
      n('downstream',2,6,'Phân bổ theo tài sản','Summary / finance','Building/room keys đi vào settlement, revenue, expense, report.',['Giữ ID qua snapshot/journal.','Soft delete giữ history.'],'Asset analytics.',['settle','reports'],[],'revenue')
    ],edges:[e('owner','building'),e('building','floor'),e('floor','room'),e('room','availability'),e('availability','state'),e('state','detail'),e('state','downstream')]},

    {id:'revenue',number:'09',navLabel:'Doanh thu',title:'Doanh thu · công nợ · tiền thu · lợi nhuận',description:'Tách receivable, collected cash, recognized revenue và deposit liability.',nodes:[
      n('invoice',1,0,'Phát hành invoice','Receivable','Invoice tạo khoản phải thu, chưa phải có tiền.',['Lưu source/kỳ.','Theo dõi issued/partial/overdue/paid.'],'Accounts receivable.',['settle','reports']),
      n('collection',1,1,'Thu và phân bổ','PaymentAllocation','Webhook/tiền mặt hợp lệ được apply vào invoice/deposit.',['Ảnh CK không đủ kết luận.','Allocation quyết định balance.'],'Collected cash.',['payment'],[],'transactions'),
      n('journal',1,2,'Ghi journal','POSTED / REVERSED','Journal là nguồn P&L/cashflow; reversal vô hiệu thay vì xóa.',['Revenue theo kỳ/policy.','Cash theo payment/refund/expense.'],'Accounting effects.',['finance','reports']),
      n('deposit',0,3,'Tách tiền cọc','Liability','Cọc còn nghĩa vụ hoàn/khấu trừ không cộng revenue.',['Keep/deduct mới đổi bản chất phù hợp.','Balance từ ledger.'],'Deposit liability.',['dep','reports']),
      n('expense',2,3,'Trừ chi phí','Net profit','Expense paid/posted giảm profit và cash.',['Theo building/owner.','Hủy qua reversal.'],'Net operating result.',['finance'],[],'expenses'),
      n('views',1,4,'Góc nhìn doanh thu','Building / room / owner','Finance tổng hợp ledger, cashflow, P&L, building/owner profit.',['Ghi rõ billed/collected/recognized.','Không trộn basis.'],'KPI có định nghĩa.',['financeApi','financePage']),
      n('analytics',0,5,'Analytics theo kỳ','Authoritative reporting','Revenue và finance analytics đọc profit-loss history/building profit summary theo tenant/kỳ, không còn số mẫu.',['Cache theo tenant.','Giữ period/basis trong response.'],'Revenue/finance analytics có nguồn chuẩn.',['analytics'],[issue('fixed','REV01','Đã nối analytics vào finance reporting','AnalyticsService lấy revenue history và building profit summary từ FinanceReportingService; dữ liệu không còn hard-code và giữ tenant scope.','Bổ sung parity monitor nếu frontend cần cùng filter kỳ như /reports.')]),
      n('report',2,5,'Báo cáo / dashboard','Export + drill-down','KPI đúng basis được đưa ra và truy về invoice/payment/journal.',['Ghi generatedAt/filter.','Giữ references.'],'Số kiểm chứng được.',['dashboard','reports'],[],'reports')
    ],edges:[e('invoice','collection'),e('collection','journal'),e('journal','deposit','loại liability'),e('journal','expense','trừ'),e('deposit','views'),e('expense','views'),e('views','analytics'),e('views','report')]},

    {id:'transactions',number:'10',navLabel:'Lịch sử giao dịch',title:'Lịch sử giao dịch · SePay · sai mã · thiếu/thừa · trùng',description:'Cùng transaction ID là replay; cùng nội dung nhưng ID khác là giao dịch riêng cần review.',nodes:[
      n('request',1,0,'PaymentRequest + QR','Expected route','Lưu code, amount, source và bank account dự kiến.',['QR đúng payer.','Request có state/expiry.'],'Expected record.',['paymentApi','payment']),
      n('receive',1,1,'SePay webhook','WebhookLog','Ghi request; kiểm chữ ký, bank routing, transaction ID.',['Replay ID không tạo payment.','Giữ evidence.'],'Received/idempotent.',['payment']),
      n('classify',1,2,'Phân loại','Match matrix','Đối chiếu code, account, amount và request state.',['MATCHED.','UNMATCHED/WRONG_BANK/SHORT/OVER/REVIEW.'],'Status + reason.',['finance','payment']),
      n('duplicate',0,3,'Trùng nội dung, khác ID','DUPLICATE_CONTENT','Không coi là replay; giữ cả hai và chuyển review.',['Không tự gộp/xóa.','Finance xác minh hai khoản thực nhận.'],'NEEDS_REVIEW + prior ref.',['payment','finance']),
      n('mismatch',2,3,'Sai mã / thiếu / thừa','Manual review','Sai route không auto apply; thiếu/thừa cần policy rõ.',['Thiếu không tự cộng tùy tiện.','Thừa thành overpayment.'],'Pending resolution.',['payment']),
      n('apply',1,4,'Payment + Allocation','Financial side effect','Match/manual assign hợp lệ tạo payment/allocation trong transaction.',['Không vượt dư nợ.','Manual action có audit.'],'Balance cập nhật.',['payment']),
      n('overpay',0,5,'Xử lý tiền thừa','Refund / credit / carry','Dư tiền có quyết định và chứng từ, không mặc định revenue.',['Refund cash-out.','Credit/carry giữ trace.'],'Overpayment resolution.',['payment']),
      n('notify',2,5,'Xác nhận kết quả','Khách + Admin','Chỉ báo nhận đủ sau financial side effect; review chỉ alert Admin.',['Không báo PAID sớm.','Delivery retry riêng.'],'Correct notification.',['payment','adminZalo'],[],'notifications'),
      n('history',1,6,'Bề mặt lịch sử','Unified + Bank/SePay','/finance/transactions có tab Tất cả dòng tiền từ reconciliation journal và tab Bank/SePay để tra webhook.',['Cash/manual/refund/journal gom theo journal entry.','Bank view giữ match status chuyên sâu.'],'Unified transaction feed + bank drill-down.',['transactionPage','bankHistory'],[issue('fixed','TX01','Đã thêm transaction timeline hợp nhất','Trang giao dịch có tab tất cả dòng tiền dùng /finance/reconciliation, nhóm cash in/out, source path và trạng thái; tab ngân hàng/SePay vẫn giữ review chuyên sâu.','Theo dõi pagination khi dữ liệu lớn và bổ sung drill-down chi tiết nếu cần.')], 'activities')
    ],edges:[e('request','receive'),e('receive','classify'),e('classify','duplicate','trùng memo'),e('classify','mismatch','lệch'),e('classify','apply','khớp'),e('duplicate','apply','đã xác minh'),e('mismatch','apply','manual'),e('apply','overpay','có dư'),e('apply','notify','đủ'),e('overpay','history'),e('notify','history')]},

    {id:'activities',number:'11',navLabel:'Nhật ký vận hành',title:'Nhật ký vận hành · actor · request · before/after',description:'Audit là dấu vết thao tác, khác lịch sử dòng tiền; command thành công không nên mất audit.',nodes:[
      n('command',1,0,'Lệnh nghiệp vụ','Module / action','Create/update/approve/pay/cancel/activate/close cần audit entity + tenant.',['Naming thống nhất.','Không ghi secret.'],'Audit context.',['audit']),
      n('context',1,1,'Actor + request','User / IP / UA','Gắn user, tenant, request ID, IP, user-agent, correlation.',['Scheduler actor SYSTEM.','Webhook có provider ref.'],'Trace context.',['audit']),
      n('diff',1,2,'Before / after','Entity snapshot','Lưu thay đổi có ý nghĩa, redact dữ liệu nhạy cảm.',['Giữ entityId.','Giữ operation key.'],'Audit payload.',['audit']),
      n('persist',1,3,'Ghi AuditLog','Retry + fail loudly','AuditService retry 3 lần và ném lỗi sau lần cuối; caller không còn bị che mất trạng thái audit.',['Retry ngắn cho lỗi tạm thời.','Failure cuối được surface để command/monitor xử lý.'],'AuditLog hoặc lỗi có thể quan sát.',['audit'],[issue('fixed','AUD01','Đã bỏ nuốt lỗi audit','AuditService retry tối đa 3 lần, log từng lần và throw sau lần cuối thay vì chỉ console.error.','Theo dõi alert/monitoring và cân nhắc outbox nếu cần tách audit khỏi transaction nghiệp vụ.')]),
      n('query',1,4,'Lọc nhật ký','Module/action/email','API trả log gần nhất và filter; hiện giới hạn tối đa 100.',['Cần pagination dài kỳ.','Luôn tenant scoped.'],'Filtered list.',['auditApi','auditClient']),
      n('screen',1,5,'Màn /activities','Operational timeline','Hiển thị actor, action, module, time và metadata.',['Deep-link entity.','Không thay transaction history.'],'Readable audit trail.',['activitiesPage']),
      n('feedback',1,6,'Phát hiện điểm đứt','Gap / error / abuse','So domain event với audit/outbox để tìm thao tác thiếu dấu vết.',['Cảnh báo success thiếu audit.','Kết nối mọi tab.'],'Evidence cải tiến logic.',['audit','sidebar'],[],'overview')
    ],edges:[e('command','context'),e('context','diff'),e('diff','persist'),e('persist','query'),e('query','screen'),e('screen','feedback')]}
  ];
  return {sources,chapters};
})();
