import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException, UnauthorizedException, Optional, Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { SettingScope } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { AuditService } from '../shared/audit/audit.service';
import { LoginInput, ChangePasswordInput, RegisterInput, ForgotPasswordInput, ResetPasswordInput, CreateTeamMemberInput, UpdateTeamMemberInput } from '@homeland/shared';
import { ErrorCodes } from '../shared/exceptions/error-codes';
import * as crypto from 'crypto';
import { MailProvider } from './services/mail.service';
import { STORAGE_PROVIDER, StorageProvider } from '../documents/interfaces/storage-provider.interface';
import { IpSecurityService } from '../shared/security/ip-security.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly audit: AuditService,
    private readonly mailProvider: MailProvider,
    @Optional() private readonly ipSecurity?: IpSecurityService,
    @Optional() @Inject(STORAGE_PROVIDER) private readonly storageProvider?: StorageProvider,
  ) {}

  async login(input: LoginInput, ip?: string, userAgent?: string) {
    const clientIp = ip || '127.0.0.1';

    // 1. Kiểm tra xem IP có đang bị khóa do nhập sai quá 5 lần không
    if (this.ipSecurity) {
      this.ipSecurity.checkIpBlocked(clientIp);
    }

    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: { equals: input.emailOrPhone.trim(), mode: 'insensitive' } },
          // { phone: input.emailOrPhone } // Uncomment when phone is added to User model
        ],
      },
      include: {
        tenant: true,
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: { permission: true }
                }
              }
            }
          }
        }
      }
    });

    if (!user) {
      if (this.ipSecurity) {
        this.ipSecurity.recordFailedAttempt(clientIp);
      }
      await this.audit.log({ action: 'LOGIN_FAILED', entity: 'User', module: 'Auth', before: { emailOrPhone: input.emailOrPhone }, ip, userAgent });
      throw new UnauthorizedException({ code: ErrorCodes.AUTH_INVALID_CREDENTIALS, message: 'Invalid credentials' });
    }

    if (user.status !== 'ACTIVE') {
      await this.audit.log({ action: 'LOGIN_FAILED', entity: 'User', entityId: user.id, module: 'Auth', before: { reason: 'Account disabled' }, tenantId: user.tenantId, ip, userAgent });
      throw new UnauthorizedException({ code: 'AUTH_ACCOUNT_DISABLED', message: 'Account is disabled' });
    }

    const isMatch = await bcrypt.compare(input.password, user.passwordHash);
    if (!isMatch) {
      // Ghi nhận lần nhập sai mật khẩu cho IP này
      if (this.ipSecurity) {
        this.ipSecurity.recordFailedAttempt(clientIp);
      }
      await this.audit.log({ action: 'LOGIN_FAILED', entity: 'User', entityId: user.id, module: 'Auth', before: { reason: 'Wrong password' }, tenantId: user.tenantId, ip, userAgent });
      throw new UnauthorizedException({ code: ErrorCodes.AUTH_INVALID_CREDENTIALS, message: 'Invalid credentials' });
    }

    // Đăng nhập thành công -> Xóa bộ đếm sai mật khẩu của IP này
    if (this.ipSecurity) {
      this.ipSecurity.resetFailedAttempts(clientIp);
    }

    // Extract roles and permissions
    const roles = user.roles.map(ur => ur.role.code);
    const permissions = Array.from(new Set(
      user.roles.flatMap(ur => ur.role.permissions.map(rp => rp.permission.key))
    ));

    const payload = {
      sub: user.id,
      tenantId: user.tenantId,
      email: user.email,
      roles,
      permissions,
      mustChangePassword: user.mustChangePassword,
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.configService.get('auth.jwtExpiresIn'),
    });

    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: this.configService.get('auth.jwtRefreshExpiresIn'),
    });

    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { 
        lastLoginAt: new Date(), 
        lastLoginIp: ip,
        lastUserAgent: userAgent,
        refreshTokenHash: hashedRefreshToken 
      }
    });

    await this.audit.log({
      action: 'LOGIN_SUCCESS',
      entity: 'User',
      entityId: user.id,
      module: 'Auth',
      tenantId: user.tenantId,
      userId: user.id,
      ip,
      userAgent,
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        tenantId: user.tenantId,
        roles,
        permissions,
        mustChangePassword: user.mustChangePassword,
      }
    };
  }

  async register(input: RegisterInput, ip?: string, userAgent?: string) {
    const existingUser = await this.prisma.user.findFirst({
      where: { email: input.email }
    });

    if (existingUser) {
      throw new UnauthorizedException({ code: 'AUTH_EMAIL_EXISTS', message: 'Email is already registered' });
    }

    const adminRole = await this.prisma.role.findUnique({ where: { code: 'ADMIN' } });
    if (!adminRole) {
      throw new Error('ADMIN role not found in database. Seed required.');
    }

    const tenantCode = `TENANT-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
    const passwordHash = await bcrypt.hash(input.password, 12);

    const user = await this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenantOrg.create({
        data: {
          name: `${input.fullName}'s Organization`,
          code: tenantCode,
        }
      });

      return tx.user.create({
        data: {
          email: input.email,
          fullName: input.fullName,
          passwordHash,
          tenantId: tenant.id,
          status: 'ACTIVE', // Ideally PENDING_VERIFICATION, but for MVP keep ACTIVE
          roles: {
            create: {
              roleId: adminRole.id
            }
          }
        },
        include: {
          tenant: true,
          roles: {
            include: { role: { include: { permissions: { include: { permission: true } } } } }
          }
        }
      });
    });

    const roles = user.roles.map(ur => ur.role.code);
    const permissions = Array.from(new Set(user.roles.flatMap(ur => ur.role.permissions.map(rp => rp.permission.key))));

    const payload = { sub: user.id, tenantId: user.tenantId, email: user.email, roles, permissions, mustChangePassword: user.mustChangePassword };
    const accessToken = this.jwtService.sign(payload, { expiresIn: this.configService.get('auth.jwtExpiresIn') });
    const refreshToken = this.jwtService.sign(payload, { expiresIn: this.configService.get('auth.jwtRefreshExpiresIn') });
    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { 
        lastLoginAt: new Date(), 
        lastLoginIp: ip,
        lastUserAgent: userAgent,
        refreshTokenHash: hashedRefreshToken 
      }
    });

    await this.audit.log({
      action: 'REGISTER',
      entity: 'User',
      entityId: user.id,
      module: 'Auth',
      tenantId: user.tenantId,
      userId: user.id
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        tenantId: user.tenantId,
        roles,
        permissions,
        mustChangePassword: user.mustChangePassword,
      }
    };
  }

  async logout(userId?: string) {
    if (userId) {
      try {
        await this.prisma.user.update({ 
          where: { id: userId }, 
          data: { refreshTokenHash: null } 
        });

        await this.audit.log({
          action: 'LOGOUT_SUCCESS',
          entity: 'User',
          entityId: userId,
          module: 'Auth',
          userId: userId
        });
      } catch (err) {
        this.logger.warn(`Logout cleanup ignored for user ${userId}: ${String(err)}`);
      }
    }

    return { success: true };
  }

  async deferPasswordChange(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          include: { role: { include: { permissions: { include: { permission: true } } } } },
        },
      },
    });

    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException({ code: ErrorCodes.AUTH_TOKEN_INVALID, message: 'Invalid token or user inactive' });
    }
    if (!user.mustChangePassword) {
      throw new BadRequestException({ code: 'AUTH_PASSWORD_CHANGE_NOT_REQUIRED', message: 'Password change is not required' });
    }

    const roles = user.roles.map(ur => ur.role.code);
    const permissions = Array.from(new Set(user.roles.flatMap(ur => ur.role.permissions.map(rp => rp.permission.key))));
    const payload = {
      sub: user.id,
      tenantId: user.tenantId,
      email: user.email,
      roles,
      permissions,
      mustChangePassword: false,
      passwordChangeDeferred: true,
    };
    const accessToken = this.jwtService.sign(payload, { expiresIn: this.configService.get('auth.jwtExpiresIn') });
    const refreshToken = this.jwtService.sign(payload, { expiresIn: this.configService.get('auth.jwtRefreshExpiresIn') });
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshTokenHash },
    });
    await this.audit.log({
      action: 'UPDATE',
      entity: 'User',
      entityId: user.id,
      module: 'Auth',
      tenantId: user.tenantId,
      userId: user.id,
      before: { mustChangePassword: true },
      after: { mustChangePassword: true, passwordChangeDeferredForSession: true },
    });

    return {
      accessToken,
      refreshToken,
      mustChangePassword: true,
      passwordChangeDeferred: true,
    };
  }

  async refresh(refreshToken: string) {
    try {
      const decoded = this.jwtService.verify(refreshToken);
      const user = await this.prisma.user.findUnique({
        where: { id: decoded.sub },
        include: {
          roles: {
            include: { role: { include: { permissions: { include: { permission: true } } } } }
          }
        }
      });

      if (!user || user.status !== 'ACTIVE') {
        throw new UnauthorizedException({ code: ErrorCodes.AUTH_TOKEN_INVALID, message: 'Invalid token or user inactive' });
      }

      if (!user.refreshTokenHash) {
        throw new UnauthorizedException({ code: ErrorCodes.AUTH_TOKEN_INVALID, message: 'Refresh token has been revoked' });
      }

      const isRefreshTokenValid = await bcrypt.compare(refreshToken, user.refreshTokenHash);
      if (!isRefreshTokenValid) {
        throw new UnauthorizedException({ code: ErrorCodes.AUTH_TOKEN_INVALID, message: 'Invalid refresh token' });
      }

      const roles = user.roles.map(ur => ur.role.code);
      const permissions = Array.from(new Set(user.roles.flatMap(ur => ur.role.permissions.map(rp => rp.permission.key))));

      const passwordChangeDeferred = Boolean(user.mustChangePassword && decoded.passwordChangeDeferred);
      const payload = {
        sub: user.id,
        tenantId: user.tenantId,
        email: user.email,
        roles,
        permissions,
        mustChangePassword: user.mustChangePassword && !passwordChangeDeferred,
        passwordChangeDeferred,
      };

      const newAccessToken = this.jwtService.sign(payload, { expiresIn: this.configService.get('auth.jwtExpiresIn') });
      const newRefreshToken = this.jwtService.sign(payload, { expiresIn: this.configService.get('auth.jwtRefreshExpiresIn') });

      const newHashedRefreshToken = await bcrypt.hash(newRefreshToken, 10);
      await this.prisma.user.update({
        where: { id: user.id },
        data: { refreshTokenHash: newHashedRefreshToken }
      });

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        mustChangePassword: user.mustChangePassword,
        passwordChangeDeferred,
      };
    } catch (e) {
      throw new UnauthorizedException({ code: ErrorCodes.AUTH_TOKEN_EXPIRED, message: 'Refresh token expired or invalid' });
    }
  }

  async forgotPassword(input: ForgotPasswordInput) {
    const user = await this.prisma.user.findFirst({ where: { email: input.email } });
    if (!user || user.status !== 'ACTIVE') {
      // Return success anyway to prevent email enumeration
      return { success: true };
    }

    const token = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetHash: hashedToken,
        passwordResetExpires: new Date(Date.now() + 3600000) // 1 hour
      }
    });

    await this.audit.log({
      action: 'PASSWORD_RESET_REQUEST',
      entity: 'User',
      entityId: user.id,
      module: 'Auth',
      tenantId: user.tenantId,
      userId: user.id
    });

    try {
      await this.mailProvider.sendPasswordResetEmail(input.email, token, user.tenantId);
    } catch (error) {
      this.logger.error(`Password reset email failed for user ${user.id}`, error instanceof Error ? error.stack : String(error));
    }

    return { success: true };
  }

  async resetPassword(input: ResetPasswordInput) {
    const hashedToken = crypto.createHash('sha256').update(input.token).digest('hex');
    const user = await this.prisma.user.findFirst({
      where: {
        passwordResetHash: hashedToken,
        passwordResetExpires: { gt: new Date() },
        status: 'ACTIVE'
      }
    });

    if (!user) {
      throw new UnauthorizedException({ code: 'AUTH_TOKEN_INVALID', message: 'Invalid or expired reset token' });
    }

    const passwordHash = await bcrypt.hash(input.newPassword, 12);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetHash: null,
        passwordResetExpires: null,
        mustChangePassword: false,
        refreshTokenHash: null,
      }
    });

    await this.audit.log({
      action: 'PASSWORD_RESET_SUCCESS',
      entity: 'User',
      entityId: user.id,
      module: 'Auth',
      tenantId: user.tenantId,
      userId: user.id
    });

    return { success: true };
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        tenant: true,
        roles: {
          include: { role: { include: { permissions: { include: { permission: true } } } } }
        }
      }
    });

    if (!user) throw new UnauthorizedException();

    const roles = user.roles.map(ur => ur.role.code);
    const permissions = Array.from(new Set(user.roles.flatMap(ur => ur.role.permissions.map(rp => rp.permission.key))));

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      tenantId: user.tenantId,
      tenant: { id: user.tenant.id, name: user.tenant.name, code: user.tenant.code },
      roles,
      permissions,
      mustChangePassword: user.mustChangePassword,
    };
  }

  async listTeam(tenantId: string) {
    const users = await this.prisma.user.findMany({
      where: {
        tenantId,
        deletedAt: null,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        status: true,
        mustChangePassword: true,
        lastLoginAt: true,
        lastLoginIp: true,
        updatedAt: true,
        roles: {
          select: {
            role: {
              select: {
                code: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: [
        { email: 'asc' },
      ],
    });

    const avatars = await this.prisma.appSetting.findMany({
      where: {
        tenantId,
        scope: SettingScope.USER,
        ownerId: { in: users.map((user) => user.id) },
        key: 'profile',
      },
      select: {
        ownerId: true,
        value: true,
      },
    });
    const avatarByUserId = new Map(avatars.map((record) => [record.ownerId, extractAvatarUrl(record.value)]));

    return users.map((user) => ({
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      status: user.status,
      mustChangePassword: user.mustChangePassword,
      roles: user.roles.map((assignment) => assignment.role.code),
      lastLoginAt: user.lastLoginAt,
      lastLoginIp: user.lastLoginIp,
      updatedAt: user.updatedAt,
      avatarUrl: avatarByUserId.get(user.id) || null,
    }));
  }

  async createTeamMember(tenantId: string, actorUserId: string, input: CreateTeamMemberInput) {
    const normalizedEmail = input.email.trim().toLowerCase();
    await this.ensureTeamProvisioningAllowed(tenantId, actorUserId, normalizedEmail, input.role);
    const existing = await this.prisma.user.findFirst({
      where: {
        tenantId,
        email: normalizedEmail,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException({ code: 'AUTH_EMAIL_EXISTS', message: 'Email is already registered in this tenant' });
    }

    const role = await this.prisma.role.findUnique({
      where: { code: input.role },
      select: { id: true, code: true },
    });
    if (!role) {
      throw new NotFoundException({ code: 'AUTH_ROLE_NOT_FOUND', message: 'Role is not configured' });
    }

    const tempPassword = input.temporaryPassword?.trim() || 'Homeland@123';
    const passwordHash = await bcrypt.hash(tempPassword, 12);
    const user = await this.prisma.$transaction(async (tx) => {
      return tx.user.create({
        data: {
          tenantId,
          email: normalizedEmail,
          fullName: input.fullName.trim(),
          passwordHash,
          status: 'ACTIVE',
          mustChangePassword: true,
          roles: {
            create: {
              roleId: role.id,
            },
          },
        },
        select: {
          id: true,
          email: true,
          fullName: true,
          status: true,
          mustChangePassword: true,
          lastLoginAt: true,
          lastLoginIp: true,
          updatedAt: true,
        },
      });
    });

    await this.audit.log({
      action: 'CREATE',
      entity: 'User',
      entityId: user.id,
      module: 'Auth',
      tenantId,
      userId: actorUserId,
      after: {
        email: user.email,
        fullName: user.fullName,
        role: role.code,
        status: user.status,
      },
    });

    return {
      ...user,
      roles: [role.code],
    };
  }

  async updateTeamMember(tenantId: string, actorUserId: string, userId: string, input: UpdateTeamMemberInput) {
    const current = await this.prisma.user.findFirst({
      where: {
        tenantId,
        id: userId,
        deletedAt: null,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        status: true,
        mustChangePassword: true,
        roles: {
          select: {
            role: {
              select: {
                code: true,
                name: true,
              },
            },
          },
        },
      },
    });
    if (!current) {
      throw new NotFoundException({ code: 'AUTH_TEAM_MEMBER_NOT_FOUND', message: 'Team member not found' });
    }

    const currentAvatarUrl = await this.resolveTeamAvatarUrl(tenantId, userId);
    const nextFullName = input.fullName?.trim();
    const nextPassword = input.temporaryPassword?.trim();
    const nextAvatarUrl = normalizeAvatarUrl(input.avatarUrl);
    const nextRole = input.role || current.roles[0]?.role.code;
    const nextStatus = input.status || current.status;

    if (nextRole && nextRole !== current.roles[0]?.role.code) {
      const role = await this.prisma.role.findUnique({
        where: { code: nextRole },
        select: { id: true, code: true },
      });
      if (!role) {
        throw new NotFoundException({ code: 'AUTH_ROLE_NOT_FOUND', message: 'Role is not configured' });
      }

      await this.prisma.$transaction(async (tx) => {
        const userUpdate: Record<string, unknown> = {};
        if (nextFullName && nextFullName !== current.fullName) {
          userUpdate.fullName = nextFullName;
        }
        if (nextStatus !== current.status) {
          userUpdate.status = nextStatus;
          if (nextStatus !== 'ACTIVE') {
            userUpdate.refreshTokenHash = null;
          }
        }
        if (nextPassword) {
          userUpdate.passwordHash = await bcrypt.hash(nextPassword, 12);
          userUpdate.mustChangePassword = true;
          userUpdate.refreshTokenHash = null;
        }
        if (Object.keys(userUpdate).length > 0) {
          await tx.user.update({
            where: { id: userId },
            data: userUpdate,
          });
        }

        await tx.userRole.deleteMany({
          where: { userId },
        });
        await tx.userRole.create({
          data: {
            userId,
            roleId: role.id,
          },
        });

        if (nextAvatarUrl !== undefined) {
          const previous = await tx.appSetting.findUnique({
            where: {
              tenantId_scope_ownerId_key: {
                tenantId,
                scope: SettingScope.USER,
                ownerId: userId,
                key: 'profile',
              },
            },
          });
          const previousValue = isRecord(previous?.value) ? previous.value : {};
          const value = {
            ...previousValue,
            avatarUrl: nextAvatarUrl,
          };

          await tx.appSetting.upsert({
            where: {
              tenantId_scope_ownerId_key: {
                tenantId,
                scope: SettingScope.USER,
                ownerId: userId,
                key: 'profile',
              },
            },
            create: {
              tenantId,
              scope: SettingScope.USER,
              ownerId: userId,
              key: 'profile',
              value,
              updatedBy: actorUserId,
            },
            update: {
              value,
              updatedBy: actorUserId,
            },
          });
        }
      });
    } else {
      const userUpdate: Record<string, unknown> = {};
      if (nextFullName && nextFullName !== current.fullName) {
        userUpdate.fullName = nextFullName;
      }
      if (nextStatus !== current.status) {
        userUpdate.status = nextStatus;
        if (nextStatus !== 'ACTIVE') {
          userUpdate.refreshTokenHash = null;
        }
      }
      if (nextPassword) {
        userUpdate.passwordHash = await bcrypt.hash(nextPassword, 12);
        userUpdate.mustChangePassword = true;
        userUpdate.refreshTokenHash = null;
      }

      if (Object.keys(userUpdate).length > 0) {
        await this.prisma.user.update({
          where: { id: userId },
          data: userUpdate,
        });
      }

      if (nextAvatarUrl !== undefined) {
        const previous = await this.prisma.appSetting.findUnique({
          where: {
            tenantId_scope_ownerId_key: {
              tenantId,
              scope: SettingScope.USER,
              ownerId: userId,
              key: 'profile',
            },
          },
        });
        const previousValue = isRecord(previous?.value) ? previous.value : {};
        const value = {
          ...previousValue,
          avatarUrl: nextAvatarUrl,
        };

        await this.prisma.appSetting.upsert({
          where: {
            tenantId_scope_ownerId_key: {
              tenantId,
              scope: SettingScope.USER,
              ownerId: userId,
              key: 'profile',
            },
          },
          create: {
            tenantId,
            scope: SettingScope.USER,
            ownerId: userId,
            key: 'profile',
            value,
            updatedBy: actorUserId,
          },
          update: {
            value,
            updatedBy: actorUserId,
          },
        });
      }
    }

    const next = await this.getTeamMemberSnapshot(tenantId, userId);
    await this.audit.log({
      action: 'UPDATE',
      entity: 'User',
      entityId: userId,
      module: 'Auth',
      tenantId,
      userId: actorUserId,
      before: {
        fullName: current.fullName,
        status: current.status,
        role: current.roles[0]?.role.code || null,
        avatarUrl: currentAvatarUrl,
        mustChangePassword: current.mustChangePassword,
      },
      after: {
        fullName: next?.fullName || current.fullName,
        status: next?.status || current.status,
        role: next?.roles?.[0] || nextRole || current.roles[0]?.role.code || null,
        avatarUrl: next?.avatarUrl || nextAvatarUrl || null,
        mustChangePassword: next?.mustChangePassword ?? current.mustChangePassword,
      },
    });

    if (!next) {
      throw new NotFoundException({ code: 'AUTH_TEAM_MEMBER_NOT_FOUND', message: 'Team member not found' });
    }

    if (currentAvatarUrl && nextAvatarUrl && currentAvatarUrl !== nextAvatarUrl) {
      try {
        await this.storageProvider?.delete(currentAvatarUrl);
      } catch (error) {
        this.logger.warn(`Failed to delete previous avatar for user ${userId}: ${String(error)}`);
      }
    }
    return next;
  }

  private async ensureTeamProvisioningAllowed(tenantId: string, actorUserId: string, email: string, role: string) {
    const actor = await this.prisma.user.findFirst({
      where: { id: actorUserId, tenantId, deletedAt: null },
      select: {
        email: true,
        roles: {
          select: {
            role: { select: { code: true, name: true } },
          },
        },
      },
    });
    const actorEmail = actor?.email?.toLowerCase() ?? '';
    const isBootstrapAdmin = actorEmail === 'admin@homeland.vn';
    const hasAdminRole = Boolean(
      actor?.roles?.some((r: any) => {
        const c = String(r?.role?.code || r?.role?.name || '').toUpperCase();
        return c === 'ADMIN' || c === 'MANAGER';
      }),
    );

    if (isBootstrapAdmin || hasAdminRole) return;

    await this.audit.log({
      action: 'CREATE',
      entity: 'User',
      module: 'Auth',
      tenantId,
      userId: actorUserId,
      before: {
        denied: true,
        reason: 'TEAM_PROVISIONING_FORBIDDEN',
        email,
        role,
      },
    });
    throw new ForbiddenException({
      code: 'AUTH_TEAM_PROVISIONING_FORBIDDEN',
      message: 'Chỉ Quản trị viên mới có quyền tạo và quản lý tài khoản nhân sự',
    });
  }

  async updateMe(userId: string, input: { fullName?: string }) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        tenant: true,
        roles: {
          include: { role: { include: { permissions: { include: { permission: true } } } } }
        }
      }
    });

    if (!user) throw new UnauthorizedException();

    const nextFullName = input.fullName?.trim();
    if (nextFullName && nextFullName !== user.fullName) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { fullName: nextFullName },
      });
      user.fullName = nextFullName;
    }

    const roles = user.roles.map(ur => ur.role.code);
    const permissions = Array.from(new Set(user.roles.flatMap(ur => ur.role.permissions.map(rp => rp.permission.key))));

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      tenantId: user.tenantId,
      tenant: { id: user.tenant.id, name: user.tenant.name, code: user.tenant.code },
      roles,
      permissions,
      mustChangePassword: user.mustChangePassword,
    };
  }

  async changePassword(userId: string, input: ChangePasswordInput) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();

    const isMatch = await bcrypt.compare(input.oldPassword, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException({ code: ErrorCodes.AUTH_INVALID_CREDENTIALS, message: 'Invalid old password' });
    }

    const isReusedPassword = await bcrypt.compare(input.newPassword, user.passwordHash);
    if (isReusedPassword) {
      throw new BadRequestException({ code: 'AUTH_PASSWORD_REUSED', message: 'New password must be different from the current password' });
    }

    const newPasswordHash = await bcrypt.hash(input.newPassword, 12);
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: newPasswordHash,
        mustChangePassword: false,
        refreshTokenHash: null,
      },
    });

    await this.audit.log({
      action: 'CHANGE_PASSWORD',
      entity: 'User',
      entityId: userId,
      module: 'Auth',
      tenantId: user.tenantId,
      userId: userId
    });

    return { success: true };
  }

  private async resolveTeamAvatarUrl(tenantId: string, userId: string) {
    const profile = await this.prisma.appSetting.findUnique({
      where: {
        tenantId_scope_ownerId_key: {
          tenantId,
          scope: SettingScope.USER,
          ownerId: userId,
          key: 'profile',
        },
      },
      select: {
        value: true,
      },
    });

    return extractAvatarUrl(profile?.value);
  }

  private async getTeamMemberSnapshot(tenantId: string, userId: string) {
    const [user, avatarUrl] = await Promise.all([
      this.prisma.user.findFirst({
        where: {
          tenantId,
          id: userId,
          deletedAt: null,
        },
        select: {
          id: true,
          email: true,
          fullName: true,
          status: true,
          mustChangePassword: true,
          lastLoginAt: true,
          lastLoginIp: true,
          updatedAt: true,
          roles: {
            select: {
              role: {
                select: {
                  code: true,
                  name: true,
                },
              },
            },
          },
        },
      }),
      this.resolveTeamAvatarUrl(tenantId, userId),
    ]);

    if (!user) return null;

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      status: user.status,
      mustChangePassword: user.mustChangePassword,
      roles: user.roles.map((assignment) => assignment.role.code),
      lastLoginAt: user.lastLoginAt,
      lastLoginIp: user.lastLoginIp,
      updatedAt: user.updatedAt,
      avatarUrl,
    };
  }
}

function extractAvatarUrl(value: unknown) {
  if (!isRecord(value)) return null;
  return typeof value.avatarUrl === 'string' && value.avatarUrl.trim() ? value.avatarUrl.trim() : null;
}

function normalizeAvatarUrl(value: unknown) {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized || null;
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
