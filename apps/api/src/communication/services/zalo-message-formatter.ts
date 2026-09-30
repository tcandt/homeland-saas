const TIME_ZONE = 'Asia/Ho_Chi_Minh';

export function formatZaloMoney(value: unknown): string {
  const raw = String(value ?? '').trim();
  const amount = /^-?\d{1,3}(?:[.,]\d{3})+$/.test(raw)
    ? Number(raw.replace(/[.,]/g, ''))
    : Number(value);
  return Number.isFinite(amount) ? `${Math.round(amount).toLocaleString('vi-VN')}đ` : '';
}

export function formatZaloRoom(value: unknown): string {
  const room = String(value ?? '').trim();
  if (!room) return '';
  return room.replace(/^PN\s*(\d)/i, 'PN $1');
}

export function formatZaloPeriod(value: unknown): string {
  const period = String(value ?? '').trim();
  const yearFirst = /^(\d{4})-(\d{1,2})$/.exec(period);
  const monthFirst = /^(?:T|Tháng\s*)?(\d{1,2})\/(\d{4})$/i.exec(period);
  const month = yearFirst ? Number(yearFirst[2]) : monthFirst ? Number(monthFirst[1]) : 0;
  const year = yearFirst?.[1] || monthFirst?.[2];
  return year && month >= 1 && month <= 12 ? `T${String(month).padStart(2, '0')}/${year}` : period;
}

export function formatZaloDate(value: unknown): string {
  if (!value) return '';
  const date = new Date(value as string | Date);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: TIME_ZONE, day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(date);
}

export function formatZaloTimestamp(value: unknown = new Date()): string {
  const date = new Date(value as string | Date);
  if (Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    day: '2-digit', month: '2-digit', year: 'numeric',
  }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value || '';
  return `🕒 ${part('hour')}:${part('minute')} • ${part('day')}/${part('month')}/${part('year')}`;
}

export function normalizeZaloTemplateContext(context: Record<string, any>) {
  const roomCode = formatZaloRoom(context.roomCode || context.room?.code || context.room?.number || String(context.roomAndBuilding || '').split(/\s+-\s+/)[0]);
  const period = formatZaloPeriod(context.period ?? context.metadata?.period);
  const method = String(context.paymentProvider || context.paymentMethod || '').toUpperCase() === 'MANUAL'
    ? 'Tiền mặt' : 'VietQR';
  const paid = context.paidAmount ?? context.amount;
  return {
    ...context,
    roomCode,
    roomAndBuilding: roomCode || 'Chưa xác định phòng',
    roomSuffix: roomCode ? ` — ${roomCode}` : '',
    buildingName: '',
    period,
    invoiceCompletionLabel: period ? `Hóa đơn ${period} đã hoàn tất.` : 'Hóa đơn đã hoàn tất.',
    paymentMethodLabel: method,
    paymentAmountDisplay: formatZaloMoney(context.paymentAmount ?? context.amount),
    amountDisplay: formatZaloMoney(context.rawAmount ?? context.amount),
    paidAmountDisplay: formatZaloMoney(paid),
    remainingAmountDisplay: formatZaloMoney(context.remainingAmount),
    zaloTime: formatZaloTimestamp(context.occurredAt || context.paidAt || context.sentAt || new Date()),
    actionLine: context.action ? `➡️ ${String(context.action).replace(/^➡️\s*/, '')}` : '',
  };
}

