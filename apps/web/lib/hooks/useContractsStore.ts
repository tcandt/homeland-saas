import { create } from 'zustand';

interface ContractsFilterState {
  search: string;
  status: string;
  setSearch: (search: string) => void;
  setStatus: (status: string) => void;
}

export const useContractsStore = create<ContractsFilterState>((set) => ({
  search: '',
  status: '',
  setSearch: (search) => set({ search }),
  setStatus: (status) => set({ status }),
}));
