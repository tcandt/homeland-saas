export type NotificationTemplateVariable = {
  path: string;
  label: string;
};

export type NotificationTemplateDefinition = {
  code: string;
  name: string;
  audience?: 'ADMIN' | 'CLIENT' | 'SYSTEM';
  category?: 'PAYMENT' | 'DEPOSIT' | 'REMINDER' | 'CONTRACT' | 'SYSTEM';
  subject?: string;
  body: string;
  variables: NotificationTemplateVariable[];
  sampleContext: Record<string, unknown>;
};

const commonRoomVariables: NotificationTemplateVariable[] = [
  { path: 'customerName', label: 'Tên khách hàng' },
  { path: 'roomAndBuilding', label: 'Mã phòng' },
  { path: 'roomSuffix', label: 'Dấu gạch và mã phòng (nếu có)' },
  { path: 'zaloTime', label: 'Thời gian gửi HH:mm • dd/MM/yyyy' },
];

const eventMessageVariables: NotificationTemplateVariable[] = [
  ...commonRoomVariables,
  { path: 'headline', label: 'Dòng trạng thái' },
  { path: 'primaryValue', label: 'Thông tin chính' },
  { path: 'secondaryValue', label: 'Thông tin bổ sung' },
  { path: 'action', label: 'Việc cần làm / hướng dẫn' },
  { path: 'actionLine', label: 'Dòng thao tác Admin (nếu cần)' },
];

const paymentDisplayVariables: NotificationTemplateVariable[] = [
  { path: 'paymentAmountDisplay', label: 'Số tiền vừa ghi nhận (đã định dạng)' },
  { path: 'amountDisplay', label: 'Tổng đã thanh toán (đã định dạng)' },
  { path: 'paidAmountDisplay', label: 'Tổng đã thu (đã định dạng)' },
  { path: 'remainingAmountDisplay', label: 'Số tiền còn phải thu (đã định dạng)' },
];

function eventTemplate(input: {
  code: string;
  name: string;
  audience: 'ADMIN' | 'CLIENT';
  category: NotificationTemplateDefinition['category'];
  sample: Pick<Record<string, string>, 'headline' | 'primaryValue' | 'secondaryValue' | 'action'>;
}): NotificationTemplateDefinition {
  const compactPrimary = ['ADMIN_DEPOSIT_CREATED', 'ADMIN_DEPOSIT_COLLECTED', 'ADMIN_INVOICE_PAID', 'ADMIN_INVOICE_DUE_SOON', 'ADMIN_INVOICE_OVERDUE'].includes(input.code);
  const body = input.audience === 'ADMIN'
    ? `{{headline}}{{roomSuffix}}\n\n{{customerName}}${compactPrimary ? ' • {{primaryValue}}' : '\n{{primaryValue}}'}\n{{secondaryValue}}\n\n{{actionLine}}\n{{zaloTime}}`
    : '{{headline}}\n\n{{roomAndBuilding}}\n{{primaryValue}}\n{{secondaryValue}}\n\n{{action}}\n{{zaloTime}}';
  return {
    code: input.code,
    name: input.name,
    audience: input.audience,
    category: input.category,
    subject: input.audience === 'ADMIN' ? '{{headline}}{{roomSuffix}}' : '{{headline}}',
    body,
    variables: eventMessageVariables,
    sampleContext: {
      customerName: 'Nguyễn Minh Anh',
      roomCode: 'PN 32-02',
      ...input.sample,
    },
  };
}

function systemEventTemplate(input: {
  code: string;
  name: string;
  category: NotificationTemplateDefinition['category'];
  sample: Pick<Record<string, string>, 'headline' | 'primaryValue' | 'secondaryValue' | 'action'>;
}): NotificationTemplateDefinition {
  return {
    code: input.code,
    name: input.name,
    audience: 'ADMIN',
    category: input.category,
    subject: '{{headline}}',
    body: '{{headline}}\n\n{{primaryValue}}\n{{secondaryValue}}\n\n{{actionLine}}\n{{zaloTime}}',
    variables: eventMessageVariables.slice(4).concat([{ path: 'zaloTime', label: 'Thời gian gửi' }]),
    sampleContext: input.sample,
  };
}

