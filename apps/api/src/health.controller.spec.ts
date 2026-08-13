import { ServiceUnavailableException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { HealthController } from './health.controller';

describe('HealthController readiness', () => {
  it('returns READY when the database probe succeeds', async () => {
    const prisma = { $queryRaw: vi.fn().mockResolvedValue([{ ok: 1 }]) };
    const controller = new HealthController(prisma as any);

    const result = await controller.checkReadiness();

    expect(result.status).toBe('READY');
    expect(result.checks.database.status).toBe('UP');
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
