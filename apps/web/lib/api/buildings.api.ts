import { apiClient } from './client';

export interface BuildingResponse {
  id: string;
  name: string;
  address: string;
  images: string[];
  notes?: string;
  status: 'active' | 'inactive';
  floors?: any[];
  rooms?: any[];
  createdAt: string;
  updatedAt: string;
}

export interface BuildingListResponse {
  items: BuildingResponse[];
  total: number;
}

export const buildingsApi = {
  list: (params?: any) => {
    return apiClient.get<BuildingListResponse>('/buildings', { params });
  },
  
  getDetail: (id: string) => {
    return apiClient.get<BuildingResponse>(`/buildings/${id}`);
  },

  create: (data: any) => {
    return apiClient.post<BuildingResponse>('/buildings', data);
  },

  update: (id: string, data: any) => {
    return apiClient.patch<BuildingResponse>(`/buildings/${id}`, data);
  },

  delete: (id: string) => {
    return apiClient.delete<{ success: boolean }>(`/buildings/${id}`);
  }
};
