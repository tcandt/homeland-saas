import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';
import { JwtAuthGuard } from './jwt-auth.guard';

function context(path = '/api/v1/contracts') {
  return {
    getHandler: () => function handler() {},
    getClass: () => class Controller {},
    switchToHttp: () => ({ getRequest: () => ({ path }) }),
  } as unknown as ExecutionContext;
}

describe('JwtAuthGuard forced password change', () => {
  it('blocks a pending user from business endpoints', () => {
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue(false) } as unknown as Reflector;
    const cls = { isActive: vi.fn().mockReturnValue(false) } as any;
    const guard = new JwtAuthGuard(reflector, cls);

    expect(() => guard.handleRequest(null, {
      id: 'owner-a-user',
      tenantId: 'tenant-1',
      roles: ['ADMIN'],
      mustChangePassword: true,
    }, null, context())).toThrow(ForbiddenException);
  });

  it('allows an explicitly marked auth endpoint', () => {
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue(true) } as unknown as Reflector;
    const cls = { isActive: vi.fn().mockReturnValue(false) } as any;
    const guard = new JwtAuthGuard(reflector, cls);
    const user = {
      id: 'owner-a-user',
      tenantId: 'tenant-1',
      roles: ['ADMIN'],
      mustChangePassword: true,
    };

    expect(guard.handleRequest(null, user, null, context('/api/v1/auth/change-password'))).toBe(user);
  });
});
