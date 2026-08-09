import { apiClient } from './client';

export const financeApi = {
  getLedger: async (params?: Record<string, any>) => {
    return await apiClient.get<any>('/finance/ledger', { params });
  },
  getCashFlow: async (params?: Record<string, any>) => {
    return await apiClient.get<any>('/finance/cashflow', { params });
  },
  getProfitLoss: async (params?: Record<string, any>) => {
    return await apiClient.get<any>('/finance/profit-loss', { params });
  },
  getBuildingFinance: async (code: string, params?: Record<string, any>) => {
    return await apiClient.get<any>(`/finance/building/${code}`, { params });
  },
  getBuildingProfitSummary: async (params?: Record<string, any>) => {
    return await apiClient.get<any>('/finance/buildings/profit-summary', { params });
  },
  getOwners: async () => {
    return await apiClient.get<any>('/finance/owners');
  },
  getOwnerProfitSummary: async () => {
    return await apiClient.get<any>('/finance/owners/profit-summary');
  },
  getOwnerProfitDetail: async (id: string, params?: Record<string, any>) => {
    return await apiClient.get<any>(`/finance/owners/${id}/profit-detail`, { params });
  },
  getBankCashFlow: async (params?: Record<string, any>) => {
    return await apiClient.get<any>('/finance/banks/cashflow', { params });
  },
  getExpenses: async (params?: Record<string, any>) => {
    return await apiClient.get<any>('/finance/expenses', { params });
  },
  createExpense: async (payload: Record<string, any>) => {
    return await apiClient.post<any>('/finance/expenses', payload);
  },
  approveExpense: async (id: string, payload?: { markPaid?: boolean }) => {
    return await apiClient.patch<any>(`/finance/expenses/${id}/approve`, payload || {});
  },
  cancelExpense: async (id: string, payload?: { reason?: string }) => {
    return await apiClient.patch<any>(`/finance/expenses/${id}/cancel`, payload || {});
  },
  updateExpenseSettlement: async (id: string, payload: { settlementStatus: string }) => {
    return await apiClient.patch<any>(`/finance/expenses/${id}/settlement`, payload);
  },
  exportReport: async () => {
    const response = await apiClient.get('/finance/export', { responseType: 'blob' } as any);
    return response;
  }
};
