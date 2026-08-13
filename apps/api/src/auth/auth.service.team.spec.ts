import { describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service';

describe('AuthService team directory', () => {
  it('returns the forced password flag in the login user and signed tokens', async () => {
    const bcrypt = await import('bcryptjs');
    const passwordHash = await bcrypt.hash('StrongTemp@123', 4);
    const prisma: any = {
      user: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'owner-a-user',
          tenantId: 'tenant-1',
          email: 'admina@homeland.local',
          fullName: 'Owner Admin - Tính',
          status: 'ACTIVE',
          mustChangePassword: true,
          passwordHash,
          tenant: { id: 'tenant-1' },
          roles: [{ role: { code: 'ADMIN', permissions: [] } }],
        }),
        update: vi.fn().mockResolvedValue({ id: 'owner-a-user' }),
      },
    };
    const jwtService: any = { sign: vi.fn().mockReturnValueOnce('access-token').mockReturnValueOnce('refresh-token') };
    const config: any = { get: vi.fn().mockReturnValue('1h') };
    const audit: any = { log: vi.fn() };
    const service = new AuthService(prisma, jwtService, config, audit, {} as any);

    const result = await service.login({
      emailOrPhone: 'admina@homeland.local',
      password: 'StrongTemp@123',
    });

    expect(result.user.mustChangePassword).toBe(true);
    expect(jwtService.sign).toHaveBeenCalledWith(expect.objectContaining({
      sub: 'owner-a-user',
      mustChangePassword: true,
    }), expect.any(Object));
  });

  it('lists only non-deleted tenant users without credential fields', async () => {
    const prisma: any = {
      user: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'user-admin-a',
            email: 'adminA@homeland.local',
            fullName: 'Owner Admin - Tính',
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
        id: 'user-admin-a',
        email: 'adminA@homeland.local',
        roles: ['ADMIN'],
        mustChangePassword: true,
      }),
    ]);
    expect(result[0]).not.toHaveProperty('passwordHash');
    expect(result[0]).not.toHaveProperty('refreshTokenHash');
  });

  it('creates a tenant team member with a hashed password, role assignment and redacted audit data', async () => {
    const prisma: any = {
      user: {
        findFirst: vi.fn()
          .mockResolvedValueOnce({ email: 'admin@homeland.local' })
          .mockResolvedValueOnce(null),
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn().mockResolvedValue({
          id: 'owner-a-user',
          email: 'admina@homeland.local',
          fullName: 'Owner Admin - Tính',
          status: 'ACTIVE',
          mustChangePassword: true,
          lastLoginAt: null,
          lastLoginIp: null,
          updatedAt: new Date('2026-08-13T05:00:00.000Z'),
        }),
      },
      role: {
        findUnique: vi.fn().mockResolvedValue({ id: 'admin-role', code: 'ADMIN' }),
      },
      $transaction: vi.fn(async (callback: any) => callback(prisma)),
    };
    const audit: any = { log: vi.fn() };
    const service = new AuthService(prisma, {} as any, {} as any, audit, {} as any);

    const result = await service.createTeamMember('tenant-1', 'system-admin', {
      fullName: 'Owner Admin - Tính',
      email: 'AdminA@HomeLand.Local',
      role: 'ADMIN',
      temporaryPassword: 'StrongTemp@123',
    });

    expect(prisma.user.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        tenantId: 'tenant-1',
        email: 'admina@homeland.local',
        passwordHash: expect.not.stringContaining('StrongTemp@123'),
        roles: { create: { roleId: 'admin-role' } },
        mustChangePassword: true,
      }),
    }));
    expect(result).toEqual(expect.objectContaining({
      email: 'admina@homeland.local',
      roles: ['ADMIN'],
      mustChangePassword: true,
    }));
    expect(result).not.toHaveProperty('passwordHash');
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({
      action: 'CREATE',
      entity: 'User',
      userId: 'system-admin',
      after: {
        email: 'admina@homeland.local',
        fullName: 'Owner Admin - Tính',
        role: 'ADMIN',
        status: 'ACTIVE',
      },
    }));
    expect(JSON.stringify(audit.log.mock.calls)).not.toContain('StrongTemp@123');
  });

  it('closes regular-admin provisioning after both owner accounts exist', async () => {
    const prisma: any = {
      user: {
        findFirst: vi.fn().mockResolvedValue({ email: 'admin@homeland.local' }),
        count: vi.fn().mockResolvedValue(2),
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
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({
      action: 'CHANGE_PASSWORD',
      tenantId: 'tenant-1',
      userId: 'owner-a-user',
    }));
  });
});
