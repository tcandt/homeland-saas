import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { groupContractRows } from '../../lib/contracts/group-contract-rows';
import OperationsContractList from '../../components/contracts/OperationsContractList';
import OperationsContractRow from '../../components/contracts/OperationsContractRow';
import { getRentalTermPhase } from '../../lib/contracts/contract-status';

const rental = {
  id: 'rental-1', tenantId: 'tenant-1', customerId: 'customer-1', roomId: 'room-1', rentalCycleId: 'cycle-1',
  code: 'HD-THUE-1', status: 'DRAFT', startDate: '2026-10-01', endDate: '2027-10-01',
  termsSnapshot: { convertedFromBookingHold: { sourceContractId: 'booking-1' } },
};
const booking = {
  id: 'booking-1', tenantId: 'tenant-1', customerId: 'customer-1', roomId: 'room-1', rentalCycleId: 'cycle-1',
  code: 'HD-COC-1', status: 'APPROVED',
  termsSnapshot: { bookingConversion: { rentalContractId: 'rental-1', rentalContractCode: 'HD-THUE-1' } },
};

const { queryResult } = vi.hoisted(() => ({ queryResult: { data: { data: [] as any[] }, isLoading: false, isError: false } }));
vi.mock('../../lib/queries/contracts.queries', () => ({ useContractsQuery: () => queryResult }));
vi.mock('../../lib/hooks/useContractsStore', () => ({ useContractsStore: () => ({ search: '', status: '' }) }));
vi.mock('../../components/contracts/OperationsContractDrawer', () => ({ default: () => null }));
vi.mock('../../components/tenants/TenantDetailDrawer', () => ({ getTenantAvatar: () => '/avatar.png' }));

describe('contract row grouping', () => {
  it('puts a linked rental above its booking contract in one numbered group', () => {
    const groups = groupContractRows([booking, rental]);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ rental: { id: 'rental-1' }, booking: { id: 'booking-1' } });
  });

  it('supports a target-side link when the older source has no link', () => {
    expect(groupContractRows([rental, { ...booking, termsSnapshot: null }])).toHaveLength(1);
  });

  it('does not group unrelated contracts in the same room or different tenant', () => {
    const unrelated = { ...rental, id: 'rental-2', termsSnapshot: null };
    expect(groupContractRows([booking, unrelated])).toHaveLength(2);
    expect(groupContractRows([booking, { ...rental, tenantId: 'tenant-2' }])).toHaveLength(2);
  });

  it('keeps both documents independently when a filter returns only one side', () => {
    expect(groupContractRows([booking])).toMatchObject([{ booking: null, rental: { id: 'booking-1' } }]);
    expect(groupContractRows([rental])).toMatchObject([{ booking: null, rental: { id: 'rental-1' } }]);
  });

  it('renders a linked rental and booking pair without an ordinal column', () => {
    queryResult.data.data = [rental, booking];
    const html = renderToStaticMarkup(React.createElement(OperationsContractList));
    expect(html.match(/data-testid="contract-group"/g)).toHaveLength(1);
    expect(html.match(/data-testid="contract-card"/g)).toHaveLength(2);
    expect(html).toContain('2 hợp đồng');
    expect(html).not.toContain('STT');
    expect(html).toContain('Hợp đồng cọc chuyển lên hợp đồng thuê dài hạn');
    expect(html.indexOf('HD-THUE-1')).toBeLessThan(html.indexOf('HD-COC-1'));
    expect(html).toContain('Mở Hợp đồng thuê phòng HD-THUE-1');
    expect(html).toContain('Mở Hợp đồng cọc giữ phòng HD-COC-1');
  });

  it('does not show rental time progress before the contract is active', () => {
    for (const status of ['DRAFT', 'PENDING_APPROVAL', 'APPROVED']) {
      const html = renderToStaticMarkup(React.createElement(OperationsContractRow, { contract: { ...rental, status }, onClick: () => {} }));
      expect(html).toContain('Thời hạn dự kiến');
      expect(html).toContain('Chưa có hiệu lực');
      expect(html).not.toContain('Còn ');
      expect(html).not.toContain('role="progressbar"');
    }

    const activeHtml = renderToStaticMarkup(React.createElement(OperationsContractRow, { contract: { ...rental, status: 'ACTIVE' }, onClick: () => {} }));
    expect(activeHtml).not.toContain('Thời hạn dự kiến');
    expect(activeHtml).toContain('role="progressbar"');
    expect(getRentalTermPhase('APPROVED')).toBe('pending');
    expect(getRentalTermPhase('ACTIVE')).toBe('running');
    expect(getRentalTermPhase('EXPIRED')).toBe('expired');
    expect(getRentalTermPhase('TERMINATED')).toBe('ended');
  });

  it('shows booking PDF signing separately from rental approval', () => {
    const signedBooking = renderToStaticMarkup(React.createElement(OperationsContractRow, {
      contract: { ...booking, signedAt: null, attachments: ['document-storage://contracts/booking.pdf'] },
      onClick: () => {},
    }));
    const approvedUnsignedRental = renderToStaticMarkup(React.createElement(OperationsContractRow, {
      contract: { ...rental, status: 'APPROVED', signedAt: null },
      onClick: () => {},
    }));
    expect(signedBooking).toContain('Đã ký');
    expect(approvedUnsignedRental).toContain('Đã duyệt');
    expect(approvedUnsignedRental).toContain('Chưa ký');
    expect(approvedUnsignedRental).not.toContain('Đã ký');
  });
});
