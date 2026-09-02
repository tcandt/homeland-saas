import { useMutation, useQueryClient } from '@tanstack/react-query';
import { customersApi } from '../api/customers.api';
import { customerKeys } from '../queries/customers.queries';
import toast from 'react-hot-toast';

export const useCreateCustomerMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: any) => customersApi.create(data),
    onSuccess: () => {
      toast.success('Thêm khách hàng thành công');
      queryClient.invalidateQueries({ queryKey: customerKeys.lists() });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Có lỗi xảy ra khi thêm khách hàng');
    },
  });
};

export const useUpdateCustomerMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => customersApi.update(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: customerKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: customerKeys.lists() });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Có lỗi xảy ra khi cập nhật khách hàng');
    },
  });
};

export const useDeleteCustomerMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => customersApi.delete(id),
    onSuccess: () => {
      toast.success('Xóa khách hàng thành công');
      queryClient.invalidateQueries({ queryKey: customerKeys.lists() });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Có lỗi xảy ra khi xóa khách hàng');
    },
  });
};

export const useDeduplicateCustomersMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => customersApi.deduplicate(),
    onSuccess: (res: any) => {
      const merged = res?.mergedCount ?? res?.data?.mergedCount ?? 0;
      if (merged > 0) {
        toast.success(`Đã tự động gộp và dọn dẹp ${merged} khách hàng trùng lặp!`);
      } else {
        toast.success('Không có khách hàng nào bị trùng lặp thông tin.');
      }
      queryClient.invalidateQueries({ queryKey: customerKeys.lists() });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Có lỗi xảy ra khi gộp khách hàng trùng lặp');
    },
  });
};
