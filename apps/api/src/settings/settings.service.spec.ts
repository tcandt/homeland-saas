import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingScope } from '@prisma/client';
import { SettingsService } from './settings.service';

describe('SettingsService', () => {
  let service: SettingsService;
  let prisma: any;
  let audit: any;

  beforeEach(() => {
    prisma = {
      appSetting: {
        findUnique: vi.fn().mockResolvedValue(null),
        upsert: vi.fn().mockResolvedValue({
          id: 'setting-1',
          key: 'owners',
          scope: SettingScope.TENANT,
          value: {},
          updatedAt: new Date('2026-08-12T00:00:00.000Z'),
        }),
      },
      owner: {
        findFirst: vi.fn(),
        update: vi.fn(),
      },
      user: {
        findFirst: vi.fn(),
      },
      $transaction: vi.fn(async (callback: any) => callback(prisma)),
    };
    audit = { log: vi.fn() };
    service = new SettingsService(prisma, audit);
  });

  it('syncs tenant owner settings into the owner directory', async () => {
    const value = {
      ownerAName: 'Tính',
      ownerBName: 'Thể',
      ownerAContactEmail: 'tinh@example.com',
      ownerBContactEmail: '',
      ownerAPhone: '0901000001',
      ownerBPhone: '  ',
    };
    prisma.appSetting.upsert.mockResolvedValue({
      id: 'setting-owners',
      key: 'owners',
      scope: SettingScope.TENANT,
      value,
      updatedAt: new Date('2026-08-12T00:00:00.000Z'),
    });
    prisma.owner.findFirst
      .mockResolvedValueOnce({ id: 'owner-a', code: 'OWNER-A', name: 'Owner A', email: null, phone: null })
      .mockResolvedValueOnce({ id: 'owner-b', code: 'OWNER-B', name: 'Owner B', email: null, phone: null });
    prisma.owner.update
      .mockResolvedValueOnce({ id: 'owner-a', code: 'OWNER-A', name: 'Tính', email: 'tinh@example.com', phone: '0901000001' })
      .mockResolvedValueOnce({ id: 'owner-b', code: 'OWNER-B', name: 'Thể', email: null, phone: null });

    await service.saveSection('tenant-1', 'user-1', 'owners', SettingScope.TENANT, value, 'user-1');

    expect(prisma.owner.update).toHaveBeenNthCalledWith(1, {
      where: { id: 'owner-a' },
      data: { name: 'Tính', email: 'tinh@example.com', phone: '0901000001' },
      select: { id: true, code: true, name: true, email: true, phone: true },
    });
    expect(prisma.owner.update).toHaveBeenNthCalledWith(2, {
      where: { id: 'owner-b' },
      data: { name: 'Thể', email: null, phone: null },
      select: { id: true, code: true, name: true, email: true, phone: true },
    });
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({
      entity: 'AppSetting',
      module: 'Settings',
      userId: 'user-1',
    }));
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({
      entity: 'Owner',
      entityId: 'owner-a',
      before: expect.objectContaining({ name: 'Owner A' }),
      after: expect.objectContaining({ name: 'Tính' }),
    }));
  });

  it('does not update owners for user-scoped settings', async () => {
    await service.saveSection('tenant-1', 'user-1', 'owners', SettingScope.USER, { ownerAName: 'Tính' }, 'user-1');

    expect(prisma.owner.update).not.toHaveBeenCalled();
  });

  it('rejects empty owner names without persisting the transaction', async () => {
    await expect(
      service.saveSection(
        'tenant-1',
        'user-1',
        'owners',
        SettingScope.TENANT,
        { ownerAName: '', ownerBName: 'Thể' },
        'user-1',
      ),
    ).rejects.toThrow('OWNER_NAME_REQUIRED');
  });
});