export function buildAdminZaloEventMessage(payload: Record<string, any>, eventKind: string): string {
  const metadata = payload.metadata || {};
  const inferredKind = payload.paymentProvider || payload.paymentRef || payload.paymentId
    ? (payload.sourceType === 'DEPOSIT' || metadata.bookingHoldDepositInvoice ? 'DEPOSIT_COLLECTED' :
      Number(payload.remainingAmount ?? metadata.remainingAmount ?? 0) > 0 ? 'INVOICE_PARTIAL' : 'INVOICE_PAID')
    : '';
  const kind = String(eventKind || inferredKind).toUpperCase().replace(/[^A-Z0-9]+/g, '_');
  const room = formatZaloRoom(payload.roomCode || metadata.roomCode);
  const customer = String(payload.customerName || metadata.customerName || 'Khách hàng');
  const amount = formatZaloMoney(payload.paymentAmount ?? payload.amount ?? 0);
  const remaining = formatZaloMoney(payload.remainingAmount ?? metadata.remainingAmount ?? 0);
  const method = String(payload.paymentProvider || '').toUpperCase() === 'MANUAL' ? 'Tiền mặt' : 'VietQR';
  let title = '📢 THÔNG BÁO VẬN HÀNH';
  let lines: string[] = [];
  let action = '';
  if (kind.includes('DEPOSIT_CREATED')) {
    title = room ? '✅ CỌC GIỮ PHÒNG' : '🟡 YÊU CẦU CỌC MỚI';
    lines = [room ? 'Đang chờ thanh toán.' : 'Chưa xác định phòng.'];
    if (!room) action = 'Cần chọn phòng.';
  } else if (kind.includes('DEPOSIT_CONVERTED')) {
    title = '✅ CHUYỂN CỌC';
    const transferred = formatZaloMoney(metadata.transferAmount ?? payload.amount ?? 0);
    const additional = Number(metadata.additionalCashRequired || 0);
    lines = additional > 0
      ? [`Đã chuyển: ${transferred}`, `Cần bổ sung: ${formatZaloMoney(additional)}`]
      : [`${transferred} • Đã chuyển vào cọc hợp đồng.`];
  } else if (kind.includes('DEPOSIT_REFUNDED') || kind.includes('REFUND')) {
    title = '↩️ HOÀN CỌC';
    const refunded = formatZaloMoney(metadata.refundAmount ?? payload.paymentAmount ?? payload.amount ?? 0);
    const retained = Number(metadata.keepAmount ?? metadata.retainedAmount ?? 0);
    lines = [`${retained > 0 ? 'Hoàn' : 'Đã hoàn'}: ${refunded}`];
    if (retained > 0) {
      title = '↩️ HOÀN CỌC MỘT PHẦN';
      lines.push(`Giữ lại: ${formatZaloMoney(retained)}`);
    }
  } else if (kind.includes('DEPOSIT_DEDUCTED')) {
    title = '➖ KHẤU TRỪ CỌC';
    lines = [`Khấu trừ: ${formatZaloMoney(metadata.deductAmount ?? payload.amount ?? 0)}`];
    if (metadata.reason || payload.reason) lines.push(`Lý do: ${metadata.reason || payload.reason}`);
  } else if (kind.includes('DEPOSIT_CANCELLED')) {
    title = '❌ HỦY CỌC';
    lines = [`${amount} • Không hoàn tiền.`];
  } else if (kind.includes('DEPOSIT_COLLECTED') || payload.sourceType === 'DEPOSIT' || metadata.bookingHoldDepositInvoice) {
    title = Number(payload.remainingAmount ?? metadata.remainingAmount ?? 0) > 0 ? '🟡 CỌC CHƯA ĐỦ' : '✅ ĐÃ NHẬN CỌC';
    lines = title.startsWith('🟡') ? [`Đã nhận: ${amount}`, `Còn thiếu: ${remaining}`] : [`${amount} • Đã thu đủ • ${method}`];
  } else if (kind.includes('INVOICE_OVERDUE')) {
    title = '🔴 QUÁ HẠN';
    lines = [`còn ${remaining}`, `Quá hạn: ${Math.max(0, Number(payload.overdueDays || 0))} ngày`];
    action = 'Cần liên hệ khách.';
  } else if (kind.includes('INVOICE_ISSUED')) {
    title = '🧾 HÓA ĐƠN MỚI';
    lines = [amount, payload.dueDate ? `Hạn: ${formatZaloDate(payload.dueDate)}` : ''];
  } else if (kind.includes('INVOICE_PARTIAL') || kind.includes('PAYMENT_RECORDED')) {
    title = '🟡 THANH TOÁN MỘT PHẦN';
    lines = [`Đã nhận: ${amount}`, `Còn thiếu: ${remaining}`];
  } else if (kind.includes('INVOICE_PAID') || kind.includes('PAYMENT')) {
    title = '✅ THANH TOÁN';
    lines = [`${amount} • Đã thanh toán đủ • ${method}`];
  } else if (kind.includes('CONTRACT_CREATED')) {
    title = '📄 HỢP ĐỒNG MỚI';
    lines = [`${formatZaloDate(payload.startDate)} → ${formatZaloDate(payload.endDate)}`];
  } else if (kind.includes('SETTLEMENT')) {
    title = '✅ QUYẾT TOÁN';
    const totals = metadata.settlement?.totals || {};
    const receivable = Number(metadata.netReceivable ?? totals.netReceivable ?? 0);
    const refund = Number(metadata.refundToCustomer ?? totals.refundToCustomer ?? 0);
    lines = [receivable > 0 ? `Còn thu: ${formatZaloMoney(receivable)}` : 'Không còn công nợ.', refund > 0 ? `Cọc hoàn: ${formatZaloMoney(refund)}` : ''];
  } else {
    lines = [payload.title || payload.message || 'Có cập nhật cần kiểm tra.'];
  }
  const header = room ? `${title} — ${room}` : title;
  return [header, '', kind.includes('DEPOSIT_CREATED') && !room ? `${customer} • ${amount}` : customer,
    ...lines.filter(Boolean), action ? '' : null, action ? `➡️ ${action}` : null,
    formatZaloTimestamp(payload.occurredAt || payload.paidAt || new Date())]
    .filter((line) => line !== null && line !== undefined).join('\n');
}

export function cleanZaloMessage(message: string, buildingName?: string | null): string {
  let result = String(message || '');
  if (buildingName) {
    const escaped = String(buildingName).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(new RegExp(`\\s+-\\s+(?:Tòa nhà\\s+)?${escaped}(?=\\n|$)`, 'giu'), '');
  }
  return result.split(/\r?\n/)
    .map((line) => line.trim().replace(/\s*\bVND\b|\s+đ(?=\s|$|[.,])/g, 'đ'))
    .filter((line) => !/^(?:Tòa nhà|Mã (?:giao dịch|phiếu|thanh toán|hóa đơn)|Trạng thái:|Thời gian (?:nhận|gửi):|HomeLand Admin\s*-|UAT\b|paymentRef\b|correlationId\b|eventKind\b)/i.test(line))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function ensureZaloFooter(message: string, timestamp: string): string {
  const body = String(message || '').trim().replace(/(?:\n|^)🕒[^\n]*$/u, '').trim();
  return `${body}\n\n${timestamp}`.trim();
}
