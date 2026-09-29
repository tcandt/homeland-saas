import { apiClient } from "./client";

export type InvoiceListParams = {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  roomId?: string;
  customerId?: string;
  contractId?: string;
  rentalCycleId?: string;
  period?: string;
  overdue?: boolean;
};

export type PaymentPromiseInput = {
  amount: number;
  dueDate: string;
  note?: string | null;
  idempotencyKey?: string;
};

export type PaymentPromiseResponse = {
  id: string;
  invoiceId: string;
  amount: number;
  dueDate: string;
  status: "PENDING" | "OVERDUE" | "FULFILLED" | "CANCELLED";
  note?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
};

export const invoicesApi = {
  list: (params?: InvoiceListParams) => {
    return apiClient.get("/invoices", { params });
  },

  listDepositDocuments: (params?: Pick<InvoiceListParams, "page" | "limit" | "roomId" | "customerId" | "contractId" | "rentalCycleId">) => {
    return apiClient.get<{ items: any[]; total: number }>("/invoices/deposit-documents", { params });
  },

  getDetail: (id: string) => {
    return apiClient.get(`/invoices/${id}`);
  },

  create: (data: any) => {
    return apiClient.post("/invoices", data);
  },

  update: (id: string, data: any) => {
    return apiClient.patch(`/invoices/${id}`, data);
  },

  delete: (id: string) => {
    return apiClient.delete(`/invoices/${id}`);
  },

  issue: (id: string) => {
    return apiClient.post(`/invoices/${id}/issue`);
  },

  pay: (
    id: string,
    amount: number,
    provider: "MANUAL",
    providerRef: string,
  ) => {
    return apiClient.post(`/invoices/${id}/pay`, {
      amount,
      provider,
      providerRef,
    });
  },

  listPaymentPromises: (id: string) => {
    return apiClient.get<PaymentPromiseResponse[]>(`/invoices/${id}/payment-promises`);
  },

  createPaymentPromise: (id: string, input: PaymentPromiseInput) => {
    const { idempotencyKey, ...payload } = input;
    return apiClient.post<PaymentPromiseResponse>(`/invoices/${id}/payment-promises`, payload, {
      headers: idempotencyKey ? { "idempotency-key": idempotencyKey } : undefined,
    });
  },

  cancel: (id: string) => {
    return apiClient.post(`/invoices/${id}/cancel`);
  },

  writeoff: (id: string) => {
    return apiClient.post(`/invoices/${id}/writeoff`);
  },
};
