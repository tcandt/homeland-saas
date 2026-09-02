import { useQuery } from '@tanstack/react-query';
import { depositsApi, DepositListResponse } from '../api/deposits.api';
import { depositAdapter, UI_Deposit } from '../adapters/deposit.adapter';

export const useDepositsQuery = (params: any) => {
  return useQuery({
    queryKey: ['deposits', params],
    queryFn: async () => {
      const response = await depositsApi.list(params);
      const rawData = response; 
      const candidate = (rawData as any)?.items || (rawData as any)?.data?.items || (rawData as any)?.data || rawData;
      const rawItems = Array.isArray(candidate) ? candidate : [];
      const total = (rawData as any)?.total || (rawData as any)?.data?.total || rawItems.length;
      
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

export const useDepositStatsQuery = (buildingId?: string) => {
  return useQuery({
    queryKey: ['deposit-stats', buildingId],
    queryFn: async () => {
      const response = await depositsApi.getStats(buildingId);
      return response;
    },
    staleTime: 30000,
  });
};
