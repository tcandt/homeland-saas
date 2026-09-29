import { describe, expect, it, vi } from 'vitest';
import { AdminZaloAlertsService } from './admin-zalo-alerts.service';

describe('AdminZaloAlertsService', () => {
  it('dispatches the configured update template to each configured tenant group without a provider', async () => {
    const prisma = {
      appSetting: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'setting-a', tenantId: 'tenant-a', value: { adminGroupChatId: 'group-a' } },
          { id: 'setting-b', tenantId: 'tenant-b', value: { adminGroupChatId: '   ' } },
          { id: 'setting-c', tenantId: 'tenant-c', value: { adminGroupChatId: 'group-c' } },
        ]),
      },
    };
    const communicationService = { dispatchDirect: vi.fn().mockResolvedValue({ delivered: true }) };
    const service = new AdminZaloAlertsService(
      prisma as any,
      communicationService as any,
      {} as any,
      {} as any,
    );

    await service.notifyManualUpdateSuccess({ fromVersion: 'v2.8.1', toVersion: 'v2.8.2' });

    expect(communicationService.dispatchDirect).toHaveBeenCalledTimes(2);
    expect(communicationService.dispatchDirect).toHaveBeenNthCalledWith(1, expect.objectContaining({
      tenantId: 'tenant-a',
      recipient: 'group-a',
      channel: 'ZALO',
      templateCode: 'ADMIN_SYSTEM_UPDATE_SUCCESS',
      context: expect.objectContaining({
        headline: '✅ CẬP NHẬT THÀNH CÔNG',
        primaryValue: 'v2.8.1 → v2.8.2',
      }),
    }));
    expect(communicationService.dispatchDirect).toHaveBeenNthCalledWith(2, expect.objectContaining({
      tenantId: 'tenant-c',
      recipient: 'group-c',
      templateCode: 'ADMIN_SYSTEM_UPDATE_SUCCESS',
    }));
  });
});
