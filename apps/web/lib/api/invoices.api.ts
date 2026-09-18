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

export const invoicesApi = {
  list: (params?: InvoiceListParams) => {
    return apiClient.get("/invoices", { params });
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

  cancel: (id: string) => {
    return apiClient.post(`/invoices/${id}/cancel`);
  },

  writeoff: (id: string) => {
    return apiClient.post(`/invoices/${id}/writeoff`);
  },
};
