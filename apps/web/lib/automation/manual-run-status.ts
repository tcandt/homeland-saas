export type ManualExecution = {
  executionId: string;
  status: string;
  error?: string | null;
};

export type ManualRunPresentation = {
  message: string;
  state: 'success' | 'error' | 'in-progress';
  shouldPoll: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function parseManualExecution(response: unknown): ManualExecution {
  const body = isRecord(response) && isRecord(response.data) ? response.data : response;
  const executionId = isRecord(body) && typeof body.executionId === 'string'
    ? body.executionId
    : isRecord(body) && typeof body.id === 'string'
      ? body.id
      : null;
  if (!isRecord(body) || !executionId || typeof body.status !== 'string') {
    throw new Error('The server did not provide an execution status.');
  }

  return {
    executionId,
    status: body.status,
    error: typeof body.error === 'string' ? body.error : null,
  };
}

export function manualRunPresentation(
  type: 'Workflow' | 'Rule',
  name: string,
  execution: ManualExecution,
): ManualRunPresentation {
  if (execution.status === 'SUCCESS') {
    return {
      message: `${type} ${name} completed successfully.`,
      state: 'success',
      shouldPoll: false,
    };
  }

  if (execution.status === 'FAILED') {
    return {
      message: `${type} ${name} failed${execution.error ? `: ${execution.error}` : '.'}`,
      state: 'error',
      shouldPoll: false,
    };
  }

  return {
    message: `${type} ${name} is in progress. Execution: ${execution.executionId}.`,
    state: 'in-progress',
    shouldPoll: true,
  };
}
