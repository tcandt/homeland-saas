import { describe, expect, it, vi } from 'vitest';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';

function activeUser(passwordHash: string) {
  return {
    id: 'user-1',
    tenantId: 'tenant-1',
    email: 'admin@homeland.vn',
    fullName: 'Admin',
    status: 'ACTIVE',
    mustChangePassword: false,
    passwordHash,
    tenant: { id: 'tenant-1' },
    roles: [{ role: { code: 'ADMIN', permissions: [{ permission: { key: 'setting.read' } }] } }],
  };
}

describe('AuthService security settings', () => {
  it('requires and verifies an email OTP before issuing a 2FA-protected login session', async () => {
    const passwordHash = await bcrypt.hash('StrongPassword@123', 4);
    const user = activeUser(passwordHash);
    let securityValue: any = {
      sessionVersion: 2,
      twoFactorEnabled: true,
      twoFactorMethod: 'EMAIL',
      idleTimeoutMinutes: 60,
    };
    const prisma: any = {
      user: {
        findFirst: vi.fn().mockResolvedValue(user),
        findUnique: vi.fn().mockResolvedValue(user),
        update: vi.fn().mockResolvedValue(user),
      },
      appSetting: {
        findUnique: vi.fn(async () => ({ value: securityValue })),
        upsert: vi.fn(async (args: any) => {
          securityValue = args.update.value;
          return { value: securityValue };
        }),
      },
    };
    let challengePayload: any;
    const jwt: any = {
      sign: vi.fn((payload: any) => {
        if (payload.tokenType === '2fa-challenge') {
          challengePayload = payload;
          return 'challenge-token';
        }
        return payload.tokenType === 'access' ? 'access-token' : 'refresh-token';
      }),
      verify: vi.fn(() => challengePayload),
    };
    const config: any = { get: vi.fn((key: string) => key === 'auth.jwtSecret' ? 'test-secret' : '1h') };
    const audit: any = { log: vi.fn() };
    let deliveredCode = '';
    const mail: any = {
      sendTwoFactorCode: vi.fn(async (_email: string, code: string) => {
        deliveredCode = code;
      }),
    };
    const service = new AuthService(prisma, jwt, config, audit, mail);

    const challenge = await service.login({
      emailOrPhone: user.email,
      password: 'StrongPassword@123',
    });

    expect(challenge).toMatchObject({ requiresTwoFactor: true, challengeToken: 'challenge-token', method: 'EMAIL' });
    expect(deliveredCode).toMatch(/^\d{6}$/);
    expect(securityValue.loginChallenge.codeHash).not.toBe(deliveredCode);
    const storedNonceHash = securityValue.loginChallenge.nonceHash;
    const session = await service.verifyTwoFactorLogin({ challengeToken: 'challenge-token', code: deliveredCode });

    expect(session).toMatchObject({ accessToken: 'access-token', refreshToken: 'refresh-token' });
    expect(securityValue.loginChallenge).toBeUndefined();
    expect(storedNonceHash).not.toBe(deliveredCode);
    expect(jwt.sign).toHaveBeenCalledWith(expect.objectContaining({ sessionVersion: 2, tokenType: 'access' }), expect.any(Object));
  });

  it('persists timeout settings and revokes old tokens while preserving the current session', async () => {
    const user = activeUser('unused');
    let securityValue: any = {
      sessionVersion: 4,
      twoFactorEnabled: false,
      twoFactorMethod: 'EMAIL',
      idleTimeoutMinutes: 1440,
    };
    const prisma: any = {
      user: {
        findUnique: vi.fn().mockResolvedValue(user),
        update: vi.fn().mockResolvedValue(user),
      },
      appSetting: {
        findUnique: vi.fn(async () => ({ value: securityValue })),
        upsert: vi.fn(async (args: any) => {
          securityValue = args.update.value;
          return { value: securityValue };
        }),
      },
    };
    const jwt: any = {
      sign: vi.fn((payload: any) => payload.tokenType === 'access' ? 'next-access' : 'next-refresh'),
    };
    const config: any = { get: vi.fn().mockReturnValue('1h') };
    const audit: any = { log: vi.fn() };
    const service = new AuthService(prisma, jwt, config, audit, {} as any);

    await expect(service.updateSecurity(user.id, { idleTimeoutMinutes: 30 })).resolves.toMatchObject({ idleTimeoutMinutes: 30 });
    const session = await service.logoutOtherSessions(user.id);

    expect(session).toMatchObject({ accessToken: 'next-access', refreshToken: 'next-refresh' });
    expect(securityValue.sessionVersion).toBe(5);
    expect(jwt.sign).toHaveBeenCalledWith(expect.objectContaining({ sessionVersion: 5, tokenType: 'access' }), expect.any(Object));
  });
});
