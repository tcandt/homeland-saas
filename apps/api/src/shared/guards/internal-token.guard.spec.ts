import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { afterEach, describe, expect, it } from 'vitest';
import { InternalTokenGuard } from './internal-token.guard';

function contextWithHeaders(headers: Record<string, string>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers }),
    }),
  } as any;
}

describe('InternalTokenGuard', () => {
  const originalInternalToken = process.env.INTERNAL_API_TOKEN;
  const originalMetricsToken = process.env.METRICS_TOKEN;

  afterEach(() => {
    process.env.INTERNAL_API_TOKEN = originalInternalToken;
    process.env.METRICS_TOKEN = originalMetricsToken;
  });

  it('rejects internal endpoints when no token is configured', () => {
    delete process.env.INTERNAL_API_TOKEN;
    delete process.env.METRICS_TOKEN;

    expect(() => new InternalTokenGuard().canActivate(contextWithHeaders({}))).toThrow(ForbiddenException);
  });

  it('accepts x-internal-token when it matches INTERNAL_API_TOKEN', () => {
    process.env.INTERNAL_API_TOKEN = 'internal-token-1234567890';

    expect(new InternalTokenGuard().canActivate(contextWithHeaders({
      'x-internal-token': 'internal-token-1234567890',
    }))).toBe(true);
  });

  it('accepts bearer token and rejects mismatches', () => {
    process.env.INTERNAL_API_TOKEN = 'internal-token-1234567890';
    const guard = new InternalTokenGuard();

    expect(guard.canActivate(contextWithHeaders({
      authorization: 'Bearer internal-token-1234567890',
    }))).toBe(true);
    expect(() => guard.canActivate(contextWithHeaders({
      authorization: 'Bearer wrong-token',
    }))).toThrow(UnauthorizedException);
  });
});
