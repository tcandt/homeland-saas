import { useQuery } from '@tanstack/react-query';
import { dashboardAdapter } from '../api/dashboard.adapter';

export const dashboardKeys = {
  all: ['dashboard'] as const,
  data: () => [...dashboardKeys.all, 'data'] as const,
};

export function useDashboardQuery() {
  return useQuery({
    queryKey: dashboardKeys.data(),
    queryFn: () => dashboardAdapter.getDashboardData(),
  });
}
