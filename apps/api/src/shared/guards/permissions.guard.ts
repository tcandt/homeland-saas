import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';
import { ErrorCodes } from '../exceptions/error-codes';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  private readonly legacyPermissionAliases: Record<string, string[]> = {
    'meter.read': ['setting.read', 'building.read', 'room.read'],
    'meter.update': ['setting.update'],
    'meter.sync': ['meter.update', 'setting.update'],
    'audit.read': ['setting.read'],
    'finance.approve': ['finance.update'],
    'finance.pay': ['finance.update'],
    'finance.settle': ['finance.update'],
    'finance.export': ['finance.read'],
    'finance.attachment.read': ['finance.read'],
  };

  private hasPermission(userPermissions: string[], permission: string) {
    if (userPermissions.includes(permission)) return true;
    return (this.legacyPermissionAliases[permission] || []).some((alias) => userPermissions.includes(alias));
  }

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    if (!user || !user.permissions) {
      throw new ForbiddenException({ code: ErrorCodes.PERMISSION_DENIED, message: 'You do not have permission to perform this action' });
    }

    if (Array.isArray(user.roles) && user.roles.includes('ADMIN')) {
      return true;
    }

    const hasPermission = requiredPermissions.every(permission => this.hasPermission(user.permissions, permission));
    if (!hasPermission) {
      throw new ForbiddenException({ code: ErrorCodes.PERMISSION_DENIED, message: 'You do not have permission to perform this action' });
    }

    return true;
  }
}
