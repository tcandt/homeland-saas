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
      status: 'QUEUED',
      error: null,
      retryCount: 0,
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
        findMany: vi.fn().mockResolvedValue([
          { id: notification.id, title: 'Pay now', message: 'Please scan QR', type: 'INVOICE_ZALO_PAYMENT_REQUEST', userId: 'customer-1', createdAt: new Date() },
        ]),
      },
      notificationQueue: {
        create: vi.fn().mockResolvedValue(queueItem),
        findUnique: vi.fn().mockResolvedValue(queueItem),
        findFirst: vi.fn().mockResolvedValue(queueItem),
        findMany: vi.fn().mockResolvedValue([{ id: 'queue-1', status: 'DELIVERED', error: null }]),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
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
    const send = vi.fn().mockResolvedValue({ ok: true, zaloResponse: { result: { message_id: 12345 } } });
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
        room: {
          id: 'room-1',
          code: 'P101',
          rentalType: 'SHARED',
          building: { id: 'building-1', name: 'LK01-31' },
        },
        contract: {
          id: 'contract-1',
          memberCount: 3,
        },
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
          context: expect.objectContaining({
            roomCode: 'P101',
            roomRentalType: 'SHARED',
            roomRentalTypeLabel: 'Phòng ghép',
            roomMemberCount: 3,
            buildingName: 'LK01-31',
          }),
        }),
      }),
    });
    expect(send).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: 'tenant-1',
      recipient: 'zalo-user-1',
    }));
    expect(prisma.notificationDelivery.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        notificationId: 'notif-1',
        channel: NotificationChannel.ZALO,
        status: 'DELIVERED',
        providerId: '12345',
      }),
    }));
  });

  it('marks queue failed with retry schedule when provider throws', async () => {
    const prisma = createPrismaMock();
    const service = new CommunicationService(prisma as any);
    const send = vi.fn().mockRejectedValue(new Error('Zalo unavailable'));
    const provider: CommunicationProvider = {
      channel: NotificationChannel.ZALO,
      send,
    };
    service.registerProvider(provider);

    await service.processQueueItem('queue-1');

    expect(prisma.notificationQueue.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'queue-1' },
      data: expect.objectContaining({
        status: 'FAILED',
        error: 'Zalo unavailable',
        retryCount: 1,
      }),
    }));
    expect(prisma.notification.update).toHaveBeenCalledWith({
      where: { id: 'notif-1' },
      data: { status: 'FAILED' },
    });
    expect(prisma.notificationDelivery.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        notificationId: 'notif-1',
        channel: NotificationChannel.ZALO,
        status: 'FAILED',
      }),
    }));
  });

  it('throws from dispatchDirect when immediate provider delivery fails', async () => {
    const prisma = createPrismaMock();
    prisma.notificationQueue.findMany = vi.fn().mockResolvedValue([
      {
        id: 'queue-1',
        status: 'FAILED',
        error: 'Zalo unavailable',
      },
    ]);
    const service = new CommunicationService(prisma as any);
    const send = vi.fn().mockRejectedValue(new Error('Zalo unavailable'));
    service.registerProvider({
      channel: NotificationChannel.ZALO,
      send,
    });

    await expect(
      service.dispatchDirect({
        tenantId: 'tenant-1',
        userId: 'customer-1',
        channel: NotificationChannel.ZALO,
        recipient: 'zalo-user-1',
        templateCode: 'INVOICE_ZALO_PAYMENT_REQUEST',
        context: {
          title: 'Pay now',
          message: 'Please scan QR',
        },
      }),
    ).rejects.toThrow('Zalo unavailable');
  });

  it('does not send when another worker already claimed the queue item', async () => {
    const prisma = createPrismaMock();
    prisma.notificationQueue.updateMany.mockResolvedValue({ count: 0 });
    const service = new CommunicationService(prisma as any);
    const send = vi.fn().mockResolvedValue({ ok: true });
    service.registerProvider({
      channel: NotificationChannel.ZALO,
      send,
    });

    await service.processQueueItem('queue-1');

    expect(send).not.toHaveBeenCalled();
    expect(prisma.notificationQueue.update).not.toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'queue-1' },
      data: expect.objectContaining({ status: 'DELIVERED' }),
    }));
  });

  it('returns queue admin summary and hydrated rows', async () => {
    const prisma = createPrismaMock();
    prisma.notificationQueue.findMany.mockResolvedValue([
      {
        id: 'queue-1',
        notificationId: 'notif-1',
        tenantId: 'tenant-1',
        channel: NotificationChannel.ZALO,
        retryCount: 1,
        status: 'FAILED',
        error: 'Zalo unavailable',
        nextRetryAt: new Date('2026-08-24T04:00:00.000Z'),
        createdAt: new Date('2026-08-24T03:00:00.000Z'),
        updatedAt: new Date('2026-08-24T03:30:00.000Z'),
        payload: {
          tenantId: 'tenant-1',
          recipient: 'zalo-user-1',
          title: 'Pay now',
          message: 'Please scan QR',
          templateCode: 'INVOICE_ZALO_PAYMENT_REQUEST',
        },
      },
    ]);
    const service = new CommunicationService(prisma as any);

    const result = await service.getQueueAdmin('tenant-1', { status: 'FAILED', search: 'scan' });

    expect(prisma.notificationQueue.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ tenantId: 'tenant-1', status: 'FAILED' }),
    }));
    expect(result.summary).toMatchObject({
      total: 1,
      failed: 1,
      delivered: 0,
    });
    expect(result.rows[0]).toMatchObject({
      id: 'queue-1',
      payloadTitle: 'Pay now',
      templateCode: 'INVOICE_ZALO_PAYMENT_REQUEST',
      recipient: 'zalo-user-1',
    });
  });

  it('moves queue item to dead letter on manual cancel', async () => {
    const prisma = createPrismaMock();
    const service = new CommunicationService(prisma as any);

    await service.cancelQueueItem('tenant-1', 'queue-1');

    expect(prisma.notificationQueue.update).toHaveBeenCalledWith({
      where: { id: 'queue-1' },
      data: {
        status: 'DEAD_LETTER',
        error: 'Cancelled manually',
        nextRetryAt: null,
      },
    });
    expect(prisma.notification.update).toHaveBeenCalledWith({
      where: { id: 'notif-1' },
      data: { status: 'FAILED' },
    });
  });
});
