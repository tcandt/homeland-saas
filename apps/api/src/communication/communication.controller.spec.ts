import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { CommunicationController } from './communication.controller';

describe('CommunicationController Zalo webhook', () => {
  function createController() {
    const prisma = {
      appSetting: {
        findMany: vi.fn(),
        update: vi.fn(),
      },
    };
    const zaloProvider = { send: vi.fn().mockResolvedValue({ success: true }) };
    const emailProvider = { send: vi.fn().mockResolvedValue({ success: true }) };
    const telegramProvider = { send: vi.fn().mockResolvedValue({ success: true }) };
    const controller = new CommunicationController(
      {} as any,
      prisma as any,
      {} as any,
      zaloProvider as any,
      emailProvider as any,
      telegramProvider as any,
    );
    return { controller, prisma, zaloProvider, emailProvider, telegramProvider };
  }

  it('rejects webhook calls with an invalid secret token', async () => {
    const { controller, prisma } = createController();
    prisma.appSetting.findMany.mockResolvedValueOnce([
      { id: 'setting-1', tenantId: 'tenant-1', value: { webhookSecret: 'expected-secret' } },
    ]);

    await expect(controller.handleZaloWebhook({}, 'wrong-secret')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.appSetting.update).not.toHaveBeenCalled();
  });

  it('captures recent chat ids from valid Zalo webhooks without storing raw payload', async () => {
    const { controller, prisma } = createController();
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

    const result = await controller.handleZaloWebhook({
      event_name: 'message_received',
      message: {
        chat: { id: 'chat-123' },
        from: { id: 'user-456', name: 'Tenant A' },
        text: 'should not be stored',
      },
    }, 'expected-secret');

    expect(result).toEqual({ success: true, capturedChat: true });
    expect(prisma.appSetting.update).toHaveBeenCalledWith({
      where: { id: 'setting-1' },
      data: {
        value: expect.objectContaining({
          defaultChatId: 'chat-123',
          recentWebhookChats: expect.arrayContaining([
            expect.objectContaining({
              chatId: 'chat-123',
              userId: 'user-456',
              displayName: 'Tenant A',
              eventName: 'message_received',
            }),
          ]),
        }),
      },
    });
    expect(JSON.stringify(prisma.appSetting.update.mock.calls[0][0].data.value)).not.toContain('should not be stored');
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
