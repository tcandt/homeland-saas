import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma.service';
import { AuditService } from '../shared/audit/audit.service';
import { LoginInput, ChangePasswordInput, RegisterInput, ForgotPasswordInput, ResetPasswordInput, CreateTeamMemberInput } from '@homeland/shared';
import { ErrorCodes } from '../shared/exceptions/error-codes';
import * as crypto from 'crypto';
import { MailProvider } from './services/mail.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly audit: AuditService,
    private readonly mailProvider: MailProvider,
  ) {}

  async login(input: LoginInput, ip?: string, userAgent?: string) {
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
      await this.audit.log({ action: 'LOGIN_FAILED', entity: 'User', module: 'Auth', before: { emailOrPhone: input.emailOrPhone }, ip, userAgent });
      throw new UnauthorizedException({ code: ErrorCodes.AUTH_INVALID_CREDENTIALS, message: 'Invalid credentials' });
    }

    if (user.status !== 'ACTIVE') {
      await this.audit.log({ action: 'LOGIN_FAILED', entity: 'User', entityId: user.id, module: 'Auth', before: { reason: 'Account disabled' }, tenantId: user.tenantId, ip, userAgent });
      throw new UnauthorizedException({ code: 'AUTH_ACCOUNT_DISABLED', message: 'Account is disabled' });
    }

    const isMatch = await bcrypt.compare(input.password, user.passwordHash);
    if (!isMatch) {
      await this.audit.log({ action: 'LOGIN_FAILED', entity: 'User', entityId: user.id, module: 'Auth', before: { reason: 'Wrong password' }, tenantId: user.tenantId, ip, userAgent });
      throw new UnauthorizedException({ code: ErrorCodes.AUTH_INVALID_CREDENTIALS, message: 'Invalid credentials' });
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

  async logout(userId: string) {
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

    const passwordHash = await bcrypt.hash(input.temporaryPassword, 12);
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

  private async ensureTeamProvisioningAllowed(tenantId: string, actorUserId: string, email: string, role: string) {
    const actor = await this.prisma.user.findFirst({
      where: { id: actorUserId, tenantId, deletedAt: null },
      select: { email: true },
    });
    const actorEmail = actor?.email?.toLowerCase() ?? '';
    const ownerEmails = new Set(['admina@homeland.local', 'adminb@homeland.local']);
    if (ownerEmails.has(actorEmail)) return;

    const isBootstrapAdmin = actorEmail === 'admin@homeland.local';
    const isExpectedOwnerAccount = ownerEmails.has(email) && role === 'ADMIN';
    if (isBootstrapAdmin && isExpectedOwnerAccount) {
      const existingOwnerAccounts = await this.prisma.user.count({
        where: {
          tenantId,
          deletedAt: null,
          email: { in: Array.from(ownerEmails), mode: 'insensitive' },
        },
      });
      if (existingOwnerAccounts < ownerEmails.size) return;
    }

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
      message: 'Only owner administrators may provision team accounts',
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
}
