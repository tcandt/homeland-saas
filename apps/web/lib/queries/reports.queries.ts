import { useQuery } from "@tanstack/react-query";
import { reportsApi } from "../api/reports.api";

export const reportsKeys = {
  all: ["reports"] as const,
  profitLossHistory: (params?: { months?: number; year?: number; month?: number }) =>
    [...reportsKeys.all, "profit-loss-history", params ?? {}] as const,
  revenueByBuilding: () => [...reportsKeys.all, "revenue-by-building"] as const,
  receivableAging: () => [...reportsKeys.all, "receivable-aging"] as const,
};

export function useProfitLossHistoryReportQuery(params?: { months?: number; year?: number; month?: number }) {
  return useQuery({
    queryKey: reportsKeys.profitLossHistory(params),
    queryFn: async () => {
      const report = await reportsApi.getProfitLossHistory(params);
      return Array.isArray(report?.data) ? report.data : [];
    },
    staleTime: 60 * 1000,
  });
}

export function useRevenueByBuildingReportQuery() {
  return useQuery({
    queryKey: reportsKeys.revenueByBuilding(),
    queryFn: reportsApi.getRevenueByBuilding,
    staleTime: 60 * 1000,
  });
}

export function useReceivableAgingReportQuery() {
  return useQuery({
    queryKey: reportsKeys.receivableAging(),
    queryFn: reportsApi.getReceivableAging,
    staleTime: 60 * 1000,
  });
}
