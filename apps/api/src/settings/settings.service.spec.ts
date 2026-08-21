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

  it('does not return protected integration secrets from settings', async () => {
    prisma.appSetting.findUnique.mockResolvedValue({
      value: {
        enabled: true,
        smtpHost: 'smtp.example.test',
        smtpPassword: 'secret-password',
      },
      updatedAt: new Date('2026-08-12T00:00:00.000Z'),
    });

    const result = await service.getSection('tenant-1', 'user-1', 'email-provider', SettingScope.TENANT);

    expect(result.value).toEqual({
      enabled: true,
      smtpHost: 'smtp.example.test',
      smtpPasswordConfigured: true,
    });
  });

  it('rejects integration secret changes from the regular admin and writes a redacted audit event', async () => {
    prisma.user.findFirst.mockResolvedValue({ email: 'admin@homeland.local' });

    await expect(
      service.saveSection(
        'tenant-1',
        'user-1',
        'telegram-provider',
        SettingScope.TENANT,
        { enabled: true, botToken: 'new-secret-token' },
        'user-1',
      ),
    ).rejects.toThrow('Chỉ owner admin A/B được chỉnh sửa token hoặc mật khẩu tích hợp.');

    expect(prisma.appSetting.upsert).not.toHaveBeenCalled();
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({
      action: 'UPDATE',
      entityId: 'telegram-provider',
      before: expect.objectContaining({
        denied: true,
        reason: 'INTEGRATION_SECRET_UPDATE_FORBIDDEN',
        fields: ['botToken'],
      }),
      after: expect.objectContaining({ botToken: '__redacted__' }),
    }));
  });

  it('allows owner admin A to replace a secret without returning it in the response', async () => {
    prisma.user.findFirst.mockResolvedValue({ email: 'adminA@homeland.local' });
    prisma.appSetting.upsert.mockResolvedValue({
      id: 'setting-email',
      key: 'email-provider',
      scope: SettingScope.TENANT,
      value: {
        enabled: true,
        smtpHost: 'smtp.example.test',
        smtpPassword: 'new-secret-password',
      },
      updatedAt: new Date('2026-08-12T00:00:00.000Z'),
    });

    const result = await service.saveSection(
      'tenant-1',
      'owner-a-user',
      'email-provider',
      SettingScope.TENANT,
      { enabled: true, smtpHost: 'smtp.example.test', smtpPassword: 'new-secret-password' },
      'owner-a-user',
    );

    expect(prisma.appSetting.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        value: expect.objectContaining({ smtpPassword: 'new-secret-password' }),
      }),
    }));
    expect(result.value).toEqual({ enabled: true, smtpHost: 'smtp.example.test', smtpPasswordConfigured: true });
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({
      after: expect.objectContaining({ smtpPassword: '__redacted__' }),
    }));
  });

  it('preserves an existing secret when an operational settings update omits it', async () => {
    prisma.appSetting.findUnique.mockResolvedValue({
      value: {
        enabled: true,
        defaultChatId: 'old-chat',
        botToken: 'existing-secret-token',
      },
    });
    prisma.appSetting.upsert.mockResolvedValue({
      id: 'setting-telegram',
      key: 'telegram-provider',
      scope: SettingScope.TENANT,
      value: {
        enabled: true,
        defaultChatId: 'new-chat',
        botToken: 'existing-secret-token',
      },
      updatedAt: new Date('2026-08-12T00:00:00.000Z'),
    });

    await service.saveSection(
      'tenant-1',
      'user-1',
      'telegram-provider',
      SettingScope.TENANT,
      { enabled: true, defaultChatId: 'new-chat' },
      'user-1',
    );

    expect(prisma.user.findFirst).not.toHaveBeenCalled();
    expect(prisma.appSetting.upsert).toHaveBeenCalledWith(expect.objectContaining({
      update: {
        value: expect.objectContaining({
          defaultChatId: 'new-chat',
          botToken: 'existing-secret-token',
        }),
        updatedBy: 'user-1',
      },
    }));
  });
});
