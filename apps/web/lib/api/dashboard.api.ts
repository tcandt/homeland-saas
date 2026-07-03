import { apiClient } from './client';

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export const dashboardApi = {
  getBuildings: () => apiClient.get<PaginatedResponse<any>>('/buildings?limit=100'),
  getRooms: () => apiClient.get<PaginatedResponse<any>>('/rooms?limit=500'),
  getContracts: () => apiClient.get<PaginatedResponse<any>>('/contracts?limit=500'),
  getInvoices: () => apiClient.get<PaginatedResponse<any>>('/invoices?limit=500'),
  getCustomers: () => apiClient.get<PaginatedResponse<any>>('/customers?limit=500'),
};
