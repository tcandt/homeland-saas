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
      queryClient.invalidateQueries({ queryKey: ['buildings'] });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      queryClient.invalidateQueries({ queryKey: ['deposits'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
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
      queryClient.invalidateQueries({ queryKey: ['buildings'] });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      queryClient.invalidateQueries({ queryKey: ['deposits'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
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
      queryClient.invalidateQueries({ queryKey: ['buildings'] });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      queryClient.invalidateQueries({ queryKey: ['deposits'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Có lỗi xảy ra khi xóa hợp đồng');
    },
  });
};

export const useTerminateContractMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => contractsApi.terminate(id),
    onSuccess: (_, variables) => {
      toast.success('Chấm dứt hợp đồng thành công');
      queryClient.invalidateQueries({ queryKey: contractKeys.detail(variables) });
      queryClient.invalidateQueries({ queryKey: contractKeys.lists() });
      queryClient.invalidateQueries({ queryKey: ['buildings'] });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Có lỗi xảy ra khi chấm dứt hợp đồng');
    },
  });
};

export const useExpireContractMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => contractsApi.expire(id),
    onSuccess: (_, variables) => {
      toast.success('Cập nhật hợp đồng thành công');
      queryClient.invalidateQueries({ queryKey: contractKeys.detail(variables) });
      queryClient.invalidateQueries({ queryKey: contractKeys.lists() });
      queryClient.invalidateQueries({ queryKey: ['buildings'] });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Có lỗi xảy ra');
    },
  });
};

