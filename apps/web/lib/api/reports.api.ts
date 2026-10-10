import { apiClient } from "./client";

export type RevenueByBuildingReportRow = {
  buildingId: string | null;
  buildingCode: string | null;
  buildingName: string;
  invoiceCount: number;
  totalAmount: number;
  operatingRevenueAmount: number;
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

export type ReportPeriodParams = {
  startDate?: string;
  endDate?: string;
  months?: number;
  year?: number;
  month?: number;
};

export const reportsApi = {
  getProfitLossHistory: (params?: ReportPeriodParams) =>
    apiClient.get<ProfitLossHistoryReport>("/finance/profit-loss-history", { params }),
  getRevenueByBuilding: (params?: ReportPeriodParams) =>
    apiClient.get<RevenueByBuildingReportRow[]>("/reports/revenue-by-building", { params }),
  getReceivableAging: (params?: ReportPeriodParams) =>
    apiClient.get<ReceivableAgingReportRow[]>("/reports/receivable-aging", { params }),
};
