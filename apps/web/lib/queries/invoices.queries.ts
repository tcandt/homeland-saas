import { useQuery } from "@tanstack/react-query";
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

export const useDepositBillingDocumentsQuery = (enabled: boolean) => useQuery({
  queryKey: [...invoiceKeys.lists(), "deposit-documents"],
  enabled,
  queryFn: async () => {
    const items: any[] = [];
    let page = 1;
    let total = 0;
    do {
      const response = await invoicesApi.listDepositDocuments({ page, limit: 100 });
      items.push(...response.items);
      total = response.total;
      page += 1;
      if (!response.items.length) break;
    } while (items.length < total);
    return items;
  },
  refetchInterval: 3000,
  refetchOnWindowFocus: true,
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
