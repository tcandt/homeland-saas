import { useQuery } from '@tanstack/react-query';
import { buildingsApi } from '../api/buildings.api';
import { adaptBuilding } from '../adapters/building.adapter';
import type { Building } from '@/components/buildings/building.types';

export const useBuildingsQuery = (params?: any) => {
  return useQuery({
    queryKey: ['buildings', params],
    queryFn: async () => {
      const response = await buildingsApi.list(params);
      const items = Array.isArray(response) ? response : (response as any).items || [];
      return items.map(adaptBuilding);
    },
  });
};

export const useBuildingDetailQuery = (id: string, enabled = true) => {
  return useQuery({
    queryKey: ['buildings', id],
    queryFn: async () => {
      const response = await buildingsApi.getDetail(id);
      return adaptBuilding(response);
    },
    enabled: enabled && !!id,
  });
};
