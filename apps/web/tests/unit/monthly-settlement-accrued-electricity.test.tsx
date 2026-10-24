import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import MonthlySettlementTable from '../../components/summary/MonthlySettlementTable';
import type { RoomSettlementItem } from '../../lib/api/monthly-settlement.api';

vi.mock('@/components/ui/Button', () => ({
  Button: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
}));

function render(issue: string | null = null, amount = 80000, kwh = 20) {
  const item = {
    roomId: 'room', roomCode: 'PN31-03', buildingName: 'A', floorLevel: 1,
    hasContract: true, representative: { fullName: 'Khách', phone: '0900000000' },
    membersCount: 1, roomPrice: 5000000, electricityAmount: amount, electricityKwh: kwh,
    electricityBillingIssue: issue,
    waterAmount: 0, totalAmount: 5080000, period: '2026-10', usagePeriod: '2026-09',
    billingDataSource: 'LOCKED_SNAPSHOT', billingSnapshotId: 'snapshot-1',
    electricityReconciliation: { status: 'MISMATCHED', currentKwh: 21, currentAmount: 84000, deltaKwh: 1, deltaAmount: 4000 },
    accruedElectricity: { status: 'AVAILABLE', amount: 100000, kwh: 25, period: '2026-10', rateMode: 'custom', customRateVnd: 4000 },
  } as RoomSettlementItem;
  return renderToStaticMarkup(<MonthlySettlementTable items={[item]} isLoading={false} onRowClick={() => {}} onResendSingle={() => {}} />);
}

describe('settlement accrued electricity table', () => {
  it('uses invoice electricity and total together instead of overriding with live accrual', () => {
    const html = render();
    expect(html).toContain('80.000 đ');
    expect(html).toContain('20 kWh');
    expect(html).toContain('5.080.000 đ');
    expect(html).not.toContain('>100.000 đ<');
    expect(html).toContain('Snapshot đã khóa');
    expect(html).toContain('snapshot-1');
    expect(html).toContain('>Điện<');
    expect(html).toContain('Tổng cộng');
    expect(html).not.toContain('Thu trước');
    expect(html).not.toContain('Thu sau');
    expect(html).not.toContain('Chưa ở T');
  });
  it('reports missing baseline without presenting zero as known usage', () => {
    const html = render('MOVE_IN_ELECTRICITY_BASELINE_REQUIRED');
    expect(html).toContain('Thiếu chỉ số nhận phòng');
    expect(html).toContain('Chưa thể chốt');
    expect(html).not.toContain('5.080.000 đ');
  });
  it('renders positive consumption even when amount is zero', () => {
    expect(render(null, 0, 2)).toContain('2 kWh');
  });
  it('keeps the billing mismatch alert in the invoice total cell', () => {
    const html = render();
    const cells = html.match(/<td\b[^>]*>[\s\S]*?<\/td>/g) || [];
    expect(cells[4]).not.toContain('role="alert"');
    expect(cells[6]).toContain('5.080.000 đ');
    expect(cells[6]).toContain('role="alert"');
    expect(cells[6]).toContain('settlement-electricity-mismatch-room');
    expect(cells[6]).toContain('Lệch 1 kWh');
  });
});
