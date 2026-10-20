import { BadRequestException, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CommunicationController } from './communication.controller';
import { PERMISSIONS_KEY } from '../shared/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../shared/guards/permissions.guard';

describe('CommunicationController Zalo webhook', () => {
  beforeEach(() => vi.stubEnv('COMMUNICATION_EXTERNAL_DELIVERY_ENABLED', 'true'));
  afterEach(() => vi.unstubAllEnvs());

  it('fails closed before staging provider actions read settings or persist cached chats', async () => {
    vi.stubEnv('DEPLOY_ENV', 'staging');
    const { controller, prisma } = createController();
    const req = { user: { tenantId: 'tenant-1' } };
    await expect(controller.testZaloAdminGroup(req, {})).rejects.toMatchObject({
      status: 503,
      response: expect.objectContaining({ code: 'EXTERNAL_PROVIDER_DISABLED_IN_STAGING' }),
    });
    await expect(controller.connectZaloWebhook(req)).rejects.toMatchObject({ status: 503 });
    await expect(controller.autoDetectAdminGroup(req)).rejects.toMatchObject({ status: 503 });
    await expect(controller.sendZaloTest(req, {})).rejects.toMatchObject({ status: 503 });
    expect(prisma.appSetting.findUnique).not.toHaveBeenCalled();
    expect(prisma.appSetting.update).not.toHaveBeenCalled();
  });

  it('protects integration status, provider tests, and Zalo management with setting permissions', () => {
    const expected: Record<string, string[]> = {
      getZaloStatus: ['setting.read'],
      testZaloEndpoint: ['setting.read'],
      testZaloBot: ['setting.update'],
      generateZaloAdminGroupSetupCode: ['setting.update'],
      testZaloAdminGroup: ['setting.update'],
      clearZaloAdminGroup: ['setting.update'],
      autoDetectAdminGroup: ['setting.update'],
      connectZaloWebhook: ['setting.update'],
      sendZaloTest: ['setting.update'],
      sendEmailTest: ['setting.update'],
      sendTelegramTest: ['setting.update'],
    };

    for (const [method, permissions] of Object.entries(expected)) {
      expect(Reflect.getMetadata(PERMISSIONS_KEY, (CommunicationController.prototype as any)[method])).toEqual(permissions);
    }
  });

  it('allows only matching settings permissions or ADMIN on integration management handlers', () => {
    const guard = new PermissionsGuard(new Reflector());
    const handlers: Array<[string, string]> = [
      ['getZaloStatus', 'setting.read'],
      ['testZaloEndpoint', 'setting.read'],
      ['testZaloBot', 'setting.update'],
      ['generateZaloAdminGroupSetupCode', 'setting.update'],
      ['testZaloAdminGroup', 'setting.update'],
      ['clearZaloAdminGroup', 'setting.update'],
      ['autoDetectAdminGroup', 'setting.update'],
      ['connectZaloWebhook', 'setting.update'],
      ['sendZaloTest', 'setting.update'],
      ['sendEmailTest', 'setting.update'],
      ['sendTelegramTest', 'setting.update'],
    ];
    const contextFor = (handler: (...args: never[]) => unknown, user?: Record<string, unknown>) => ({
      getHandler: () => handler,
      getClass: () => CommunicationController,
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    }) as unknown as ExecutionContext;

    for (const [method, permission] of handlers) {
      const handler = (CommunicationController.prototype as any)[method];
      expect(() => guard.canActivate(contextFor(handler))).toThrow(ForbiddenException);
      expect(guard.canActivate(contextFor(handler, { roles: ['ADMIN'], permissions: [] }))).toBe(true);
      expect(guard.canActivate(contextFor(handler, { roles: [], permissions: [permission] }))).toBe(true);
      expect(() => guard.canActivate(contextFor(handler, { roles: [], permissions: ['setting.other'] }))).toThrow(ForbiddenException);
    }
  });

  function createController() {
    const prisma = {
      $transaction: vi.fn(),
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

  it('allows the protected Homeland administrator to edit Zalo integration secrets', async () => {
    const { controller, prisma } = createController();
    prisma.appSetting.findUnique.mockResolvedValueOnce(null);

    const result = await controller.getZaloStatus({
      user: { tenantId: 'tenant-1', email: ' Admin@HomeLand.vn ' },
    });

    expect(result.capabilities.canEditIntegrationSecrets).toBe(true);
    expect(result.status.botTokenConfigured).toBe(false);
  });

  it('keeps Zalo integration secrets locked for other accounts', async () => {
    const { controller, prisma } = createController();
    prisma.appSetting.findUnique.mockResolvedValueOnce(null);

    const result = await controller.getZaloStatus({
      user: { tenantId: 'tenant-1', email: 'manager@homeland.vn' },
    });

    expect(result.capabilities.canEditIntegrationSecrets).toBe(false);
  });

  it('rejects webhook calls with an invalid secret token', async () => {
    const { controller, prisma } = createController();
    prisma.appSetting.findMany.mockResolvedValueOnce([
      { id: 'setting-1', tenantId: 'tenant-1', value: { webhookSecret: 'expected-secret' } },
    ]);

    await expect(controller.handleZaloWebhook({ rawBody: '' }, {}, 'wrong-secret')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.appSetting.update).not.toHaveBeenCalled();
  });

  it.each(['', 'x'.repeat(64), '\u00e9'.repeat(64)])('rejects missing, long or multibyte wrong secrets without changing settings (%#)', async (provided) => {
    const { controller, prisma, zaloRegistrationService } = createController();
    prisma.appSetting.findMany.mockResolvedValueOnce([
      { id: 'setting-1', tenantId: 'tenant-1', value: { webhookSecret: 'a'.repeat(64) } },
    ]);
    await expect(controller.handleZaloWebhook({ rawBody: '' }, { message: { chat: { id: 'untrusted-chat' } } }, provided)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.appSetting.update).not.toHaveBeenCalled();
    expect(zaloRegistrationService.handleIncomingMessage).not.toHaveBeenCalled();
  });

  it('rejects ambiguous cross-tenant webhook secrets without writing either tenant', async () => {
    const { controller, prisma, zaloRegistrationService } = createController();
    prisma.appSetting.findMany.mockResolvedValueOnce([
      { id: 'setting-1', tenantId: 'tenant-1', value: { webhookSecret: 'shared-secret' } },
      { id: 'setting-2', tenantId: 'tenant-2', value: { webhookSecret: 'shared-secret' } },
    ]);
    await expect(controller.handleZaloWebhook({ rawBody: '' }, {}, 'shared-secret')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.appSetting.update).not.toHaveBeenCalled();
    expect(zaloRegistrationService.handleIncomingMessage).not.toHaveBeenCalled();
  });

  it('routes a unique webhook secret exclusively to its owning tenant', async () => {
    const { controller, prisma, zaloRegistrationService } = createController();
    prisma.appSetting.findMany.mockResolvedValueOnce([
      { id: 'setting-1', tenantId: 'tenant-1', value: { webhookSecret: 'tenant-one-secret' } },
      { id: 'setting-2', tenantId: 'tenant-2', value: { webhookSecret: 'tenant-two-secret' } },
    ]);
    await expect(controller.handleZaloWebhook({ rawBody: '' }, { event_name: 'follow' }, 'tenant-two-secret')).resolves.toMatchObject({ success: true });
    expect(prisma.appSetting.update).toHaveBeenCalledOnce();
    expect(prisma.appSetting.update).toHaveBeenCalledWith({ where: { id: 'setting-2' }, data: { value: expect.objectContaining({ webhookSecret: 'tenant-two-secret' }) } });
    expect(zaloRegistrationService.handleIncomingMessage).toHaveBeenCalledOnce();
    expect(zaloRegistrationService.handleIncomingMessage).toHaveBeenCalledWith('tenant-2', expect.any(Object), expect.objectContaining({ webhookSecret: 'tenant-two-secret' }));
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

  it('captures chat ids from conversation.id payloads returned by Zalo variants', async () => {
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
      message: {
        conversation: { id: 'zalo-conversation-321', type: 'GROUP' },
        from: { id: 'user-conv-1', display_name: 'Admin Conv' },
        text: '/id',
      },
    }, 'expected-secret');

    expect(result).toEqual({ success: true, capturedChat: true });
    expect(prisma.appSetting.update).toHaveBeenCalledWith({
      where: { id: 'setting-1' },
      data: {
        value: expect.objectContaining({
          lastWebhookChatId: 'zalo-conversation-321',
          lastWebhookChatType: 'group',
          lastWebhookSenderId: 'user-conv-1',
          recentWebhookChats: expect.arrayContaining([
            expect.objectContaining({
              chatId: 'zalo-conversation-321',
              chatType: 'group',
              displayName: 'Admin Conv',
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

  it('forwards the current tenant base URL when connecting the Zalo webhook', async () => {
    const { controller, prisma, zaloProvider } = createController();
    prisma.appSetting.findUnique.mockResolvedValueOnce({
      id: 'setting-1',
      value: {
        baseUrl: ' https://live.example/ ',
        webhookBaseUrl: 'https://stale.example',
        webhookSecret: 'expected-secret',
      },
    });

    const result = await controller.connectZaloWebhook({ user: { tenantId: 'tenant-1' } });

    expect(result.webhookUrl).toBe('https://live.example/api/v1/notifications/zalo/webhook');
    expect(zaloProvider.setWebhook).toHaveBeenCalledWith('tenant-1', {
      url: 'https://live.example/api/v1/notifications/zalo/webhook',
      secretToken: 'expected-secret',
    });
    expect(prisma.appSetting.update).toHaveBeenCalledWith({
      where: { id: 'setting-1' },
      data: {
        value: expect.objectContaining({
          baseUrl: ' https://live.example/ ',
          webhookBaseUrl: 'https://stale.example',
          webhookSecret: 'expected-secret',
          webhookUrl: 'https://live.example/api/v1/notifications/zalo/webhook',
          lastWebhookStatus: 'CONNECTED',
        }),
      },
    });
  });

  it('does not persist a connected status when the Zalo webhook call fails', async () => {
    const { controller, prisma, zaloProvider } = createController();
    prisma.appSetting.findUnique.mockResolvedValueOnce({
      id: 'setting-1',
      value: {
        baseUrl: 'https://live.example',
        webhookSecret: 'expected-secret',
      },
    });
    zaloProvider.setWebhook.mockRejectedValueOnce(new Error('provider unavailable'));

    await expect(
      controller.connectZaloWebhook({ user: { tenantId: 'tenant-1' } }),
    ).rejects.toThrow('provider unavailable');

    expect(prisma.appSetting.update).not.toHaveBeenCalled();
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
        value: expect.objectContaining({
          recentWebhookChats: [
            { chatId: 'zalo-group-alpha-1', chatType: 'group', displayName: 'Group A' },
            { chatId: 'zalo-private-alpha-1', chatType: 'private', displayName: 'Tenant A' },
          ],
          adminGroupChatId: 'zalo-group-alpha-1',
          adminGroupConnectedAt: expect.any(String),
          adminSetupCode: null,
          adminSetupCodeExpiresAt: null,
          adminSetupCodePending: null,
        }),
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

  it('falls back to the latest webhook preview when history is empty and no stored chat id exists', async () => {
    const { controller, prisma } = createController();
    prisma.appSetting.findUnique.mockResolvedValueOnce({
      id: 'setting-1',
      value: {
        lastWebhookPreview: {
          chatId: 'zalo-preview-group-555',
          chatType: 'group',
          senderId: 'sender-preview-1',
          eventName: 'message',
        },
        lastWebhookReceivedAt: '2026-08-24T09:19:40.280Z',
      },
    });

    const result = await controller.autoDetectAdminGroup({ user: { tenantId: 'tenant-1' } });

    expect(result).toEqual({
      success: true,
      chat: expect.objectContaining({
        chatId: 'zalo-preview-group-555',
        chatType: 'group',
        userId: 'sender-preview-1',
        eventName: 'message',
      }),
    });
    expect(prisma.appSetting.update).toHaveBeenCalledWith({
      where: { id: 'setting-1' },
      data: {
        value: expect.objectContaining({
          adminGroupChatId: 'zalo-preview-group-555',
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

  describe('operational notification deduplication', () => {
    const input = {
      tenantId: 'tenant-1',
      userId: 'user-1',
      type: 'PAYMENT_RECEIVED',
      entityId: 'payment-1',
      title: 'Received',
      message: 'Payment received',
      metadata: { entityId: 'payment-1', amount: 400000 },
    };

    function transactionWith(existing: { id: string } | null = null) {
      const tx = {
        $queryRaw: vi.fn().mockResolvedValue([{ lock: 'ok' }]),
        notification: {
          findFirst: vi.fn().mockResolvedValue(existing),
          create: vi.fn().mockResolvedValue({ id: 'notification-1' }),
        },
      };
      return tx;
    }

    it('rechecks the persisted, tenant-scoped entity identity after taking its lock', async () => {
      const { controller, prisma } = createController();
      const tx = transactionWith({ id: 'older-notification' });
      prisma.$transaction.mockImplementation(async (work: any) => work(tx));
      const existingKeys = new Set<string>();

      await (controller as any).createOperationalNotification(input, existingKeys);

      expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'ReadCommitted' });
      expect(tx.notification.findFirst).toHaveBeenCalledWith({
        where: {
          tenantId: 'tenant-1',
          userId: 'user-1',
          channel: 'IN_APP',
          type: 'PAYMENT_RECEIVED',
          OR: [
            { metadata: { path: ['entityId'], equals: 'payment-1' } },
            { metadata: { path: ['paymentId'], equals: 'payment-1' } },
          ],
        },
        select: { id: true, tenantId: true, userId: true, channel: true, type: true },
      });
      expect(tx.$queryRaw.mock.calls[0][0].values).toEqual([
        JSON.stringify(['tenant-1', 'user-1', 'IN_APP', 'PAYMENT_RECEIVED', 'payment-1']),
      ]);
      expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(tx.notification.findFirst.mock.invocationCallOrder[0]);
      expect(tx.notification.create).not.toHaveBeenCalled();
      expect(existingKeys).toEqual(new Set(['PAYMENT_RECEIVED:payment-1']));
    });

    it('creates once when concurrent snapshots both missed the notification', async () => {
      const { controller, prisma } = createController();
      const persisted = new Set<string>();
      const tx = {
        $queryRaw: vi.fn().mockResolvedValue([{ lock: 'ok' }]),
        notification: {
          findFirst: vi.fn().mockImplementation(async ({ where }: any) =>
            persisted.has(`${where.tenantId}:${where.userId}:${where.type}:${where.OR[0].metadata.equals}`) ? { id: 'notification-1' } : null,
          ),
          create: vi.fn().mockImplementation(async ({ data }: any) => {
            persisted.add(`${data.tenantId}:${data.userId}:${data.type}:${data.metadata.entityId}`);
            return { id: 'notification-1' };
          }),
        },
      };
      let lockQueue = Promise.resolve();
      prisma.$transaction.mockImplementation((work: any) => {
        const result = lockQueue.then(() => work(tx));
        lockQueue = result.then(() => undefined, () => undefined);
        return result;
      });

      await Promise.all([
        (controller as any).createOperationalNotification(input, new Set<string>()),
        (controller as any).createOperationalNotification(input, new Set<string>()),
      ]);

      expect(tx.notification.create).toHaveBeenCalledTimes(1);
      expect(tx.notification.findFirst).toHaveBeenCalledTimes(2);
    });

    it('uses distinct locks for notification scopes that must remain independent', async () => {
      const { controller, prisma } = createController();
      const tx = transactionWith(null);
      prisma.$transaction.mockImplementation(async (work: any) => work(tx));

      await (controller as any).createOperationalNotification(input, new Set<string>());
      await (controller as any).createOperationalNotification({ ...input, userId: 'user-2' }, new Set<string>());
      await (controller as any).createOperationalNotification({ ...input, tenantId: 'tenant-2' }, new Set<string>());

      expect(tx.$queryRaw.mock.calls.map((call: any[]) => call[0].values[0])).toEqual([
        JSON.stringify(['tenant-1', 'user-1', 'IN_APP', 'PAYMENT_RECEIVED', 'payment-1']),
        JSON.stringify(['tenant-1', 'user-2', 'IN_APP', 'PAYMENT_RECEIVED', 'payment-1']),
        JSON.stringify(['tenant-2', 'user-1', 'IN_APP', 'PAYMENT_RECEIVED', 'payment-1']),
      ]);
      expect(tx.notification.create).toHaveBeenCalledTimes(3);
    });

    it('does not add a false in-memory key when the transaction rolls back', async () => {
      const { controller, prisma } = createController();
      prisma.$transaction.mockRejectedValueOnce(new Error('database unavailable'));
      const existingKeys = new Set<string>();

      await expect((controller as any).createOperationalNotification(input, existingKeys)).rejects.toThrow('database unavailable');

      expect(existingKeys.size).toBe(0);
    });
  });
});
