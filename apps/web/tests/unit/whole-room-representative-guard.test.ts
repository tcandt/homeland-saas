import { describe, it, expect } from 'vitest';

/**
 * Pure guard function testing WHOLE room invariant:
 * A WHOLE room with roommates but without a primary contract representative must block adding more roommates
 * and require selecting/creating a primary representative.
 */
export function evaluateWholeRoomRepresentativeGuard(params: {
  rentalType: string;
  hasPrimaryRepresentative: boolean;
  occupantCount: number;
}) {
  const isWhole = params.rentalType.toLowerCase() !== 'shared';
  const hasOrphanRoommates = isWhole && params.occupantCount > 0 && !params.hasPrimaryRepresentative;

  return {
    isWhole,
    hasOrphanRoommates,
    canAddRoommate: isWhole ? params.hasPrimaryRepresentative : true,
    mustCreatePrimaryRepresentative: hasOrphanRoommates,
    lockedRepresentativeState: hasOrphanRoommates ? true : false,
    alertMessage: hasOrphanRoommates
      ? 'Cảnh báo: Phòng nguyên căn chưa có Đại diện hợp đồng chính. Phải chỉ định hoặc thêm đại diện HĐ chính trước khi thêm thành viên khác.'
      : null,
  };
}

describe('D2-FIX-03: WHOLE Room Representative Guard', () => {
  it('WHOLE room with orphan roommate: blocks adding new roommate and requires primary rep', () => {
    const guard = evaluateWholeRoomRepresentativeGuard({
      rentalType: 'WHOLE',
      hasPrimaryRepresentative: false,
      occupantCount: 2, // has occupants/roommates in DB
    });

    expect(guard.hasOrphanRoommates).toBe(true);
    expect(guard.canAddRoommate).toBe(false);
    expect(guard.mustCreatePrimaryRepresentative).toBe(true);
    expect(guard.lockedRepresentativeState).toBe(true);
    expect(guard.alertMessage).toContain('chưa có Đại diện hợp đồng chính');
  });

  it('WHOLE room with primary representative: permits adding roommates', () => {
    const guard = evaluateWholeRoomRepresentativeGuard({
      rentalType: 'WHOLE',
      hasPrimaryRepresentative: true,
      occupantCount: 1,
    });

    expect(guard.hasOrphanRoommates).toBe(false);
    expect(guard.canAddRoommate).toBe(true);
    expect(guard.mustCreatePrimaryRepresentative).toBe(false);
  });

  it('SHARED room: does not enforce WHOLE room representative guard', () => {
    const guard = evaluateWholeRoomRepresentativeGuard({
      rentalType: 'SHARED',
      hasPrimaryRepresentative: false,
      occupantCount: 1,
    });

    expect(guard.isWhole).toBe(false);
    expect(guard.hasOrphanRoommates).toBe(false);
    expect(guard.canAddRoommate).toBe(true);
  });
});
