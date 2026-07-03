import { create } from 'zustand';

interface InvoicesFilterState {
  search: string;
  status: string;
  setSearch: (search: string) => void;
  setStatus: (status: string) => void;
}

export const useInvoicesStore = create<InvoicesFilterState>((set) => ({
  search: '',
  status: '',
  setSearch: (search) => set({ search }),
  setStatus: (status) => set({ status }),
}));
