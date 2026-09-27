export type NotificationTemplateVariable = {
  path: string;
  label: string;
};

export type NotificationTemplateDefinition = {
  code: string;
  name: string;
  subject?: string;
  body: string;
  variables: NotificationTemplateVariable[];
  sampleContext: Record<string, unknown>;
};

const commonRoomVariables: NotificationTemplateVariable[] = [
  { path: 'customerName', label: 'Tên khách hàng' },
  { path: 'roomAndBuilding', label: 'Phòng - tòa nhà' },
];

export const NOTIFICATION_TEMPLATE_CATALOG: NotificationTemplateDefinition[] = [
  {
    code: 'SYSTEM_ALERT',
    name: 'Thông báo HomeLand',
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
      roomAndBuilding: 'P.101 - Tòa A',
    },
  },
  {
    code: 'INVOICE_ZALO_PAYMENT_CONFIRMATION',
    name: 'Xác nhận thanh toán hóa đơn',
    subject: 'HomeLand - Đã nhận thanh toán {{metadata.code}}',
    body: `HomeLand - Đã nhận thanh toán

Kính gửi: {{customerName}}
Hóa đơn: {{metadata.code}}
Số tiền ghi nhận: {{paymentAmount}} đ
Đã thanh toán: {{amount}} đ
Trạng thái: {{paymentStatusLabel}}
{{roomAndBuilding}}

Cảm ơn quý khách.`,
    variables: [
      ...commonRoomVariables,
      { path: 'metadata.code', label: 'Mã hóa đơn' },
      { path: 'paymentAmount', label: 'Số tiền vừa ghi nhận' },
      { path: 'amount', label: 'Tổng đã thanh toán' },
      { path: 'paymentStatusLabel', label: 'Trạng thái thanh toán' },
    ],
    sampleContext: {
      customerName: 'Nguyễn Minh Anh',
      roomAndBuilding: 'P.101 - Tòa A',
      metadata: { code: 'INV-2026-001' },
      paymentAmount: '1.500.000',
      amount: '3.000.000',
      paymentStatusLabel: 'Đã thu đủ qua VietQR',
    },
  },
  {
    code: 'DEPOSIT_ZALO_PAYMENT_CONFIRMATION',
    name: 'Xác nhận thanh toán tiền cọc',
    subject: 'HomeLand - Đã nhận tiền cọc {{metadata.code}}',
    body: `HomeLand - Đã nhận tiền cọc

Kính gửi: {{customerName}}
Phiếu cọc/hóa đơn: {{metadata.code}}
Số tiền ghi nhận: {{paymentAmount}} đ
Đã thanh toán: {{amount}} đ
Trạng thái: {{paymentStatusLabel}}
{{roomAndBuilding}}

Cảm ơn quý khách.`,
    variables: [
      ...commonRoomVariables,
      { path: 'metadata.code', label: 'Mã phiếu cọc' },
      { path: 'paymentAmount', label: 'Số tiền vừa ghi nhận' },
      { path: 'amount', label: 'Tổng đã thanh toán' },
      { path: 'paymentStatusLabel', label: 'Trạng thái thanh toán' },
    ],
    sampleContext: {
      customerName: 'Nguyễn Minh Anh',
      roomAndBuilding: 'P.101 - Tòa A',
      metadata: { code: 'DEP-2026-001' },
      paymentAmount: '2.000.000',
      amount: '2.000.000',
      paymentStatusLabel: 'Đã thu đủ qua VietQR',
    },
  },
  {
    code: 'PAYMENT_RECEIVED',
    name: 'Đã nhận được thanh toán',
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
      roomAndBuilding: 'P.101 - Tòa A',
    },
  },
  {
    code: 'PAYMENT_ZALO_CONFIRMATION',
    name: 'Xác nhận thanh toán',
    subject: 'HomeLand - Đã nhận thanh toán {{paymentCode}}',
    body: `HomeLand - Đã nhận thanh toán

Kính gửi: {{customerName}}
Mã thanh toán: {{paymentCode}}
Số tiền ghi nhận: {{paymentAmount}} đ
Đã thanh toán: {{amount}} đ
Trạng thái: {{paymentStatusLabel}}
{{roomAndBuilding}}

Cảm ơn quý khách.`,
    variables: [
      ...commonRoomVariables,
      { path: 'paymentCode', label: 'Mã thanh toán' },
      { path: 'paymentAmount', label: 'Số tiền vừa ghi nhận' },
      { path: 'amount', label: 'Tổng đã thanh toán' },
      { path: 'paymentStatusLabel', label: 'Trạng thái thanh toán' },
    ],
    sampleContext: {
      customerName: 'Nguyễn Minh Anh',
      roomAndBuilding: 'P.101 - Tòa A',
      paymentCode: 'PAY-2026-001',
      paymentAmount: '1.500.000',
      amount: '3.000.000',
      paymentStatusLabel: 'Đã thu đủ qua VietQR',
    },
  },
  {
    code: 'DEPOSIT_COLLECTED',
    name: 'Đã nhận tiền cọc',
    subject: 'HomeLand - Đã nhận tiền cọc {{metadata.code}}',
    body: `HomeLand - Đã nhận tiền cọc

Kính gửi: {{customerName}}
Mã phiếu cọc: {{metadata.code}}
Số tiền ghi nhận: {{paymentAmount}} đ
Tổng đã thu: {{paidAmount}} đ
{{roomAndBuilding}}

Cảm ơn quý khách.`,
    variables: [
      ...commonRoomVariables,
      { path: 'metadata.code', label: 'Mã phiếu cọc' },
      { path: 'paymentAmount', label: 'Số tiền vừa ghi nhận' },
      { path: 'paidAmount', label: 'Tổng đã thu' },
    ],
    sampleContext: {
      customerName: 'Nguyễn Minh Anh',
      roomAndBuilding: 'P.101 - Tòa A',
      metadata: { code: 'DEP-2026-001' },
      paymentAmount: '2.000.000',
      paidAmount: '2.000.000',
    },
  },
  {
    code: 'INVOICE_OVERDUE',
    name: 'Hóa đơn quá hạn',
    subject: 'HomeLand - Hóa đơn {{invoiceCode}} đã quá hạn',
    body: `Hóa đơn {{invoiceCode}} đã quá hạn thanh toán.

Số tiền còn phải thu: {{remainingAmount}} đ
Vui lòng liên hệ ban quản lý để được hỗ trợ.`,
    variables: [
      { path: 'invoiceCode', label: 'Mã hóa đơn' },
      { path: 'remainingAmount', label: 'Số tiền còn phải thu' },
    ],
    sampleContext: {
      invoiceCode: 'INV-2026-001',
      remainingAmount: '1.250.000',
    },
  },
  {
    code: 'INVOICE_ZALO_PAYMENT_REQUEST',
    name: 'Yêu cầu thanh toán hóa đơn',
    subject: 'HomeLand - Hóa đơn tiền nhà {{period}}',
    body: `HomeLand - Hóa đơn tiền nhà {{period}}

Kính gửi: {{customerName}}
{{roomAndBuilding}}

Chi tiết khoản thu:
{{itemsSummary}}
Tổng: {{amount}} đ

(Quét mã QR đính kèm để thanh toán nhanh)`,
    variables: [
      ...commonRoomVariables,
      { path: 'period', label: 'Kỳ thanh toán' },
      { path: 'itemsSummary', label: 'Chi tiết khoản thu' },
      { path: 'amount', label: 'Tổng cần thanh toán' },
    ],
    sampleContext: {
      customerName: 'Nguyễn Minh Anh',
      roomAndBuilding: 'P.101 - Tòa A',
      period: '09/2026',
      itemsSummary: 'Tiền phòng: 3.000.000 đ\nĐiện nước: 450.000 đ',
      amount: '3.450.000',
    },
  },
  {
    code: 'DEPOSIT_ZALO_PAYMENT_REQUEST',
    name: 'Yêu cầu thanh toán cọc',
    subject: 'HomeLand - Hóa đơn tiền cọc {{roomAndBuilding}}',
    body: `HomeLand - Hóa đơn tiền cọc {{roomAndBuilding}}

Kính gửi: {{customerName}}
{{roomAndBuilding}}

Chi tiết khoản thu:
{{itemsSummary}}
Tổng: {{amount}} đ

(Quét mã QR đính kèm để thanh toán nhanh)`,
    variables: [
      ...commonRoomVariables,
      { path: 'itemsSummary', label: 'Chi tiết khoản thu' },
      { path: 'amount', label: 'Tổng cần thanh toán' },
    ],
    sampleContext: {
      customerName: 'Nguyễn Minh Anh',
      roomAndBuilding: 'P.101 - Tòa A',
      itemsSummary: 'Đặt cọc giữ phòng: 2.000.000 đ',
      amount: '2.000.000',
    },
  },
];

export const DEFAULT_NOTIFICATION_TEMPLATES = Object.fromEntries(
  NOTIFICATION_TEMPLATE_CATALOG.map((template) => [template.code, template]),
) as Record<string, NotificationTemplateDefinition>;

export function getNotificationTemplateDefinition(code: string) {
  return DEFAULT_NOTIFICATION_TEMPLATES[String(code || '').trim()];
}
