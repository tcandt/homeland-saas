import { Injectable, CanActivate, ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../../shared/decorators/public.decorator';
import { ClsService } from 'nestjs-cls';
import { ALLOW_PASSWORD_CHANGE_REQUIRED_KEY } from '../../shared/decorators/allow-password-change-required.decorator';
import { ErrorCodes } from '../../shared/exceptions/error-codes';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') implements CanActivate {
  constructor(
    private reflector: Reflector,
    private readonly cls: ClsService
  ) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    
    if (isPublic) {
      return true;
    }
    
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    if (err || !user) {
      throw err || new UnauthorizedException('Authentication token is missing or invalid');
    }

    const allowsPendingPasswordChange = this.reflector.getAllAndOverride<boolean>(
      ALLOW_PASSWORD_CHANGE_REQUIRED_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (user.mustChangePassword && !allowsPendingPasswordChange) {
      throw new ForbiddenException({
        code: ErrorCodes.AUTH_PASSWORD_CHANGE_REQUIRED,
        message: 'Password change is required before accessing this resource',
      });
    }
    
    // Enrich CLS Context
    if (this.cls.isActive()) {
      this.cls.set('userId', user.id);
      this.cls.set('tenantId', user.tenantId);
      this.cls.set('roles', user.roles);
    }
    
    return user;
  }
}
