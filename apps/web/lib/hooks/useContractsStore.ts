import { create } from 'zustand';

interface ContractsFilterState {
  search: string;
  status: string;
  sort: string;
  selectedContract: any | null;
  setSearch: (search: string) => void;
  setStatus: (status: string) => void;
  setSort: (sort: string) => void;
  setSelectedContract: (contract: any | null) => void;
}

export const useContractsStore = create<ContractsFilterState>((set) => ({
  search: '',
  status: '',
  sort: 'newest',
  selectedContract: null,
  setSearch: (search) => set({ search }),
  setStatus: (status) => set({ status }),
  setSort: (sort) => set({ sort }),
  setSelectedContract: (selectedContract) => set({ selectedContract }),
}));
