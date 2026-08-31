import { useQuery } from '@tanstack/react-query';
import { dashboardAdapter } from '../api/dashboard.adapter';
import { apiClient } from '../api/client';

export const dashboardKeys = {
  all: ['dashboard'] as const,
  data: () => [...dashboardKeys.all, 'data'] as const,
  revenueHistory: () => [...dashboardKeys.all, 'revenue-history'] as const,
};

export function useDashboardQuery() {
  return useQuery({
    queryKey: dashboardKeys.data(),
    queryFn: () => dashboardAdapter.getDashboardData(),
    staleTime: 60 * 1000,
  });
}

export function useRevenueHistoryQuery() {
  return useQuery({
    queryKey: dashboardKeys.revenueHistory(),
    queryFn: async () => {
      try {
        const res: any = await apiClient.get('/dashboard/revenue-history');
        const data = Array.isArray(res) ? res : (res?.data || []);
        return Array.isArray(data) ? data : [];
      } catch {
        return [];
      }
    },
    staleTime: 5 * 60 * 1000,
  });
}
