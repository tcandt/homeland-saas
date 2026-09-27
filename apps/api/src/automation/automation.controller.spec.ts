import { describe, expect, it, vi } from 'vitest';
import { AutomationController } from './automation.controller';

function createSubject() {
  const automationService = {
    runWorkflow: vi.fn(),
    runRule: vi.fn(),
  };
  const cls = {
    get: vi.fn().mockReturnValue('user-a'),
  };
  const prisma = {
    user: {
      findUnique: vi.fn().mockResolvedValue({ id: 'user-a', tenantId: 'tenant-a' }),
    },
  };

  return {
    automationService,
    controller: new AutomationController(automationService as any, cls as any, prisma as any),
  };
}

describe('AutomationController manual runs', () => {
  it('derives the workflow tenant from the authenticated user and preserves the execution status response', async () => {
    const { controller, automationService } = createSubject();
    automationService.runWorkflow.mockResolvedValue({ executionId: 'workflow-execution-1', status: 'RUNNING' });

    await expect(controller.runWorkflow('invoice.paid.workflow', {
      tenantId: 'tenant-b',
      invoiceId: 'invoice-1',
    })).resolves.toEqual({ executionId: 'workflow-execution-1', status: 'RUNNING' });

    expect(automationService.runWorkflow).toHaveBeenCalledWith('invoice.paid.workflow', 'tenant-a', {
      tenantId: 'tenant-b',
      invoiceId: 'invoice-1',
    });
  });

  it('derives the rule tenant from the authenticated user', async () => {
    const { controller, automationService } = createSubject();
    automationService.runRule.mockResolvedValue({ executionId: 'rule-execution-1', status: 'SUCCESS' });

    await expect(controller.runRule('invoice.overdue.7_days', {
      tenantId: 'tenant-b',
      invoiceId: 'invoice-1',
    })).resolves.toEqual({ executionId: 'rule-execution-1', status: 'SUCCESS' });

    expect(automationService.runRule).toHaveBeenCalledWith('invoice.overdue.7_days', 'tenant-a', {
      tenantId: 'tenant-b',
      invoiceId: 'invoice-1',
    });
  });
});
