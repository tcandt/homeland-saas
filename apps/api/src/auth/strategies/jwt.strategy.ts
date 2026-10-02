import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClsService } from 'nestjs-cls';
import { SettingScope } from '@prisma/client';
import { PrismaService } from '../../prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private cls: ClsService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('auth.jwtSecret'),
    });
  }

  async validate(payload: any) {
    if (payload?.tokenType !== 'access') {
      throw new UnauthorizedException('Access token is missing or invalid');
    }

    const record = await this.prisma.appSetting.findUnique({
      where: { tenantId_scope_ownerId_key: {
        tenantId: payload.tenantId, scope: SettingScope.USER, ownerId: payload.sub, key: 'auth-security',
      } },
      select: { value: true },
    });
    const value = record?.value && typeof record.value === 'object' && !Array.isArray(record.value)
      ? record.value as Record<string, unknown> : {};
    const currentVersion = Number.isSafeInteger(value.sessionVersion) ? Number(value.sessionVersion) : 0;
    const idleTimeoutMinutes = Number.isSafeInteger(value.idleTimeoutMinutes)
      && Number(value.idleTimeoutMinutes) >= 5 && Number(value.idleTimeoutMinutes) <= 10080
      ? Number(value.idleTimeoutMinutes) : 1440;
    const lastActivityAt = typeof value.lastActivityAt === 'string' ? Date.parse(value.lastActivityAt) : NaN;
    if (Number.isFinite(lastActivityAt) && Date.now() - lastActivityAt >= idleTimeoutMinutes * 60 * 1000) {
      throw new UnauthorizedException('Session expired due to inactivity');
    }
    if (Number(payload.sessionVersion || 0) !== currentVersion) {
      throw new UnauthorizedException('This session has been revoked');
    }
    this.cls.set('tenantId', payload.tenantId);
    this.cls.set('userId', payload.sub);

    // This payload will be injected into request.user
    return {
      id: payload.sub,
      tenantId: payload.tenantId,
      email: payload.email,
      roles: payload.roles,
      permissions: payload.permissions,
      mustChangePassword: Boolean(payload.mustChangePassword),
    };
  }
}
