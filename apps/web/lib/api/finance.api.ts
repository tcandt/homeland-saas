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
  exportReport: async () => {
    const response = await apiClient.get('/finance/export', { responseType: 'blob' } as any);
    return response;
  }
};
