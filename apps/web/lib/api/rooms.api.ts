import { apiClient } from './client';

export interface RoomResponse {
  id: string;
  number: string;
  status: 'vacant' | 'occupied' | 'deposited' | 'expiring_soon' | 'maintenance';
  type: string;
  price: number;
  area: number;
  capacity: number;
  images: string[];
  rentalType: 'whole' | 'shared';
  notes?: string;
  buildingId: string;
  floorId?: string;
  tenant?: any;
  roommates?: any[];
  contract?: any;
  invoices?: any[];
  paymentHistory?: any[];
  sharedTenants?: any[];
  createdAt: string;
  updatedAt: string;
}

export interface RoomListResponse {
  items: RoomResponse[];
  total: number;
}

export const roomsApi = {
  list: (params?: any) => {
    return apiClient.get<RoomListResponse>('/rooms', { params });
  },
  
  getDetail: (id: string) => {
    return apiClient.get<RoomResponse>(`/rooms/${id}`);
  },

  create: (data: any) => {
    return apiClient.post<RoomResponse>('/rooms', data);
  },

  update: (id: string, data: any) => {
    const payload = { ...data };
    if (payload.status) {
      const statusMap: Record<string, string> = {
        vacant: 'AVAILABLE',
        deposited: 'RESERVED',
        occupied: 'OCCUPIED',
        expiring_soon: 'OCCUPIED',
        maintenance: 'MAINTENANCE',
      };
      payload.status = statusMap[payload.status] || payload.status;
    }
    return apiClient.patch<RoomResponse>(`/rooms/${id}`, payload);
  },

  delete: (id: string) => {
    return apiClient.delete<{ success: boolean }>(`/rooms/${id}`);
  }
};
