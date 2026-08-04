import { describe, expect, it, vi } from 'vitest';
import { CommunicationService, CommunicationProvider } from './communication.service';
import { NotificationChannel } from '../automation/automation.constants';

describe('CommunicationService', () => {
  function createPrismaMock() {
    const notification = { id: 'notif-1' };
    const queueItem = {
      id: 'queue-1',
      notificationId: notification.id,
      channel: NotificationChannel.ZALO,
      payload: {
        tenantId: 'tenant-1',
        recipient: 'zalo-user-1',
        title: 'Pay now',
        message: 'Please scan QR',
      },
    };

    return {
      notificationTemplate: {
        findUnique: vi.fn().mockResolvedValue({
          name: 'Payment request',
          subject: '{{title}}',
          body: '{{message}}',
        }),
      },
      notificationPreference: {
        findUnique: vi.fn(),
      },
      notification: {
        create: vi.fn().mockResolvedValue(notification),
        update: vi.fn(),
      },
      notificationQueue: {
        create: vi.fn().mockResolvedValue(queueItem),
        findUnique: vi.fn().mockResolvedValue(queueItem),
        update: vi.fn(),
      },
      notificationDelivery: {
        create: vi.fn(),
      },
    };
  }

  it('uses the explicit direct channel and forwards tenant recipient payload to provider', async () => {
    const prisma = createPrismaMock();
    const service = new CommunicationService(prisma as any);
    const send = vi.fn().mockResolvedValue({ ok: true });
    const provider: CommunicationProvider = {
      channel: NotificationChannel.ZALO,
      send,
    };
    service.registerProvider(provider);

    await service.dispatchDirect({
      tenantId: 'tenant-1',
      userId: 'customer-1',
      channel: NotificationChannel.ZALO,
      recipient: 'zalo-user-1',
      templateCode: 'INVOICE_ZALO_PAYMENT_REQUEST',
      context: {
        title: 'Pay now',
        message: 'Please scan QR',
      },
    });

    expect(prisma.notificationPreference.findUnique).toHaveBeenCalled();
    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: 'tenant-1',
        userId: 'customer-1',
        channel: NotificationChannel.ZALO,
      }),
    });
    expect(prisma.notificationQueue.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        channel: NotificationChannel.ZALO,
        payload: expect.objectContaining({
          tenantId: 'tenant-1',
          recipient: 'zalo-user-1',
          channel: NotificationChannel.ZALO,
        }),
      }),
    });
    expect(send).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: 'tenant-1',
      recipient: 'zalo-user-1',
    }));
  });
});
