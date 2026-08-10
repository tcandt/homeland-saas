import { useQuery, useMutation } from '@tanstack/react-query';
import { ContractSettlementPayload, contractsApi } from '../api/contracts.api';

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
      const payload = Array.isArray(response) ? { items: response } : (response as any) || {};
      const items = Array.isArray(payload.items) ? payload.items : Array.isArray(payload.data) ? payload.data : [];
      const meta = payload.meta || {};
      return {
        data: items,
        meta: {
          total: Number(meta.total || payload.total || items.length || 0),
          page: Number(meta.page || payload.page || params?.page || 1),
          limit: Number(meta.limit || payload.limit || params?.limit || items.length || 0),
        },
      };
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

export const useSubmitContractMutation = () => {
  return useMutation({
    mutationFn: (id: string) => contractsApi.submit(id),
  });
};

export const useApproveContractMutation = () => {
  return useMutation({
    mutationFn: (id: string) => contractsApi.approve(id),
  });
};

export const useActivateContractMutation = () => {
  return useMutation({
    mutationFn: (id: string) => contractsApi.activate(id),
  });
};

export const useTerminateContractMutation = () => {
  return useMutation({
    mutationFn: (input: string | { id: string; payload?: Partial<ContractSettlementPayload> }) => {
      if (typeof input === 'string') {
        return contractsApi.terminate(input);
      }
      return contractsApi.terminate(input.id, input.payload);
    },
  });
};

export const useSettlementPreviewMutation = () => {
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ContractSettlementPayload }) =>
      contractsApi.previewSettlement(id, payload),
  });
};
