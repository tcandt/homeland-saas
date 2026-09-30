import { describe, expect, it, vi } from 'vitest';
import { PaymentsController } from './payments.controller';

describe('PaymentsController SePay admin config capabilities', () => {
  it('allows the protected Homeland administrator to edit integration secrets', async () => {
    const config = { rooms: [], routes: [], bankAccounts: [], status: {} };
    const paymentsService = {
      getSePayAdminConfig: vi.fn().mockResolvedValue(config),
    };
    const controller = new PaymentsController(paymentsService as any);

    await expect(
      controller.getSePayAdminConfig('tenant-1', ' Admin@HomeLand.vn '),
    ).resolves.toEqual({
      success: true,
      config,
      capabilities: { canEditIntegrationSecrets: true },
    });
  });

  it('keeps integration secrets locked for other accounts', async () => {
    const paymentsService = {
      getSePayAdminConfig: vi.fn().mockResolvedValue({ rooms: [], routes: [] }),
    };
    const controller = new PaymentsController(paymentsService as any);

    const result = await controller.getSePayAdminConfig('tenant-1', 'manager@homeland.vn');

    expect(result.capabilities.canEditIntegrationSecrets).toBe(false);
  });
});
