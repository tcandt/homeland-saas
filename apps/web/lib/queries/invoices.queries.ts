import { useQuery } from '@tanstack/react-query';
import { invoicesApi } from '../api/invoices.api';

export const invoiceKeys = {
  all: ['invoices'] as const,
  lists: () => [...invoiceKeys.all, 'list'] as const,
  list: (params: any) => [...invoiceKeys.lists(), params] as const,
  details: () => [...invoiceKeys.all, 'detail'] as const,
  detail: (id: string) => [...invoiceKeys.details(), id] as const,
};

export const useInvoicesQuery = (params?: { page?: number; limit?: number; search?: string; status?: string; roomId?: string; customerId?: string; contractId?: string; period?: string; overdue?: boolean }) => {
  return useQuery({
    queryKey: invoiceKeys.list(params),
    queryFn: async () => {
      const response = await invoicesApi.list(params);
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

export const useInvoiceDetailQuery = (id: string) => {
  return useQuery({
    queryKey: invoiceKeys.detail(id),
    queryFn: async () => {
      if (!id) return null;
      const response = await invoicesApi.getDetail(id);
      return { data: response };
    },
    enabled: !!id,
  });
};

import { useMutation, useQueryClient } from '@tanstack/react-query';

export const useIssueInvoiceMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => invoicesApi.issue(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: invoiceKeys.lists() });
      queryClient.invalidateQueries({ queryKey: invoiceKeys.detail(id) });
    },
  });
};

export const usePayInvoiceMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, amount, provider, providerRef }: { id: string; amount: number; provider?: string; providerRef?: string }) => 
      invoicesApi.pay(id, amount, provider, providerRef),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: invoiceKeys.lists() });
      queryClient.invalidateQueries({ queryKey: invoiceKeys.detail(id) });
    },
  });
};

export const useCancelInvoiceMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => invoicesApi.cancel(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: invoiceKeys.lists() });
      queryClient.invalidateQueries({ queryKey: invoiceKeys.detail(id) });
    },
  });
};

export const useWriteoffInvoiceMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => invoicesApi.writeoff(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: invoiceKeys.lists() });
      queryClient.invalidateQueries({ queryKey: invoiceKeys.detail(id) });
    },
  });
};
