import { describe, expect, it, vi } from 'vitest';
import { PaymentsService } from './payments.service';

describe('PaymentsService SePay admin config', () => {
  it('returns unmapped rooms when no receiving bank account has been configured', async () => {
    const service = Object.create(PaymentsService.prototype) as any;
    service.getSePayStatus = vi.fn().mockResolvedValue({ enabled: true });
    service.resolveRoutingSettings = vi.fn().mockResolvedValue({ assignments: [] });
    service.resolveBankAccount = vi.fn();
    service.prisma = {
      bankAccount: { findMany: vi.fn().mockResolvedValue([]) },
      room: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'room-1',
            code: 'PN 31-01',
            name: 'Phòng 31-01',
            rentalType: 'SINGLE',
            buildingId: 'building-1',
            building: {
              id: 'building-1',
              code: 'LK01.31',
              name: 'LK01.31',
              ownerId: 'owner-1',
            },
          },
        ]),
      },
      owner: { findMany: vi.fn().mockResolvedValue([{ id: 'owner-1', name: 'Tính' }]) },
    };

    const result = await service.getSePayAdminConfig('tenant-1');

    expect(service.resolveBankAccount).not.toHaveBeenCalled();
    expect(result.bankAccounts).toEqual([]);
    expect(result.routes).toEqual([]);
    expect(result.rooms).toEqual([
      expect.objectContaining({
        id: 'room-1',
        mappedBankAccountId: null,
        mappedBankAccountLabel: null,
        mappingSource: null,
      }),
    ]);
  });
});
