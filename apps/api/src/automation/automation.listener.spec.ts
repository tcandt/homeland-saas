import { describe, expect, it, vi } from 'vitest';
import { AutomationListener } from './automation.listener';

describe('AutomationListener payment delivery', () => {
  it('waits for payment workflows before the event promise resolves', async () => {
    let releaseWorkflow!: () => void;
    const workflowFinished = new Promise<void>((resolve) => {
      releaseWorkflow = resolve;
    });
    const automationService = {
      getWorkflows: vi.fn().mockResolvedValue([
        { name: 'invoice.paid.workflow', triggerEvent: 'invoice.paid' },
      ]),
      triggerWorkflow: vi.fn().mockReturnValue(workflowFinished),
    };
    const listener = new AutomationListener(automationService as any);

    let settled = false;
    const handled = listener.handleInvoicePaid({ tenantId: 'tenant-1', sourceId: 'invoice-1' } as any).then(() => {
      settled = true;
    });

    await Promise.resolve();
    expect(automationService.triggerWorkflow).toHaveBeenCalledWith(
      'invoice.paid.workflow',
      'invoice.paid',
      expect.objectContaining({ tenantId: 'tenant-1', sourceId: 'invoice-1' }),
    );
    expect(settled).toBe(false);

    releaseWorkflow();
    await handled;
    expect(settled).toBe(true);
  });
});
