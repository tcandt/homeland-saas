import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { CommunicationController } from './communication.controller';

describe('CommunicationController Zalo webhook', () => {
  function createController() {
    const prisma = {
      appSetting: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
    };
    const zaloProvider = {
      send: vi.fn().mockResolvedValue({ success: true }),
      getMe: vi.fn(),
      setWebhook: vi.fn(),
      getWebhookInfo: vi.fn(),
      deleteWebhook: vi.fn(),
      getUpdates: vi.fn(),
    };
    const emailProvider = { send: vi.fn().mockResolvedValue({ success: true }) };
    const telegramProvider = { send: vi.fn().mockResolvedValue({ success: true }) };
    const zaloRegistrationService = { handleIncomingMessage: vi.fn().mockResolvedValue({ route: 'ignored' }) };
    const controller = new CommunicationController(
      {} as any,
      prisma as any,
      {} as any,
      zaloProvider as any,
      emailProvider as any,
      telegramProvider as any,
      zaloRegistrationService as any,
    );
    return { controller, prisma, zaloProvider, emailProvider, telegramProvider, zaloRegistrationService };
  }

  it('rejects webhook calls with an invalid secret token', async () => {
    const { controller, prisma } = createController();
    prisma.appSetting.findMany.mockResolvedValueOnce([
      { id: 'setting-1', tenantId: 'tenant-1', value: { webhookSecret: 'expected-secret' } },
    ]);

    await expect(controller.handleZaloWebhook({ rawBody: '' }, {}, 'wrong-secret')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.appSetting.update).toHaveBeenCalledWith({
      where: { id: 'setting-1' },
      data: {
        value: expect.objectContaining({
          lastWebhookRejectedReason: 'SECRET_INVALID_OR_MISSING',
          lastWebhookPreview: expect.objectContaining({
            secretProvided: true,
            rawBodyLength: 0,
          }),
        }),
      },
    });
  });

  it('captures recent chat ids from valid Zalo webhooks without storing raw payload', async () => {
    const { controller, prisma, zaloRegistrationService } = createController();
    prisma.appSetting.findMany.mockResolvedValueOnce([
      {
        id: 'setting-1',
        tenantId: 'tenant-1',
        value: {
          enabled: true,
          webhookSecret: 'expected-secret',
          recentWebhookChats: [{ chatId: 'old-chat', eventName: 'old' }],
        },
      },
    ]);

    const result = await controller.handleZaloWebhook({ rawBody: '{"event_name":"message_received"}' }, {
      event_name: 'message_received',
      message: {
        chat: { id: 'tenant-chat-123' },
        from: { id: 'user-456', name: 'Tenant A' },
        text: 'should not be stored',
      },
    }, 'expected-secret');

    expect(result).toEqual({ success: true, capturedChat: true });
    expect(prisma.appSetting.update).toHaveBeenCalledWith({
      where: { id: 'setting-1' },
      data: {
        value: expect.objectContaining({
          defaultChatId: 'tenant-chat-123',
          lastWebhookEventName: 'message_received',
          lastWebhookChatId: 'tenant-chat-123',
          lastWebhookSenderId: 'user-456',
          lastWebhookRejectedReason: null,
          lastWebhookPreview: expect.objectContaining({
            eventName: 'message_received',
            chatId: 'tenant-chat-123',
            senderId: 'user-456',
            hasText: true,
          }),
          recentWebhookChats: expect.arrayContaining([
            expect.objectContaining({
              chatId: 'tenant-chat-123',
              chatType: 'unknown',
              userId: 'user-456',
              displayName: 'Tenant A',
              eventName: 'message_received',
            }),
          ]),
        }),
      },
    });
    expect(JSON.stringify(prisma.appSetting.update.mock.calls[0][0].data.value)).not.toContain('should not be stored');
    expect(zaloRegistrationService.handleIncomingMessage).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({
        chatId: 'tenant-chat-123',
        senderId: 'user-456',
        text: 'should not be stored',
        displayName: 'Tenant A',
        eventName: 'message_received',
      }),
      expect.objectContaining({
        enabled: true,
        webhookSecret: 'expected-secret',
        lastWebhookChatId: 'tenant-chat-123',
      }),
    );
  });

  it('stores webhook diagnostics even when no chat id can be extracted', async () => {
    const { controller, prisma, zaloRegistrationService } = createController();
    prisma.appSetting.findMany.mockResolvedValueOnce([
      {
        id: 'setting-1',
        tenantId: 'tenant-1',
        value: {
          enabled: true,
          webhookSecret: 'expected-secret',
        },
      },
    ]);

    const result = await controller.handleZaloWebhook({ rawBody: '{"event_name":"follow"}' }, {
      event_name: 'follow',
      app_id: 'bot-app-1',
      sender: { name: 'Tenant A' },
    }, 'expected-secret');

    expect(result).toEqual({ success: true, capturedChat: false });
    expect(prisma.appSetting.update).toHaveBeenCalledWith({
      where: { id: 'setting-1' },
      data: {
        value: expect.objectContaining({
          lastWebhookEventName: 'follow',
          lastWebhookChatId: null,
          lastWebhookRejectedReason: 'CHAT_ID_NOT_FOUND',
          lastWebhookPreview: expect.objectContaining({
            payloadKeys: expect.arrayContaining(['event_name', 'app_id', 'sender']),
          }),
        }),
      },
    });
    expect(zaloRegistrationService.handleIncomingMessage).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({
        eventName: 'follow',
        chatId: null,
      }),
      expect.objectContaining({
        lastWebhookRejectedReason: 'CHAT_ID_NOT_FOUND',
      }),
    );
  });

  it('captures group chat type from chat.chat_type payloads', async () => {
    const { controller, prisma } = createController();
    prisma.appSetting.findMany.mockResolvedValueOnce([
      {
        id: 'setting-1',
        tenantId: 'tenant-1',
        value: {
          enabled: true,
          webhookSecret: 'expected-secret',
        },
      },
    ]);

    const result = await controller.handleZaloWebhook({ rawBody: '{"event_name":"message.text.received"}' }, {
      event_name: 'message.text.received',
      message: {
        chat: { id: 'zalo-admin-group-123', chat_type: 'GROUP' },
        from: { id: 'user-456', display_name: 'Admin Group Member' },
        text: 'hello bot',
      },
    }, 'expected-secret');

    expect(result).toEqual({ success: true, capturedChat: true });
    expect(prisma.appSetting.update).toHaveBeenCalledWith({
      where: { id: 'setting-1' },
      data: {
        value: expect.objectContaining({
          lastWebhookChatId: 'zalo-admin-group-123',
          lastWebhookChatType: 'group',
          recentWebhookChats: expect.arrayContaining([
            expect.objectContaining({
              chatId: 'zalo-admin-group-123',
              chatType: 'group',
              displayName: 'Admin Group Member',
            }),
          ]),
        }),
      },
    });
  });

  it('captures chat ids from nested data payloads returned by Zalo polling or webhook variants', async () => {
    const { controller, prisma } = createController();
    prisma.appSetting.findMany.mockResolvedValueOnce([
      {
        id: 'setting-1',
        tenantId: 'tenant-1',
        value: {
          enabled: true,
          webhookSecret: 'expected-secret',
        },
      },
    ]);

    const result = await controller.handleZaloWebhook({ rawBody: '{"event_name":"message"}' }, {
      event_name: 'message',
      data: {
        message: {
          conversation_id: 'zalo-group-data-123',
          chat: { chat_type: 'GROUP' },
          from: { id: 'user-data-1', display_name: 'Admin Data' },
          text: '/id',
        },
      },
    }, 'expected-secret');

    expect(result).toEqual({ success: true, capturedChat: true });
    expect(prisma.appSetting.update).toHaveBeenCalledWith({
      where: { id: 'setting-1' },
      data: {
        value: expect.objectContaining({
          lastWebhookChatId: 'zalo-group-data-123',
          lastWebhookChatType: 'group',
          lastWebhookSenderId: 'user-data-1',
          recentWebhookChats: expect.arrayContaining([
            expect.objectContaining({
              chatId: 'zalo-group-data-123',
              chatType: 'group',
              displayName: 'Admin Data',
            }),
          ]),
        }),
      },
    });
  });

  it('captures real Zalo wrapped webhook payloads and extracts the group chat id', async () => {
    const { controller, prisma, zaloRegistrationService } = createController();
    prisma.appSetting.findMany.mockResolvedValueOnce([
      {
        id: 'setting-1',
        tenantId: 'tenant-1',
        value: {
          enabled: true,
          webhookSecret: 'expected-secret',
          recentWebhookChats: [{ chatId: 'group-test-001', chatType: 'group', source: 'legacy' }],
        },
      },
    ]);

    const result = await controller.handleZaloWebhook({ rawBody: '{"ok":true}' }, {
      ok: true,
      result: {
        event_name: 'message',
        message: {
          chat: { id: 'zalo-live-group-999', chat_type: 'GROUP' },
          from: { id: 'user-789', display_name: 'Admin Zalo' },
          text: '/setadmin A1B2C3D4',
        },
      },
    }, 'expected-secret');

    expect(result).toEqual({ success: true, capturedChat: true });
    expect(prisma.appSetting.update).toHaveBeenCalledWith({
      where: { id: 'setting-1' },
      data: {
        value: expect.objectContaining({
          lastWebhookEventName: 'message',
          lastWebhookChatId: 'zalo-live-group-999',
          lastWebhookChatType: 'group',
          lastWebhookSenderId: 'user-789',
          lastWebhookRejectedReason: null,
          lastWebhookPreview: expect.objectContaining({
            payloadWrapped: true,
            chatId: 'zalo-live-group-999',
            senderId: 'user-789',
          }),
          recentWebhookChats: expect.arrayContaining([
            expect.objectContaining({
              chatId: 'zalo-live-group-999',
              chatType: 'group',
              source: 'zalo',
            }),
          ]),
        }),
      },
    });
    expect(zaloRegistrationService.handleIncomingMessage).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({
        chatId: 'zalo-live-group-999',
        senderId: 'user-789',
        eventName: 'message',
      }),
      expect.any(Object),
    );
  });

  it('ignores synthetic placeholder chat ids so they cannot pollute admin-group detection', async () => {
    const { controller, prisma, zaloRegistrationService } = createController();
    prisma.appSetting.findMany.mockResolvedValueOnce([
      {
        id: 'setting-1',
        tenantId: 'tenant-1',
        value: {
          enabled: true,
          webhookSecret: 'expected-secret',
          recentWebhookChats: [],
        },
      },
    ]);

    const result = await controller.handleZaloWebhook({ rawBody: '{"ok":true}' }, {
      ok: true,
      result: {
        event_name: 'message',
        message: {
          chat: { id: 'real-zalo-group-999', chat_type: 'GROUP' },
          from: { id: 'user-789', display_name: 'Admin Zalo' },
          text: '/id',
        },
      },
    }, 'expected-secret');

    expect(result).toEqual({ success: true, capturedChat: false });
    expect(prisma.appSetting.update).toHaveBeenCalledWith({
      where: { id: 'setting-1' },
      data: {
        value: expect.objectContaining({
          lastWebhookChatId: null,
          lastWebhookChatType: null,
          lastWebhookSenderId: null,
          lastWebhookRejectedReason: 'SYNTHETIC_CHAT_ID_IGNORED',
          recentWebhookChats: [],
        }),
      },
    });
    expect(zaloRegistrationService.handleIncomingMessage).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({
        chatId: 'real-zalo-group-999',
      }),
      expect.objectContaining({
        lastWebhookChatId: null,
        lastWebhookRejectedReason: 'SYNTHETIC_CHAT_ID_IGNORED',
      }),
    );
  });

  it('rejects webhook connect when zalo settings have not been saved yet', async () => {
    const { controller, prisma } = createController();
    prisma.appSetting.findUnique.mockResolvedValueOnce(null);

    await expect(
      controller.connectZaloWebhook({ user: { tenantId: 'tenant-1' } }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('auto-detects admin group chat id from the latest group webhook chat', async () => {
    const { controller, prisma } = createController();
    prisma.appSetting.findUnique.mockResolvedValueOnce({
      id: 'setting-1',
      value: {
        recentWebhookChats: [
          { chatId: 'zalo-group-alpha-1', chatType: 'group', displayName: 'Group A' },
          { chatId: 'zalo-private-alpha-1', chatType: 'private', displayName: 'Tenant A' },
        ],
      },
    });

    const result = await controller.autoDetectAdminGroup({ user: { tenantId: 'tenant-1' } });

    expect(result).toEqual({
      success: true,
      chat: { chatId: 'zalo-group-alpha-1', chatType: 'group', displayName: 'Group A' },
    });
    expect(prisma.appSetting.update).toHaveBeenCalledWith({
      where: { id: 'setting-1' },
      data: {
        value: {
          recentWebhookChats: [
            { chatId: 'zalo-group-alpha-1', chatType: 'group', displayName: 'Group A' },
            { chatId: 'zalo-private-alpha-1', chatType: 'private', displayName: 'Tenant A' },
          ],
          adminGroupChatId: 'zalo-group-alpha-1',
        },
      },
    });
  });

  it('prefers a real Zalo webhook group over legacy test payloads when auto-detecting admin group chat id', async () => {
    const { controller, prisma } = createController();
    prisma.appSetting.findUnique.mockResolvedValueOnce({
      id: 'setting-1',
      value: {
        recentWebhookChats: [
          { chatId: 'group-test-001', chatType: 'group', displayName: 'Curl Test', source: 'legacy' },
          { chatId: 'zalo-live-group-999', chatType: 'group', displayName: 'Admin Group', source: 'zalo' },
        ],
      },
    });

    const result = await controller.autoDetectAdminGroup({ user: { tenantId: 'tenant-1' } });

    expect(result).toEqual({
      success: true,
      chat: { chatId: 'zalo-live-group-999', chatType: 'group', displayName: 'Admin Group', source: 'zalo' },
    });
    expect(prisma.appSetting.update).toHaveBeenCalledWith({
      where: { id: 'setting-1' },
      data: {
        value: expect.objectContaining({
          adminGroupChatId: 'zalo-live-group-999',
        }),
      },
    });
  });

  it('falls back to polling updates when webhook history is empty and restores the webhook afterwards', async () => {
    const { controller, prisma, zaloProvider } = createController();
    prisma.appSetting.findUnique.mockResolvedValueOnce({
      id: 'setting-1',
      value: {
        botToken: 'bot-token-1',
        webhookSecret: 'expected-secret',
        baseUrl: 'https://homeland.ductinh.one',
        recentWebhookChats: [],
      },
    });
    zaloProvider.getWebhookInfo.mockResolvedValueOnce({
      ok: true,
      result: { url: 'https://homeland.ductinh.one/api/v1/notifications/zalo/webhook' },
    });
    zaloProvider.deleteWebhook.mockResolvedValueOnce({ ok: true });
    zaloProvider.getUpdates.mockResolvedValueOnce({
      ok: true,
      result: [
        {
          ok: true,
          result: {
            event_name: 'message',
            message: {
              chat: { id: 'zalo-polled-group-123', chat_type: 'GROUP' },
              from: { id: 'user-polled-1', display_name: 'Admin Group' },
              text: '/id',
            },
          },
        },
      ],
    });
    zaloProvider.setWebhook.mockResolvedValueOnce({ ok: true });

    const result = await controller.autoDetectAdminGroup({ user: { tenantId: 'tenant-1' } });

    expect(result).toEqual({
      success: true,
        chat: expect.objectContaining({
        chatId: 'zalo-polled-group-123',
        chatType: 'group',
      }),
    });
    expect(zaloProvider.deleteWebhook).toHaveBeenCalledOnce();
    expect(zaloProvider.getUpdates).toHaveBeenCalledWith('tenant-1', { limit: 20, timeout: 8 });
    expect(zaloProvider.setWebhook).toHaveBeenCalledWith('tenant-1', {
      url: 'https://homeland.ductinh.one/api/v1/notifications/zalo/webhook',
      secretToken: 'expected-secret',
    });
    expect(prisma.appSetting.update).toHaveBeenCalledWith({
      where: { id: 'setting-1' },
      data: {
        value: expect.objectContaining({
          adminGroupChatId: 'zalo-polled-group-123',
          recentWebhookChats: expect.arrayContaining([
            expect.objectContaining({
              chatId: 'zalo-polled-group-123',
              source: 'zalo',
            }),
          ]),
        }),
      },
    });
  });

  it('returns a structured bad request instead of a 500 when Zalo polling fails', async () => {
    const { controller, prisma, zaloProvider } = createController();
    prisma.appSetting.findUnique.mockResolvedValueOnce({
      id: 'setting-1',
      value: {
        enabled: true,
        botToken: 'bot-token-1',
        webhookSecret: 'expected-secret',
        baseUrl: 'https://homeland.ductinh.one',
        recentWebhookChats: [],
      },
    });
    zaloProvider.getWebhookInfo.mockResolvedValueOnce({
      ok: true,
      result: { url: 'https://homeland.ductinh.one/api/v1/notifications/zalo/webhook' },
    });
    zaloProvider.deleteWebhook.mockResolvedValueOnce({ ok: true });
    zaloProvider.getUpdates.mockRejectedValueOnce(new Error('Zalo getUpdates returned empty body'));
    zaloProvider.setWebhook.mockResolvedValueOnce({ ok: true });

    await expect(controller.autoDetectAdminGroup({ user: { tenantId: 'tenant-1' } })).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'ZALO_NO_WEBHOOK_CHAT_AVAILABLE',
        message: 'ZALO_NO_WEBHOOK_CHAT_AVAILABLE',
        details: expect.objectContaining({
          pollingAttempted: true,
          pollingError: 'Zalo getUpdates returned empty body',
          pollingAttempts: 1,
        }),
      }),
    });

    expect(zaloProvider.setWebhook).toHaveBeenCalledWith('tenant-1', {
      url: 'https://homeland.ductinh.one/api/v1/notifications/zalo/webhook',
      secretToken: 'expected-secret',
    });
  });

  it('generates an admin group setup code', async () => {
    const { controller, prisma } = createController();
    prisma.appSetting.findUnique.mockResolvedValueOnce({
      id: 'setting-1',
      value: {},
    });

    const result = await controller.generateZaloAdminGroupSetupCode({ user: { tenantId: 'tenant-1' } });

    expect(result.success).toBe(true);
    expect(result.code).toMatch(/^[A-F0-9]{8}$/);
    expect(result.command).toBe(`/setadmin ${result.code}`);
    expect(prisma.appSetting.update).toHaveBeenCalledWith({
      where: { id: 'setting-1' },
      data: {
        value: expect.objectContaining({
          adminSetupCode: result.code,
          adminSetupCodeExpiresAt: expect.any(String),
        }),
      },
    });
  });

  it('clears the configured admin group binding', async () => {
    const { controller, prisma } = createController();
    prisma.appSetting.findUnique.mockResolvedValueOnce({
      id: 'setting-1',
      value: {
        adminGroupChatId: 'group-123',
        adminGroupConnectedAt: '2026-08-24T09:19:40.280Z',
        adminSetupCode: 'A91F72BC',
        adminSetupCodeExpiresAt: '2026-08-24T17:00:00.000Z',
      },
    });

    const result = await controller.clearZaloAdminGroup({ user: { tenantId: 'tenant-1' } });

    expect(result).toEqual({ success: true });
    expect(prisma.appSetting.update).toHaveBeenCalledWith({
      where: { id: 'setting-1' },
      data: {
        value: expect.objectContaining({
          adminGroupChatId: null,
          adminGroupConnectedAt: null,
          adminSetupCode: null,
          adminSetupCodeExpiresAt: null,
        }),
      },
    });
  });

  it('falls back to last webhook diagnostics when recent chat history is empty', async () => {
    const { controller, prisma } = createController();
    prisma.appSetting.findUnique.mockResolvedValueOnce({
      id: 'setting-1',
      value: {
        lastWebhookChatId: 'zalo-from-diagnostics',
        lastWebhookChatType: 'group',
        lastWebhookSenderId: 'sender-1',
        lastWebhookEventName: 'message_received',
        lastWebhookReceivedAt: '2026-08-24T09:19:40.280Z',
      },
    });

    const result = await controller.autoDetectAdminGroup({ user: { tenantId: 'tenant-1' } });

    expect(result).toEqual({
      success: true,
      chat: expect.objectContaining({
        chatId: 'zalo-from-diagnostics',
        chatType: 'group',
        userId: 'sender-1',
        eventName: 'message_received',
      }),
    });
    expect(prisma.appSetting.update).toHaveBeenCalledWith({
      where: { id: 'setting-1' },
      data: {
        value: expect.objectContaining({
          adminGroupChatId: 'zalo-from-diagnostics',
        }),
      },
    });
  });

  it('sends email provider tests to an explicit recipient', async () => {
    const { controller, emailProvider } = createController();

    const result = await controller.sendEmailTest(
      { user: { tenantId: 'tenant-1' } },
      { recipient: 'ops@example.test', title: 'Email test', message: 'Hello' },
    );

    expect(result.success).toBe(true);
    expect(emailProvider.send).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      recipient: 'ops@example.test',
      title: 'Email test',
      message: 'Hello',
      context: {},
    });
  });

  it('sends telegram provider tests using the default chat when recipient is omitted', async () => {
    const { controller, telegramProvider } = createController();

    const result = await controller.sendTelegramTest(
      { user: { tenantId: 'tenant-1' } },
      { title: 'Telegram test', message: 'Hello' },
    );

    expect(result.success).toBe(true);
    expect(result.recipient).toBe(null);
    expect(telegramProvider.send).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      recipient: null,
      title: 'Telegram test',
      message: 'Hello',
      context: {},
    });
  });
});
