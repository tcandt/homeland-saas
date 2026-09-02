import { apiClient } from './client';

export const customersApi = {
  list: (params?: { page?: number; limit?: number; search?: string; status?: string }) => {
    return apiClient.get('/customers', { params });
  },
  
  getDetail: (id: string) => {
    return apiClient.get(`/customers/${id}`);
  },

  create: (data: any) => {
    return apiClient.post('/customers', data);
  },

  update: (id: string, data: any) => {
    return apiClient.patch(`/customers/${id}`, data);
  },

  delete: (id: string) => {
    return apiClient.delete(`/customers/${id}`);
  },

  deduplicate: () => {
    return apiClient.post('/customers/deduplicate');
  }
};
