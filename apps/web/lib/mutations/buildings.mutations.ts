import { useMutation, useQueryClient } from '@tanstack/react-query';
import { buildingsApi } from '../api/buildings.api';
import { useToast } from '@/components/ui/ToastContext';
import type { Building } from '@/components/buildings/building.types';
import { adaptBuilding } from '../adapters/building.adapter';

export const useCreateBuildingMutation = () => {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: async (data: any) => {
      const response = await buildingsApi.create(data);
      return adaptBuilding(response);
    },
    onSuccess: () => {
      showToast('Thêm tòa nhà thành công', 'success');
      queryClient.invalidateQueries({ queryKey: ['buildings'] });
    },
    onError: (error: any) => {
      showToast(error?.message || 'Có lỗi khi thêm tòa nhà', 'error');
    },
  });
};

export const useUpdateBuildingMutation = () => {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await buildingsApi.update(id, data);
      return adaptBuilding(response);
    },
    // Optimistic Update
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ['buildings'] });
      const previousBuildings = queryClient.getQueryData<Building[]>(['buildings']);

      if (previousBuildings) {
        queryClient.setQueryData<Building[]>(['buildings'], (old) => {
          if (!old) return old;
          return old.map(b => b.id === id ? { ...b, ...data } : b);
        });
      }

      return { previousBuildings };
    },
    onError: (err, newBuilding, context: any) => {
      if (context?.previousBuildings) {
        queryClient.setQueryData(['buildings'], context.previousBuildings);
      }
      showToast(err?.message || 'Có lỗi khi cập nhật tòa nhà', 'error');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['buildings'] });
    },
    onSuccess: () => {
      showToast('Cập nhật tòa nhà thành công', 'success');
    }
  });
};

export const useMoveBuildingMutation = () => {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: async ({ id, direction }: { id: string; direction: 'up' | 'down' }) => {
      const response = await buildingsApi.move(id, direction);
      const items = Array.isArray(response) ? response : (response as any).data || (response as any).items || [];
      return items.map(adaptBuilding);
    },
    onSuccess: (buildings) => {
      queryClient.setQueriesData({ queryKey: ['buildings'] }, buildings);
      queryClient.invalidateQueries({ queryKey: ['buildings'] });
      showToast('Đã cập nhật thứ tự tòa nhà', 'success');
    },
    onError: (error: any) => {
      showToast(error?.message || 'Có lỗi khi sắp xếp tòa nhà', 'error');
    },
  });
};

export const useDeleteBuildingMutation = () => {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: async (input: string | { id: string; suppressToast?: boolean }) => {
      const id = typeof input === 'string' ? input : input.id;
      await buildingsApi.delete(id);
      return id;
    },
    onSuccess: () => {
      showToast('Đã xóa tòa nhà thành công', 'success');
      queryClient.invalidateQueries({ queryKey: ['buildings'] });
    },
    onError: (error: any, input) => {
      const suppressToast = typeof input !== 'string' && input?.suppressToast;
      if (!suppressToast) {
        showToast(error?.message || 'Có lỗi khi xóa tòa nhà', 'error');
      }
    },
  });
};
