import { afterEach, describe, expect, it, vi } from 'vitest';
import { ZaloProvider } from './communication.providers';

describe('ZaloProvider', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function createProvider(settingValue: Record<string, any>) {
    const prisma = {
      appSetting: {
        findUnique: vi.fn().mockResolvedValue({
          value: settingValue,
        }),
      },
    };
    return {
      prisma,
      provider: new ZaloProvider(prisma as any),
    };
  }

  it('uses the default Zalo Bot API host instead of tenant baseUrl for sendMessage', async () => {
    const { provider } = createProvider({
      enabled: true,
      botToken: 'bot-token-1',
      baseUrl: 'https://authorities-tutorial-leader-have.trycloudflare.com',
    });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, result: { message_id: '1' } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await provider.send({
      tenantId: 'tenant-1',
      recipient: 'group-chat-1',
      title: 'Test',
      message: 'Hello',
      context: {},
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://bot-api.zaloplatforms.com/botbot-token-1/sendMessage',
      expect.any(Object),
    );
  });

  it('uses custom apiBaseUrl when explicitly configured', async () => {
    const { provider } = createProvider({
      enabled: true,
      botToken: 'bot-token-1',
      apiBaseUrl: 'https://custom-zalo-api.example.com',
      baseUrl: 'https://authorities-tutorial-leader-have.trycloudflare.com',
    });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, result: { id: 'bot-1' } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await provider.getMe('tenant-1');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://custom-zalo-api.example.com/botbot-token-1/getMe',
      expect.any(Object),
    );
  });

  it('uses sendPhoto when photo payload is provided', async () => {
    const { provider } = createProvider({
      enabled: true,
      botToken: 'bot-token-1',
    });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, result: { message_id: 'photo-1' } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await provider.sendPhoto({
      tenantId: 'tenant-1',
      recipient: 'group-chat-1',
      photo: 'https://vietqr.app/img?acc=123',
      caption: 'QR test',
      context: {},
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://bot-api.zaloplatforms.com/botbot-token-1/sendPhoto',
      expect.objectContaining({
        method: 'POST',
      }),
    );
  });
});