export const NOTIFICATION_TEMPLATE_CATALOG: NotificationTemplateDefinition[] = [
  {
    code: 'SYSTEM_ALERT',
    name: 'Thông báo HomeLand',
    audience: 'SYSTEM',
    category: 'SYSTEM',
    subject: '{{title}}',
    body: '{{message}}',
    variables: [
      { path: 'title', label: 'Tiêu đề' },
      { path: 'message', label: 'Nội dung' },
      ...commonRoomVariables,
    ],
    sampleContext: {
      title: 'Thông báo vận hành',
      message: 'Khách hàng có một thông báo mới cần lưu ý.',
      customerName: 'Nguyễn Minh Anh',
      roomAndBuilding: 'PN 32-02',
    },
  },
  {
    code: 'INVOICE_ZALO_PAYMENT_CONFIRMATION',
    name: 'Xác nhận thanh toán hóa đơn',
    audience: 'CLIENT',
    category: 'PAYMENT',
    subject: '✅ ĐÃ THANH TOÁN ĐỦ',
    body: `✅ ĐÃ THANH TOÁN ĐỦ

{{roomAndBuilding}}
{{paidAmountDisplay}} • {{paymentMethodLabel}}
{{invoiceCompletionLabel}}

Cảm ơn Anh/Chị.
{{zaloTime}}`,
    variables: [
      ...commonRoomVariables,
      { path: 'metadata.code', label: 'Mã hóa đơn' },
      { path: 'paymentAmount', label: 'Số tiền vừa ghi nhận' },
      { path: 'paymentReceiptMessage', label: 'Nội dung xác nhận phương thức thanh toán' },
      { path: 'amount', label: 'Tổng đã thanh toán' },
      ...paymentDisplayVariables,
      { path: 'paymentStatusLabel', label: 'Trạng thái thanh toán' },
      { path: 'paymentMethodLabel', label: 'Phương thức thanh toán' },
      { path: 'invoiceCompletionLabel', label: 'Trạng thái hoàn tất theo kỳ hóa đơn' },
    ],
    sampleContext: {
      customerName: 'Nguyễn Minh Anh',
      roomAndBuilding: 'PN 32-02',
      metadata: { code: 'INV-2026-001', period: '2026-09' },
      paymentAmount: '1.500.000',
      amount: '3.000.000',
      paymentAmountDisplay: '1.500.000 đ',
      amountDisplay: '3.000.000 đ',
      paymentStatusLabel: 'Đã thu đủ qua VietQR',
    },
  },
  {
    code: 'DEPOSIT_ZALO_PAYMENT_CONFIRMATION',
    name: 'Xác nhận thanh toán tiền cọc',
    audience: 'CLIENT',
    category: 'DEPOSIT',
    subject: '✅ ĐÃ NHẬN CỌC',
    body: `✅ ĐÃ NHẬN CỌC

{{roomAndBuilding}}
{{paidAmountDisplay}} • {{paymentMethodLabel}}
Đã thanh toán đủ.

Cảm ơn Anh/Chị.
{{zaloTime}}`,
    variables: [
      ...commonRoomVariables,
      { path: 'metadata.code', label: 'Mã phiếu cọc' },
      { path: 'paymentAmount', label: 'Số tiền vừa ghi nhận' },
      { path: 'paymentReceiptMessage', label: 'Nội dung xác nhận phương thức thanh toán' },
      { path: 'amount', label: 'Tổng đã thanh toán' },
      ...paymentDisplayVariables,
      { path: 'paymentStatusLabel', label: 'Trạng thái thanh toán' },
      { path: 'paymentMethodLabel', label: 'Phương thức thanh toán' },
    ],
    sampleContext: {
      customerName: 'Nguyễn Minh Anh',
      roomAndBuilding: 'PN 32-02',
      metadata: { code: 'DEP-2026-001' },
      paymentAmount: '2.000.000',
      amount: '2.000.000',
      paymentAmountDisplay: '2.000.000 đ',
      paidAmountDisplay: '2.000.000 đ',
      paymentStatusLabel: 'Đã thu đủ qua VietQR',
    },
  },
  {
    code: 'PAYMENT_RECEIVED',
    name: 'Đã nhận được thanh toán',
    audience: 'ADMIN',
    category: 'PAYMENT',
    subject: '{{title}}',
    body: '{{message}}',
    variables: [
      { path: 'title', label: 'Tiêu đề' },
      { path: 'message', label: 'Nội dung' },
      ...commonRoomVariables,
    ],
    sampleContext: {
      title: 'Đã nhận được thanh toán',
      message: 'Chúng tôi đã ghi nhận thanh toán của quý khách.',
      customerName: 'Nguyễn Minh Anh',
      roomAndBuilding: 'PN 32-02',
    },
  },
  {
    code: 'PAYMENT_ZALO_CONFIRMATION',
    name: 'Xác nhận thanh toán',
    audience: 'CLIENT',
    category: 'PAYMENT',
    subject: '✅ ĐÃ THANH TOÁN ĐỦ',
    body: `✅ ĐÃ THANH TOÁN ĐỦ

{{roomAndBuilding}}
{{paidAmountDisplay}} • {{paymentMethodLabel}}
Đã thanh toán đủ.

Cảm ơn Anh/Chị.
{{zaloTime}}`,
    variables: [
      ...commonRoomVariables,
      { path: 'paymentCode', label: 'Mã thanh toán' },
      { path: 'paymentAmount', label: 'Số tiền vừa ghi nhận' },
      { path: 'amount', label: 'Tổng đã thanh toán' },
      ...paymentDisplayVariables,
      { path: 'paymentStatusLabel', label: 'Trạng thái thanh toán' },
      { path: 'paymentMethodLabel', label: 'Phương thức thanh toán' },
    ],
    sampleContext: {
      customerName: 'Nguyễn Minh Anh',
      roomAndBuilding: 'PN 32-02',
      paymentCode: 'PAY-2026-001',
      paymentAmount: '1.500.000',
      amount: '3.000.000',
      paymentAmountDisplay: '1.500.000 đ',
      amountDisplay: '3.000.000 đ',
      paymentStatusLabel: 'Đã thu đủ qua VietQR',
    },
  },
  {
    code: 'DEPOSIT_COLLECTED',
    name: 'Đã nhận tiền cọc',
    audience: 'CLIENT',
    category: 'DEPOSIT',
    subject: '✅ ĐÃ NHẬN CỌC',
    body: `✅ ĐÃ NHẬN CỌC

{{roomAndBuilding}}
{{paidAmountDisplay}} • {{paymentMethodLabel}}
Đã thanh toán đủ.

Cảm ơn Anh/Chị.
{{zaloTime}}`,
    variables: [
      ...commonRoomVariables,
      { path: 'metadata.code', label: 'Mã phiếu cọc' },
      { path: 'paymentAmount', label: 'Số tiền vừa ghi nhận' },
      { path: 'paidAmount', label: 'Tổng đã thu' },
      ...paymentDisplayVariables,
      { path: 'paymentMethodLabel', label: 'Phương thức thanh toán' },
    ],
    sampleContext: {
      customerName: 'Nguyễn Minh Anh',
      roomAndBuilding: 'PN 32-02',
      metadata: { code: 'DEP-2026-001' },
      paymentAmount: '2.000.000',
      paidAmount: '2.000.000',
      paymentAmountDisplay: '2.000.000 đ',
      paidAmountDisplay: '2.000.000 đ',
    },
  },
  {
    code: 'INVOICE_OVERDUE',
    name: 'Hóa đơn quá hạn',
    audience: 'CLIENT',
    category: 'REMINDER',
    subject: '🔴 THANH TOÁN QUÁ HẠN',
    body: `🔴 THANH TOÁN QUÁ HẠN

{{roomAndBuilding}}
Còn lại: {{remainingAmountDisplay}}
{{overdueLabel}}

Anh/Chị vui lòng thanh toán sớm.
{{zaloTime}}`,
    variables: [
      ...commonRoomVariables,
      { path: 'invoiceCode', label: 'Mã hóa đơn' },
      { path: 'remainingAmount', label: 'Số tiền còn phải thu' },
      ...paymentDisplayVariables,
      { path: 'overdueLabel', label: 'Số ngày quá hạn' },
    ],
    sampleContext: {
      invoiceCode: 'INV-2026-001',
      remainingAmount: '1.250.000',
      roomAndBuilding: 'PN 32-02',
      customerName: 'Nguyễn Minh Anh',
      remainingAmountDisplay: '1.250.000 đ',
      overdueLabel: 'Đã quá hạn 7 ngày.',
    },
  },
  {
    code: 'INVOICE_ZALO_PAYMENT_REQUEST',
    name: 'Yêu cầu thanh toán hóa đơn',
    audience: 'CLIENT',
    category: 'PAYMENT',
    subject: '🏠 THANH TOÁN {{period}}',
    body: `🏠 THANH TOÁN {{period}}

{{roomAndBuilding}}
Cần thanh toán: {{amountDisplay}}
Hạn: {{dueDate}}

Quét QR bên dưới để thanh toán.
{{zaloTime}}`,
    variables: [
      ...commonRoomVariables,
      { path: 'period', label: 'Kỳ thanh toán' },
      { path: 'itemsSummary', label: 'Chi tiết khoản thu' },
      { path: 'amount', label: 'Tổng cần thanh toán' },
      ...paymentDisplayVariables,
      { path: 'dueDate', label: 'Hạn thanh toán' },
    ],
    sampleContext: {
      customerName: 'Nguyễn Minh Anh',
      roomAndBuilding: 'PN 32-02',
      period: 'T09/2026',
      itemsSummary: 'Tiền phòng: 3.000.000 đ\nĐiện nước: 450.000 đ',
      amount: '3.450.000',
      amountDisplay: '3.450.000 đ',
      dueDate: '05/10/2026',
    },
  },
  {
    code: 'DEPOSIT_ZALO_PAYMENT_REQUEST',
    name: 'Yêu cầu thanh toán cọc',
    audience: 'CLIENT',
    category: 'DEPOSIT',
    subject: '🔐 CỌC GIỮ PHÒNG',
    body: `🔐 CỌC GIỮ PHÒNG

{{roomAndBuilding}}
Cần thanh toán: {{amountDisplay}}

Quét QR bên dưới để giữ phòng.
{{zaloTime}}`,
    variables: [
      ...commonRoomVariables,
      { path: 'itemsSummary', label: 'Chi tiết khoản thu' },
      { path: 'amount', label: 'Tổng cần thanh toán' },
      ...paymentDisplayVariables,
    ],
    sampleContext: {
      customerName: 'Nguyễn Minh Anh',
      roomAndBuilding: 'PN 32-02',
      itemsSummary: 'Đặt cọc giữ phòng: 2.000.000 đ',
      amount: '2.000.000',
      amountDisplay: '2.000.000 đ',
    },
  },
  {
    code: 'INVOICE_ZALO_PARTIAL_PAYMENT_CONFIRMATION',
    name: 'Xác nhận thanh toán một phần',
    audience: 'CLIENT',
    category: 'PAYMENT',
    subject: '🟡 ĐÃ NHẬN THANH TOÁN',
    body: `🟡 ĐÃ NHẬN THANH TOÁN

{{roomAndBuilding}}
Đã nhận: {{paymentAmountDisplay}}
Còn lại: {{remainingAmountDisplay}}

{{zaloTime}}`,
    variables: [
      ...commonRoomVariables,
      { path: 'paymentAmount', label: 'Số tiền vừa ghi nhận' },
      { path: 'paymentReceiptMessage', label: 'Nội dung xác nhận phương thức thanh toán' },
      { path: 'remainingAmount', label: 'Số tiền còn phải thu' },
      ...paymentDisplayVariables,
    ],
    sampleContext: {
      customerName: 'Nguyễn Minh Anh',
      roomAndBuilding: 'PN 32-02',
      paymentAmount: '3.000.000',
      remainingAmount: '3.850.000',
      paymentAmountDisplay: '3.000.000 đ',
      remainingAmountDisplay: '3.850.000 đ',
    },
  },
  eventTemplate({
    code: 'ADMIN_DEPOSIT_CREATED', name: 'Admin - Cọc giữ phòng mới', audience: 'ADMIN', category: 'DEPOSIT',
    sample: { headline: '✅ CỌC GIỮ PHÒNG', primaryValue: '1.000.000đ', secondaryValue: 'Đang chờ thanh toán.', action: '' },
  }),
  eventTemplate({
    code: 'ADMIN_DEPOSIT_COLLECTED', name: 'Admin - Đã nhận tiền cọc', audience: 'ADMIN', category: 'DEPOSIT',
    sample: { headline: '✅ ĐÃ NHẬN CỌC', primaryValue: '1.000.000đ', secondaryValue: 'Đã thu đủ • VietQR', action: '' },
  }),
  eventTemplate({
    code: 'ADMIN_INVOICE_PAID', name: 'Admin - Hóa đơn đã thanh toán', audience: 'ADMIN', category: 'PAYMENT',
    sample: { headline: '✅ THANH TOÁN', primaryValue: '7.266.667đ', secondaryValue: 'Đã thanh toán đủ • VietQR', action: '' },
  }),
  eventTemplate({
    code: 'ADMIN_INVOICE_PARTIAL', name: 'Admin - Thanh toán một phần', audience: 'ADMIN', category: 'PAYMENT',
    sample: { headline: '🟡 THANH TOÁN MỘT PHẦN', primaryValue: 'Đã nhận: 3.000.000đ', secondaryValue: 'Còn thiếu: 4.266.667đ', action: '' },
  }),
  eventTemplate({
    code: 'ADMIN_INVOICE_DUE_SOON', name: 'Admin - Hóa đơn sắp đến hạn', audience: 'ADMIN', category: 'REMINDER',
    sample: { headline: '⏰ SẮP ĐẾN HẠN', primaryValue: 'Còn 6.850.000 đ', secondaryValue: 'Hạn: 05/10/2026', action: '' },
  }),
  eventTemplate({
    code: 'ADMIN_INVOICE_OVERDUE', name: 'Admin - Hóa đơn quá hạn', audience: 'ADMIN', category: 'REMINDER',
    sample: { headline: '🔴 QUÁ HẠN', primaryValue: 'Còn 6.850.000 đ', secondaryValue: 'Quá hạn: 7 ngày', action: 'Cần liên hệ khách.' },
  }),
  eventTemplate({
    code: 'ADMIN_PAYMENT_PROMISE_DUE', name: 'Admin - Đến hẹn thanh toán', audience: 'ADMIN', category: 'REMINDER',
    sample: { headline: '🔴 ĐẾN HẸN THANH TOÁN', primaryValue: 'Còn 3.000.000 đ', secondaryValue: 'Khách đã đến hẹn thanh toán.', action: 'Cần liên hệ khách.' },
  }),
  eventTemplate({
    code: 'ADMIN_CONTRACT_EXPIRING', name: 'Admin - Hợp đồng sắp hết hạn', audience: 'ADMIN', category: 'CONTRACT',
    sample: { headline: '⏳ SẮP HẾT HỢP ĐỒNG', primaryValue: 'Hết hạn: 30/10/2026', secondaryValue: '', action: 'Xác nhận gia hạn hoặc trả phòng.' },
  }),
  eventTemplate({
    code: 'ADMIN_CONTRACT_CREATED', name: 'Admin - Hợp đồng mới', audience: 'ADMIN', category: 'CONTRACT',
    sample: { headline: '📄 HỢP ĐỒNG MỚI', primaryValue: '01/10/2026 → 30/09/2027', secondaryValue: '', action: '' },
  }),
  eventTemplate({
    code: 'ADMIN_CONTRACT_SETTLEMENT_COMPLETED', name: 'Admin - Quyết toán hợp đồng', audience: 'ADMIN', category: 'CONTRACT',
    sample: { headline: '✅ QUYẾT TOÁN', primaryValue: 'Còn thu: 350.000đ', secondaryValue: 'Cọc hoàn: 5.650.000đ', action: '' },
  }),
  eventTemplate({
    code: 'ADMIN_DEPOSIT_CONVERTED', name: 'Admin - Chuyển cọc sang hợp đồng', audience: 'ADMIN', category: 'DEPOSIT',
    sample: { headline: '✅ CHUYỂN CỌC', primaryValue: 'Đã chuyển: 1.000.000đ', secondaryValue: 'Cần bổ sung: 7.000.000đ', action: '' },
  }),
  eventTemplate({
    code: 'ADMIN_DEPOSIT_REFUND_PENDING', name: 'Admin - Yêu cầu hoàn cọc', audience: 'ADMIN', category: 'DEPOSIT',
    sample: { headline: '⏳ YÊU CẦU HOÀN CỌC', primaryValue: 'Chờ xử lý: 1.500.000 đ', secondaryValue: 'Chưa hoàn tiền.', action: 'Kiểm tra và xử lý yêu cầu hoàn.' },
  }),
  eventTemplate({
    code: 'ADMIN_DEPOSIT_REFUNDED', name: 'Admin - Hoàn cọc hoàn tất', audience: 'ADMIN', category: 'DEPOSIT',
    sample: { headline: '↩️ HOÀN CỌC', primaryValue: 'Đã hoàn: 1.000.000đ', secondaryValue: '', action: '' },
  }),
  eventTemplate({
    code: 'ADMIN_DEPOSIT_DEDUCTED', name: 'Admin - Khấu trừ cọc', audience: 'ADMIN', category: 'DEPOSIT',
    sample: { headline: '➖ KHẤU TRỪ CỌC', primaryValue: 'Khấu trừ: 750.000 đ', secondaryValue: 'Theo biên bản xử lý.', action: '' },
  }),
  eventTemplate({
    code: 'ADMIN_DEPOSIT_CANCELLED', name: 'Admin - Hủy cọc', audience: 'ADMIN', category: 'DEPOSIT',
    sample: { headline: '❌ HỦY CỌC', primaryValue: 'Đã hủy yêu cầu giữ phòng.', secondaryValue: 'Theo trạng thái xử lý hiện tại.', action: '' },
  }),
  eventTemplate({
    code: 'CLIENT_DEPOSIT_REFUND_PENDING', name: 'Khách - Yêu cầu hoàn cọc đang xử lý', audience: 'CLIENT', category: 'DEPOSIT',
    sample: { headline: '⏳ ĐANG XỬ LÝ HOÀN CỌC', primaryValue: 'Yêu cầu hoàn cọc đã được tiếp nhận.', secondaryValue: 'Khoản hoàn chưa hoàn tất.', action: 'HomeLand sẽ thông báo khi xử lý xong.' },
  }),
  eventTemplate({
    code: 'CLIENT_DEPOSIT_REFUNDED', name: 'Khách - Hoàn cọc hoàn tất', audience: 'CLIENT', category: 'DEPOSIT',
    sample: { headline: '✅ ĐÃ HOÀN CỌC', primaryValue: 'Số tiền hoàn: 1.500.000 đ', secondaryValue: 'Khoản hoàn cọc đã được xử lý.', action: '' },
  }),
  eventTemplate({
    code: 'CLIENT_DEPOSIT_DEDUCTED', name: 'Khách - Khấu trừ cọc', audience: 'CLIENT', category: 'DEPOSIT',
    sample: { headline: '➖ ĐÃ XỬ LÝ CỌC', primaryValue: 'Khoản cọc được giữ hoặc khấu trừ theo biên bản.', secondaryValue: '', action: 'Liên hệ HomeLand nếu cần hỗ trợ.' },
  }),
  eventTemplate({
    code: 'CLIENT_DEPOSIT_CANCELLED', name: 'Khách - Hủy cọc', audience: 'CLIENT', category: 'DEPOSIT',
    sample: { headline: '❌ ĐÃ HỦY CỌC', primaryValue: 'Yêu cầu giữ phòng đã được hủy.', secondaryValue: 'Theo trạng thái xử lý hiện tại.', action: 'Liên hệ HomeLand nếu cần hỗ trợ.' },
  }),
  eventTemplate({
    code: 'CLIENT_DEPOSIT_CONVERTED', name: 'Khách - Chuyển cọc sang hợp đồng', audience: 'CLIENT', category: 'DEPOSIT',
    sample: { headline: '✅ ĐÃ CHUYỂN TIỀN CỌC', primaryValue: 'Đã chuyển: 1.000.000đ', secondaryValue: 'Cần bổ sung: 7.000.000đ', action: '' },
  }),
  eventTemplate({
    code: 'CLIENT_INVOICE_DUE_SOON', name: 'Khách - Nhắc thanh toán sắp đến hạn', audience: 'CLIENT', category: 'REMINDER',
    sample: { headline: '⏰ NHẮC THANH TOÁN', primaryValue: 'Còn phải thanh toán: 6.850.000 đ', secondaryValue: 'Hạn thanh toán: 05/10/2026', action: 'Anh/Chị vui lòng thanh toán đúng hạn.' },
  }),
  eventTemplate({
    code: 'CLIENT_CONTRACT_EXPIRING', name: 'Khách - Hợp đồng sắp hết hạn', audience: 'CLIENT', category: 'CONTRACT',
    sample: { headline: '⏳ HỢP ĐỒNG SẮP HẾT HẠN', primaryValue: 'Hết hạn: 30/10/2026', secondaryValue: '', action: 'Anh/Chị vui lòng xác nhận gia hạn hoặc trả phòng.' },
  }),
  eventTemplate({
    code: 'CLIENT_PAYMENT_PROMISE_DUE', name: 'Khách - Đến hẹn thanh toán', audience: 'CLIENT', category: 'REMINDER',
    sample: { headline: '⏰ ĐẾN HẸN THANH TOÁN', primaryValue: 'Còn phải thanh toán: 3.000.000 đ', secondaryValue: 'Khoản thanh toán đã hẹn hôm nay đến hạn.', action: 'Anh/Chị vui lòng thanh toán hoặc liên hệ HomeLand nếu cần hỗ trợ.' },
  }),
  systemEventTemplate({
    code: 'ADMIN_SYSTEM_OVERLOAD', name: 'Admin - Cảnh báo tải hệ thống', category: 'SYSTEM',
    sample: { headline: '🚨 SERVER TẢI CAO', primaryValue: 'RPS: 18 • IP: 32', secondaryValue: 'Phát hiện lưu lượng bất thường.', action: 'Kiểm tra hệ thống.' },
  }),
  systemEventTemplate({
    code: 'ADMIN_SYSTEM_UPDATE_SUCCESS', name: 'Admin - Cập nhật hệ thống thành công', category: 'SYSTEM',
    sample: { headline: '✅ CẬP NHẬT THÀNH CÔNG', primaryValue: 'v2.8.1 → v2.8.2', secondaryValue: 'Hệ thống hoạt động bình thường.', action: '' },
  }),
  systemEventTemplate({
    code: 'ADMIN_SYSTEM_UPDATE_AVAILABLE', name: 'Admin - Có phiên bản hệ thống mới', category: 'SYSTEM',
    sample: { headline: '📢 CÓ BẢN CẬP NHẬT MỚI', primaryValue: 'Hiện tại: v2.8.1', secondaryValue: 'Phiên bản mới: v2.8.2', action: '' },
  }),
];

export const DEFAULT_NOTIFICATION_TEMPLATES = Object.fromEntries(
  NOTIFICATION_TEMPLATE_CATALOG.map((template) => [template.code, template]),
) as Record<string, NotificationTemplateDefinition>;

export function getNotificationTemplateDefinition(code: string) {
  return DEFAULT_NOTIFICATION_TEMPLATES[String(code || '').trim()];
}
