/* A roadmap to convergence, not a claim that the work below is complete. */
(function () {
  'use strict';

  const tracks = [
    {
      title: 'P0–P4 · Context phòng, khách và đặt cọc',
      summary: 'Khóa toàn bộ hành trình từ phòng tới QR trước khi mở rộng nghiệp vụ tài chính.',
      items: [
        ['P0', 'Viết Playwright đổi phòng trong lúc tải hồ sơ và double-click lưu; guard hủy/chọn lại/mở lại đã có regression 9/9.', 'Chạy E2E cùng staging fixture và lưu trace/screenshot retry.'],
        ['P1', 'Rà soát dữ liệu legacy, duplicate phone/CCCD và flow chọn khách cũ/mới theo tenant.', 'Xác nhận trên staging không cross-tenant, không duplicate Customer/Occupancy.'],
        ['P2', 'Đã đóng phạm vi popup BOOKING/Ở ngay; chỉ duy trì regression khi thay đổi UI.', 'Giữ 100% bằng regression trong mọi release candidate.'],
        ['P3', 'Chạy replay/rollback cho DepositOperation, RoomHold, RentalCycle và contract DRAFT.', 'E2E booking end-to-end có DB evidence, QR và retry không tạo bản ghi trùng.'],
        ['P4', 'Kiểm thử ma trận cọc đầu kỳ, prorate và QR sau popup bằng transaction thật giả lập.', 'Sandbox/staging payment code khớp chính xác invoice/deposit, kiểm FIN xác nhận.'],
      ],
    },
    {
      title: 'P5–P10 · Tài chính phòng, cọc và Occupancy',
      summary: 'Dùng cùng một nguồn chứng từ cho phòng, khách, hợp đồng, kỳ thuê và báo cáo.',
      items: [
        ['P5', 'Invoice payment đã invalidation invoice + Finance summaries; tiếp tục nối sau commit giữa popup, deposit, contract và finance summary.', 'Hai tab staging cùng tenant khớp sau mutation; tenant khác không nhận dữ liệu.'],
        ['P6', 'Tạo matrix cash + QR, QR cũ, partial, retry và webhook cùng lúc.', 'PostgreSQL concurrency + đối soát finance độc lập không double allocation/ledger.'],
        ['P7', 'Hoàn thiện receipt/audit/outbox cho hoàn đủ, một phần, không hoàn và chứng từ.', 'UAT hoàn tiền thực tế có proof, notification và room/contract status đúng.'],
        ['P8', 'Test WHOLE: đại diện, thành viên phụ, nước đầu người, invoice và settlement.', 'UAT dữ liệu thật xác nhận roster/payer/tiền nước không lệch.'],
        ['P9', 'Test SHARED: capacity, nhiều hợp đồng chính, chia điện/nước và chuyển phòng.', 'UAT Hunonic + FIN xác nhận tổng chia bằng số đo phòng.'],
        ['P10', 'Dry-run detector legacy/backfill, xuất danh sách review thay vì tự ghi dữ liệu.', 'DBA/FIN phê duyệt backfill, report hậu kiểm không có orphan hay side effect.'],
      ],
    },
    {
      title: 'P11–P16 · Snapshot, hóa đơn, gia hạn và báo cáo',
      summary: 'Chứng minh kỳ đã khóa là bất biến và các màn hình đọc cùng financial truth.',
      items: [
        ['P11', 'Chạy integration snapshot create-only, retry và conflict trên DB cô lập.', 'Hunonic payload thật xác nhận meter, unit, scale và source period.'],
        ['P12', 'Chạy MONTHLY_BASE WHOLE/SHARED với invoice issued/paid, retry và no-overwrite.', 'UAT một kỳ thật có FIN đối chiếu số đo, rounding và invoice.'],
        ['P13', 'Test reminder theo tenant setting với invoice còn nợ, đã trả, hẹn trả và hết hạn.', 'Provider Zalo/Telegram/Email delivery có log/audit và OPS xác nhận nội dung.'],
        ['P14', 'Trạng thái khai báo đã fail-closed; nối task khai báo tạm trú sau gia hạn: assignee, deadline, status, evidence file.', 'OPS UAT renewal tạo đúng task và người phụ trách đóng được task.'],
        ['P15', 'Đã đóng core settlement/GATE-09; giữ test settlement/renewal/transfer trong regression.', 'Giữ 100% bằng gate tiền độc lập trong release candidate.'],
        ['P16', 'Đã gỡ cap 500 và customer-name join; chạy Playwright drill-down theo owner/bank/room/customer/cycle với endpoint aggregate.', 'FIN đối chiếu report với JournalLine/receipt trên dữ liệu lớn thật.'],
      ],
    },
    {
      title: 'P17–P20 · E2E, UAT và go-live',
      summary: 'Không có shortcut: phần này chỉ tăng khi có artifact môi trường thực.',
      items: [
        ['P17', 'Chạy CORE-10.04 Playwright đủ happy path và ngoại lệ; chụp đủ 11 ảnh vận hành.', 'Evidence đúng SHA, không conditional skip thay cho testcase bắt buộc.'],
        ['P18', 'Chạy SePay match code, Hunonic sync, notification và bank owner trên staging.', 'OPS/FIN/OWNER ký UAT với reconciliation và issue list không còn P0/P1.'],
        ['P19', 'Thực hiện backup off-host, restore drill, rollback rehearsal và đo RPO/RTO.', 'DBA/INFRA lưu backup ID/checksum/restore evidence và owner ký.'],
        ['P20', 'Tổng hợp GO/NO-GO dashboard, incident runbook, on-call và rollback owner.', 'Chỉ 100% khi P17–P19 hoàn tất và REL-09 được ký; trước đó luôn LIVE NO-GO.'],
      ],
    },
    {
      title: 'P21–P30 · Hunonic, điện nước và chốt kỳ',
      summary: 'Đóng vòng dữ liệu provider → snapshot khóa → invoice → báo cáo với số đo thật.',
      items: [
        ['P21', 'Xác nhận rate mode, unit, scale và custom/EVN calculation bằng fixture provider.', 'FIN/OPS UAT pricing thật, không có mode unknown trong financial write.'],
        ['P22', 'Test stale/offline/reconnect từ providerObservedAt, không dùng fetch time thay thế.', 'UAT thiết bị/provider thật xác nhận status và cảnh báo quá hạn.'],
        ['P23', 'So sánh KPI, CSV, card và lịch sử với 0 kWh/0đ cùng snapshot period.', 'FIN ký 3 phòng x 3 kỳ, mọi tổng/rounding đúng số liệu gốc.'],
        ['P24', 'Chạy nhiều worker với advisory lock, retry/backoff và fault giữa fetch/retry.', 'Staging multi-worker quan sát không duplicate fetch/write.'],
        ['P25', 'Integration append-only với provider replay, payload identity và conflict observation.', 'Provider thật xác nhận retry không overwrite hoặc mất lịch sử.'],
        ['P26', 'Filter history building/room/year/month đã nối metadata API; chạy E2E DB-backed drill-down observation.', 'OPS xác nhận xem được tháng cũ, không thay bằng dữ liệu live.'],
        ['P27', 'DB-backed test snapshot locked/unlocked, delta đỏ và provenance trên UI.', 'Maintenance/UAT xác nhận snapshot đã khóa không bị mutation.'],
        ['P28', 'Test cutoff cuối tháng UTC+7, persisted reading thiếu và concurrent API worker.', 'Staging month-end rehearsal có evidence fail-closed và one-winner.'],
        ['P29', 'E2E Đồng hồ → Tổng hợp → Hóa đơn dùng một snapshot ID/kỳ.', 'FIN xác nhận all drill-down source IDs và tổng tiền nhất quán.'],
        ['P30', 'Đóng suite 3 phòng x 3 kỳ gồm retry, lock, snapshot và invoice.', 'FIN/OPS ký gate Hunonic; không có UAT này thì phase không đạt 100%.'],
      ],
    },
    {
      title: 'P31–P36 · Cọc, thanh toán, hoàn và nhắc hạn',
      summary: 'Ưu tiên finance safety trước trải rộng notification/realtime.',
      items: [
        ['P31', 'Ghi nhận quy tắc chủ nhà quyết hoàn/giữ/khấu trừ theo từng ca, lý do và chứng từ.', 'OWNER/FIN/OPS phê duyệt SOP; không tự gán % hoàn hay hoa hồng.'],
        ['P32', 'Chạy DB concurrency/crash-retry convert hold → contract → security deposit → QR.', 'Finance review độc lập xác nhận B<C, B=C, B>C và E2E webhook.'],
        ['P33', 'UAT upload ảnh/camera/PDF, complete refund idempotent và roommate guard.', 'Storage/notification thật + Sol High review tiền trước 100%.'],
        ['P34', 'Chạy partial cash + QR concurrent/retry và stale QR trên PostgreSQL.', 'FIN review allocation/overpayment/refund và staging evidence.'],
        ['P35', 'Test bank transaction trùng memo nhưng khác reference, manual assign và refund proof lock.', 'SePay/staging bank evidence + review đối soát độc lập.'],
        ['P36', 'Chạy scheduler UTC+7 trên staging với paid/partial/promise/expiring contract.', 'Provider delivery UAT + finance/OPS review lịch sử task/notification.'],
      ],
    },
    {
      title: 'P37–P43 · Mẫu tin, queue, realtime, reports và CRM',
      summary: 'Chỉ mở sau khi P31–P36 đủ safety evidence; không biến code chuẩn bị thành phase hoàn thành.',
      items: [
        ['P37', 'Unfreeze sau P31–P36: test template precedence, preview, publish/rollback và snapshot retry.', 'Gửi thật từng kênh với recipient được duyệt, nội dung/version traceable.'],
        ['P38', 'Test event dedupe, worker crash, retry/dead-letter và từng kênh failure isolation.', 'Provider UAT chứng minh no false DELIVERED/no duplicate notification.'],
        ['P39', 'Thêm tenant-scoped event/broker, reconnect/resync và polling fallback.', 'Hai tab/hai instance staging khớp sau out-of-order/duplicate event.'],
        ['P40', 'Occupancy analytics đã dùng count phòng tenant-scoped thật; tiếp tục hoàn thiện reports không cap/demo, PDF fail rõ, các analytics còn lại và source drill-down.', 'FIN đối chiếu >500 record: revenue/cash/liability/owner isolation đúng.'],
        ['P41', 'Thiết kế CommissionPolicy versioned: basis, share, approval, payout, clawback.', 'OWNER phê duyệt chính sách; FIN xác nhận không double expense và refund reversal đúng.'],
        ['P42', 'Task board, Operations Insights, Sales summary, Tenant Grid pagination, tạo Lead, Pipeline transition, Customer create idempotent và Room Filters đã hoàn tất; tiếp tục convert/import.', 'E2E lead → customer → deposit/contract chỉ tạo một chuỗi canonical.'],
        ['P43', 'Ingest AI đã fail-closed, lịch sử/ownership AI thật, tải Documents có Bearer auth + storage tenant gate. Catalog template, tạo PDF, upload ảnh/PDF/camera và DocumentVersion tenant-owned đã nối dữ liệu; lỗi DB upload không báo success giả. Manual workflow/rule trả execution tenant-scoped, không báo success khi còn RUNNING.', 'Review consumer/tenant permission; đường chưa hỗ trợ không trả success giả.'],
      ],
    },
    {
      title: 'P44–P45 · Gate cuối, cutover và hypercare',
      summary: 'Đây là điều kiện hội tụ, không phải phase có thể tự đạt bằng unit test.',
      items: [
        ['P44', 'Chạy regression, integration, E2E, provider UAT và đóng finding đúng SHA.', 'Sol High finance/tenant/concurrency PASS; FIN/OPS/OWNER ký acceptance.'],
        ['P45', 'Chạy preflight, backup trước cutover, deploy immutable, smoke và monitoring.', 'GO có ủy quyền riêng; sau mở traffic phải đạt hypercare/reconciliation theo TODO.'],
      ],
    },
  ];

  function currentPercent(id) {
    const value = document.querySelector(`#work-${id.toLowerCase()} .phase-progress-header strong`);
    return value ? value.textContent : '0%';
  }

  const section = document.createElement('section');
  section.id = 'completion-roadmap';
  section.className = 'section';
  section.style.scrollMarginTop = '90px';
  const heading = document.createElement('h2');
  heading.textContent = 'Todo hội tụ P0–P45: 90% kỹ thuật → 100% nghiệm thu';
  const intro = document.createElement('p');
  intro.textContent = 'Mỗi phase dưới đây có đúng một mục tiêu kỹ thuật để vượt 90% và một gate chứng minh để được 100%. Phần trăm hiện tại chỉ phản ánh evidence đã có; không tăng theo kế hoạch này cho đến khi công việc và bằng chứng hoàn tất.';
  const note = document.createElement('div');
  note.className = 'note';
  note.textContent = 'Thứ tự bắt buộc: P0–P30 + P31–P36 safety → P37–P43 reliability/product → P44 gate → P45 cutover. P17–P20, P30, P44 và P45 phụ thuộc môi trường thật, quyền vận hành và ký duyệt nên không thể thay bằng unit test.';
  section.append(heading, intro, note);

  const grid = document.createElement('div');
  grid.className = 'completion-grid';
  tracks.forEach((track) => {
    const trackSection = document.createElement('article');
    trackSection.className = 'completion-track';
    const trackHeading = document.createElement('h3');
    trackHeading.textContent = track.title;
    const trackSummary = document.createElement('p');
    trackSummary.textContent = track.summary;
    const list = document.createElement('div');
    list.className = 'completion-list';
    track.items.forEach(([id, goal90, gate100]) => {
      const row = document.createElement('article');
      row.className = 'completion-item';
      const rowHeading = document.createElement('h4');
      const link = document.createElement('a');
      link.href = `#work-${id.toLowerCase()}`;
      link.textContent = `${id} · hiện ${currentPercent(id)}`;
      rowHeading.append(link);
      const to90 = document.createElement('p');
      const strong90 = document.createElement('strong');
      strong90.textContent = 'Đến 90%: ';
      to90.append(strong90, goal90);
      const to100 = document.createElement('p');
      const strong100 = document.createElement('strong');
      strong100.textContent = 'Đến 100%: ';
      to100.append(strong100, gate100);
      row.append(rowHeading, to90, to100);
      list.append(row);
    });
    trackSection.append(trackHeading, trackSummary, list);
    grid.append(trackSection);
  });
  section.append(grid);
  document.querySelector('main').append(section);

  const shortcut = document.createElement('button');
  shortcut.className = 'cg-shortcut';
  shortcut.textContent = 'Todo 90–100% ↓';
  shortcut.onclick = () => section.scrollIntoView({ block: 'start' });
  const toolbar = document.querySelector('.toolbar');
  if (toolbar) toolbar.insertBefore(shortcut, document.getElementById('search'));
})();
