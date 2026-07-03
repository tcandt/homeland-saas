import { create } from 'zustand';

interface RoomsFilterState {
  search: string;
  buildingId: string;
  floorId: string;
  status: string;
  type: string;
  setSearch: (search: string) => void;
  setBuildingId: (buildingId: string) => void;
  setFloorId: (floorId: string) => void;
  setStatus: (status: string) => void;
  setType: (type: string) => void;
}

export const useRoomsStore = create<RoomsFilterState>((set) => ({
  search: '',
  buildingId: '',
  floorId: '',
  status: '',
  type: '',
  setSearch: (search) => set({ search }),
  setBuildingId: (buildingId) => set({ buildingId }),
  setFloorId: (floorId) => set({ floorId }),
  setStatus: (status) => set({ status }),
  setType: (type) => set({ type }),
}));
