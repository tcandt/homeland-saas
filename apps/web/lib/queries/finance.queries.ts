import { useQuery } from '@tanstack/react-query';
import { financeAdapter } from '../adapters/finance.adapter';

export const financeKeys = {
  all: ['finance'] as const,
  ledger: (params: any) => [...financeKeys.all, 'ledger', params] as const,
  cashFlow: (params: any) => [...financeKeys.all, 'cashFlow', params] as const,
  profitLoss: (params: any) => [...financeKeys.all, 'profitLoss', params] as const,
  building: (code: string, params: any) => [...financeKeys.all, 'building', code, params] as const,
};

export function useLedgerQuery(params?: Record<string, any>) {
  return useQuery({
    queryKey: financeKeys.ledger(params),
    queryFn: () => financeAdapter.getLedger(params),
  });
}

export function useCashFlowQuery(params?: Record<string, any>) {
  return useQuery({
    queryKey: financeKeys.cashFlow(params),
    queryFn: () => financeAdapter.getCashFlow(params),
  });
}

export function useProfitLossQuery(params?: Record<string, any>) {
  return useQuery({
    queryKey: financeKeys.profitLoss(params),
    queryFn: () => financeAdapter.getProfitLoss(params),
  });
}

export function useBuildingFinanceQuery(code: string, params?: Record<string, any>) {
  return useQuery({
    queryKey: financeKeys.building(code, params),
    queryFn: () => financeAdapter.getBuildingFinance(code, params),
    enabled: !!code,
  });
}
