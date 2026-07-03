import { useMutation, useQueryClient } from '@tanstack/react-query';
import { invoicesApi } from '../api/invoices.api';
import { invoiceKeys } from '../queries/invoices.queries';
import toast from 'react-hot-toast';

export const useCreateInvoiceMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: any) => invoicesApi.create(data),
    onSuccess: () => {
      toast.success('Thêm hóa đơn thành công');
      queryClient.invalidateQueries({ queryKey: invoiceKeys.lists() });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Có lỗi xảy ra khi thêm hóa đơn');
    },
  });
};

export const useUpdateInvoiceMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => invoicesApi.update(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: invoiceKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: invoiceKeys.lists() });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Có lỗi xảy ra khi cập nhật hóa đơn');
    },
  });
};

export const useDeleteInvoiceMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => invoicesApi.delete(id),
    onSuccess: () => {
      toast.success('Xóa hóa đơn thành công');
      queryClient.invalidateQueries({ queryKey: invoiceKeys.lists() });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Có lỗi xảy ra khi xóa hóa đơn');
    },
  });
};
