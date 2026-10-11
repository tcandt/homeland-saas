import { apiClient } from './client';

export const customersApi = {
  list: (params?: { page?: number; limit?: number; search?: string; status?: string }) => {
    return apiClient.get('/customers', { params });
  },
  
  getDetail: (id: string) => {
    return apiClient.get(`/customers/${id}`);
  },

  create: (data: any, idempotencyKey?: string) => {
    if (!idempotencyKey) {
      return apiClient.post('/customers', data);
    }
    return apiClient.post('/customers', data, {
      headers: { 'Idempotency-Key': idempotencyKey },
    });
  },

  update: (id: string, data: any) => {
    return apiClient.patch(`/customers/${id}`, data);
  },

  approveIdentityImages: (
    id: string,
    images: Array<{ url: string; originalUrl?: string; side: 'front' | 'back'; source: 'upload' | 'scan' }>,
  ) => apiClient.post(`/customers/${id}/identity-images/approve`, { images }),
  revokeIdentityImage: (id: string, url: string) =>
    apiClient.post(`/customers/${id}/identity-images/revoke`, { url }),
  uploadIdentityImage: (id: string, formData: FormData) =>
    apiClient.postForm(`/customers/${id}/identity-images/upload`, formData),

  delete: (id: string) => {
    return apiClient.delete(`/customers/${id}`);
  },

  deduplicate: () => {
    return apiClient.post('/customers/deduplicate');
  },

  checkDuplicate: (params: { phone?: string; identityNo?: string; excludeId?: string }) => {
    return apiClient.get('/customers/check-duplicate', { params });
  }
};
