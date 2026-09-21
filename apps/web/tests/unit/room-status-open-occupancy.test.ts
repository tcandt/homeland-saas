import { describe, it, expect } from 'vitest';
import {
  getRoomUiStatus,
  getTenantRentalStatus,
  isActiveContract,
  isNonTerminalContract,
  hasOpenOccupancy,
  hasActiveHold,
} from '../../lib/adapters/room-status.adapter';

describe('D2-FIX-02: Room & Tenant Status Adapter (Unit Matrix)', () => {
  const baseDate = new Date('2026-09-08T12:00:00.000Z');

  // 1. AVAILABLE + không binding -> vacant
  it('1. AVAILABLE + no bindings should return vacant', () => {
    const room = {
      id: 'r-1',
      status: 'AVAILABLE',
      rentalType: 'WHOLE',
      contracts: [],
      occupancies: [],
      holds: [],
      roommates: [],
    };
    expect(getRoomUiStatus(room, baseDate)).toBe('vacant');
  });

  // 2. AVAILABLE + open occupancy -> occupied
  it('2. AVAILABLE + open occupancy should return occupied', () => {
    const room = {
      id: 'r-2',
      status: 'AVAILABLE',
      rentalType: 'WHOLE',
      contracts: [],
      occupancies: [{ id: 'occ-1', leftAt: null, status: 'ACTIVE' }],
      holds: [],
    };
    expect(getRoomUiStatus(room, baseDate)).toBe('occupied');
  });

  // 3. AVAILABLE + roommate lịch sử, không occupancy -> vacant
  it('3. AVAILABLE + legacy roommate without open occupancy should return vacant', () => {
    const room = {
      id: 'r-3',
      status: 'AVAILABLE',
      rentalType: 'WHOLE',
      contracts: [],
      occupancies: [{ id: 'occ-old', leftAt: '2026-01-01T00:00:00.000Z' }],
      roommates: [{ id: 'cust-old', name: 'Legacy Roommate' }],
      holds: [],
    };
    expect(getRoomUiStatus(room, baseDate)).toBe('vacant');
  });

  // 4. EXPIRED contract -> không occupied (vacant)
  it('4. EXPIRED / TERMINATED / CANCELLED contract should not make room occupied', () => {
    const room = {
      id: 'r-4',
      status: 'AVAILABLE',
      rentalType: 'WHOLE',
      contracts: [
        { id: 'c-exp', status: 'EXPIRED', endDate: '2026-08-01T00:00:00.000Z' },
        { id: 'c-term', status: 'TERMINATED', endDate: '2026-07-01T00:00:00.000Z' },
      ],
      occupancies: [],
      holds: [],
    };
    expect(getRoomUiStatus(room, baseDate)).toBe('vacant');
  });

  // 5. ACTIVE contract -> occupied
  it('5. ACTIVE contract should return occupied', () => {
    const room = {
      id: 'r-5',
      status: 'OCCUPIED',
      rentalType: 'WHOLE',
      contracts: [{ id: 'c-act', status: 'ACTIVE', endDate: '2026-12-31T00:00:00.000Z' }],
      occupancies: [],
      holds: [],
    };
    expect(getRoomUiStatus(room, baseDate)).toBe('occupied');
  });

  // 6. ACTIVE hold -> reserved / deposited
  it('6. ACTIVE hold (not expired) should return deposited (reserved)', () => {
    const room = {
      id: 'r-6',
      status: 'RESERVED',
      rentalType: 'WHOLE',
      contracts: [],
      occupancies: [],
      holds: [
        {
          id: 'hold-1',
          status: 'ACTIVE',
          expiresAt: '2026-09-10T12:00:00.000Z', // in future relative to baseDate
        },
      ],
    };
    expect(getRoomUiStatus(room, baseDate)).toBe('deposited');
  });

  it('6b. DRAFT / PENDING_APPROVAL contract should reserve the room without marking it occupied', () => {
    const draftRoom = {
      id: 'r-6b',
      status: 'AVAILABLE',
      rentalType: 'WHOLE',
      contracts: [{ id: 'c-draft', status: 'DRAFT', startDate: '2026-09-15T00:00:00.000Z' }],
      occupancies: [],
      holds: [],
    };
    expect(getRoomUiStatus(draftRoom, baseDate)).toBe('deposited');

    const pendingRoom = {
      ...draftRoom,
      contracts: [{ id: 'c-pending', status: 'PENDING_APPROVAL', startDate: '2026-09-15T00:00:00.000Z' }],
    };
    expect(getRoomUiStatus(pendingRoom, baseDate)).toBe('deposited');
  });

  // 7. Hold hết hạn -> không reserved (vacant)
  it('7. Expired hold should not make room reserved', () => {
    const room = {
      id: 'r-7',
      status: 'AVAILABLE',
      rentalType: 'WHOLE',
      contracts: [],
      occupancies: [],
      holds: [
        {
          id: 'hold-exp',
          status: 'ACTIVE',
          expiresAt: '2026-09-01T12:00:00.000Z', // in past relative to baseDate
        },
      ],
    };
    expect(getRoomUiStatus(room, baseDate)).toBe('vacant');
  });

  // 8. WHOLE / SHARED đều dùng cùng precedence
  it('8. SHARED room with open occupancy should return occupied', () => {
    const room = {
      id: 'r-8',
      status: 'AVAILABLE',
      rentalType: 'SHARED',
      contracts: [],
      occupancies: [{ id: 'occ-shared-1', leftAt: null }],
    };
    expect(getRoomUiStatus(room, baseDate)).toBe('occupied');
  });

  it('computes tenant rental status correctly for open occupancy (Ở ghép)', () => {
    const customer = {
      id: 'cust-roommate',
      fullName: 'Roommate A',
      occupancies: [{ id: 'occ-1', leftAt: null, room: { id: 'r-10', name: 'PN 32-07' } }],
    };
    const result = getTenantRentalStatus(customer, [], baseDate);
    expect(result.status).toBe('ACTIVE');
    expect(result.statusLabel).toBe('Ở ghép');
    expect(result.statusVariant).toBe('success');
  });

  it('computes tenant rental status correctly for DRAFT / PENDING_APPROVAL contract (Chờ ký HĐ)', () => {
    const customerDraft = {
      id: 'cust-draft',
      fullName: 'Customer Draft',
      contracts: [{ id: 'c-draft', status: 'DRAFT', startDate: '2026-09-15' }],
    };
    const resultDraft = getTenantRentalStatus(customerDraft, [], baseDate);
    expect(resultDraft.status).toBe('DRAFT');
    expect(resultDraft.statusLabel).toBe('Chờ ký HĐ');
    expect(resultDraft.statusVariant).toBe('primary');

    const customerPending = {
      id: 'cust-pending',
      fullName: 'Customer Pending Approval',
      contracts: [{ id: 'c-pending', status: 'PENDING_APPROVAL', startDate: '2026-09-15' }],
    };
    const resultPending = getTenantRentalStatus(customerPending, [], baseDate);
    expect(resultPending.status).toBe('DRAFT');
    expect(resultPending.statusLabel).toBe('Chờ ký HĐ');
    expect(resultPending.statusVariant).toBe('primary');
  });

  it('shows booking hold contracts as waiting for booking-hold contract signing', () => {
    const customer = {
      id: 'cust-booking-hold',
      fullName: 'Booking Hold Customer',
      contracts: [{
        id: 'c-booking-hold',
        code: 'HD-COC-PN 31-01-6538',
        status: 'ACTIVE',
        purpose: 'Hợp đồng cọc giữ phòng',
        startDate: '2026-09-20',
      }],
    };

    const result = getTenantRentalStatus(customer, [], baseDate);
    expect(result.status).toBe('DRAFT');
    expect(result.statusLabel).toBe('Chờ ký HĐ cọc giữ phòng');
    expect(result.statusVariant).toBe('primary');
  });

  it('computes tenant rental status correctly for terminated contract without open occupancy (Đã trả phòng)', () => {
    const customer = {
      id: 'cust-old',
      fullName: 'Old Tenant',
      contracts: [{ id: 'c-1', status: 'TERMINATED' }],
      occupancies: [{ id: 'occ-old', leftAt: '2026-01-01T00:00:00.000Z' }],
    };
    const result = getTenantRentalStatus(customer, [], baseDate);
    expect(result.status).toBe('TERMINATED');
    expect(result.statusLabel).toBe('Đã trả phòng');
    expect(result.statusVariant).toBe('neutral');
  });
});
