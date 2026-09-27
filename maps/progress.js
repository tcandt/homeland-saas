(function () {
  'use strict';
  // Persisted task state: update with each implementation/verification step.
  // Do not infer completion from the colour of a risk or a historical PASS log.
  var work = {
    P0: ['doing', 'Đã thêm guard bỏ phản hồi hồ sơ khi phòng thay đổi, chống chọn đồng thời, và sửa Room API/UI để hợp đồng DRAFT/PENDING hiện khách trong phòng thay vì báo trống. Còn E2E giữ context phòng và retry toàn hành trình.'],
    P1: ['doing', 'Đã bổ sung phoneNormalized/identityNoNormalized tenant-scoped, NFKC Unicode canonicalization, guard số điện thoại bắt buộc và unique index active theo tenant; 31 test focused, Prisma validate và API typecheck PASS. Migration chưa chạy trên DB cô lập vì initdb Windows bị chặn; còn CI disposable-PostgreSQL và E2E chọn hồ sơ cũ/mới.'],
    P2: ['done', 'RoomPremiumModal đã chuẩn hóa flow Tòa nhà → Tầng → Phòng → Khách thuê → chọn Cọc giữ phòng/Ở ngay; header popup có breadcrumb click quay lại/xem flow; tab Tài chính không còn nút mở popup tạo hóa đơn; các nút tạo hóa đơn/thêm khách trực tiếp đang tạm làm mờ và khóa.'],
    P3: ['doing', 'Cọc giữ phòng từ popup phòng tự tạo hợp đồng cọc DRAFT + Deposit/RoomHold/RentalCycle + invoice/payment request QR; Ở ngay tự tạo contract DRAFT + invoice đầu kỳ + QR; phòng có hợp đồng nháp/chờ duyệt nay hiển thị khách và trạng thái đặt cọc/chờ HĐ, kể cả khi room cache còn status trống. Còn E2E retry/staging toàn chuỗi.'],
    P4: ['doing', 'Đã nối tự sinh invoice/issue/payment request và gửi QR qua Zalo nếu khách đã đăng ký. Còn E2E payment code match SePay và kiểm thử prorate/ma trận cọc.'],
    P5: ['doing', 'Sau thu tiền thủ công, client đã invalidation cả invoice và toàn bộ Finance query keys nên màn hình Finance đang mở refetch thay vì giữ số ledger/KPI/P&L cũ (focused 1/1, web typecheck đạt). Còn đối soát xuyên tab, chi phí phát sinh và realtime đa tab theo P39.'],
    P6: ['doing', 'Evidence API một phần; còn manual/SePay E2E đủ ma trận.'],
    P7: ['doing', 'Còn chứng từ chi thực tế và E2E hoàn/giữ/khấu trừ.'],
    P8: ['doing', 'Còn E2E WHOLE đại diện/thành viên và nước theo đầu người.'],
    P9: ['doing', 'Còn UAT SHARED và đối chiếu Hunonic thật.'],
    P10: ['doing', 'Còn kiểm chứng dữ liệu legacy; không tự apply backfill.'],
    P11: ['doing', 'Có snapshot core; còn UAT và gate dữ liệu thật.'],
    P12: ['doing', 'Có monthly invoice core; còn UAT WHOLE/SHARED.'],
    P13: ['doing', 'Đã thêm cấu hình số ngày nhắc trước/quá hạn trong Admin Settings → Tự động thông báo và scheduler đọc setting theo tenant. Còn UAT gửi thật qua kênh đã bật.'],
    P14: ['doing', 'Đã fail-closed trạng thái khai báo tạm trú: chỉ marker từ server mới hiển thị đã khai báo, không dùng localStorage của trình duyệt làm bằng chứng. Còn task tenant-backed, deadline/assignee và file evidence sau gia hạn.'],
    P15: ['doing', 'API có evidence lịch sử; còn CORE-10.04 staging.'],
    P16: ['doing', 'Reports đã chuyển khỏi tổng hợp client bị giới hạn 500 bản ghi: dùng các API aggregate có thẩm quyền và receivable trả thẳng invoice/customer/room/building, không ghép theo tên khách. Còn E2E drill-down trên môi trường thật và FIN đối soát báo cáo với JournalLine/receipt.'],
    P17: ['blocked', 'Đã sửa project thành Desktop 1366; --list nhận 30 test/11 file. Chưa chạy E2E: thiếu staging URL/credential và 11 ảnh.'],
    P18: ['doing', 'SePay sandbox đã nhận 3 webhook thật qua 2 VA BIDV và IGNORED đúng kỳ vọng vì chưa có mã thanh toán. Đã sửa modal tạo cọc/QR: idempotency-key hợp lệ, DB enum CREATE local, chọn/auto dùng khách hiện có, cọc giữ chỗ phòng trống dùng QR deposit thay vì invoice, hiển thị QR/paymentCode ngay trong modal, và không còn gửi enum HELD không tồn tại. Backend tạo cọc nay gắn RoomHold, chuyển phòng RESERVED, gắn khách vào phòng, tạo task admin cập nhật hợp đồng/thông tin khách; frontend refresh deposits/rooms/buildings/customers. Đã cố định INSERT DepositOperation với sourceDepositId bắt buộc + targetDepositId NULL và guard operationId. Còn cần test payment code match invoice/deposit và UAT end-to-end.'],
    P19: ['blocked', 'Local preflight không thay thế backup off-host/restore drill và production preflight.'],
    P20: ['blocked', 'LIVE NO-GO; phụ thuộc P17–P19 và release sign-off.'],
    P21: ['doing', 'Đã sửa API/UI không suy diễn rate mode thiếu dữ liệu thành EVN; chặn chốt snapshot/hóa đơn bằng HUNONIC_RATE_MODE_UNVERIFIED. Còn payload Hunonic thật và UAT.'],
    P22: ['doing', 'Đã sửa offline/unknown không suy ra online từ thời điểm sync; cảnh báo quá hạn sau 30 phút; timestamp không dùng updatedAt/giờ hiện tại. Còn UAT provider thật.'],
    P23: ['doing', 'Đã giữ aggregate tháng bằng 0 ở KPI/bảng/card/CSV. Còn đối chiếu 3 phòng × 3 kỳ.'],
    P24: ['doing', 'Đã thêm distributed scheduler lock cho cron 15 phút và retry/backoff khi fetch Hunonic provider. Còn UAT provider thật và quan sát nhiều worker trên staging.'],
    P25: ['doing', 'Có append-only core; còn gate cron tích hợp và payload provider thật.'],
    P26: ['doing', 'Lịch sử Hunonic đã dùng filter tenant-scoped building/room/year/month/search từ metadata API, không còn fallback tòa/năm cứng; đổi filter quay về trang 1. Còn E2E DB-backed xem tháng cũ và observation drill-down.'],
    P27: ['doing', 'Snapshot core có evidence; còn UI delta sau khóa và gate staging.'],
    P28: ['doing', 'Đã chặn notification-worker chạy cron tạo invoice/chốt điện; scheduler focused 4/4 PASS. Còn guard persisted reading cuối kỳ và chạy nhiều API worker.'],
    P29: ['doing', 'Còn E2E Đồng hồ → Tổng hợp → Hóa đơn cùng snapshot.'],
    P30: ['blocked', 'Chưa đủ integration/E2E/UAT 3 phòng × 3 kỳ và ký FIN/OPS.'],
  };
  var completed = {
    P0: 'Guard context phòng khi tải hồ sơ bất đồng bộ, chống chọn đồng thời, và đồng bộ room profile với contract DRAFT/PENDING để không còn phòng trống nhưng có kỳ thuê. Review độc lập PASS; web/API typecheck PASS.',
    P1: 'API detail trả đầy đủ Occupancy mở; kiểm tra helper production và fail-closed binding thiếu; duplicate lookup không lộ/trả nhầm khách tenant khác. Web selection 6/6, API controller 3/3, customer service 7/7 PASS; review PASS.',
    P2: 'Hai nhánh mục tiêu thuê từ tab Khách thuê; không tạo nghiệp vụ mới từ popup Hóa đơn. Booking/Ở ngay giữ room context và chỉ sinh một nhánh.',
    P3: 'Server create deposit + RoomHold/RentalCycle + DepositOperation idempotent; room/customer/building sync; booking/ở ngay tạo contract DRAFT, invoice và payment request QR; Room API trả pending contract cho hồ sơ phòng. Web focused 122/122, API focused PASS, API/web typecheck PASS.',
    P4: 'Tab Tài chính chỉ xem invoice/QR; tạo invoice từ RoomPremiumModal sau khi lưu khách, không còn InvoiceCreateModal tại ngữ cảnh phòng. Ở ngay tạo invoice đầu kỳ và payment request, booking tạo invoice cọc.',
    P13: 'Admin Settings có 3 ô cấu hình ngày nhắc: hóa đơn sắp đến hạn, hóa đơn quá hạn, hợp đồng sắp hết hạn. RuleScheduler đọc AppSetting notifications theo tenant; scheduler focused 4/4, API typecheck và web typecheck PASS.',
    P17: 'Lệnh CORE-10.04 chọn đúng Desktop 1366; Playwright --list nhận 30 test trong 11 file (không phải chạy E2E). Review PASS.',
    P18: 'Phạm vi UAT đã được owner phê duyệt: tùy chọn 3 phòng mẫu trên 4 căn, 3 tháng gần nhất, sync Hunonic thật vào staging, SePay sandbox theo Speaker API, sign-off bởi chủ nhà, pass khi đối soát >=99%. Đã sửa lỗi UI Settings SePay khóa secret lần đầu, modal bank bị chìm, modal tạo cọc/QR bị chặn bởi duplicate customer + thiếu idempotency-key, DB enum CREATE local, và luồng cọc giữ chỗ phòng trống dùng QR deposit thay vì invoice nên tránh INVOICE_CREATE_SCOPE_MISMATCH. Cọc giữ phòng nay đồng bộ RoomHold/phòng RESERVED/khách vào phòng, tạo task admin cập nhật hợp đồng, refresh Buildings/Customers ngay sau submit và hiển thị QR/paymentCode trực tiếp trong modal; trạng thái HELD không hợp lệ đã được loại bỏ. DB có HMAC mode + 2 VA BIDV active; webhook health 200; valid HMAC probe qua tunnel trả 200, invalid trả 401. SePay sandbox đã bắn 3 webhook thật, cả 2 VA đều nhận và xác thực thành công; status IGNORED đúng kỳ vọng vì chưa có payment code trong nội dung. Payments 25/25, deposit-core 17/17, API/web typecheck PASS.',
    P21: 'API unknown pricing + UI badge + guard chốt tiền trước mọi write. API Hunonic/controller 21/21, monthly 92/92, web presentation 6/6 PASS; review PASS.',
    P22: 'Không suy online từ giờ fetch; kiểm tra cả providerObservedAt và lastSyncedAt. Dữ liệu quá 30 phút/mất timestamp hiển thị quá hạn. Web presentation 6/6 + API evidence PASS; review PASS.',
    P23: 'Giữ 0 cho kWh/tiền tháng tại KPI, tổng vùng chọn, bảng, card, CSV và chi tiết lịch sử. Web presentation 6/6 PASS; review PASS.',
    P24: 'Cron sync dùng pg_try_advisory_xact_lock để worker thứ hai bỏ qua trước khi đọc tenant/gọi provider; fetch history/dashboard retry 3 lần với backoff. Hunonic service 21/21 và API typecheck PASS.',
    P28: 'Notification-worker không chạy scheduler chốt điện/sinh hóa đơn. Scheduler 4/4 PASS; review PASS.',
  };
  var labels = { done: 'Đã hoàn thành', doing: 'Đang thực hiện', todo: 'Chưa làm', blocked: 'Bị chặn' };
  // A percentage measures implementation, focused verification, and accepted
  // evidence for this phase only. It is not a release or production metric.
  // 100% is reserved for a whole phase whose stated Definition of Done is met.
  var phaseProgress = {
    P0: [82, 'Hủy/chọn lại/mở lại flow đều vô hiệu hóa context cũ; focused regression 9/9 và web typecheck đạt. Còn E2E đổi phòng, double-click và retry toàn hành trình.'],
    P1: [74, 'Đã hoàn thiện normalized identifiers, guard create/update, NFKC SQL/runtime, retry-safe indexes và test tenant/soft-delete/duplicate (31/31 PASS). Chưa có evidence migration chạy trên PostgreSQL cô lập; còn CI migration gate, legacy reconciliation và E2E chọn hồ sơ cũ/mới.'],
    P2: [100, 'Hai nhánh BOOKING/Ở ngay và ranh giới popup hóa đơn đã hoàn tất trong phạm vi P2.'],
    P3: [80, 'Đã tạo contract/deposit/hold/cycle idempotent; còn E2E replay, rollback và staging toàn chuỗi.'],
    P4: [76, 'Invoice canonical/prorate đã có evidence; còn ma trận cọc đầu kỳ và E2E popup đến QR.'],
    P5: [68, 'Finance authoritative đã có; mutation thu hóa đơn đã invalidation invoice + Finance query keys (focused 1/1, web typecheck đạt). Còn đối soát xuyên tab, chi phí phát sinh và realtime đa tab P39.'],
    P6: [76, 'CAS, allocation và provider reference đã có; còn cash + QR đồng thời, QR cũ, sai nội dung và UAT.'],
    P7: [78, 'Ledger phân bổ và pending refund đã có; còn chứng từ chi thực tế, notification và E2E theo P33.'],
    P8: [75, 'Đã có guard payer/headcount WHOLE; còn UAT đại diện, thành viên và nước theo đầu người.'],
    P9: [80, 'Allocation SHARED bảo toàn tổng đã có; còn UAT roster, capacity và payload Hunonic thật.'],
    P10: [65, 'RentalCycle/Occupancy và lifecycle canonical đã có; còn gate legacy/backfill được phê duyệt.'],
    P11: [82, 'Snapshot create-only/provenance đã có; còn UAT payload thật và gate dữ liệu.'],
    P12: [78, 'MONTHLY_BASE và phân bổ cốt lõi đã có; còn UAT kỳ thực tế và chống overwrite invoice đã phát hành.'],
    P13: [85, 'Setting tenant, registry/scheduler và biên ngày UTC+7 đã đồng nhất; còn provider delivery UAT và renew/no-renew theo P36.'],
    P14: [78, 'Renewal core/GATE-09 đã đạt; adapter không còn nhận localStorage làm khai báo tạm trú (focused 9/9, web typecheck đạt). Còn task tenant-backed, deadline/assignee và file evidence sau gia hạn.'],
    P15: [100, 'Tất toán core, lifecycle, đối soát và GATE-09 đã hoàn thành trong phạm vi P15.'],
    P16: [85, 'Reports dùng aggregate API thay cho dữ liệu client cap 500; metadata phòng/tòa nhà của receivable là trực tiếp nên không nhầm khi trùng tên khách. API unit 7/7 và web typecheck đạt; còn Playwright môi trường thật và FIN đối soát JournalLine/receipt.'],
    P17: [20, 'Đã xác định được bộ E2E/11 ảnh; chưa có lượt chạy staging hiện hành đủ evidence.'],
    P18: [60, 'Webhook sandbox và các sửa popup đã có; còn giao dịch match thật, UAT complete và sign-off.'],
    P19: [40, 'Runbook, script và local preflight đã có; còn backup off-host, restore/rollback drill và owner ký.'],
    P20: [0, 'LIVE NO-GO: chỉ mở sau P17–P19 và release sign-off có evidence.'],
    P21: [80, 'Guard rate mode unknown đã có; còn xác nhận đơn vị/scale/rate từ provider và UAT.'],
    P22: [75, 'Presentation online/offline/stale đã có; còn UAT observation timestamp từ provider thật.'],
    P23: [85, 'Hiển thị số 0 và kỳ snapshot đã có; còn đối chiếu 3 phòng x 3 kỳ bằng số liệu thật.'],
    P24: [80, 'Cron lock và retry/backoff đã có; còn quan sát nhiều worker staging và provider retry thật.'],
    P25: [70, 'Payload identity/append-only đã có; còn integration cron và observation provider thật.'],
    P26: [75, 'Filter lịch sử lấy tòa/phòng/năm/tháng từ metadata/period API, truyền roomCode và reset trang (focused 3/3, web typecheck đạt). Còn E2E DB-backed lịch sử cũ, scope tenant và observation drill-down.'],
    P27: [82, 'Snapshot/delta/provenance UI đã có; còn DB-backed E2E, UAT thật và maintenance gate.'],
    P28: [75, 'Runtime guard đã chặn notification worker chạy scheduler; còn UAT cuối tháng, concurrent API worker và fail-closed evidence.'],
    P29: [75, 'SnapshotId/kỳ và invoice link đã có; còn E2E DB-backed Đồng hồ đến Tổng hợp đến Hóa đơn.'],
    P30: [10, 'Chờ integration/E2E 3 phòng x 3 kỳ, retry/snapshot evidence và FIN/OPS sign-off.']
  };

  function createProgress(id, status) {
    var entry = phaseProgress[id] || [0, 'Chưa có evidence đủ để ước lượng tiến độ.'];
    var percent = entry[0];
    var meter = document.createElement('div');
    meter.className = 'phase-progress ' + status;
    var header = document.createElement('div');
    header.className = 'phase-progress-header';
    var label = document.createElement('span');
    label.textContent = 'Tiến độ ước lượng';
    var value = document.createElement('strong');
    value.textContent = percent + '%';
    header.append(label, value);
    var track = document.createElement('div');
    track.className = 'phase-progress-track';
    track.setAttribute('role', 'progressbar');
    track.setAttribute('aria-label', 'Tiến độ ' + id);
    track.setAttribute('aria-valuemin', '0');
    track.setAttribute('aria-valuemax', '100');
    track.setAttribute('aria-valuenow', String(percent));
    var fill = document.createElement('div');
    fill.className = 'phase-progress-fill';
    fill.style.width = percent + '%';
    track.append(fill);
    var reason = document.createElement('p');
    reason.className = 'phase-progress-reason';
    reason.textContent = entry[1];
    meter.append(header, track, reason);
    return meter;
  }

  var review = window.HOMELAND_PHASE_REVIEW;
  var reviewById = {};
  if (review) review.entries.forEach(function (entry) {
    reviewById[entry[0]] = entry;
    work[entry[0]] = [entry[1], entry[2] + ' Còn lại/ranh giới: ' + entry[4]];
  });
  // Exclude standalone fix notes; only P0..P30 participate in this counter/filter.
  var cards = Array.from(document.querySelectorAll('.todo-card')).filter(function(card) {
    var pill=card.querySelector('.pill');return pill && /^P(?:[0-9]|[12][0-9]|30)$/.test(pill.textContent.trim());
  });
  var toolbar = document.getElementById('work-tracking');
  document.getElementById('hunonic-mobile-sync-p21-p30').before(toolbar);
  cards.forEach(function (card) {
    var id = card.querySelector('.pill').textContent.trim();
    var entry = work[id];
    if (!entry) return;
    card.id = 'work-' + id.toLowerCase();
    card.dataset.workStatus = entry[0];
    card.classList.remove('ok', 'warn', 'risk', 'gate');
    var previous = card.querySelector('.todo-status');
    if (previous) {
      var evidence = document.createElement('details');
      var title = document.createElement('summary');
      title.textContent = 'Evidence ghi nhận trước lượt rà soát này';
      evidence.append(title);
      previous.className = 'todo-status todo';
      previous.querySelector('strong').textContent = 'Evidence từng phần (không phải hoàn thành toàn card)';
      previous.replaceWith(evidence);
      evidence.append(previous);
    }
    var status = document.createElement('div');
    status.className = 'todo-status ' + entry[0];
    var heading = document.createElement('strong');
    heading.textContent = labels[entry[0]] + ' · rà soát ' + (review ? review.date : '19/09/2026');
    var note = document.createElement('p');
    note.textContent = entry[1];
    status.append(heading, note);
    var title = card.querySelector('h3');
    card.insertBefore(status, title);
    card.insertBefore(createProgress(id, entry[0]), title);
    if(reviewById[id]) {
      var source=document.createElement('a');source.href='../'+reviewById[id][3];source.textContent='Nguồn đối chiếu: '+reviewById[id][3];
      var sourceLine=document.createElement('p');sourceLine.style.overflowWrap='anywhere';sourceLine.append(source);status.append(sourceLine);
    }
    if (completed[id]) {
      var fix = document.createElement('div');
      fix.className = 'todo-status done completed-fix';
      var fixTitle = document.createElement('strong');
      fixTitle.textContent = 'Evidence lịch sử phần sửa lỗi · 19/09/2026 (không chạy lại trong lượt rà soát)';
      var fixEvidence = document.createElement('p');
      fixEvidence.textContent = completed[id];
      fix.append(fixTitle, fixEvidence);
      card.append(fix);
    }
  });
  function filter() {
    var selected = document.getElementById('work-status').value;
    var query = document.getElementById('work-search').value.trim().toLocaleLowerCase('vi');
    var counts = { done: 0, doing: 0, todo: 0, blocked: 0 };
    var visible = 0;
    cards.forEach(function (card) {
      counts[card.dataset.workStatus]++;
      card.hidden = !((selected === 'all' || selected === card.dataset.workStatus) && (!query || card.textContent.toLocaleLowerCase('vi').includes(query)));
      if (!card.hidden) visible++;
    });
    document.getElementById('work-count').textContent = 'Hiển thị ' + visible + '/' + cards.length + ' · ' + Object.keys(counts).map(function (key) { return labels[key] + ': ' + counts[key]; }).join(' · ') + ' · ' + Object.keys(completed).length + ' card đã có phần sửa được kiểm chứng (xem khối xanh trong card).';
  }
  document.getElementById('work-status').addEventListener('change', filter);
  document.getElementById('work-search').addEventListener('input', filter);
  filter();
})();
