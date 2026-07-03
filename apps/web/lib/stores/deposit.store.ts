import { create } from 'zustand';
import { UI_Deposit } from '../adapters/deposit.adapter';

interface DepositState {
  searchQuery: string;
  statusFilter: string;
  typeFilter: string;
  buildingFilter: string;
  page: number;
  limit: number;
  selectedDeposit: UI_Deposit | null;

  setSearchQuery: (query: string) => void;
  setStatusFilter: (status: string) => void;
  setTypeFilter: (type: string) => void;
  setBuildingFilter: (building: string) => void;
  setPage: (page: number) => void;
  setLimit: (limit: number) => void;
  setSelectedDeposit: (deposit: UI_Deposit | null) => void;
  resetFilters: () => void;
}

export const useDepositStore = create<DepositState>((set) => ({
  searchQuery: '',
  statusFilter: 'ALL',
  typeFilter: 'ALL',
  buildingFilter: 'ALL',
  page: 1,
  limit: 20,
  selectedDeposit: null,

  setSearchQuery: (query) => set({ searchQuery: query, page: 1 }),
  setStatusFilter: (status) => set({ statusFilter: status, page: 1 }),
  setTypeFilter: (type) => set({ typeFilter: type, page: 1 }),
  setBuildingFilter: (building) => set({ buildingFilter: building, page: 1 }),
  setPage: (page) => set({ page }),
  setLimit: (limit) => set({ limit, page: 1 }),
  setSelectedDeposit: (deposit) => set({ selectedDeposit: deposit }),
  resetFilters: () => set({
    searchQuery: '',
    statusFilter: 'ALL',
    typeFilter: 'ALL',
    buildingFilter: 'ALL',
    page: 1,
  }),
}));
