import { useMutation, useQueryClient } from '@tanstack/react-query';
import { floorsApi } from '../api/floors.api';
import { useToast } from '@/components/ui/ToastContext';
import { adaptFloor } from '../adapters/building.adapter';
import type { Building } from '@/components/buildings/building.types';

export const useCreateFloorMutation = () => {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: async (data: any) => {
      const response = await floorsApi.create(data);
      return adaptFloor(response);
    },
    onSuccess: () => {
      showToast('Thêm tầng thành công', 'success');
      queryClient.invalidateQueries({ queryKey: ['buildings'] });
    },
    onError: (error: any) => {
      showToast(error?.message || 'Có lỗi khi thêm tầng', 'error');
    },
  });
};

export const useUpdateFloorMutation = () => {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await floorsApi.update(id, data);
      return adaptFloor(response);
    },
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ['buildings'] });
      const previousBuildings = queryClient.getQueryData<Building[]>(['buildings']);

      if (previousBuildings) {
        queryClient.setQueryData<Building[]>(['buildings'], (old) => {
          if (!old) return old;
          return old.map(b => ({
            ...b,
            floors: b.floors.map(f => f.id === id ? { ...f, ...data } : f)
          }));
        });
      }

      return { previousBuildings };
    },
    onError: (err, newFloor, context: any) => {
      if (context?.previousBuildings) {
        queryClient.setQueryData(['buildings'], context.previousBuildings);
      }
      showToast(err?.message || 'Có lỗi khi cập nhật tầng', 'error');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['buildings'] });
    },
    onSuccess: () => {
      showToast('Cập nhật tầng thành công', 'success');
    }
  });
};

export const useDeleteFloorMutation = () => {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      await floorsApi.delete(id);
      return id;
    },
    onSuccess: () => {
      showToast('Đã xóa tầng thành công', 'success');
      queryClient.invalidateQueries({ queryKey: ['buildings'] });
    },
    onError: (error: any) => {
      showToast(error?.message || 'Có lỗi khi xóa tầng', 'error');
    },
  });
};
