import { describe, expect, it, vi } from 'vitest';
import { ZaloRegistrationService } from './zalo-registration.service';

describe('ZaloRegistrationService', () => {
  function createService() {
    const prisma = {
      room: {
        findFirst: vi.fn(),
      },
      customer: {
        update: vi.fn(),
      },
    };
    const zaloProvider = {
      send: vi.fn().mockResolvedValue({ success: true }),
    };

    return {
      prisma,
      zaloProvider,
      service: new ZaloRegistrationService(prisma as any, zaloProvider as any),
    };
  }

  it('binds chat id to matched customer on a valid DK command and notifies customer + admin', async () => {
    const { service, prisma, zaloProvider } = createService();
    prisma.room.findFirst.mockResolvedValueOnce({
      id: 'room-1',
      code: '31.06',
      contracts: [
        {
          id: 'contract-1',
          customer: {
            id: 'customer-1',
            fullName: 'Khach A',
            phone: '0567867889',
            zaloUserId: null,
          },
        },
      ],
      roommates: [],
    });

    const result = await service.handleIncomingMessage(
      'tenant-1',
      {
        updateId: 'u-1',
        chatId: 'chat-123',
        chatType: 'private',
        senderId: 'sender-456',
        text: 'DK 0567867889 31.06',
        eventName: 'message_received',
        displayName: 'Khach A',
        raw: {},
      },
      { adminGroupChatId: 'admin-group-1' },
    );

    expect(result).toMatchObject({
      ok: true,
      customerId: 'customer-1',
      roomId: 'room-1',
      contractId: 'contract-1',
    });
    expect(prisma.customer.update).toHaveBeenCalledWith({
      where: { id: 'customer-1' },
      data: {
        zaloChatId: 'chat-123',
        zaloUserId: 'sender-456',
        zaloPhone: '0567867889',
      },
    });
    expect(zaloProvider.send).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        tenantId: 'tenant-1',
        recipient: 'chat-123',
        title: 'HomeLand - Đăng ký thành công',
      }),
    );
    expect(zaloProvider.send).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        tenantId: 'tenant-1',
        recipient: 'admin-group-1',
        title: 'HomeLand - Khách đã đăng ký Zalo Bot',
      }),
    );
  });

  it('replies with syntax help when a DK message is malformed', async () => {
    const { service, zaloProvider, prisma } = createService();

    const result = await service.handleIncomingMessage(
      'tenant-1',
      {
        updateId: 'u-1',
        chatId: 'chat-123',
        chatType: 'private',
        senderId: 'sender-456',
        text: 'DK dang ky',
        eventName: 'message_received',
        displayName: 'Khach A',
        raw: {},
      },
      {},
    );

    expect(result).toEqual({ route: 'customer', action: 'syntax_error' });
    expect(prisma.room.findFirst).not.toHaveBeenCalled();
    expect(zaloProvider.send).toHaveBeenCalledWith(
      expect.objectContaining({
        recipient: 'chat-123',
        title: 'HomeLand - Đăng ký Zalo Bot',
        message: expect.stringContaining('DK <SĐT> <PHÒNG>'),
      }),
    );
  });

  it('notifies customer and admin when phone does not belong to the active room contract', async () => {
    const { service, prisma, zaloProvider } = createService();
    prisma.room.findFirst.mockResolvedValueOnce({
      id: 'room-1',
      code: '31.06',
      contracts: [
        {
          id: 'contract-1',
          customer: {
            id: 'customer-1',
            fullName: 'Khach A',
            phone: '0909000001',
          },
        },
      ],
      roommates: [],
    });

    const result = await service.handleIncomingMessage(
      'tenant-1',
      {
        updateId: 'u-1',
        chatId: 'chat-123',
        chatType: 'private',
        senderId: 'sender-456',
        text: 'DK 0567867889 31.06',
        eventName: 'message_received',
        displayName: 'Khach A',
        raw: {},
      },
      { adminGroupChatId: 'admin-group-1' },
    );

    expect(result).toMatchObject({
      ok: false,
      code: 'PHONE_NOT_IN_CONTRACT',
    });
    expect(prisma.customer.update).not.toHaveBeenCalled();
    expect(zaloProvider.send).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        recipient: 'chat-123',
        message: expect.stringContaining('SĐT chưa được ghi nhận'),
      }),
    );
    expect(zaloProvider.send).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        recipient: 'admin-group-1',
        message: expect.stringContaining('PHONE_NOT_IN_CONTRACT'),
      }),
    );
  });

  it('replies with the current chat id when receiving /id', async () => {
    const { service, zaloProvider, prisma } = createService();

    const result = await service.handleIncomingMessage(
      'tenant-1',
      {
        updateId: 'u-1',
        chatId: 'group-123',
        chatType: 'group',
        senderId: 'sender-456',
        text: '/id',
        eventName: 'message.text.received',
        displayName: 'Admin',
        raw: {},
      },
      {},
    );

    expect(result).toEqual({ route: 'command', action: 'chat_id_echo' });
    expect(prisma.room.findFirst).not.toHaveBeenCalled();
    expect(zaloProvider.send).toHaveBeenCalledWith(
      expect.objectContaining({
        recipient: 'group-123',
        title: 'HomeLand - Chat ID',
        message: expect.stringContaining('Chat ID: group-123'),
      }),
    );
  });

  it('binds the admin group when receiving /setadmin with a valid setup code', async () => {
    const { service, zaloProvider, prisma } = createService();
    (prisma as any).appSetting = {
      findUnique: vi.fn().mockResolvedValue({
        id: 'setting-1',
        value: {},
      }),
      update: vi.fn().mockResolvedValue({}),
    };

    const result = await service.handleIncomingMessage(
      'tenant-1',
      {
        updateId: 'u-1',
        chatId: 'group-123',
        chatType: 'group',
        senderId: 'sender-456',
        text: '/setadmin A91F72BC',
        eventName: 'message.text.received',
        displayName: 'Admin',
        raw: {},
      },
      {
        adminSetupCode: 'A91F72BC',
        adminSetupCodeExpiresAt: '2026-08-24T17:00:00.000Z',
      },
    );

    expect(result).toEqual({
      route: 'command',
      action: 'admin_group_connected',
      chatId: 'group-123',
    });
    expect((prisma as any).appSetting.update).toHaveBeenCalledWith({
      where: { id: 'setting-1' },
      data: {
        value: expect.objectContaining({
          adminGroupChatId: 'group-123',
          adminSetupCode: null,
          adminSetupCodeExpiresAt: null,
        }),
      },
    });
    expect(zaloProvider.send).toHaveBeenCalledWith(
      expect.objectContaining({
        recipient: 'group-123',
        title: 'HomeLand - Admin Bot Connected',
        message: expect.stringContaining('Bot Admin đã kết nối'),
      }),
    );
  });
});
