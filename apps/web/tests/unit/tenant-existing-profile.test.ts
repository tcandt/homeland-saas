import { describe, it, expect } from 'vitest';
import { maskPhone, maskCccd } from '../../lib/adapters/tenant-masking.adapter';

import { evaluateExistingCustomerSelection } from '../../lib/adapters/customer-selection';

describe('D2-FIX-04: Existing Customer Profile & PII Masking', () => {
  it('checks every open occupancy and fails closed on missing room binding', () => {
    expect(evaluateExistingCustomerSelection({ id: 'c', occupancies: [{}, { roomId: 'elsewhere' }] }, 'here').isSelectable).toBe(false);
    expect(evaluateExistingCustomerSelection({ id: 'c', occupancies: [{}] }, 'here').hasUnknownRoom).toBe(true);
    expect(evaluateExistingCustomerSelection({ id: 'c', roomId: 'legacy' }, 'here').isSelectable).toBe(false);
    expect(evaluateExistingCustomerSelection({ id: 'c', roomId: 'legacy', occupancies: [] }, 'here').isSelectable).toBe(true);
    expect(evaluateExistingCustomerSelection({ id: 'c', occupancies: [{ room: { id: 'here' } }] }, 'here').isInCurrentRoom).toBe(true);
  });

  it('blocks open contracts elsewhere but ignores deleted and terminated contracts', () => {
    expect(evaluateExistingCustomerSelection({ id: 'c', contracts: [{ roomId: 'elsewhere', status: 'DRAFT' }] }, 'here').isSelectable).toBe(false);
    expect(evaluateExistingCustomerSelection({ id: 'c', contracts: [{ roomId: 'elsewhere', status: 'ACTIVE', deletedAt: '2026-09-01' }] }, 'here').isSelectable).toBe(true);
    expect(evaluateExistingCustomerSelection({ id: 'c' }, '').isSelectable).toBe(false);
  });
  it('masks phone numbers and CCCD properly', () => {
    expect(maskPhone('0989882555')).toBe('098****555');
    expect(maskPhone('0363564131')).toBe('036****131');
    expect(maskCccd('079199001234')).toBe('079******234');
    expect(maskPhone('')).toBe('');
    expect(maskCccd('')).toBe('');
  });

  it('allows selecting former customer who has terminated contracts and no open occupancy', () => {
    const formerCustomer = {
      id: 'cust-former',
      fullName: 'Nguyen Thi Ngoc Anh',
      phone: '0363564131',
      identityNo: '079199001234',
      contracts: [{ status: 'TERMINATED' }],
      occupancies: [{ roomId: 'old-room-id', leftAt: '2026-08-01T00:00:00.000Z' }],
    };

    const evaluation = evaluateExistingCustomerSelection(formerCustomer, 'new-room-id');
    expect(evaluation.isSelectable).toBe(true);
    expect(evaluation.isInAnotherRoom).toBe(false);
    expect(evaluation.isInCurrentRoom).toBe(false);
  });

  it('blocks selecting customer who currently has an open occupancy in another room', () => {
    const activeCustomer = {
      id: 'cust-active-elsewhere',
      fullName: 'Tran Yen Chi',
      phone: '0399576087',
      occupancies: [{ roomId: 'room-building-1', leftAt: null }],
    };

    const evaluation = evaluateExistingCustomerSelection(activeCustomer, 'room-building-2');
    expect(evaluation.isSelectable).toBe(false);
    expect(evaluation.isInAnotherRoom).toBe(true);
  });

  it('blocks selecting customer who is already an active occupant in current room', () => {
    const currentOccupant = {
      id: 'cust-here',
      fullName: 'Pham Phu Hung',
      phone: '0849911189',
      occupancies: [{ roomId: 'room-current', leftAt: null }],
    };

    const evaluation = evaluateExistingCustomerSelection(currentOccupant, 'room-current');
    expect(evaluation.isSelectable).toBe(false);
    expect(evaluation.isInCurrentRoom).toBe(true);
  });
});
