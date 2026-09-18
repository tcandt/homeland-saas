import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  HunonicSnapshotPresentation,
  type HunonicSnapshotData,
} from '../../components/finance/HunonicSnapshotPresentation';

function buildSnapshot(overrides: Partial<HunonicSnapshotData> = {}): HunonicSnapshotData {
  return {
    roomCode: '32-07',
    buildingName: 'LK01-32',
    cycleMonth: '09/2026',
    isLive: false,
    pricingMode: 'custom',
    electricity: {
      startReading: 1250,
      endReading: 1450,
      totalKwh: 200,
      unitPrice: 3500,
      totalAmount: 700000,
    },
    water: {
      occupantCount: 3,
      unitPricePerPerson: 100000,
      totalAmount: 300000,
    },
    tenantShares: [
      { customerId: 't1', customerName: 'Khách A', sharePercent: 1 / 3, electricityAmount: 233334, waterAmount: 100000, totalAmount: 333334 },
      { customerId: 't2', customerName: 'Khách B', sharePercent: 1 / 3, electricityAmount: 233333, waterAmount: 100000, totalAmount: 333333 },
      { customerId: 't3', customerName: 'Khách C', sharePercent: 1 / 3, electricityAmount: 233333, waterAmount: 100000, totalAmount: 333333 },
    ],
    ...overrides,
  };
}

describe('CORE-07: trình bày snapshot điện nước', () => {
  it('render dữ liệu snapshot đã khóa và chính sách nước 100.000đ/người', () => {
    const html = renderToStaticMarkup(React.createElement(HunonicSnapshotPresentation, { data: buildSnapshot() }));

    expect(html).toContain('Snapshot kỳ chốt');
    expect(html).toContain('3 người');
    expect(html).toContain('100.000 đ/người');
    expect(html).toContain('700.000 đ');
    expect(html).not.toContain('Cảnh báo: Tổng tiền phân bổ');
  });

  it('hiện cảnh báo khi tổng phân bổ không bảo toàn tổng phòng', () => {
    const invalid = buildSnapshot({
      tenantShares: [
        { customerId: 't1', customerName: 'Khách A', sharePercent: 1, electricityAmount: 1, waterAmount: 1, totalAmount: 2 },
      ],
    });
    const html = renderToStaticMarkup(React.createElement(HunonicSnapshotPresentation, { data: invalid }));

    expect(html).toContain('Cảnh báo: Tổng tiền phân bổ');
  });
});
