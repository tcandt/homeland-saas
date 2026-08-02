import { useQuery } from '@tanstack/react-query';
import { salesApi } from '../api/sales.api';

export const salesKeys = {
  all: ['sales'] as const,
  lists: () => [...salesKeys.all, 'list'] as const,
  list: (params: any) => [...salesKeys.lists(), params] as const,
  details: () => [...salesKeys.all, 'detail'] as const,
  detail: (id: string) => [...salesKeys.details(), id] as const,
};

export const useSalesLeadsQuery = (params?: { page?: number; limit?: number; search?: string; status?: string; sort?: string; order?: string }) => {
  return useQuery({
    queryKey: salesKeys.list(params),
    queryFn: async () => {
      const response = await salesApi.list(params);
      const payload = Array.isArray(response) ? { items: response } : (response as any) || {};
      const items = Array.isArray(payload.items) ? payload.items : Array.isArray(payload.data) ? payload.data : [];
      const total = Number(payload.total || items.length || 0);
      return {
        data: {
          data: items,
          items,
          total,
          meta: {
            total,
            page: Number(payload.page || params?.page || 1),
            limit: Number(payload.limit || params?.limit || items.length || 0),
          },
        },
      };
    },
  });
};

export const useSalesLeadDetailQuery = (id: string) => {
  return useQuery({
    queryKey: salesKeys.detail(id),
    queryFn: async () => {
      if (!id) return null;
      const response = await salesApi.getDetail(id);
      return { data: response };
    },
    enabled: !!id,
  });
};
