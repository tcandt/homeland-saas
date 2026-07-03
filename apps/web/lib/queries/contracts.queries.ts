import { useQuery } from '@tanstack/react-query';
import { contractsApi } from '../api/contracts.api';

export const contractKeys = {
  all: ['contracts'] as const,
  lists: () => [...contractKeys.all, 'list'] as const,
  list: (params: any) => [...contractKeys.lists(), params] as const,
  details: () => [...contractKeys.all, 'detail'] as const,
  detail: (id: string) => [...contractKeys.details(), id] as const,
};

export const useContractsQuery = (params?: { page?: number; limit?: number; search?: string; status?: string; roomId?: string; customerId?: string }) => {
  return useQuery({
    queryKey: contractKeys.list(params),
    queryFn: async () => {
      const response = await contractsApi.list(params);
      return { data: response };
    },
  });
};

export const useContractDetailQuery = (id: string) => {
  return useQuery({
    queryKey: contractKeys.detail(id),
    queryFn: async () => {
      if (!id) return null;
      const response = await contractsApi.getDetail(id);
      return { data: response };
    },
    enabled: !!id,
  });
};
