import { useQuery } from '@tanstack/react-query';
import { buildingsApi } from '../api/buildings.api';
import { adaptBuilding } from '../adapters/building.adapter';
import { Building } from '@/components/buildings/mockData';

export const useBuildingsQuery = (params?: any) => {
  return useQuery({
    queryKey: ['buildings', params],
    queryFn: async () => {
      const response = await buildingsApi.list(params);
      // Fetch full details to get floors and rooms for KPI calculations
      const items = Array.isArray(response) ? response : (response as any).items || [];
      const detailedBuildings = await Promise.all(
        items.map((b: any) => buildingsApi.getDetail(b.id))
      );
      return detailedBuildings.map(adaptBuilding);
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
