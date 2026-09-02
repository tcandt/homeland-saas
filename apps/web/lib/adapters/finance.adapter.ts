import { financeApi } from '../api/finance.api';

export interface UIJournalLine {
  id: string;
  accountId: string;
  accountCode: string;
  accountName: string;
  costCenterId?: string;
  costCenterCode?: string;
  type: 'DEBIT' | 'CREDIT';
  amount: number;
  description?: string;
}

export interface UIJournal {
  id: string;
  code: string;
  entryDate: string;
  sourceType: string;
  sourceId: string;
  description: string;
  status: string;
  postedAt?: string;
  createdBy?: string;
  lines: UIJournalLine[];
  totalDebit: number;
  totalCredit: number;
}

export interface UILedgerRow {
  id: string; // JournalLine id
  journalId: string;
  journalCode: string;
  date: string;
  description: string;
  accountCode: string;
  accountName: string;
  costCenterName?: string;
  debit: number;
  credit: number;
  sourceType: string;
  status: string;
}

export const financeAdapter = {
  getLedger: async (params?: Record<string, any>): Promise<UILedgerRow[]> => {
    const raw = await financeApi.getLedger(params);
    const candidate = Array.isArray(raw) ? raw : (raw as any)?.data || (raw as any)?.items || [];
    const rows = Array.isArray(candidate) ? candidate : [];
    
    return rows.map((line: any) => ({
      id: line.id,
      journalId: line.journalEntry?.id || line.journalId || line.id,
      journalCode: line.journalEntry?.code || line.journalCode || 'JRN-001',
      date: line.createdAt || line.date || new Date().toISOString(),
      description: line.description || line.journalEntry?.description || '',
      accountCode: line.account?.code || line.accountCode || '',
      accountName: line.account?.name || line.accountName || '',
      costCenterName: line.costCenter?.name || line.costCenterName,
      debit: line.type === 'DEBIT' ? Number(line.amount) : Number(line.debit || 0),
      credit: line.type === 'CREDIT' ? Number(line.amount) : Number(line.credit || 0),
      sourceType: line.journalEntry?.sourceType || line.sourceType || 'MANUAL',
      status: line.journalEntry?.status || line.status || 'POSTED',
    }));
  },

  getCashFlow: async (params?: Record<string, any>) => {
    const data = await financeApi.getCashFlow(params);
    return data;
  },

  getProfitLoss: async (params?: Record<string, any>) => {
    const data = await financeApi.getProfitLoss(params);
    return data;
  },
  
  getBuildingFinance: async (code: string, params?: Record<string, any>) => {
    const data = await financeApi.getBuildingFinance(code, params);
    return data;
  },

  getBuildingProfitSummary: async (params?: Record<string, any>) => {
    return await financeApi.getBuildingProfitSummary(params);
  },

  getOwnerProfitSummary: async () => {
    return await financeApi.getOwnerProfitSummary();
  },

  getOwnerProfitDetail: async (id: string, params?: Record<string, any>) => {
    return await financeApi.getOwnerProfitDetail(id, params);
  },

  getBankCashFlow: async (params?: Record<string, any>) => {
    return await financeApi.getBankCashFlow(params);
  },

  getBankTransactions: async (params?: Record<string, any>) => {
    return await financeApi.getBankTransactions(params);
  },

  getSePayReconciliation: async (params?: Record<string, any>) => {
    return await financeApi.getSePayReconciliation(params);
  },

  getSePayReconciliationAudit: async (params?: Record<string, any>) => {
    return await financeApi.getSePayReconciliationAudit(params);
  },

  getExpenses: async (params?: Record<string, any>) => {
    return await financeApi.getExpenses(params);
  }
};
