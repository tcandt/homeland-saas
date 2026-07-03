import { apiClient } from './client';

export const invoicesApi = {
  list: (params?: { page?: number; limit?: number; search?: string; status?: string; roomId?: string; customerId?: string; contractId?: string; period?: string; overdue?: boolean }) => {
    return apiClient.get('/invoices', { params });
  },
  
  getDetail: (id: string) => {
    return apiClient.get(`/invoices/${id}`);
  },

  create: (data: any) => {
    return apiClient.post('/invoices', data);
  },

  update: (id: string, data: any) => {
    return apiClient.patch(`/invoices/${id}`, data);
  },

  delete: (id: string) => {
    return apiClient.delete(`/invoices/${id}`);
  }
};
