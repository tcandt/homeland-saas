import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { depositAdapter } from '../../lib/adapters/deposit.adapter';
import { getDepositStatusLabel } from '../../lib/deposits/deposit-status';
import { DepositDocumentsStatus } from '../../components/deposits/DepositDocumentsStatus';
import OperationsDepositList from '../../components/deposits/OperationsDepositList';

const { queryResult } = vi.hoisted(() => ({ queryResult: { data: { data: { items: [] as any[], total: 0 } }, isLoading: false, isError: false } }));
vi.mock('../../lib/queries/deposits.queries', () => ({ useDepositsQuery: () => queryResult }));
vi.mock('../../lib/stores/deposit.store', () => ({ useDepositStore: () => ({ page: 1, limit: 20, statusFilter: 'ALL', typeFilter: 'ALL', buildingFilter: 'ALL', setPage: vi.fn(), setSelectedDeposit: vi.fn() }) }));
vi.mock('../../lib/mutations/deposits.mutations', () => ({ useDeleteDepositMutation: () => ({ mutate: vi.fn() }) }));
vi.mock('../../components/deposits/DepositQrModal', () => ({ default: () => null }));
vi.mock('../../components/ui/ConfirmDialog', () => ({ default: () => null }));

const toDeposit = (overrides: Record<string, unknown> = {}) => depositAdapter.toUI({
  id: 'security-1', code: 'SEC-1', type: 'SECURITY', status: 'PAID', amount: 8_000_000,
  createdAt: '2026-09-28', customer: { fullName: 'Khách thuê', idImages: [] },
  contract: { id: 'rental-1', status: 'ACTIVE', attachments: [] }, ...overrides,
});

describe('deposit list presentation', () => {
  it.each(['BOOKING', 'RESERVATION'])('labels converted %s deposits without changing the stored status', (type) => {
    const deposit = toDeposit({ type, status: 'CONVERTED_TO_CONTRACT' });
    expect(getDepositStatusLabel(deposit)).toBe('Đã chuyển đổi');
    expect(deposit.status).toBe('CONVERTED_TO_CONTRACT');
  });

  it.each(['ACTIVE', 'EXPIRING'])('shows an effective contract only for paid security and %s contracts', (status) => {
    expect(getDepositStatusLabel(toDeposit({ contract: { status } }))).toBe('HĐ có hiệu lực');
    expect(getDepositStatusLabel(toDeposit({ contract: { status }, status: 'PENDING' }))).toBe('Chờ thu cọc hợp đồng');
    expect(getDepositStatusLabel(toDeposit({ contract: { status }, type: 'BOOKING' }))).toBe('Đã thu cọc giữ phòng');
  });

  it.each(['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'TERMINATED', 'EXPIRED', 'CANCELLED', null])('does not treat paid security as activation when contract status is %s', (status) => {
    expect(getDepositStatusLabel(toDeposit({ contract: { status } }))).toBe('Đã thu cọc hợp đồng');
  });

  it('shows the actual missing files instead of the deposit amount', () => {
    queryResult.data.data = { items: [toDeposit()], total: 1 };
    const html = renderToStaticMarkup(React.createElement(OperationsDepositList));
    expect(html).toContain('Hồ sơ');
    expect(html).toContain('Thiếu file HĐ');
    expect(html).toContain('Thiếu file CCCD');
    expect(html).toContain('HĐ có hiệu lực');
    expect(html).not.toContain('Số tiền cọc');
    expect(html).not.toContain('8.000.000');
  });

  it('requires both identity sides and a contract file for a complete profile', () => {
    const deposit = toDeposit({ customer: { idImages: ['front.jpg', 'back.jpg'] }, contract: { attachments: ['signed.pdf'] } });
    const html = renderToStaticMarkup(React.createElement(DepositDocumentsStatus, { documents: deposit.documents }));
    expect(html).toContain('Đủ hồ sơ');
    expect(html).not.toContain('Thiếu');
  });

  it('flags a missing identity side and ignores empty file URLs', () => {
    const deposit = toDeposit({ customer: { idImages: ['front.jpg', ' '] }, contract: { attachments: [''] } });
    const html = renderToStaticMarkup(React.createElement(DepositDocumentsStatus, { documents: deposit.documents }));
    expect(html).toContain('Thiếu 1 mặt CCCD');
    expect(html).toContain('Thiếu file HĐ');
  });

  it('does not claim a complete profile when the response lacks document fields', () => {
    const deposit = toDeposit({ customer: {}, contract: {} });
    const html = renderToStaticMarkup(React.createElement(DepositDocumentsStatus, { documents: deposit.documents }));
    expect(html).toContain('Chưa đủ dữ liệu hồ sơ');
    expect(html).not.toContain('Đủ hồ sơ');
  });
});
