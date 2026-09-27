import { apiClient } from "./client";

export type RevenueByBuildingReportRow = {
  buildingId: string | null;
  buildingCode: string | null;
  buildingName: string;
  invoiceCount: number;
  totalAmount: number;
  paidAmount: number;
  creditAmount: number;
  remainingAmount: number;
  revenueBreakdown: {
    rent: number;
    electricity: number;
    waterAndService: number;
    other: number;
  };
};

export type ReceivableAgingReportRow = {
  invoiceId: string;
  invoiceCode: string;
  customerId: string;
  customer: string;
  phone: string | null;
  roomId: string | null;
  roomCode: string | null;
  buildingId: string | null;
  buildingCode: string | null;
  buildingName: string | null;
  dueDate: string;
  totalAmount: number;
  remainingAmount: number;
  daysOverdue: number;
  agingBucket: string;
};

export type ProfitLossHistoryReportRow = {
  month: string;
  key: string;
  period: {
    year: number;
    month: number;
    startDate: string;
    endDate: string;
  };
  revenue: number;
  expense: number;
  profit: number;
};

export type ProfitLossHistoryReport = {
  period: {
    months: number;
    endYear: number;
    endMonth: number;
  };
  data: ProfitLossHistoryReportRow[];
};

export const reportsApi = {
  getProfitLossHistory: (params?: { months?: number; year?: number; month?: number }) =>
    apiClient.get<ProfitLossHistoryReport>("/finance/profit-loss-history", { params }),
  getRevenueByBuilding: () =>
    apiClient.get<RevenueByBuildingReportRow[]>("/reports/revenue-by-building"),
  getReceivableAging: () =>
    apiClient.get<ReceivableAgingReportRow[]>("/reports/receivable-aging"),
};
