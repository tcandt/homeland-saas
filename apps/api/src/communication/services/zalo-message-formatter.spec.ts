import { describe, expect, it } from 'vitest';
import {
  buildAdminZaloEventMessage,
  cleanZaloMessage,
  formatZaloMoney,
  formatZaloPeriod,
  formatZaloRoom,
  formatZaloTimestamp,
  normalizeZaloTemplateContext,
} from './zalo-message-formatter';

describe('Zalo message format', () => {
  it('uses room code, integer đồng and minute-level Vietnam time', () => {
    expect(formatZaloRoom('PN32-02')).toBe('PN 32-02');
    expect(formatZaloMoney(7_266_666.7)).toBe('7.266.667đ');
    expect(formatZaloPeriod('2026-09')).toBe('T09/2026');
    expect(formatZaloPeriod('09/2026')).toBe('T09/2026');
    expect(formatZaloTimestamp('2026-09-29T12:28:35.000Z')).toBe('🕒 19:28 • 29/09/2026');
    const context = normalizeZaloTemplateContext({
      roomCode: 'PN32-02', buildingName: 'LK01-32', paymentProvider: 'MANUAL',
      paidAmount: 8_000_000, occurredAt: '2026-09-29T12:28:35.000Z',
    });
    expect(context).toMatchObject({ roomAndBuilding: 'PN 32-02', buildingName: '', paymentMethodLabel: 'Tiền mặt', paidAmountDisplay: '8.000.000đ' });
    expect(normalizeZaloTemplateContext({ metadata: { period: '2026-09' } }).invoiceCompletionLabel)
      .toBe('Hóa đơn T09/2026 đã hoàn tất.');
  });

  it('does not expose building and internal references in an outgoing message', () => {
    expect(cleanZaloMessage('✅ ĐÃ NHẬN CỌC — PN 32-02 - LK01-32\nTòa nhà: LK01-32\nMã giao dịch: txn-1\nĐã nhận: 1.000.000 VND', 'LK01-32'))
      .toBe('✅ ĐÃ NHẬN CỌC — PN 32-02\nĐã nhận: 1.000.000đ');
  });

  it('renders partial payment and missing-room deposit with only actionable lines', () => {
    const partial = buildAdminZaloEventMessage({
      roomCode: 'PN32-02', customerName: 'Nguyễn Văn A', paymentAmount: 3_000_000,
      remainingAmount: 4_266_667, paymentRef: 'internal-123', buildingName: 'LK01-32',
      occurredAt: '2026-09-29T12:28:35.000Z',
    }, 'invoice.payment.recorded');
    expect(partial).toContain('🟡 THANH TOÁN MỘT PHẦN — PN 32-02');
    expect(partial).toContain('Còn thiếu: 4.266.667đ');
    expect(partial).not.toContain('internal-123');
    expect(partial).not.toContain('LK01-32');
    expect(partial.endsWith('🕒 19:28 • 29/09/2026')).toBe(true);

    const unknownRoom = buildAdminZaloEventMessage({ customerName: 'Nguyễn Văn A', amount: 1_000_000 }, 'deposit.created');
    expect(unknownRoom).toContain('🟡 YÊU CẦU CỌC MỚI');
    expect(unknownRoom).toContain('➡️ Cần chọn phòng.');
    expect(unknownRoom).not.toContain('✅');
  });
});
