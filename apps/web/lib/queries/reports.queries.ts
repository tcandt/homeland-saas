import { useQuery } from "@tanstack/react-query";
import { reportsApi } from "../api/reports.api";
import type { ReportPeriodParams } from "../api/reports.api";

export const reportsKeys = {
  all: ["reports"] as const,
  profitLossHistory: (params?: ReportPeriodParams) =>
    [...reportsKeys.all, "profit-loss-history", params ?? {}] as const,
  revenueByBuilding: (params?: ReportPeriodParams) => [...reportsKeys.all, "revenue-by-building", params ?? {}] as const,
  receivableAging: (params?: ReportPeriodParams) => [...reportsKeys.all, "receivable-aging", params ?? {}] as const,
};

export function useProfitLossHistoryReportQuery(params?: ReportPeriodParams) {
  return useQuery({
    queryKey: reportsKeys.profitLossHistory(params),
    queryFn: async () => {
      const report = await reportsApi.getProfitLossHistory(params);
      return Array.isArray(report?.data) ? report.data : [];
    },
    staleTime: 60 * 1000,
  });
}

export function useRevenueByBuildingReportQuery(params?: ReportPeriodParams) {
  return useQuery({
    queryKey: reportsKeys.revenueByBuilding(params),
    queryFn: () => reportsApi.getRevenueByBuilding(params),
    staleTime: 60 * 1000,
  });
}

export function useReceivableAgingReportQuery(params?: ReportPeriodParams) {
  return useQuery({
    queryKey: reportsKeys.receivableAging(params),
    queryFn: () => reportsApi.getReceivableAging(params),
    staleTime: 60 * 1000,
  });
}
