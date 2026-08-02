import { useQuery } from '@tanstack/react-query';
import { customersApi } from '../api/customers.api';

export const customerKeys = {
  all: ['customers'] as const,
  lists: () => [...customerKeys.all, 'list'] as const,
  list: (params: any) => [...customerKeys.lists(), params] as const,
  details: () => [...customerKeys.all, 'detail'] as const,
  detail: (id: string) => [...customerKeys.details(), id] as const,
};

export const useCustomersQuery = (params?: { page?: number; limit?: number; search?: string; status?: string }) => {
  return useQuery({
    queryKey: customerKeys.list(params),
    queryFn: async () => {
      const response = await customersApi.list(params);
      const payload = Array.isArray(response) ? { items: response } : (response as any) || {};
      const items = Array.isArray(payload.items) ? payload.items : Array.isArray(payload.data) ? payload.data : [];
      return {
        data: items,
        meta: {
          total: Number(payload.total || items.length || 0),
          page: Number(payload.page || params?.page || 1),
          limit: Number(payload.limit || params?.limit || items.length || 0),
        },
      };
    },
  });
};

export const useCustomerDetailQuery = (id: string) => {
  return useQuery({
    queryKey: customerKeys.detail(id),
    queryFn: async () => {
      if (!id) return null;
      const response = await customersApi.getDetail(id);
      return { data: response };
    },
    enabled: !!id,
  });
};
