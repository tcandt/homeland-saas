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
  getBankTransactions: async (params?: Record<string, any>) => {
    return await apiClient.get<any>('/finance/banks/transactions', { params });
  },
  createBankAccount: async (payload: { ownerId: string; bankName: string; accountNumber: string; accountName: string }) => {
    return await apiClient.post<any>('/finance/banks', payload);
  },
  updateBankAccount: async (id: string, payload: { bankName: string; accountNumber: string; accountName: string }) => {
    return await apiClient.patch<any>(`/finance/banks/${id}`, payload);
  },
  updateBankAccountStatus: async (id: string, payload: { isActive: boolean }) => {
    return await apiClient.patch<any>(`/finance/banks/${id}/status`, payload);
  },
  getSePayReconciliation: async (params?: Record<string, any>) => {
    return await apiClient.get<any>('/finance/sepay/reconciliation', { params });
  },
  getSePayReconciliationAudit: async (params?: Record<string, any>) => {
    return await apiClient.get<any>('/finance/sepay/reconciliation-audit', { params });
  },
  manualAssignSePayTransaction: async (payload: { logId: string; sourceType: 'INVOICE' | 'DEPOSIT'; sourceCode: string }) => {
    return await apiClient.post<any>('/payments/sepay/manual-assign', payload);
  },
  resolveSePayOverpayment: async (payload: { logId: string; resolution: 'CREDIT_BALANCE' | 'CARRY_FORWARD' | 'REFUND_PENDING' }) => {
    return await apiClient.post<any>('/payments/sepay/resolve-overpayment', payload);
  },
  completeSePayOverpaymentRefund: async (payload: { logId: string; note?: string }) => {
    return await apiClient.post<any>('/payments/sepay/complete-overpayment-refund', payload);
  },
  getExpenses: async (params?: Record<string, any>) => {
    return await apiClient.get<any>('/finance/expenses', { params });
  },
  createExpense: async (payload: Record<string, any>) => {
    return await apiClient.post<any>('/finance/expenses', payload);
  },
  updateExpense: async (id: string, payload: Record<string, any>) => {
    return await apiClient.patch<any>(`/finance/expenses/${id}`, payload);
  },
  approveExpense: async (id: string, payload?: { markPaid?: boolean }) => {
    return await apiClient.patch<any>(`/finance/expenses/${id}/approve`, payload || {});
  },
  payExpense: async (id: string) => {
    return await apiClient.patch<any>(`/finance/expenses/${id}/pay`, {});
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
  },
  exportExcelReport: async () => {
    const response = await apiClient.get('/finance/export.xlsx', { responseType: 'blob' } as any);
    return response;
  },
  exportPdfReport: async () => {
    const response = await apiClient.get('/finance/export.pdf', { responseType: 'blob' } as any);
    return response;
  }
};
