import { useQuery } from '@tanstack/react-query';
import { roomsApi } from '../api/rooms.api';
import { adaptRoom } from '../adapters/building.adapter'; // Using the same file for now as it contains both

export const useRoomsQuery = (params?: any) => {
  return useQuery({
    queryKey: ['rooms', params],
    queryFn: async () => {
      const response = await roomsApi.list(params);
      const items = Array.isArray(response) ? response : (response as any).items || [];
      return items.map(adaptRoom);
    },
  });
};

export const useRoomDetailQuery = (id: string, enabled = true) => {
  return useQuery({
    queryKey: ['rooms', id],
    queryFn: async () => {
      const response = await roomsApi.getDetail(id);
      return adaptRoom(response);
    },
    enabled: enabled && !!id,
  });
};
