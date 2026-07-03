import { useMutation, useQueryClient } from '@tanstack/react-query';
import { contractsApi } from '../api/contracts.api';
import { contractKeys } from '../queries/contracts.queries';
import toast from 'react-hot-toast';

export const useCreateContractMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: any) => contractsApi.create(data),
    onSuccess: () => {
      toast.success('Thêm hợp đồng thành công');
      queryClient.invalidateQueries({ queryKey: contractKeys.lists() });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Có lỗi xảy ra khi thêm hợp đồng');
    },
  });
};

export const useUpdateContractMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => contractsApi.update(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: contractKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: contractKeys.lists() });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Có lỗi xảy ra khi cập nhật hợp đồng');
    },
  });
};

export const useDeleteContractMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => contractsApi.delete(id),
    onSuccess: () => {
      toast.success('Xóa hợp đồng thành công');
      queryClient.invalidateQueries({ queryKey: contractKeys.lists() });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Có lỗi xảy ra khi xóa hợp đồng');
    },
  });
};
