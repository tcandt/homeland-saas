import { describe, expect, it } from 'vitest';
import { getOperationsSalesInsights } from './operations-sales-insights';

describe('getOperationsSalesInsights', () => {
  it('does not invent insight values when sales data is unavailable', () => {
    expect(getOperationsSalesInsights(undefined, { isLoading: true })).toEqual({ kind: 'loading' });
    expect(getOperationsSalesInsights(undefined, { isError: true })).toEqual({ kind: 'error' });
    expect(getOperationsSalesInsights({
      total: 0,
      activeCount: 0,
      staleCount: 0,
      stageCounts: {},
      newestLeads: [],
    })).toEqual({ kind: 'unavailable' });
  });

  it('maps only tenant summary metrics that have an API source', () => {
    expect(getOperationsSalesInsights({
      total: 12,
      activeCount: 5,
      staleCount: 2,
      stageCounts: { PROPOSAL: 3, WON: 4 },
      newestLeads: [],
    })).toEqual({
      kind: 'ready',
      metrics: { stale: 2, active: 5, proposal: 3, won: 4, total: 12 },
    });
  });
});
