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
    const strategy = new JwtStrategy({ get: () => 'test-secret' } as any, cls);

    await expect(strategy.validate({
      sub: 'user-1',
      tenantId: 'tenant-1',
      tokenType: 'access',
    })).resolves.toMatchObject({ id: 'user-1', tenantId: 'tenant-1' });

    await expect(strategy.validate({
      sub: 'user-1',
      tenantId: 'tenant-1',
      tokenType: 'refresh',
    })).rejects.toThrow(UnauthorizedException);
  });
});
