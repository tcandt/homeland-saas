import { ServiceUnavailableException } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HealthController } from './health.controller';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { InternalTokenGuard } from './shared/guards/internal-token.guard';

describe('HealthController readiness', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('distinguishes staging deployment from production Node runtime without changing the legacy field', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('DEPLOY_ENV', 'staging');
    vi.stubEnv('APP_ENV', 'other');
    const controller = new HealthController({} as any);
    expect(controller.getBuildInfo()).toMatchObject({
      environment: 'production',
      deploymentEnvironment: 'staging',
    });
  });

  it('falls back to the runtime environment when deployment labels are absent', () => {
    vi.stubEnv('DEPLOY_ENV', '');
    vi.stubEnv('APP_ENV', '');
    vi.stubEnv('ENVIRONMENT', '');
    vi.stubEnv('NODE_ENV', 'development');
    expect(new HealthController({} as any).getBuildInfo().deploymentEnvironment).toBe('development');
  });

  it('protects build metadata with the internal token guard', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, HealthController.prototype.getBuildInfo)).toContain(InternalTokenGuard);
  });
  it('returns READY when the database probe succeeds', async () => {
    const prisma = {
      $queryRaw: vi.fn()
        .mockResolvedValueOnce([{ ok: 1 }])
        .mockResolvedValueOnce([{ compatible: true }]),
    };
    const controller = new HealthController(prisma as any);

    const result = await controller.checkReadiness();

    expect(result.status).toBe('READY');
    expect(result.checks.database.status).toBe('UP');
    expect(result.checks.schema.status).toBe('UP');
    const schemaSql = prisma.$queryRaw.mock.calls[1][0].join('');
    expect(schemaSql).toContain("migration_name = '20261014130000_retire_sales_role_and_leads'");
    expect(schemaSql).toContain("migration_name = '20261017100000_booking_hold_cancel_adjustment_scope'");
    expect(schemaSql).toContain('WHERE finished_at IS NULL AND rolled_back_at IS NULL');
    expect(schemaSql).toContain(`to_regclass('public."SalesLead"') IS NULL`);
    expect(schemaSql).toContain("= ARRAY['ADMIN', 'FINANCE', 'MANAGER']::text[]");
  });

  it('keeps readiness closed for a 35-migration release missing the booking cancellation scope migration', async () => {
    const prisma = {
      $queryRaw: vi.fn()
        .mockResolvedValueOnce([{ ok: 1 }])
        .mockResolvedValueOnce([{ compatible: false }]),
    };
    try {
      await new HealthController(prisma as any).checkReadiness();
      expect.fail('An outdated release schema must not serve traffic');
    } catch (error) {
      expect(error).toBeInstanceOf(ServiceUnavailableException);
      expect((error as ServiceUnavailableException).getResponse()).toMatchObject({
        code: 'SERVICE_NOT_READY',
        details: { checks: { database: { status: 'UP' }, schema: { status: 'DOWN' } } },
      });
    }
  });

  it('throws 503 when the database is reachable but has an incompatible schema', async () => {
    const prisma = {
      $queryRaw: vi.fn()
        .mockResolvedValueOnce([{ ok: 1 }])
        .mockResolvedValueOnce([{ compatible: false }]),
    };
    const controller = new HealthController(prisma as any);

    await expect(controller.checkReadiness()).rejects.toBeInstanceOf(ServiceUnavailableException);
    try {
      await controller.checkReadiness();
    } catch (error) {
      const exception = error as ServiceUnavailableException;
      expect(exception.getStatus()).toBe(503);
      expect(exception.getResponse()).toMatchObject({
        code: 'SERVICE_NOT_READY',
        details: {
          status: 'NOT_READY',
          checks: {
            database: { status: 'UP' },
            schema: { status: 'DOWN' },
          },
        },
      });
    }
  });

  it('throws 503 with sanitized dependency details when the database probe fails', async () => {
    const prisma = { $queryRaw: vi.fn().mockRejectedValue(new Error('sensitive-connectivity-detail')) };
    const controller = new HealthController(prisma as any);

    await expect(controller.checkReadiness()).rejects.toBeInstanceOf(ServiceUnavailableException);
    try {
      await controller.checkReadiness();
    } catch (error) {
      const exception = error as ServiceUnavailableException;
      expect(exception.getStatus()).toBe(503);
      expect(exception.getResponse()).toMatchObject({
        code: 'SERVICE_NOT_READY',
        details: {
          status: 'NOT_READY',
          checks: { database: { status: 'DOWN' } },
        },
      });
      expect(JSON.stringify(exception.getResponse())).not.toContain('sensitive-connectivity-detail');
    }
  });
});
