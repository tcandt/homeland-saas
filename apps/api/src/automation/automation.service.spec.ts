import { describe, expect, it, vi } from 'vitest';
import { AutomationService } from './automation.service';

function createSubject() {
  const prisma = {
    workflowExecution: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    ruleExecution: {
      findFirst: vi.fn(),
    },
  };
  const workflowEngine = {
    executeWorkflow: vi.fn(),
    getWorkflows: vi.fn(),
  };
  const ruleEngine = {
    executeRule: vi.fn(),
    getRules: vi.fn(),
  };

  return {
    prisma,
    workflowEngine,
    ruleEngine,
    service: new AutomationService(prisma as any, workflowEngine as any, ruleEngine as any),
  };
}

describe('AutomationService manual execution scope', () => {
  it('overwrites a spoofed workflow tenant and returns the execution id and current status', async () => {
    const { service, workflowEngine } = createSubject();
    workflowEngine.executeWorkflow.mockResolvedValue({ id: 'workflow-execution-1', status: 'RUNNING' });

    await expect(service.runWorkflow('invoice.paid.workflow', 'tenant-a', {
      tenantId: 'tenant-b',
      invoiceId: 'invoice-1',
    })).resolves.toEqual({ executionId: 'workflow-execution-1', status: 'RUNNING' });

    expect(workflowEngine.executeWorkflow).toHaveBeenCalledWith('invoice.paid.workflow', 'manual_run', {
      tenantId: 'tenant-a',
      invoiceId: 'invoice-1',
    });
  });

  it('overwrites a spoofed rule tenant and returns the execution id and current status', async () => {
    const { service, ruleEngine } = createSubject();
    ruleEngine.executeRule.mockResolvedValue({ id: 'rule-execution-1', status: 'FAILED', error: 'Delivery unavailable' });

    await expect(service.runRule('invoice.overdue.7_days', 'tenant-a', {
      tenantId: 'tenant-b',
      invoiceId: 'invoice-1',
    })).resolves.toEqual({
      executionId: 'rule-execution-1',
      status: 'FAILED',
      error: 'Delivery unavailable',
    });

    expect(ruleEngine.executeRule).toHaveBeenCalledWith('invoice.overdue.7_days', {
      tenantId: 'tenant-a',
      invoiceId: 'invoice-1',
    });
  });

  it('tenant-scopes execution lists and makes foreign execution ids indistinguishable from missing ids', async () => {
    const { service, prisma } = createSubject();
    prisma.workflowExecution.findMany.mockResolvedValue([]);
    prisma.workflowExecution.findFirst.mockResolvedValue(null);
    prisma.ruleExecution.findFirst.mockResolvedValue(null);

    await expect(service.getExecutions('tenant-a')).resolves.toEqual([]);
    await expect(service.getExecutionById('tenant-a', 'foreign-execution')).rejects.toThrow('Execution not found');
    await expect(service.getExecutionById('tenant-a', 'missing-execution')).rejects.toThrow('Execution not found');

    expect(prisma.workflowExecution.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { tenantId: 'tenant-a' },
    }));
    expect(prisma.workflowExecution.findFirst).toHaveBeenCalledWith({
      where: { id: 'foreign-execution', tenantId: 'tenant-a' },
      include: { steps: true },
    });
    expect(prisma.ruleExecution.findFirst).toHaveBeenCalledWith({
      where: { id: 'foreign-execution', tenantId: 'tenant-a' },
    });
  });
});
