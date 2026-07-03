import { apiClient } from './client';

export interface DepositResponse {
  id: string;
  code: string;
  type: string;
  status: string;
  amount: number;
  expiredAt: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  customer: {
    id: string;
    fullName: string;
    phone: string;
  };
  room: {
    id: string;
    code: string;
    name: string;
    building: {
      id: string;
      name: string;
    };
  };
}

export interface DepositListResponse {
  items: DepositResponse[];
  total: number;
}

export const depositsApi = {
  list: (params?: any) => {
    return apiClient.get<any>('/deposits', { params });
  },
  
  getDetail: (id: string) => {
    return apiClient.get<any>(`/deposits/${id}`);
  },

  create: (data: any) => {
    return apiClient.post<any>('/deposits', data);
  },

  update: (id: string, data: any) => {
    return apiClient.patch<any>(`/deposits/${id}`, data);
  },

  delete: (id: string) => {
    return apiClient.delete<{ success: boolean }>(`/deposits/${id}`);
  },

  collect: (id: string, note?: string) => {
    return apiClient.post<any>(`/deposits/${id}/collect`, { note });
  },

  refund: (id: string, reason: string) => {
    return apiClient.post<any>(`/deposits/${id}/refund`, { reason });
  },

  cancel: (id: string, reason: string) => {
    return apiClient.post<any>(`/deposits/${id}/cancel`, { reason });
  },

  convertToContract: (id: string) => {
    return apiClient.post<any>(`/deposits/${id}/convert-contract`);
  }
};
