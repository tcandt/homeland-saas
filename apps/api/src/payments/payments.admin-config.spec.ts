import { describe, expect, it, vi } from 'vitest';
import { PaymentsService } from './payments.service';

describe('PaymentsService SePay admin config', () => {
  it('still rejects real QR generation while SePay is disabled before resolving a bank account', async () => {
    const service = Object.create(PaymentsService.prototype) as any;
    service.resolveSePayConfig = vi.fn().mockResolvedValue({ enabled: false });
    service.prisma = { bankAccount: { findFirst: vi.fn() } };
    await expect(service.previewSePayQr('tenant-1', { bankAccountId: 'bank-1' }))
      .rejects.toMatchObject({ status: 400, message: 'SePay đang tắt trong Settings' });
    expect(service.prisma.bankAccount.findFirst).not.toHaveBeenCalled();
  });

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

  it('keeps bank and room routing metadata readable while SePay is disabled', async () => {
    const service = Object.create(PaymentsService.prototype) as any;
    service.getSePayStatus = vi.fn().mockResolvedValue({ enabled: false });
    service.resolveRoutingSettings = vi.fn().mockResolvedValue({
      assignments: [{
        id: 'route-1',
        roomId: 'room-1',
        bankAccountId: 'bank-1',
        validFrom: '2026-01-01T00:00:00.000Z',
      }],
    });
    service.resolveBankAccount = vi.fn().mockRejectedValue(new Error('must not resolve disabled SePay'));
    service.formatBankAccountLabel = vi.fn((account: any) => `${account.bankName} • ${account.accountNumber}`);
    service.isRoutingAssignmentActive = vi.fn().mockReturnValue(true);
    service.prisma = {
      bankAccount: {
        findMany: vi.fn().mockResolvedValue([{
          id: 'bank-1',
          ownerId: 'owner-1',
          bankName: 'VCB',
          accountNumber: '123456',
          accountName: 'HomeLand',
          isActive: true,
        }]),
      },
      room: {
        findMany: vi.fn().mockResolvedValue([{
          id: 'room-1',
          code: 'PN 31-01',
          name: 'Phòng 31-01',
          rentalType: 'SINGLE',
          buildingId: 'building-1',
          building: { id: 'building-1', code: 'LK01.31', name: 'LK01.31', ownerId: 'owner-1' },
        }]),
      },
      owner: { findMany: vi.fn().mockResolvedValue([{ id: 'owner-1', name: 'Tính' }]) },
    };

    const result = await service.getSePayAdminConfig('tenant-1');

    expect(service.resolveBankAccount).not.toHaveBeenCalled();
    expect(result.routes).toEqual([
      expect.objectContaining({ roomId: 'room-1', bankAccountId: 'bank-1' }),
    ]);
    expect(result.rooms[0]).toEqual(expect.objectContaining({
      mappedBankAccountId: 'bank-1',
      mappingSource: 'ROOM',
    }));
  });
});
