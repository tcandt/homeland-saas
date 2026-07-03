import { create } from 'zustand';

interface TenantsFilterState {
  search: string;
  status: string;
  setSearch: (search: string) => void;
  setStatus: (status: string) => void;
}

export const useTenantsStore = create<TenantsFilterState>((set) => ({
  search: '',
  status: '',
  setSearch: (search) => set({ search }),
  setStatus: (status) => set({ status }),
}));
