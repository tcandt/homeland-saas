import { describe, expect, it, vi } from 'vitest';
import * as bcrypt from 'bcryptjs';
import { UnauthorizedException } from '@nestjs/common';
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

  it('updates activity only through the explicit activity endpoint service', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-30T10:00:00.000Z'));
    let securityValue: any = {
      sessionVersion: 2,
      twoFactorEnabled: false,
      twoFactorMethod: 'EMAIL',
      idleTimeoutMinutes: 60,
      lastActivityAt: '2026-09-30T09:30:00.000Z',
    };
    const prisma: any = {
      user: { findUnique: vi.fn().mockResolvedValue({ id: 'user-1', tenantId: 'tenant-1', status: 'ACTIVE' }) },
      appSetting: {
        findUnique: vi.fn(async () => ({ value: securityValue })),
        upsert: vi.fn(async (args: any) => {
          securityValue = args.update.value;
          return { value: securityValue };
        }),
      },
    };
    const service = new AuthService(prisma, {} as any, {} as any, { log: vi.fn() } as any, {} as any);

    await expect(service.recordActivity('user-1')).resolves.toEqual({ success: true, idleTimeoutMinutes: 60 });
    expect(securityValue.lastActivityAt).toBe('2026-09-30T10:00:00.000Z');
    expect(prisma.appSetting.upsert).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it('rejects an explicit activity update after the idle timeout has elapsed', async () => {
    const prisma: any = {
      user: { findUnique: vi.fn().mockResolvedValue({ id: 'user-1', tenantId: 'tenant-1', status: 'ACTIVE' }) },
      appSetting: {
        findUnique: vi.fn().mockResolvedValue({
          value: {
            sessionVersion: 2,
            twoFactorEnabled: false,
            twoFactorMethod: 'EMAIL',
            idleTimeoutMinutes: 60,
            lastActivityAt: new Date(Date.now() - 61 * 60 * 1000).toISOString(),
          },
        }),
        upsert: vi.fn(),
      },
    };
    const service = new AuthService(prisma, {} as any, {} as any, {} as any, {} as any);

    await expect(service.recordActivity('user-1')).rejects.toThrow(UnauthorizedException);
    expect(prisma.appSetting.upsert).not.toHaveBeenCalled();
  });

  it('does not extend inactivity when refreshing an active session', async () => {
    const user = {
      ...activeUser('unused'),
      refreshTokenHash: await bcrypt.hash('refresh-token', 4),
    };
    const prisma: any = {
      user: {
        findUnique: vi.fn().mockResolvedValue(user),
        update: vi.fn().mockResolvedValue(user),
      },
      appSetting: {
        findUnique: vi.fn().mockResolvedValue({
          value: {
            sessionVersion: 2,
            twoFactorEnabled: false,
            twoFactorMethod: 'EMAIL',
            idleTimeoutMinutes: 60,
            lastActivityAt: new Date().toISOString(),
          },
        }),
        upsert: vi.fn(),
      },
    };
    const jwt: any = {
      verify: vi.fn().mockReturnValue({ sub: user.id, sessionVersion: 2, tokenType: 'refresh' }),
      sign: vi.fn((payload: any) => payload.tokenType === 'access' ? 'next-access' : 'next-refresh'),
    };
    const service = new AuthService(prisma, jwt, { get: vi.fn().mockReturnValue('1h') } as any, {} as any, {} as any);

    await expect(service.refresh('refresh-token')).resolves.toMatchObject({ accessToken: 'next-access', refreshToken: 'next-refresh' });
    expect(prisma.appSetting.upsert).not.toHaveBeenCalled();
  });

  it('serializes timeout changes with activity updates without losing security fields', async () => {
    let securityValue: any = {
      sessionVersion: 7,
      twoFactorEnabled: true,
      twoFactorMethod: 'EMAIL',
      idleTimeoutMinutes: 15,
      lastActivityAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    };
    let transactionTail = Promise.resolve();
    const tx: any = {
      $queryRaw: vi.fn().mockResolvedValue([{ lock: '' }]),
      appSetting: {
        findUnique: vi.fn(async () => ({ value: securityValue })),
        upsert: vi.fn(async (args: any) => {
          securityValue = args.update.value;
          return { value: securityValue };
        }),
      },
    };
    const prisma: any = {
      user: { findUnique: vi.fn().mockResolvedValue({ id: 'user-1', tenantId: 'tenant-1', status: 'ACTIVE' }) },
      appSetting: {
        findUnique: vi.fn(async () => ({ value: securityValue })),
      },
      $transaction: vi.fn((callback: any) => {
        const run = transactionTail.then(() => callback(tx));
        transactionTail = run.then(() => undefined, () => undefined);
        return run;
      }),
    };
    const service = new AuthService(prisma, {} as any, {} as any, { log: vi.fn() } as any, {} as any);

    await Promise.all([
      service.updateSecurity('user-1', { idleTimeoutMinutes: 60 }),
      service.recordActivity('user-1'),
    ]);

    expect(securityValue).toMatchObject({
      sessionVersion: 7,
      twoFactorEnabled: true,
      twoFactorMethod: 'EMAIL',
      idleTimeoutMinutes: 60,
    });
    expect(Date.parse(securityValue.lastActivityAt)).toBeGreaterThan(Date.now() - 10 * 60 * 1000);
  });

  it('preserves a concurrent timeout change when creating a 2FA challenge', async () => {
    let securityValue: any = {
      sessionVersion: 3,
      twoFactorEnabled: false,
      twoFactorMethod: 'EMAIL',
      idleTimeoutMinutes: 15,
      lastActivityAt: new Date().toISOString(),
    };
    let transactionTail = Promise.resolve();
    const tx: any = {
      $queryRaw: vi.fn().mockResolvedValue([{ lock: '' }]),
      appSetting: {
        findUnique: vi.fn(async () => ({ value: securityValue })),
        upsert: vi.fn(async (args: any) => {
          securityValue = args.update.value;
          return { value: securityValue };
        }),
      },
    };
    const prisma: any = {
      user: { findUnique: vi.fn().mockResolvedValue({ id: 'user-1', tenantId: 'tenant-1', email: 'user@example.com', status: 'ACTIVE' }) },
      appSetting: { findUnique: vi.fn(async () => ({ value: securityValue })) },
      $transaction: vi.fn((callback: any) => {
        const run = transactionTail.then(() => callback(tx));
        transactionTail = run.then(() => undefined, () => undefined);
        return run;
      }),
    };
    const service = new AuthService(
      prisma,
      {} as any,
      { get: vi.fn().mockReturnValue('test-secret') } as any,
      { log: vi.fn() } as any,
      { sendTwoFactorCode: vi.fn() } as any,
    );

    await Promise.all([
      service.updateSecurity('user-1', { idleTimeoutMinutes: 60 }),
      service.requestTwoFactorChange('user-1', { enabled: true }),
    ]);

    expect(securityValue).toMatchObject({
      sessionVersion: 3,
      idleTimeoutMinutes: 60,
      pendingTwoFactor: { action: 'ENABLE', attempts: 0 },
    });
  });

  it('serializes parallel invalid 2FA attempts', async () => {
    let securityValue: any = {
      sessionVersion: 4,
      twoFactorEnabled: false,
      twoFactorMethod: 'EMAIL',
      idleTimeoutMinutes: 60,
      lastActivityAt: new Date().toISOString(),
      pendingTwoFactor: {
        action: 'ENABLE',
        codeHash: '00'.repeat(32),
        expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        attempts: 0,
      },
    };
    let transactionTail = Promise.resolve();
    const tx: any = {
      $queryRaw: vi.fn().mockResolvedValue([{ lock: '' }]),
      appSetting: {
        findUnique: vi.fn(async () => ({ value: securityValue })),
        upsert: vi.fn(async (args: any) => {
          securityValue = args.update.value;
          return { value: securityValue };
        }),
      },
    };
    const prisma: any = {
      user: { findUnique: vi.fn().mockResolvedValue({ id: 'user-1', tenantId: 'tenant-1', status: 'ACTIVE' }) },
      $transaction: vi.fn((callback: any) => {
        const run = transactionTail.then(() => callback(tx));
        transactionTail = run.then(() => undefined, () => undefined);
        return run;
      }),
    };
    const service = new AuthService(
      prisma,
      {} as any,
      { get: vi.fn().mockReturnValue('test-secret') } as any,
      { log: vi.fn() } as any,
      {} as any,
    );

    const results = await Promise.allSettled([
      service.confirmTwoFactorChange('user-1', { enabled: true, code: '111111' }),
      service.confirmTwoFactorChange('user-1', { enabled: true, code: '222222' }),
    ]);

    expect(results.every((result) => result.status === 'rejected')).toBe(true);
    expect(securityValue.pendingTwoFactor.attempts).toBe(2);
  });
});
