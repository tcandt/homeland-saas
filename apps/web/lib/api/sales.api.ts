import { apiClient } from './client';

export const salesApi = {
  list: (params?: { page?: number; limit?: number; search?: string; status?: string; sort?: string; order?: string }) => {
    return apiClient.get('/sales', { params });
  },

  getDetail: (id: string) => {
    return apiClient.get(`/sales/${id}`);
  },
};
