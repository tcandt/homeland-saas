import { apiClient } from './client';

export interface FloorResponse {
  id: string;
  number: number;
  notes?: string;
  buildingId: string;
  createdAt: string;
  updatedAt: string;
}

export interface FloorListResponse {
  items: FloorResponse[];
  total: number;
}

export const floorsApi = {
  list: (params?: any) => {
    return apiClient.get<FloorListResponse>('/floors', { params });
  },
  
  getDetail: (id: string) => {
    return apiClient.get<FloorResponse>(`/floors/${id}`);
  },

  create: (data: any) => {
    return apiClient.post<FloorResponse>('/floors', data);
  },

  update: (id: string, data: any) => {
    return apiClient.patch<FloorResponse>(`/floors/${id}`, data);
  },

  delete: (id: string) => {
    return apiClient.delete<{ success: boolean }>(`/floors/${id}`);
  }
};
