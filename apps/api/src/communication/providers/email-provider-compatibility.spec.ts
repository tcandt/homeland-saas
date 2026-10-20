import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import nodemailer from 'nodemailer';
import { EmailProvider } from './communication.providers';

// Exercise the actual mail compiler, but never create an SMTP connection.
const createTransport = nodemailer.createTransport.bind(nodemailer);
beforeEach(() => vi.stubEnv('COMMUNICATION_EXTERNAL_DELIVERY_ENABLED', 'true'));
afterEach(() => vi.unstubAllEnvs());
const settings = {
  enabled: true,
  smtpHost: 'smtp.invalid',
  smtpPort: 587,
  smtpSecure: false,
  smtpUser: 'sender@example.invalid',
  smtpPassword: 'synthetic-test-only',
  fromName: 'HomeLand test',
  fromEmail: 'sender@example.invalid',
};

function harness(value: Record<string, unknown> = settings) {
  const compiled: Record<string, unknown>[] = [];
  const createMock = vi.spyOn(nodemailer, 'createTransport').mockImplementation(() => {
    const transport = createTransport({ jsonTransport: true });
    const sendMail = transport.sendMail.bind(transport);
    vi.spyOn(transport, 'sendMail').mockImplementation(async (message: any) => {
      const info = await sendMail(message);
      compiled.push(JSON.parse(String((info as any).message)));
      return info;
    });
    return transport;
  });
  const findUnique = vi.fn().mockResolvedValue({ value });
  const provider = new EmailProvider({ appSetting: { findUnique } } as any);
  return { provider, compiled, createMock, findUnique };
}

const payload = {
  tenantId: 'synthetic-tenant',
  recipient: 'recipient@example.invalid',
  title: 'Compatibility test',
  message: '<script>not executable</script>\nSecond line & text',
};

afterEach(() => vi.restoreAllMocks());

describe('EmailProvider Nodemailer compatibility without network', () => {
  it('uses the unchanged SMTP options and compiles escaped HTML with the real library', async () => {
    const { provider, compiled, createMock, findUnique } = harness();
    await expect(provider.send(payload)).resolves.toMatchObject({
      success: true, providerMessageId: expect.any(String),
    });
    expect(createMock).toHaveBeenCalledWith(expect.objectContaining({
      host: settings.smtpHost, port: 587, secure: false, pool: true,
      auth: { user: settings.smtpUser, pass: settings.smtpPassword },
    }));
    expect(findUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: { tenantId_scope_ownerId_key: {
        tenantId: payload.tenantId, scope: 'TENANT',
        ownerId: payload.tenantId, key: 'email-provider',
      } },
    }));
    expect(compiled[0]).toMatchObject({
      subject: payload.title, text: payload.message,
      html: '&lt;script&gt;not executable&lt;/script&gt;<br />Second line &amp; text',
      to: [{ address: payload.recipient, name: '' }],
    });
  });

  it('reuses only the same tenant transport and renews it after credential changes', async () => {
    const { provider, createMock, findUnique } = harness();
    await provider.send(payload);
    await provider.send(payload);
    expect(createMock).toHaveBeenCalledTimes(1);
    await provider.send({ ...payload, tenantId: 'other-synthetic-tenant' });
    expect(createMock).toHaveBeenCalledTimes(2);
    findUnique.mockResolvedValue({ value: { ...settings, smtpPassword: 'changed-test-only' } });
    await provider.send(payload);
    expect(createMock).toHaveBeenCalledTimes(3);
  });

  it('supports plain-text-only mail and never opens a disabled provider transport', async () => {
    const { provider, compiled, createMock, findUnique } = harness({ ...settings, sendHtml: false });
    await provider.send(payload);
    expect(compiled[0].html).toBeUndefined();
    findUnique.mockResolvedValue({ value: { ...settings, enabled: false } });
    await expect(provider.send({ ...payload, tenantId: 'disabled-tenant' })).rejects.toThrow('disabled');
    expect(createMock).toHaveBeenCalledTimes(1);
  });

  it('does not report success when the transport rejects a message', async () => {
    const { provider, createMock } = harness();
    createMock.mockReturnValue({ sendMail: vi.fn().mockRejectedValue(new Error('mock delivery failure')) } as any);
    await expect(provider.send(payload)).rejects.toThrow('mock delivery failure');
  });
});
