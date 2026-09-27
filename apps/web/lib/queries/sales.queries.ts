import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { salesApi, type SalesLeadStatus, type SalesSummary } from '../api/sales.api';

export type SalesLeadListParams = {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  sort?: string;
  order?: string;
};

export type SalesLeadListPage = {
  items: unknown[];
  total: number;
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
};

export const salesKeys = {
  all: ['sales'] as const,
  lists: () => [...salesKeys.all, 'list'] as const,
  list: (params: any) => [...salesKeys.lists(), params] as const,
  details: () => [...salesKeys.all, 'detail'] as const,
  detail: (id: string) => [...salesKeys.details(), id] as const,
  summary: () => [...salesKeys.all, 'summary'] as const,
};

const SALES_SUMMARY_STATUSES = ['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'WON', 'LOST'] as const;

export function normalizeSalesSummary(value: unknown): SalesSummary {
  const payload = value && typeof value === 'object' ? value as Partial<SalesSummary> : {};
  const rawStageCounts = payload.stageCounts && typeof payload.stageCounts === 'object'
    ? payload.stageCounts
    : {};
  const stageCounts = SALES_SUMMARY_STATUSES.reduce<Record<string, number>>((counts, status) => {
    const count = Number(rawStageCounts[status]);
    counts[status] = Number.isFinite(count) && count >= 0 ? count : 0;
    return counts;
  }, {});

  const total = Number(payload.total);
  const activeCount = Number(payload.activeCount);
  const staleCount = Number(payload.staleCount);

  return {
    total: Number.isFinite(total) && total >= 0 ? total : 0,
    activeCount: Number.isFinite(activeCount) && activeCount >= 0 ? activeCount : 0,
    staleCount: Number.isFinite(staleCount) && staleCount >= 0 ? staleCount : 0,
    stageCounts,
    newestLeads: Array.isArray(payload.newestLeads) ? payload.newestLeads : [],
  };
}

export const useSalesSummaryQuery = () => {
  return useQuery({
    queryKey: salesKeys.summary(),
    queryFn: async () => normalizeSalesSummary(await salesApi.getSummary()),
    staleTime: 60 * 1000,
  });
};

function nonNegativeNumber(value: unknown, fallback: number) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue >= 0 ? numberValue : fallback;
}

function positiveNumber(value: unknown, fallback: number) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : fallback;
}

export function normalizeSalesLeadListPage(value: unknown, params: SalesLeadListParams = {}): SalesLeadListPage {
  const payload = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const items = Array.isArray(value)
    ? value
    : Array.isArray(payload.data)
      ? payload.data
      : Array.isArray(payload.items)
        ? payload.items
        : [];
  const rawMeta = payload.meta && typeof payload.meta === 'object' && !Array.isArray(payload.meta)
    ? payload.meta as Record<string, unknown>
    : {};
  const page = positiveNumber(rawMeta.page, positiveNumber(payload.page, positiveNumber(params.page, 1)));
  const limit = positiveNumber(rawMeta.limit, positiveNumber(payload.limit, positiveNumber(params.limit, items.length || 20)));
  const total = nonNegativeNumber(rawMeta.total, nonNegativeNumber(payload.total, items.length));
  const totalPages = positiveNumber(rawMeta.totalPages, Math.max(1, Math.ceil(total / limit)));

  return {
    items,
    total,
    meta: {
      total,
      page,
      limit,
      totalPages,
      hasNextPage: typeof rawMeta.hasNextPage === 'boolean' ? rawMeta.hasNextPage : page < totalPages,
      hasPreviousPage: typeof rawMeta.hasPreviousPage === 'boolean' ? rawMeta.hasPreviousPage : page > 1,
    },
  };
}

export const useSalesLeadsQuery = (params?: SalesLeadListParams) => {
  return useQuery({
    queryKey: salesKeys.list(params),
    queryFn: async () => {
      const response = await salesApi.list(params);
      const page = normalizeSalesLeadListPage(response, params);
      return {
        data: {
          data: page.items,
          items: page.items,
          total: page.total,
          meta: page.meta,
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

export const useUpdateSalesLeadStageMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, idempotencyKey }: { id: string; status: SalesLeadStatus; idempotencyKey: string }) =>
      salesApi.updateStage(id, status, idempotencyKey),
    onSuccess: async (lead: { id: string }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: salesKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: salesKeys.summary() }),
        queryClient.invalidateQueries({ queryKey: salesKeys.detail(lead.id) }),
      ]);
    },
  });
};
