import { useMutation, useQueryClient } from '@tanstack/react-query';
import { roomsApi } from '../api/rooms.api';
import { useToast } from '@/components/ui/ToastContext';
import { adaptRoom } from '../adapters/building.adapter';
import { Building, Room } from '@/components/buildings/mockData';

export const useCreateRoomMutation = () => {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: async (data: any) => {
      const response = await roomsApi.create(data);
      return adaptRoom(response);
    },
    onSuccess: () => {
      showToast('Thêm phòng thành công', 'success');
      queryClient.invalidateQueries({ queryKey: ['buildings'] });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
    },
    onError: (error: any) => {
      showToast(error?.message || 'Có lỗi khi thêm phòng', 'error');
    },
  });
};

export const useUpdateRoomMutation = () => {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await roomsApi.update(id, data);
      return adaptRoom(response);
    },
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ['buildings'] });
      await queryClient.cancelQueries({ queryKey: ['rooms'] });
      
      const previousBuildings = queryClient.getQueryData<Building[]>(['buildings']);
      const previousRooms = queryClient.getQueryData<Room[]>(['rooms']);

      if (previousBuildings) {
        queryClient.setQueryData<Building[]>(['buildings'], (old) => {
          if (!old) return old;
          return old.map(b => ({
            ...b,
            floors: b.floors.map(f => ({
              ...f,
              rooms: f.rooms.map(r => r.id === id ? { ...r, ...data } : r)
            }))
          }));
        });
      }

      if (previousRooms) {
        queryClient.setQueryData<Room[]>(['rooms'], (old) => {
          if (!old) return old;
          return old.map(r => r.id === id ? { ...r, ...data } : r);
        });
      }

      return { previousBuildings, previousRooms };
    },
    onError: (err, newRoom, context: any) => {
      if (context?.previousBuildings) {
        queryClient.setQueryData(['buildings'], context.previousBuildings);
      }
      if (context?.previousRooms) {
        queryClient.setQueryData(['rooms'], context.previousRooms);
      }
      showToast(err?.message || 'Có lỗi khi cập nhật phòng', 'error');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['buildings'] });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
    },
    onSuccess: () => {
      showToast('Cập nhật phòng thành công', 'success');
    }
  });
};

export const useDeleteRoomMutation = () => {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      await roomsApi.delete(id);
      return id;
    },
    onSuccess: () => {
      showToast('Đã xóa phòng thành công', 'success');
      queryClient.invalidateQueries({ queryKey: ['buildings'] });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
    },
    onError: (error: any) => {
      showToast(error?.message || 'Có lỗi khi xóa phòng', 'error');
    },
  });
};
