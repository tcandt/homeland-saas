import { useQuery } from '@tanstack/react-query';
import { financeAdapter } from '../adapters/finance.adapter';

export const financeKeys = {
  all: ['finance'] as const,
  ledger: (params: any) => [...financeKeys.all, 'ledger', params] as const,
  cashFlow: (params: any) => [...financeKeys.all, 'cashFlow', params] as const,
  profitLoss: (params: any) => [...financeKeys.all, 'profitLoss', params] as const,
  building: (code: string, params: any) => [...financeKeys.all, 'building', code, params] as const,
  buildingProfitSummary: (params: any) => [...financeKeys.all, 'buildingProfitSummary', params] as const,
  ownerProfitSummary: () => [...financeKeys.all, 'ownerProfitSummary'] as const,
  ownerProfitDetail: (id: string, params: any) => [...financeKeys.all, 'ownerProfitDetail', id, params] as const,
  bankCashFlow: (params: any) => [...financeKeys.all, 'bankCashFlow', params] as const,
  sePayReconciliation: (params: any) => [...financeKeys.all, 'sePayReconciliation', params] as const,
  expenses: (params: any) => [...financeKeys.all, 'expenses', params] as const,
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

export function useBuildingProfitSummaryQuery(params?: Record<string, any>) {
  return useQuery({
    queryKey: financeKeys.buildingProfitSummary(params),
    queryFn: () => financeAdapter.getBuildingProfitSummary(params),
  });
}

export function useOwnerProfitSummaryQuery() {
  return useQuery({
    queryKey: financeKeys.ownerProfitSummary(),
    queryFn: () => financeAdapter.getOwnerProfitSummary(),
  });
}

export function useOwnerProfitDetailQuery(id: string, params?: Record<string, any>) {
  return useQuery({
    queryKey: financeKeys.ownerProfitDetail(id, params),
    queryFn: () => financeAdapter.getOwnerProfitDetail(id, params),
    enabled: !!id,
  });
}

export function useBankCashFlowQuery(params?: Record<string, any>) {
  return useQuery({
    queryKey: financeKeys.bankCashFlow(params),
    queryFn: () => financeAdapter.getBankCashFlow(params),
  });
}

export function useSePayReconciliationQuery(params?: Record<string, any>) {
  return useQuery({
    queryKey: financeKeys.sePayReconciliation(params),
    queryFn: () => financeAdapter.getSePayReconciliation(params),
  });
}

export function useExpensesQuery(params?: Record<string, any>) {
  return useQuery({
    queryKey: financeKeys.expenses(params),
    queryFn: () => financeAdapter.getExpenses(params),
  });
}
