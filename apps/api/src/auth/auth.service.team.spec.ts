import { describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service';

describe('AuthService team directory', () => {
  it('returns the forced password flag in the login user and signed tokens', async () => {
    const bcrypt = await import('bcryptjs');
    const passwordHash = await bcrypt.hash('StrongTemp@123', 4);
    const prisma: any = {
      user: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'system-admin',
          tenantId: 'tenant-1',
          email: 'admin@homeland.vn',
          fullName: 'System Admin',
          status: 'ACTIVE',
          mustChangePassword: true,
          passwordHash,
          tenant: { id: 'tenant-1' },
          roles: [{ role: { code: 'ADMIN', permissions: [] } }],
        }),
        update: vi.fn().mockResolvedValue({ id: 'system-admin' }),
      },
    };
    const jwtService: any = { sign: vi.fn().mockReturnValueOnce('access-token').mockReturnValueOnce('refresh-token') };
    const config: any = { get: vi.fn().mockReturnValue('1h') };
    const audit: any = { log: vi.fn() };
    const service = new AuthService(prisma, jwtService, config, audit, {} as any);

    const result = await service.login({
      emailOrPhone: 'admin@homeland.vn',
      password: 'StrongTemp@123',
    });

    expect(result.user.mustChangePassword).toBe(true);
    expect(jwtService.sign).toHaveBeenCalledWith(expect.objectContaining({
      sub: 'system-admin',
      mustChangePassword: true,
    }), expect.any(Object));
  });

  it('lists only non-deleted tenant users without credential fields', async () => {
    const prisma: any = {
      user: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'user-admin',
            email: 'admin@homeland.vn',
            fullName: 'System Admin',
            status: 'ACTIVE',
            mustChangePassword: true,
            lastLoginAt: new Date('2026-08-13T04:00:00.000Z'),
            lastLoginIp: '127.0.0.1',
            updatedAt: new Date('2026-08-13T04:00:00.000Z'),
            roles: [{ role: { code: 'ADMIN', name: 'ADMIN' } }],
            passwordHash: 'must-not-be-returned',
            refreshTokenHash: 'must-not-be-returned',
          },
        ]),
      },
      appSetting: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    const service = new AuthService(prisma, {} as any, {} as any, {} as any, {} as any);

    const result = await service.listTeam('tenant-1');

    expect(prisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        tenantId: 'tenant-1',
        deletedAt: null,
      },
      select: expect.objectContaining({
        id: true,
        email: true,
        roles: expect.any(Object),
      }),
    }));
    expect(result).toEqual([
      expect.objectContaining({
        id: 'user-admin',
        email: 'admin@homeland.vn',
        roles: ['ADMIN'],
        mustChangePassword: true,
      }),
    ]);
    expect(result[0]).not.toHaveProperty('passwordHash');
    expect(result[0]).not.toHaveProperty('refreshTokenHash');
  });

  it('updates a tenant team member and preserves the audit trail', async () => {
    const bcrypt = await import('bcryptjs');
    const prisma: any = {
      user: {
        findFirst: vi.fn()
          .mockResolvedValueOnce({
            id: 'member-1',
            email: 'member@homeland.local',
            fullName: 'Member One',
            status: 'ACTIVE',
            mustChangePassword: false,
            roles: [{ role: { code: 'SALES', name: 'Sales' } }],
          })
          .mockResolvedValueOnce({
            id: 'member-1',
            email: 'member@homeland.local',
            fullName: 'Member Updated',
            status: 'DISABLED',
            mustChangePassword: true,
            lastLoginAt: null,
            lastLoginIp: null,
            updatedAt: new Date('2026-08-13T06:00:00.000Z'),
            roles: [{ role: { code: 'MANAGER', name: 'Manager' } }],
          }),
        update: vi.fn().mockResolvedValue({ id: 'member-1' }),
      },
      role: {
        findUnique: vi.fn().mockResolvedValue({ id: 'manager-role', code: 'MANAGER' }),
      },
      userRole: {
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
        create: vi.fn().mockResolvedValue({ userId: 'member-1', roleId: 'manager-role' }),
      },
      appSetting: {
        findMany: vi.fn().mockResolvedValue([]),
        findUnique: vi.fn().mockResolvedValue(null),
        upsert: vi.fn().mockResolvedValue({ id: 'setting-1' }),
      },
      $transaction: vi.fn(async (callback: any) => callback(prisma)),
    };
    const audit: any = { log: vi.fn() };
    const service = new AuthService(prisma, {} as any, {} as any, audit, {} as any);

    const result = await service.updateTeamMember('tenant-1', 'system-admin', 'member-1', {
      fullName: 'Member Updated',
      role: 'MANAGER',
      status: 'DISABLED',
      temporaryPassword: 'StrongTemp@123',
    });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'member-1' },
      data: expect.objectContaining({
        fullName: 'Member Updated',
        status: 'DISABLED',
        mustChangePassword: true,
        refreshTokenHash: null,
        passwordHash: expect.any(String),
      }),
    });
    expect(prisma.userRole.deleteMany).toHaveBeenCalledWith({ where: { userId: 'member-1' } });
    expect(prisma.userRole.create).toHaveBeenCalledWith({
      data: { userId: 'member-1', roleId: 'manager-role' },
    });
    await expect(bcrypt.compare('StrongTemp@123', prisma.user.update.mock.calls[0][0].data.passwordHash)).resolves.toBe(true);
    expect(result).toEqual(expect.objectContaining({
      id: 'member-1',
      fullName: 'Member Updated',
      status: 'DISABLED',
      mustChangePassword: true,
      roles: ['MANAGER'],
    }));
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({
      action: 'UPDATE',
      entity: 'User',
      userId: 'system-admin',
    }));
  });

  it('creates a tenant team member with a hashed password, role assignment and redacted audit data', async () => {
    const prisma: any = {
      user: {
        findFirst: vi.fn()
          .mockResolvedValueOnce({ email: 'admin@homeland.vn' })
          .mockResolvedValueOnce(null),
        create: vi.fn().mockResolvedValue({
          id: 'manager-user',
          email: 'new-manager@homeland.local',
          fullName: 'New Manager',
          status: 'ACTIVE',
          mustChangePassword: true,
          lastLoginAt: null,
          lastLoginIp: null,
          updatedAt: new Date('2026-08-13T05:00:00.000Z'),
        }),
      },
      role: {
        findUnique: vi.fn().mockResolvedValue({ id: 'manager-role', code: 'MANAGER' }),
      },
      $transaction: vi.fn(async (callback: any) => callback(prisma)),
    };
    const audit: any = { log: vi.fn() };
    const service = new AuthService(prisma, {} as any, {} as any, audit, {} as any);

    const result = await service.createTeamMember('tenant-1', 'system-admin', {
      fullName: 'New Manager',
      email: 'New-Manager@HomeLand.Local',
      role: 'MANAGER',
      temporaryPassword: 'StrongTemp@123',
    });

    expect(prisma.user.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        tenantId: 'tenant-1',
        email: 'new-manager@homeland.local',
        passwordHash: expect.not.stringContaining('StrongTemp@123'),
        roles: { create: { roleId: 'manager-role' } },
        mustChangePassword: true,
      }),
    }));
    expect(result).toEqual(expect.objectContaining({
      email: 'new-manager@homeland.local',
      roles: ['MANAGER'],
      mustChangePassword: true,
    }));
    expect(result).not.toHaveProperty('passwordHash');
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({
      action: 'CREATE',
      entity: 'User',
      userId: 'system-admin',
      after: {
        email: 'new-manager@homeland.local',
        fullName: 'New Manager',
        role: 'MANAGER',
        status: 'ACTIVE',
      },
    }));
    expect(JSON.stringify(audit.log.mock.calls)).not.toContain('StrongTemp@123');
  });

  it('blocks team provisioning from non-system admins', async () => {
    const prisma: any = {
      user: {
        findFirst: vi.fn().mockResolvedValue({ email: 'manager@homeland.local' }),
      },
    };
    const audit: any = { log: vi.fn() };
    const service = new AuthService(prisma, {} as any, {} as any, audit, {} as any);

    await expect(service.createTeamMember('tenant-1', 'system-admin', {
      fullName: 'Extra administrator',
      email: 'extra-admin@homeland.local',
      role: 'ADMIN',
      temporaryPassword: 'StrongTemp@123',
    })).rejects.toMatchObject({ status: 403 });

    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({
      before: expect.objectContaining({
        denied: true,
        reason: 'TEAM_PROVISIONING_FORBIDDEN',
      }),
    }));
  });

  it('clears the forced password flag and revokes refresh sessions after password change', async () => {
    const bcrypt = await import('bcryptjs');
    const passwordHash = await bcrypt.hash('StrongTemp@123', 4);
    const prisma: any = {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'owner-a-user',
          tenantId: 'tenant-1',
          passwordHash,
          mustChangePassword: true,
        }),
        update: vi.fn().mockResolvedValue({ id: 'owner-a-user' }),
      },
    };
    const audit: any = { log: vi.fn() };
    const service = new AuthService(prisma, {} as any, {} as any, audit, {} as any);

    await expect(service.changePassword('owner-a-user', {
      oldPassword: 'StrongTemp@123',
      newPassword: 'OwnerFinal@456',
      confirmPassword: 'OwnerFinal@456',
    })).resolves.toEqual({ success: true });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'owner-a-user' },
      data: expect.objectContaining({
        passwordHash: expect.any(String),
        mustChangePassword: false,
        refreshTokenHash: null,
      }),
    });
    const updatedPasswordHash = prisma.user.update.mock.calls[0][0].data.passwordHash;
    await expect(bcrypt.compare('StrongTemp@123', updatedPasswordHash)).resolves.toBe(false);
    await expect(bcrypt.compare('OwnerFinal@456', updatedPasswordHash)).resolves.toBe(true);
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({
      action: 'CHANGE_PASSWORD',
      tenantId: 'tenant-1',
      userId: 'owner-a-user',
    }));
  });

  it('defers the password change for only the current token session', async () => {
    const prisma: any = {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'owner-a-user',
          tenantId: 'tenant-1',
          email: 'admin@homeland.vn',
          status: 'ACTIVE',
          mustChangePassword: true,
          roles: [{ role: { code: 'ADMIN', permissions: [] } }],
        }),
        update: vi.fn().mockResolvedValue({ id: 'owner-a-user' }),
      },
    };
    const jwtService: any = {
      sign: vi.fn().mockReturnValueOnce('deferred-access-token').mockReturnValueOnce('deferred-refresh-token'),
    };
    const config: any = { get: vi.fn().mockReturnValue('1h') };
    const audit: any = { log: vi.fn() };
    const service = new AuthService(prisma, jwtService, config, audit, {} as any);

    const result = await service.deferPasswordChange('owner-a-user');

    expect(result).toEqual(expect.objectContaining({
      accessToken: 'deferred-access-token',
      refreshToken: 'deferred-refresh-token',
      mustChangePassword: true,
      passwordChangeDeferred: true,
    }));
    expect(jwtService.sign).toHaveBeenCalledWith(expect.objectContaining({
      mustChangePassword: false,
      passwordChangeDeferred: true,
    }), expect.any(Object));
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'owner-a-user' },
      data: { refreshTokenHash: expect.any(String) },
    });
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({
      action: 'UPDATE',
      after: { mustChangePassword: true, passwordChangeDeferredForSession: true },
    }));
  });

  it('preserves a deferred password prompt while rotating the refresh token', async () => {
    const bcrypt = await import('bcryptjs');
    const refreshTokenHash = await bcrypt.hash('current-refresh-token', 4);
    const prisma: any = {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'owner-a-user',
          tenantId: 'tenant-1',
          email: 'admin@homeland.vn',
          status: 'ACTIVE',
          mustChangePassword: true,
          refreshTokenHash,
          roles: [{ role: { code: 'ADMIN', permissions: [] } }],
        }),
        update: vi.fn().mockResolvedValue({ id: 'owner-a-user' }),
      },
    };
    const jwtService: any = {
      verify: vi.fn().mockReturnValue({ sub: 'owner-a-user', passwordChangeDeferred: true }),
      sign: vi.fn().mockReturnValueOnce('next-access-token').mockReturnValueOnce('next-refresh-token'),
    };
    const config: any = { get: vi.fn().mockReturnValue('1h') };
    const service = new AuthService(prisma, jwtService, config, {} as any, {} as any);

    const result = await service.refresh('current-refresh-token');

    expect(result.passwordChangeDeferred).toBe(true);
    expect(result.mustChangePassword).toBe(true);
    expect(jwtService.sign).toHaveBeenCalledWith(expect.objectContaining({
      mustChangePassword: false,
      passwordChangeDeferred: true,
    }), expect.any(Object));
  });
});
