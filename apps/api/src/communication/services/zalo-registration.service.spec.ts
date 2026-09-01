import { describe, expect, it, vi } from 'vitest';
import { ZaloRegistrationService } from './zalo-registration.service';

describe('ZaloRegistrationService', () => {
  function createService() {
    const prisma = {
      room: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
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

  it('binds chat id to multiple phone numbers for room and notifies customer + admin', async () => {
    const { service, prisma, zaloProvider } = createService();
    prisma.room.findFirst.mockResolvedValueOnce({
      id: 'room-1',
      code: 'PN 31-06',
      building: { code: 'LK01.31', name: 'Tòa nhà LK01.31' },
      contracts: [
        {
          id: 'contract-1',
          customer: {
            id: 'customer-1',
            fullName: 'Nguyen Van A',
            phone: '0567867889',
            zaloUserId: null,
          },
        },
      ],
      roommates: [
        {
          id: 'customer-2',
          fullName: 'Tran Thi B',
          phone: '0329484353',
          zaloUserId: null,
        },
      ],
    });

    const result = await service.handleIncomingMessage(
      'tenant-1',
      {
        updateId: 'u-1',
        chatId: 'chat-123',
        chatType: 'private',
        senderId: 'sender-456',
        text: 'DK 0567867889,0329484353 31.06',
        eventName: 'message_received',
        displayName: 'Nguyen Van A',
        raw: {},
      },
      { adminGroupChatId: 'admin-group-1' },
    );

    expect(result).toMatchObject({
      ok: true,
      customerIds: ['customer-1', 'customer-2'],
      roomId: 'room-1',
      contractId: 'contract-1',
    });
    expect(prisma.customer.update).toHaveBeenCalledTimes(2);
    expect(prisma.customer.update).toHaveBeenCalledWith({
      where: { id: 'customer-1' },
      data: {
        zaloChatId: 'chat-123',
        zaloUserId: 'sender-456',
        zaloPhone: '0567867889',
      },
    });
    expect(prisma.customer.update).toHaveBeenCalledWith({
      where: { id: 'customer-2' },
      data: {
        zaloChatId: 'chat-123',
        zaloUserId: 'sender-456',
        zaloPhone: '0329484353',
      },
    });
    expect(zaloProvider.send).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        recipient: 'chat-123',
        title: 'HomeLand - Đăng ký thành công',
        message: expect.stringContaining('0567867889, 0329484353'),
      }),
    );
  });

  it('unregisters Zalo notifications when receiving HUY command with phone and room', async () => {
    const { service, prisma, zaloProvider } = createService();
    prisma.room.findFirst.mockResolvedValueOnce({
      id: 'room-1',
      code: 'PN 31-06',
      building: { code: 'LK01.31', name: 'Tòa LK01.31' },
      contracts: [
        {
          id: 'contract-1',
          customer: {
            id: 'customer-1',
            fullName: 'Nguyen Van A',
            phone: '0567867889',
            zaloChatId: 'chat-123',
            zaloUserId: 'sender-456',
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
        text: 'HUY 0567867889 LK31.06',
        eventName: 'message_received',
        displayName: 'Nguyen Van A',
        raw: {},
      },
      { adminGroupChatId: 'admin-group-1' },
    );

    expect(result).toMatchObject({
      ok: true,
      action: 'unregistered',
      customerIds: ['customer-1'],
    });
    expect(prisma.customer.update).toHaveBeenCalledWith({
      where: { id: 'customer-1' },
      data: {
        zaloChatId: null,
        zaloUserId: null,
        zaloPhone: null,
      },
    });
    expect(zaloProvider.send).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        recipient: 'chat-123',
        title: 'HomeLand - Hủy nhận thông báo thành công',
      }),
    );
    expect(zaloProvider.send).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        recipient: 'admin-group-1',
        title: 'HomeLand - Khách hủy nhận tin Zalo Bot',
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
        message: expect.stringContaining('DK <SĐT> <MÃ PHÒNG>'),
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
        message: expect.stringContaining('Đăng ký không thành công'),
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
        text: '/id',
        eventName: 'message.text.received',
        displayName: 'Admin',
        raw: {},
      },
      {},
    );

    expect(result).toEqual({ route: 'command', action: 'admin_group_auto_connected', chatId: 'group-123' });
    expect(prisma.room.findFirst).not.toHaveBeenCalled();
    expect((prisma as any).appSetting.update).toHaveBeenCalledWith({
      where: { id: 'setting-1' },
      data: {
        value: expect.objectContaining({
          adminGroupChatId: 'group-123',
          lastWebhookChatId: 'group-123',
        }),
      },
    });
    expect(zaloProvider.send).toHaveBeenCalledWith(
      expect.objectContaining({
        recipient: 'group-123',
        title: 'HomeLand - Chat ID',
        message: expect.stringContaining('Chat ID: group-123'),
      }),
    );
  });

  it('auto-binds admin group from /id even when chat type is unknown but chat id differs from sender id', async () => {
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
        chatId: '998877665544332211',
        senderId: '1122334455',
        text: '/id',
        chatType: 'unknown',
        eventName: 'message',
        updateId: 'update-2',
        displayName: 'Admin Group',
        raw: {},
      },
      {},
    );

    expect(result).toEqual({
      route: 'command',
      action: 'admin_group_auto_connected',
      chatId: '998877665544332211',
    });
    expect((prisma as any).appSetting.update).toHaveBeenCalledWith({
      where: { id: 'setting-1' },
      data: {
        value: expect.objectContaining({
          adminGroupChatId: '998877665544332211',
          lastWebhookChatId: '998877665544332211',
        }),
      },
    });
    expect(zaloProvider.send).toHaveBeenCalledWith(
      expect.objectContaining({
        recipient: '998877665544332211',
      }),
    );
  });

  it('accepts /id commands with a bot mention when auto-binding admin group', async () => {
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
        chatId: 'group-with-mention-123',
        senderId: 'sender-456',
        text: '/id@HomeLandBot',
        chatType: 'group',
        eventName: 'message',
        updateId: 'update-3',
        displayName: 'Admin Group',
        raw: {},
      },
      {},
    );

    expect(result).toEqual({
      route: 'command',
      action: 'admin_group_auto_connected',
      chatId: 'group-with-mention-123',
    });
    expect((prisma as any).appSetting.update).toHaveBeenCalledWith({
      where: { id: 'setting-1' },
      data: {
        value: expect.objectContaining({
          adminGroupChatId: 'group-with-mention-123',
        }),
      },
    });
    expect(zaloProvider.send).toHaveBeenCalledWith(
      expect.objectContaining({
        recipient: 'group-with-mention-123',
      }),
    );
  });

  it('binds the admin group when receiving /setadmin with a valid setup code', async () => {
    const { service, zaloProvider, prisma } = createService();
    (prisma as any).appSetting = {
      findUnique: vi.fn().mockResolvedValue({
        id: 'setting-1',
        value: {},
        updatedAt: new Date(),
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
        adminSetupCodeExpiresAt: new Date(Date.now() + 600000).toISOString(),
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

  it('binds the admin group when receiving /setadmin with a bot mention and valid setup code', async () => {
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
        text: '/setadmin@HomeLandBot A91F72BC',
        eventName: 'message.text.received',
        displayName: 'Admin',
        raw: {},
      },
      {
        adminSetupCode: 'A91F72BC',
        adminSetupCodeExpiresAt: new Date(Date.now() + 600000).toISOString(),
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
          adminSetupCodePending: null,
        }),
      },
    });
    expect(zaloProvider.send).toHaveBeenCalledWith(
      expect.objectContaining({
        recipient: 'group-123',
        title: 'HomeLand - Admin Bot Connected',
      }),
    );
  });

  it('sends welcome guide on follow event without text', async () => {
    const { service, zaloProvider } = createService();

    const result = await service.handleIncomingMessage(
      'tenant-1',
      {
        updateId: 'u-1',
        chatId: 'user-follow-123',
        chatType: 'private',
        senderId: 'user-follow-123',
        text: null,
        eventName: 'follow',
        displayName: 'Customer',
        raw: {},
      },
      {},
    );

    expect(result).toEqual({
      route: 'customer',
      action: 'welcome_sent',
      chatId: 'user-follow-123',
    });
    expect(zaloProvider.send).toHaveBeenCalledWith(
      expect.objectContaining({
        recipient: 'user-follow-123',
        title: 'HomeLand - Đăng ký nhận thông tin',
        message: expect.stringContaining('DK <Số điện thoại> <Mã phòng>'),
      }),
    );
  });

  it('successfully registers with Vietnamese diacritic command "ĐK 0567867889 phòng 31.06"', async () => {
    const { service, prisma, zaloProvider } = createService();
    prisma.room.findFirst.mockResolvedValueOnce({
      id: 'room-1',
      code: 'P31-06',
      building: { code: 'LK01.31', name: 'Tòa nhà LK01.31' },
      contracts: [
        {
          id: 'contract-1',
          customer: {
            id: 'customer-1',
            fullName: 'Nguyen Van A',
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
        chatId: 'chat-vn-123',
        chatType: 'private',
        senderId: 'sender-vn-456',
        text: 'ĐK 0567867889 phòng 31.06',
        eventName: 'user_send_text',
        displayName: 'Nguyen Van A',
        raw: {},
      },
      { adminGroupChatId: 'admin-group-1' },
    );

    expect(result).toMatchObject({
      ok: true,
      customerId: 'customer-1',
      roomId: 'room-1',
    });
    expect(prisma.customer.update).toHaveBeenCalledWith({
      where: { id: 'customer-1' },
      data: {
        zaloChatId: 'chat-vn-123',
        zaloUserId: 'sender-vn-456',
        zaloPhone: '0567867889',
      },
    });
    expect(zaloProvider.send).toHaveBeenCalledWith(
      expect.objectContaining({
        recipient: 'chat-vn-123',
        title: 'HomeLand - Đăng ký thành công',
      }),
    );
  });

  it('responds with guide message when customer sends "Đăng ký nhận thông tin" or greeting', async () => {
    const { service, zaloProvider } = createService();

    const result = await service.handleIncomingMessage(
      'tenant-1',
      {
        updateId: 'u-1',
        chatId: 'chat-help-123',
        chatType: 'private',
        senderId: 'sender-help-456',
        text: 'Đăng ký nhận thông tin',
        eventName: 'user_send_text',
        displayName: 'Guest',
        raw: {},
      },
      {},
    );

    expect(result).toEqual({
      route: 'customer',
      action: 'guide_sent',
      chatId: 'chat-help-123',
    });
    expect(zaloProvider.send).toHaveBeenCalledWith(
      expect.objectContaining({
        recipient: 'chat-help-123',
        title: 'HomeLand - Hướng dẫn đăng ký Zalo Bot',
        message: expect.stringContaining('DK <Số điện thoại> <Mã phòng>'),
      }),
    );
  });
});
