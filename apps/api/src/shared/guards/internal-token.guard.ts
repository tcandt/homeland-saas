import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { timingSafeEqual } from 'crypto';

function safeEquals(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

@Injectable()
export class InternalTokenGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const expected = String(process.env.INTERNAL_API_TOKEN || process.env.METRICS_TOKEN || '').trim();

    if (!expected) {
      throw new ForbiddenException('Internal endpoint token is not configured');
    }

    const headerToken = String(request.headers?.['x-internal-token'] || '').trim();
    const authHeader = String(request.headers?.authorization || '').trim();
    const bearerToken = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : '';
    const provided = headerToken || bearerToken;

    if (!provided || !safeEquals(provided, expected)) {
      throw new UnauthorizedException('Internal endpoint token is missing or invalid');
    }

    return true;
  }
}
