import { describe, expect, it } from 'vitest';
import { manualRunPresentation, parseManualExecution } from './manual-run-status';

describe('manual automation run status', () => {
  it('keeps a 2xx non-terminal execution in progress instead of calling it successful', () => {
    const execution = parseManualExecution({
      data: { executionId: 'workflow-execution-1', status: 'RUNNING' },
    });

    expect(manualRunPresentation('Workflow', 'invoice.paid.workflow', execution)).toEqual({
      message: 'Workflow invoice.paid.workflow is in progress. Execution: workflow-execution-1.',
      state: 'in-progress',
      shouldPoll: true,
    });
  });

  it('only presents SUCCESS as a successful manual run and FAILED as an error', () => {
    expect(manualRunPresentation('Rule', 'invoice.overdue.7_days', {
      executionId: 'rule-execution-1',
      status: 'SUCCESS',
    })).toMatchObject({ state: 'success', shouldPoll: false });

    expect(manualRunPresentation('Rule', 'invoice.overdue.7_days', {
      executionId: 'rule-execution-2',
      status: 'FAILED',
      error: 'Delivery unavailable',
    })).toEqual({
      message: 'Rule invoice.overdue.7_days failed: Delivery unavailable',
      state: 'error',
      shouldPoll: false,
    });
  });
});
