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
    const rows = await financeApi.getLedger(params) || [];
    
    return rows.map((line: any) => ({
      id: line.id,
      journalId: line.journalEntry?.id,
      journalCode: line.journalEntry?.code,
      date: line.createdAt,
      description: line.description || line.journalEntry?.description,
      accountCode: line.account?.code,
      accountName: line.account?.name,
      costCenterName: line.costCenter?.name,
      debit: line.type === 'DEBIT' ? Number(line.amount) : 0,
      credit: line.type === 'CREDIT' ? Number(line.amount) : 0,
      sourceType: line.journalEntry?.sourceType,
      status: line.journalEntry?.status,
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
  }
};
