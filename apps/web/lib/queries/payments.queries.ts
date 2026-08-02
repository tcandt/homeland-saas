import { useMutation, useQuery } from '@tanstack/react-query';
import { paymentsApi } from '../api/payments.api';

export const paymentKeys = {
  all: ['payments'] as const,
  request: (id: string) => [...paymentKeys.all, 'request', id] as const,
};

export const usePaymentRequestQuery = (id: string) => {
  return useQuery({
    queryKey: paymentKeys.request(id),
    queryFn: async () => {
      if (!id) return null;
      const response = await paymentsApi.getRequest(id);
      return { data: response };
    },
    enabled: !!id,
    refetchInterval: (query) => {
      const status = query.state.data?.data?.status;
      return status === 'PENDING' ? 5000 : false;
    },
  });
};

export const useCreateInvoicePaymentRequestMutation = () => {
  return useMutation({
    mutationFn: (invoiceId: string) => paymentsApi.createInvoiceRequest(invoiceId),
  });
};

export const useSendInvoicePaymentToZaloMutation = () => {
  return useMutation({
    mutationFn: (invoiceId: string) => paymentsApi.sendInvoiceToZalo(invoiceId),
  });
};

export const useCreateDepositPaymentRequestMutation = () => {
  return useMutation({
    mutationFn: (depositId: string) => paymentsApi.createDepositRequest(depositId),
  });
};

export const useSendDepositPaymentToZaloMutation = () => {
  return useMutation({
    mutationFn: (depositId: string) => paymentsApi.sendDepositToZalo(depositId),
  });
};
