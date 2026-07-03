import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma.service';
import { AuditService } from '../shared/audit/audit.service';
import { LoginInput, ChangePasswordInput } from '@homeland/shared';
import { ErrorCodes } from '../shared/exceptions/error-codes';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly audit: AuditService,
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

    if (!user.isActive) {
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

    // TODO: if schema supports it, save refreshTokenHash and lastLoginAt
    // await this.prisma.user.update({
    //   where: { id: user.id },
    //   data: { lastLoginAt: new Date(), refreshTokenHash: await bcrypt.hash(refreshToken, 10) }
    // });

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

  async logout(userId: string) {
    // TODO: if schema supports it, nullify the refreshTokenHash
    // await this.prisma.user.update({ where: { id: userId }, data: { refreshTokenHash: null } });

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

      if (!user || !user.isActive) {
        throw new UnauthorizedException({ code: ErrorCodes.AUTH_TOKEN_INVALID, message: 'Invalid token or user inactive' });
      }

      // TODO: if schema supports it, verify the refreshTokenHash

      const roles = user.roles.map(ur => ur.role.code);
      const permissions = Array.from(new Set(user.roles.flatMap(ur => ur.role.permissions.map(rp => rp.permission.key))));

      const payload = { sub: user.id, tenantId: user.tenantId, email: user.email, roles, permissions };

      const newAccessToken = this.jwtService.sign(payload, { expiresIn: this.configService.get('auth.jwtExpiresIn') });
      const newRefreshToken = this.jwtService.sign(payload, { expiresIn: this.configService.get('auth.jwtRefreshExpiresIn') });

      // TODO: if schema supports it, save the newRefreshTokenHash

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      };
    } catch (e) {
      throw new UnauthorizedException({ code: ErrorCodes.AUTH_TOKEN_EXPIRED, message: 'Refresh token expired or invalid' });
    }
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
