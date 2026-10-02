import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import {
  InvoiceListParams,
  invoicesApi,
  PaymentPromiseInput,
} from "../api/invoices.api";
import { financeKeys } from "./finance.queries";

export type InvoiceQueryOptions = {
  /** Do not fetch a finance-scoped list until its exact rental cycle is known. */
  requireRentalCycle?: boolean;
  enabled?: boolean;
  refetchInterval?: number | false;
  refetchOnWindowFocus?: boolean;
  fetchAllPages?: boolean;
};

export type InvoiceCursorPage = {
  data: any[];
  meta: {
    limit: number;
    nextCursor: string | null;
    hasNextPage: boolean;
  };
};

export function shouldEnableInvoicesQuery(
  params?: InvoiceListParams,
  options: InvoiceQueryOptions = {},
) {
  return (options.enabled ?? true) &&
    (!options.requireRentalCycle || Boolean(params?.rentalCycleId));
}

export const invoiceKeys = {
  all: ["invoices"] as const,
  lists: () => [...invoiceKeys.all, "list"] as const,
  list: (params: any) => [...invoiceKeys.lists(), params] as const,
  details: () => [...invoiceKeys.all, "detail"] as const,
  detail: (id: string) => [...invoiceKeys.details(), id] as const,
  paymentPromises: (id: string) =>
    [...invoiceKeys.detail(id), "payment-promises"] as const,
};

export const useInvoicesQuery = (
  params?: InvoiceListParams,
  options: InvoiceQueryOptions = {},
) => {
  return useQuery({
    queryKey: options.fetchAllPages ? [...invoiceKeys.list(params), "all-pages"] : invoiceKeys.list(params),
    enabled: shouldEnableInvoicesQuery(params, options),
    queryFn: async () => {
      const response = await invoicesApi.list(params);
      const payload = Array.isArray(response)
        ? { items: response }
        : (response as any) || {};
      const items = Array.isArray(payload.items)
        ? payload.items
        : Array.isArray(payload.data)
          ? payload.data
          : [];
      const total = Number(payload.total ?? payload.meta?.total ?? items.length);
      if (options.fetchAllPages) {
        const limit = Number(payload.limit || params?.limit || 100);
        let nextPage = Number(params?.page || 1) + 1;
        let lastPageCount = items.length;
        while (items.length < total && lastPageCount > 0) {
          const nextResponse: any = await invoicesApi.list({ ...params, page: nextPage, limit });
          const nextItems = Array.isArray(nextResponse?.items) ? nextResponse.items
            : Array.isArray(nextResponse?.data) ? nextResponse.data : [];
          items.push(...nextItems);
          lastPageCount = nextItems.length;
          nextPage += 1;
        }
      }
      return {
        data: items,
        meta: {
          total,
          page: Number(payload.page || params?.page || 1),
          limit: Number(payload.limit || params?.limit || items.length || 0),
        },
      };
    },
    refetchInterval: options.refetchInterval,
    refetchOnWindowFocus: options.refetchOnWindowFocus,
  });
};

/**
 * Cursor feed for the operations screen. It deliberately keeps only the
 * windows requested by the user in memory and never walks every page.
 */
export const useInfiniteInvoicesQuery = (
  params: Omit<InvoiceListParams, "cursor" | "paginationMode" | "page"> = {},
  options: Pick<InvoiceQueryOptions, "enabled" | "refetchOnWindowFocus"> & { pageSize?: number } = {},
) => useInfiniteQuery<InvoiceCursorPage>({
  queryKey: [...invoiceKeys.list(params), "cursor"],
  enabled: shouldEnableInvoicesQuery(params, options),
  initialPageParam: null as string | null,
  queryFn: async ({ pageParam }) => {
    const cursor = pageParam as string | null;
    const response: any = await invoicesApi.list({
      ...params,
      limit: options.pageSize ?? 100,
      paginationMode: "cursor",
      ...(cursor ? { cursor } : {}),
    });
    const payload = Array.isArray(response) ? { items: response } : response || {};
    const items = Array.isArray(payload.items) ? payload.items : Array.isArray(payload.data) ? payload.data : [];
    return {
      data: items,
      meta: {
        limit: Number(payload.meta?.limit ?? payload.limit ?? options.pageSize ?? 100),
        nextCursor: payload.meta?.nextCursor ?? payload.nextCursor ?? null,
        hasNextPage: Boolean(payload.meta?.hasNextPage ?? payload.hasNextPage),
      },
    };
  },
  getNextPageParam: (lastPage) => lastPage.meta.hasNextPage ? lastPage.meta.nextCursor : undefined,
  getPreviousPageParam: () => undefined,
  // Keep a single 100-row operations window. Advancing the cursor replaces
  // it, so DOM and query memory stay constant even for very large tenants.
  maxPages: 1,
  refetchOnWindowFocus: options.refetchOnWindowFocus ?? false,
});

export const useInvoiceDetailQuery = (
  id: string,
  options: Pick<InvoiceQueryOptions, "enabled" | "refetchInterval" | "refetchOnWindowFocus"> = {},
) => {
  return useQuery({
    queryKey: invoiceKeys.detail(id),
    queryFn: async () => {
      if (!id) return null;
      const response = await invoicesApi.getDetail(id);
      return { data: response };
    },
    enabled: !!id && (options.enabled ?? true),
    refetchInterval: options.refetchInterval,
    refetchOnWindowFocus: options.refetchOnWindowFocus,
  });
};

export const useDepositBillingDocumentsQuery = (enabled: boolean, invoiceIds: string[] = []) => useQuery({
  queryKey: [...invoiceKeys.lists(), "deposit-documents", invoiceIds],
  enabled: enabled && invoiceIds.length > 0,
  queryFn: async () => {
    // Deposit documents are enrichment for the visible invoice window. Keep
    // this bounded so a large tenant cannot make the browser enumerate every
    // historical deposit before the invoice feed can render.
    const response = await invoicesApi.listDepositDocuments({ page: 1, limit: 100, invoiceIds: invoiceIds.join(",") });
    return response.items || [];
  },
  refetchInterval: false,
  refetchOnWindowFocus: false,
});

import { useMutation, useQueryClient } from "@tanstack/react-query";

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
    mutationFn: ({
      id,
      amount,
      provider,
      providerRef,
    }: {
      id: string;
      amount: number;
      provider: "MANUAL";
      providerRef: string;
    }) => invoicesApi.pay(id, amount, provider, providerRef),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: invoiceKeys.lists() });
      queryClient.invalidateQueries({ queryKey: invoiceKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: financeKeys.all });
    },
  });
};

export const useInvoicePaymentPromisesQuery = (
  id: string,
  options: Pick<InvoiceQueryOptions, "enabled" | "refetchInterval"> = {},
) => {
  return useQuery({
    queryKey: invoiceKeys.paymentPromises(id),
    queryFn: () => invoicesApi.listPaymentPromises(id),
    enabled: !!id && (options.enabled ?? true),
    refetchInterval: options.refetchInterval,
  });
};

export const useCreateInvoicePaymentPromiseMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: PaymentPromiseInput }) =>
      invoicesApi.createPaymentPromise(id, input),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: invoiceKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: invoiceKeys.paymentPromises(id) });
      queryClient.invalidateQueries({ queryKey: invoiceKeys.lists() });
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
