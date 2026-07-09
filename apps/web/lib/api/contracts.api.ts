import { apiClient } from './client';

export const contractsApi = {
  list: (params?: { page?: number; limit?: number; search?: string; status?: string; roomId?: string; customerId?: string }) => {
    return apiClient.get('/contracts', { params });
  },
  
  getDetail: (id: string) => {
    return apiClient.get(`/contracts/${id}`);
  },

  create: (data: any) => {
    return apiClient.post('/contracts', data);
  },

  update: (id: string, data: any) => {
    return apiClient.patch(`/contracts/${id}`, data);
  },

  delete: (id: string) => {
    return apiClient.delete(`/contracts/${id}`);
  },

  submit: (id: string) => {
    return apiClient.post(`/contracts/${id}/submit`);
  },

  approve: (id: string) => {
    return apiClient.post(`/contracts/${id}/approve`);
  },

  activate: (id: string) => {
    return apiClient.post(`/contracts/${id}/activate`);
  },

  terminate: (id: string) => {
    return apiClient.post(`/contracts/${id}/terminate`);
  }
};
