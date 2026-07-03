import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface DateRange {
  from?: string;
  to?: string;
}

interface FinanceState {
  dateRange: DateRange;
  buildingId: string | null;
  costCenterId: string | null;
  accountId: string | null;
  search: string;
  reportType: 'cashflow' | 'profit-loss' | 'balance-sheet';
  selectedJournalId: string | null;
  
  setDateRange: (range: DateRange) => void;
  setBuilding: (id: string | null) => void;
  setCostCenter: (id: string | null) => void;
  setAccount: (id: string | null) => void;
  setSearch: (search: string) => void;
  setReportType: (type: 'cashflow' | 'profit-loss' | 'balance-sheet') => void;
  setSelectedJournal: (id: string | null) => void;
  resetFilters: () => void;
}

export const useFinanceStore = create<FinanceState>()(
  persist(
    (set) => ({
      dateRange: {},
      buildingId: null,
      costCenterId: null,
      accountId: null,
      search: '',
      reportType: 'profit-loss',
      selectedJournalId: null,

      setDateRange: (range) => set({ dateRange: range }),
      setBuilding: (id) => set({ buildingId: id }),
      setCostCenter: (id) => set({ costCenterId: id }),
      setAccount: (id) => set({ accountId: id }),
      setSearch: (search) => set({ search }),
      setReportType: (type) => set({ reportType: type }),
      setSelectedJournal: (id) => set({ selectedJournalId: id }),
      resetFilters: () => set({
        dateRange: {},
        buildingId: null,
        costCenterId: null,
        accountId: null,
        search: '',
      }),
    }),
    {
      name: 'finance-store',
      partialize: (state) => ({
        dateRange: state.dateRange,
        buildingId: state.buildingId,
        costCenterId: state.costCenterId,
        accountId: state.accountId,
        reportType: state.reportType,
      }), // only persist filters
    }
  )
);
