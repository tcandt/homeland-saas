import { readFileSync } from 'fs';
import { describe, expect, it, vi } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy transport security', () => {
  it('accepts JWTs from the Authorization header only', () => {
    const source = readFileSync(__filename.replace(/\.spec\.ts$/, '.ts'), 'utf8');

    expect(source).toContain('ExtractJwt.fromAuthHeaderAsBearerToken()');
    expect(source).not.toContain('fromUrlQueryParameter');
  });

  it('accepts only access-token payloads', async () => {
    const cls: any = { set: vi.fn() };
    const prisma: any = {
      appSetting: {
        findUnique: vi.fn().mockResolvedValue({
          value: { sessionVersion: 0, idleTimeoutMinutes: 60, lastActivityAt: new Date().toISOString() },
        }),
        upsert: vi.fn(),
      },
    };
    const strategy = new JwtStrategy({ get: () => 'test-secret' } as any, cls, prisma);

    await expect(strategy.validate({
      sub: 'user-1',
      tenantId: 'tenant-1',
      tokenType: 'access',
    })).resolves.toMatchObject({ id: 'user-1', tenantId: 'tenant-1' });
    expect(prisma.appSetting.upsert).not.toHaveBeenCalled();

    await expect(strategy.validate({
      sub: 'user-1',
      tenantId: 'tenant-1',
      tokenType: 'refresh',
    })).rejects.toThrow(UnauthorizedException);
  });
});
