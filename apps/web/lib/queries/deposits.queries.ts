import { useQuery } from '@tanstack/react-query';
import { depositsApi, DepositListResponse } from '../api/deposits.api';
import { depositAdapter, UI_Deposit } from '../adapters/deposit.adapter';

export const useDepositsQuery = (params: any) => {
  return useQuery({
    queryKey: ['deposits', params],
    queryFn: async () => {
      const response = await depositsApi.list(params);
      // Backend ResponseInterceptor wraps successful responses in { success: true, data: T, meta: any }
      // apiClient.get returns data.data (which is the actual payload, e.g. { items, total })
      // We must wrap it back in { data: ... } for components that expect it, per previous fix.
      const rawData = response; 
      const rawItems = Array.isArray(rawData) ? rawData : (rawData as any).data || (rawData as any).items || [];
      const total = Array.isArray(rawData) ? rawItems.length : (rawData as any).total || 0;
      
      return {
        data: {
          items: rawItems.map((item: any) => depositAdapter.toUI(item)),
          total: total,
        }
      };
    },
  });
};

export const useDepositDetailQuery = (id: string | null) => {
  return useQuery({
    queryKey: ['deposit', id],
    queryFn: async () => {
      if (!id) return null;
      const response = await depositsApi.getDetail(id);
      return {
        data: depositAdapter.toUI(response)
      };
    },
    enabled: !!id,
  });
};
