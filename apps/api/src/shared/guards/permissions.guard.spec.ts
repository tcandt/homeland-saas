import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';
import { PermissionsGuard } from './permissions.guard';

function createContext(user: Record<string, unknown>): ExecutionContext {
  return {
    getHandler: () => function handler() {},
    getClass: () => class Controller {},
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

function createGuard(requiredPermissions: string[] | undefined, isPublic = false) {
  const reflector = {
    getAllAndOverride: vi.fn((key: string) => {
      if (key === 'isPublic') return isPublic;
      return requiredPermissions;
    }),
  } as unknown as Reflector;

  return new PermissionsGuard(reflector);
}

describe('PermissionsGuard', () => {
  it('allows ADMIN role to perform operational actions even when a token has stale permissions', () => {
    const guard = createGuard(['finance.pay']);

    expect(guard.canActivate(createContext({ roles: ['ADMIN'], permissions: [] }))).toBe(true);
  });

  it('does not grant permissions based on a hard-coded email address', () => {
    const guard = createGuard(['finance.pay']);

    expect(() => guard.canActivate(createContext({
      email: 'admin@homeland.local',
      roles: ['MANAGER'],
      permissions: [],
    }))).toThrow(ForbiddenException);
  });

  it('allows users with the required permission or a supported legacy alias', () => {
    const direct = createGuard(['room.update']);
    const legacy = createGuard(['finance.pay']);

    expect(direct.canActivate(createContext({ roles: ['MANAGER'], permissions: ['room.update'] }))).toBe(true);
    expect(legacy.canActivate(createContext({ roles: ['FINANCE'], permissions: ['finance.update'] }))).toBe(true);
  });

  it('denies authenticated users that do not have every required permission', () => {
    const guard = createGuard(['room.read', 'room.update']);

    expect(() => guard.canActivate(createContext({ roles: ['MANAGER'], permissions: ['room.read'] }))).toThrow(
      ForbiddenException,
    );
  });
});
