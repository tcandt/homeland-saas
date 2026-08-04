import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma.service';
import { AuditService } from '../shared/audit/audit.service';
import { LoginInput, ChangePasswordInput, RegisterInput, ForgotPasswordInput, ResetPasswordInput } from '@homeland/shared';
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
          { email: input.emailOrPhone },
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
      await this.audit.log({ action: 'LOGIN_FAILED', entity: 'User', module: 'Auth', before: { emailOrPhone: input.emailOrPhone }});
      throw new UnauthorizedException({ code: ErrorCodes.AUTH_INVALID_CREDENTIALS, message: 'Invalid credentials' });
    }

    if (user.status !== 'ACTIVE') {
      await this.audit.log({ action: 'LOGIN_FAILED', entity: 'User', entityId: user.id, module: 'Auth', before: { reason: 'Account disabled' }});
      throw new UnauthorizedException({ code: 'AUTH_ACCOUNT_DISABLED', message: 'Account is disabled' });
    }

    const isMatch = await bcrypt.compare(input.password, user.passwordHash);
    if (!isMatch) {
      await this.audit.log({ action: 'LOGIN_FAILED', entity: 'User', entityId: user.id, module: 'Auth', before: { reason: 'Wrong password' }});
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

    const payload = { sub: user.id, tenantId: user.tenantId, email: user.email, roles, permissions };
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

      const payload = { sub: user.id, tenantId: user.tenantId, email: user.email, roles, permissions };

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
        passwordResetExpires: null
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
    };
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
    };
  }

  async changePassword(userId: string, input: ChangePasswordInput) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();

    const isMatch = await bcrypt.compare(input.oldPassword, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException({ code: ErrorCodes.AUTH_INVALID_CREDENTIALS, message: 'Invalid old password' });
    }

    const newPasswordHash = await bcrypt.hash(input.newPassword, 12);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash },
    });

    await this.audit.log({
      action: 'CHANGE_PASSWORD',
      entity: 'User',
      entityId: userId,
      module: 'Auth',
      userId: userId
    });

    return { success: true };
  }
}
