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
      return { data: response };
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
