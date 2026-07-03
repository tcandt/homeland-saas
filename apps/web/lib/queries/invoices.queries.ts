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
      return { data: response };
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
