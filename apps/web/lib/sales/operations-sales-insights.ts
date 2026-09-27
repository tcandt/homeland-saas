import type { SalesSummary } from '../api/sales.api';

export type SalesInsightsState =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'unavailable' }
  | {
      kind: 'ready';
      metrics: {
        stale: number;
        active: number;
        proposal: number;
        won: number;
        total: number;
      };
    };

export function getOperationsSalesInsights(
  summary: SalesSummary | undefined,
  state: { isLoading?: boolean; isError?: boolean } = {},
): SalesInsightsState {
  if (state.isLoading) return { kind: 'loading' };
  if (state.isError) return { kind: 'error' };
  if (!summary || summary.total === 0) return { kind: 'unavailable' };

  return {
    kind: 'ready',
    metrics: {
      stale: summary.staleCount,
      active: summary.activeCount,
      proposal: summary.stageCounts.PROPOSAL || 0,
      won: summary.stageCounts.WON || 0,
      total: summary.total,
    },
  };
}
