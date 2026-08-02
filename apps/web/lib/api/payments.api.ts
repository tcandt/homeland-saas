import { apiClient } from './client';

export interface PaymentRequestResponse {
  id: string;
  sourceType: 'INVOICE' | 'DEPOSIT';
  sourceId: string;
  paymentCode: string;
  amount: number;
  bankName: string;
  bankAccountNumber: string;
  bankAccountName: string | null;
  qrUrl: string;
  status: 'PENDING' | 'CONFIRMED' | 'EXPIRED' | 'CANCELLED';
  provider: 'SEPAY' | 'MANUAL';
  createdAt: string;
  updatedAt: string;
}

export const paymentsApi = {
  createInvoiceRequest: (invoiceId: string) => {
    return apiClient.post<PaymentRequestResponse>(`/payments/invoices/${invoiceId}/request`);
  },

  sendInvoiceToZalo: (invoiceId: string) => {
    return apiClient.post<PaymentRequestResponse>(`/payments/invoices/${invoiceId}/send-zalo`);
  },

  createDepositRequest: (depositId: string) => {
    return apiClient.post<PaymentRequestResponse>(`/payments/deposits/${depositId}/request`);
  },

  sendDepositToZalo: (depositId: string) => {
    return apiClient.post<PaymentRequestResponse>(`/payments/deposits/${depositId}/send-zalo`);
  },

  getRequest: (id: string) => {
    return apiClient.get<PaymentRequestResponse>(`/payments/requests/${id}`);
  },
};
