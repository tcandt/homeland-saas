"use client";

import React, { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  ArrowUpRight,
  Building2,
  CheckCircle2,
  Clock,
  FileText,
  Layers,
  PieChart as PieIcon,
  Receipt,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import { Card } from "@/components/ui/Card";
import { useDashboardQuery } from "@/lib/queries/dashboard.queries";
import {
  useProfitLossHistoryReportQuery,
  useReceivableAgingReportQuery,
  useRevenueByBuildingReportQuery,
} from "@/lib/queries/reports.queries";

function formatVnd(value: number) {
  return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(value || 0)} đ`;
}

function formatCompactVnd(value: number) {
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(1)} Tỷ`;
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)} Tr`;
  }
  return formatVnd(value);
}

const PIE_COLORS = ["#6366f1", "#10b981", "#0ea5e9", "#f59e0b", "#ec4899", "#8b5cf6", "#14b8a6"];

export default function ReportsPage() {
  const dashboardQuery = useDashboardQuery();
  const revenueHistoryQuery = useProfitLossHistoryReportQuery();
  const revenueByBuildingQuery = useRevenueByBuildingReportQuery();
  const receivableAgingQuery = useReceivableAgingReportQuery();

  const dashboard = dashboardQuery.data;
  const revenueHistory = Array.isArray(revenueHistoryQuery.data) ? revenueHistoryQuery.data : [];
  const revenueByBuilding = Array.isArray(revenueByBuildingQuery.data)
    ? revenueByBuildingQuery.data
    : [];
  const receivableAging = Array.isArray(receivableAgingQuery.data)
    ? receivableAgingQuery.data
    : [];
  const buildingHealth = Array.isArray(dashboard?.buildingHealth) ? dashboard.buildingHealth : [];
  const isLoading =
    dashboardQuery.isLoading ||
    revenueHistoryQuery.isLoading ||
    revenueByBuildingQuery.isLoading ||
    receivableAgingQuery.isLoading;

  const summary = useMemo(() => {
    const totals = revenueByBuilding.reduce(
      (result, row) => {
        result.totalRevenue += Number(row.totalAmount || 0);
        result.collected += Number(row.paidAmount || 0);
        result.settled += Number(row.paidAmount || 0) + Number(row.creditAmount || 0);
        result.debt += Number(row.remainingAmount || 0);
        result.invoiceCount += Number(row.invoiceCount || 0);
        return result;
      },
      { totalRevenue: 0, collected: 0, settled: 0, debt: 0, invoiceCount: 0 }
    );
    const totalRooms = Number(dashboard?.occupancy?.totalRooms || 0);
    const occupiedRooms = Number(dashboard?.occupancy?.occupiedRooms || 0);
    const occupancyRate = totalRooms
      ? (occupiedRooms / totalRooms) * 100
      : Number(dashboard?.occupancy?.rate || 0);
    const recoveryRate = totals.totalRevenue ? (totals.collected / totals.totalRevenue) * 100 : 0;
    const revPar = totalRooms ? Math.round(totals.totalRevenue / totalRooms) : 0;

    return {
      ...totals,
      debtInvoiceCount: receivableAging.filter((invoice) => Number(invoice.remainingAmount || 0) > 0).length,
      depositHeld: Number(dashboard?.kpisRaw?.depositHeld || 0),
      activeContracts: Number(dashboard?.operations?.activeContracts || 0),
      expiringContracts: Number(dashboard?.operations?.expiringContracts || 0),
      totalRooms,
      occupiedRooms,
      occupancyRate,
      recoveryRate,
      revPar,
    };
  }, [dashboard, receivableAging, revenueByBuilding]);

  const revenueTrend = useMemo(() => {
    return revenueHistory.map((month: any) => ({
      label: month.month || month.label,
      revenue: Number(month.revenue || 0),
      profit: Number(month.profit || 0),
    }));
  }, [revenueHistory]);

  const revenueStructure = useMemo(() => {
    if (summary.totalRevenue <= 0) {
      return [{ label: "Chưa có phát sinh", value: 1, displayValue: 0, color: "#94a3b8" }];
    }

    const map = new Map<string, number>();
    revenueByBuilding.forEach((row) => {
      const breakdown = row.revenueBreakdown || {};
      const categories = [
        ["Tiền thuê phòng", breakdown.rent],
        ["Tiền điện", breakdown.electricity],
        ["Nước & dịch vụ", breakdown.waterAndService],
        ["Khác", breakdown.other],
      ] as const;
      categories.forEach(([label, amount]) => {
        const value = Number(amount || 0);
        if (value > 0) map.set(label, (map.get(label) || 0) + value);
      });
    });

    const entries = Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
    if (entries.length === 0) {
      return [{ label: "Tiền phòng & Dịch vụ", value: summary.totalRevenue, displayValue: summary.totalRevenue, color: PIE_COLORS[0] }];
    }

    return entries.map(([label, value], idx) => ({
      label,
      value: Math.max(1, value),
      displayValue: value,
      color: PIE_COLORS[idx % PIE_COLORS.length],
    }));
  }, [revenueByBuilding, summary.totalRevenue]);

  const buildingRows = useMemo(() => {
    const grouped = new Map<
      string,
      { code: string; name: string; totalRooms: number; occupiedRooms: number; revenue: number; collected: number; debt: number }
    >();

    buildingHealth.forEach((building: any) => {
      const key = building.code || building.id || building.name;
      grouped.set(key, {
        code: building.code || building.id || "N/A",
        name: building.name || building.code || "Tòa nhà",
        totalRooms: Number(building.rooms || 0),
        occupiedRooms: Number(building.occupied || 0),
        revenue: 0,
        collected: 0,
        debt: 0,
      });
    });

    revenueByBuilding.forEach((row) => {
      const bKey = row.buildingCode || row.buildingId || row.buildingName || "Chưa rõ";
      if (!grouped.has(bKey)) {
        grouped.set(bKey, {
          code: bKey,
          name: row.buildingName || bKey,
          totalRooms: 0,
          occupiedRooms: 0,
          revenue: 0,
          collected: 0,
          debt: 0,
        });
      }
      const target = grouped.get(bKey)!;
      target.revenue += Number(row.totalAmount || 0);
      target.collected += Number(row.paidAmount || 0);
      target.debt += Number(row.remainingAmount || 0);
    });

    const list = Array.from(grouped.values()).filter(
      (row) => row.revenue > 0 || row.totalRooms > 0
    );

    return list.sort((a, b) => b.revenue - a.revenue);
  }, [buildingHealth, revenueByBuilding]);

  const debtRows = useMemo(() => {
    return receivableAging
      .map((invoice) => {
        const total = Number(invoice.totalAmount || 0);
        const debt = Number(invoice.remainingAmount || 0);
        return {
          id: invoice.invoiceId || invoice.invoiceCode,
          code: invoice.invoiceCode,
          name: invoice.customer || "Khách thuê",
          phone: invoice.phone || "",
          roomCode: invoice.roomCode || "--",
          building: invoice.buildingCode || invoice.buildingName || "",
          total,
          settled: Math.max(0, total - debt),
          debt,
          daysOverdue: Number(invoice.daysOverdue || 0),
        };
      })
      .filter((row) => row.debt > 0)
      .sort((a, b) => b.debt - a.debt)
      .slice(0, 10);
  }, [receivableAging]);

  return (
    <AppShell>
      <div data-testid="reports-root" className="flex flex-col gap-3.5 pb-10">
        {/* 1. 6 SLIM LUXURY KPI METRIC CARDS (AGGREGATED ACROSS ALL 4 BUILDINGS) */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2.5">
          {/* Total Revenue */}
          <Card className="flex flex-col justify-between rounded-xl border border-border/70 bg-card p-3 shadow-2xs hover:border-primary/40 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-muted uppercase tracking-wider">Phát sinh thuê</span>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                <Receipt size={14} />
              </div>
            </div>
            <div className="mt-2 font-mono font-black text-lg text-text tracking-tight leading-tight">
              {isLoading ? "..." : formatCompactVnd(summary.totalRevenue)}
            </div>
            <div className="mt-1 flex items-center gap-1 text-[10px] font-bold text-muted truncate">
              <span>{summary.invoiceCount} hóa đơn thuê/phí đã phát sinh</span>
            </div>
          </Card>

          {/* Collected / Paid */}
          <Card className="flex flex-col justify-between rounded-xl border border-border/70 bg-card p-3 shadow-2xs hover:border-emerald-500/40 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-muted uppercase tracking-wider">Thực thu thuê</span>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <WalletCards size={14} />
              </div>
            </div>
            <div className="mt-2 font-mono font-black text-lg text-emerald-600 dark:text-emerald-400 tracking-tight leading-tight">
              {isLoading ? "..." : formatCompactVnd(summary.collected)}
            </div>
            <div className="mt-1 flex items-center gap-1 text-[10px] font-bold text-emerald-600 truncate">
              <ArrowUpRight size={12} />
              <span>Thu hồi: {summary.recoveryRate.toFixed(1)}%</span>
            </div>
          </Card>

          {/* Outstanding Debt */}
          <Card className="flex flex-col justify-between rounded-xl border border-border/70 bg-card p-3 shadow-2xs hover:border-amber-500/40 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-muted uppercase tracking-wider">Công nợ tồn</span>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                <AlertTriangle size={14} />
              </div>
            </div>
            <div className="mt-2 font-mono font-black text-lg text-amber-600 dark:text-amber-400 tracking-tight leading-tight">
              {isLoading ? "..." : formatCompactVnd(summary.debt)}
            </div>
            <div className="mt-1 flex items-center gap-1 text-[10px] font-bold text-amber-600 truncate">
              <span>{summary.debtInvoiceCount} hóa đơn chưa thu</span>
            </div>
          </Card>

          {/* Occupancy Rate */}
          <Card className="flex flex-col justify-between rounded-xl border border-border/70 bg-card p-3 shadow-2xs hover:border-sky-500/40 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-muted uppercase tracking-wider">Tỷ lệ lấp đầy</span>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                <Building2 size={14} />
              </div>
            </div>
            <div className="mt-2 font-mono font-black text-lg text-sky-600 dark:text-sky-400 tracking-tight leading-tight">
              {isLoading ? "..." : `${summary.occupancyRate.toFixed(1)}%`}
            </div>
            <div className="mt-1 flex items-center gap-1 text-[10px] font-bold text-muted truncate">
              <span>{summary.occupiedRooms}/{summary.totalRooms} phòng có khách</span>
            </div>
          </Card>

          {/* Active Contracts */}
          <Card className="flex flex-col justify-between rounded-xl border border-border/70 bg-card p-3 shadow-2xs hover:border-purple-500/40 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-muted uppercase tracking-wider">Hợp đồng hiệu lực</span>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                <FileText size={14} />
              </div>
            </div>
            <div className="mt-2 font-mono font-black text-lg text-purple-600 dark:text-purple-400 tracking-tight leading-tight">
              {isLoading ? "..." : `${summary.activeContracts} HĐ`}
            </div>
            <div className="mt-1 flex items-center gap-1 text-[10px] font-bold text-orange-500 truncate">
              <span>{summary.expiringContracts} HĐ sắp đến hạn</span>
            </div>
          </Card>

          {/* RevPAR / Average Revenue Per Room */}
          <Card className="flex flex-col justify-between rounded-xl border border-border/70 bg-card p-3 shadow-2xs hover:border-teal-500/40 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-muted uppercase tracking-wider">Cọc đang giữ</span>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20">
                <TrendingUp size={14} />
              </div>
            </div>
            <div className="mt-2 font-mono font-black text-lg text-teal-600 dark:text-teal-400 tracking-tight leading-tight">
              {isLoading ? "..." : formatCompactVnd(summary.depositHeld)}
            </div>
            <div className="mt-1 flex items-center gap-1 text-[10px] font-bold text-muted truncate">
              <span>Không ghi nhận vào doanh thu</span>
            </div>
          </Card>
        </div>

        {/* 2. MAIN CHARTS SECTION */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-3.5">
          {/* 6-Month Revenue vs Profit Area Chart (8 Cols) */}
          <div className="xl:col-span-8 rounded-2xl border border-border/70 bg-card p-4 md:p-5 shadow-2xs flex flex-col justify-between">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-3">
              <div>
                <h2 className="text-sm md:text-base font-black text-text tracking-tight flex items-center gap-2">
                  <TrendingUp size={16} className="text-primary" />
                  <span>Xu hướng Doanh thu vs Lợi nhuận (Tổng hợp 6 tháng)</span>
                </h2>
                <p className="text-xs text-muted font-medium mt-0.5">
                  Dữ liệu ghi nhận từ sổ cái doanh thu và chi phí theo từng tháng.
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0 text-xs font-bold">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                  <span className="text-text">Doanh thu</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span className="text-text">Lợi nhuận</span>
                </div>
              </div>
            </div>

            <div className="h-[280px] w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="colorCollected" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fontWeight: 700, fill: "var(--muted)" }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: "var(--muted)" }}
                    tickFormatter={(val) => `${Math.round(Number(val) / 1000000)}M`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    name="Doanh thu"
                    stroke="#6366f1"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#colorRevenue)"
                  />
                  <Area
                    type="monotone"
                    dataKey="profit"
                    name="Lợi nhuận"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#colorCollected)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Revenue Structure Donut Chart (4 Cols) */}
          <div className="xl:col-span-4 rounded-2xl border border-border/70 bg-card p-4 md:p-5 shadow-2xs flex flex-col justify-between">
            <div className="border-b border-border/60 pb-3">
              <h2 className="text-sm md:text-base font-black text-text tracking-tight flex items-center gap-2">
                <PieIcon size={16} className="text-indigo-500" />
                <span>Cơ cấu hóa đơn thuê/phí</span>
              </h2>
              <p className="text-xs text-muted font-medium mt-0.5">
                Tỷ trọng tiền thuê, điện, nước và dịch vụ; không tính cọc giữ phòng.
              </p>
            </div>

            <div className="relative h-[200px] w-full flex items-center justify-center my-2">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={revenueStructure}
                    dataKey="value"
                    nameKey="label"
                    innerRadius={60}
                    outerRadius={85}
                    paddingAngle={3}
                    stroke="var(--card)"
                    strokeWidth={3}
                  >
                    {revenueStructure.map((entry, idx) => (
                      <Cell key={`cell-${idx}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="font-mono font-black text-sm md:text-base text-text">
                  {formatCompactVnd(summary.totalRevenue)}
                </span>
                <span className="text-[10px] font-bold text-muted uppercase tracking-wider">Phát sinh thuê</span>
              </div>
            </div>

            {/* Legend Badges */}
            <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
              {revenueStructure.map((item) => {
                const percent =
                  summary.totalRevenue > 0
                    ? ((item.displayValue / summary.totalRevenue) * 100).toFixed(1)
                    : "0.0";
                return (
                  <div
                    key={item.label}
                    className="flex items-center justify-between gap-2 rounded-lg bg-muted/5 p-1.5 text-xs font-semibold"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                      <span className="text-text font-bold truncate text-[11px]">{item.label}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono font-bold text-muted text-[11px]">{formatCompactVnd(item.displayValue)}</span>
                      <span className="rounded bg-background px-1.5 py-0.5 text-[10px] font-black text-text border border-border/60">
                        {percent}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 3. ALL 4 BUILDINGS PERFORMANCE COMPARISON TABLE */}
        <div className="rounded-2xl border border-border/70 bg-card shadow-2xs overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 p-4 bg-muted/5">
            <div>
              <h2 className="text-sm md:text-base font-black text-text tracking-tight flex items-center gap-2">
                <Building2 size={16} className="text-primary" />
                <span>Hiệu suất kinh doanh & Thu hồi của 4 Tòa nhà</span>
              </h2>
              <p className="text-xs text-muted font-medium mt-0.5">
                Bảng so sánh phát sinh hóa đơn thuê/phí, số tiền đã thu, công nợ và tỷ lệ lấp đầy của toàn bộ cơ sở.
              </p>
            </div>
            <span className="text-xs font-bold text-muted">
              {buildingRows.length} tòa nhà đang vận hành
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="border-b border-border/70 bg-card text-[10px] uppercase font-black text-muted select-none">
                <tr>
                  <th className="px-4 py-3">Tòa nhà / Cơ sở</th>
                  <th className="px-4 py-3 text-center">Lấp đầy phòng</th>
                  <th className="px-4 py-3 text-right">Phát sinh thuê/phí</th>
                  <th className="px-4 py-3 text-right">Thực thu nhận</th>
                  <th className="px-4 py-3 text-right">Công nợ tồn</th>
                  <th className="px-4 py-3 text-center">Tỷ lệ thu hồi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {buildingRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted font-medium">
                      Không có dữ liệu tòa nhà nào.
                    </td>
                  </tr>
                ) : (
                  buildingRows.map((row) => {
                    const recovery = row.revenue > 0 ? Math.round((row.collected / row.revenue) * 100) : 0;
                    const occRate = row.totalRooms > 0 ? Math.round((row.occupiedRooms / row.totalRooms) * 100) : 0;
                    return (
                      <tr key={row.code} className="hover:bg-muted/10 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center font-bold text-xs shrink-0">
                              {row.code.slice(0, 3)}
                            </div>
                            <div>
                              <div className="font-bold text-text text-xs">{row.name}</div>
                              <div className="text-[10px] font-mono text-muted">Mã: {row.code}</div>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3 text-center">
                          <div className="inline-flex flex-col items-center">
                            <span className="font-bold text-text text-xs">{occRate}%</span>
                            <span className="text-[10px] text-muted">{row.occupiedRooms}/{row.totalRooms} phòng</span>
                          </div>
                        </td>

                        <td className="px-4 py-3 text-right font-mono font-bold text-text">
                          {formatVnd(row.revenue)}
                        </td>

                        <td className="px-4 py-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {formatVnd(row.collected)}
                        </td>

                        <td className="px-4 py-3 text-right font-mono font-bold text-amber-600 dark:text-amber-400">
                          {formatVnd(row.debt)}
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-24 h-2 rounded-full bg-muted/20 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  recovery >= 80 ? "bg-emerald-500" : recovery >= 50 ? "bg-amber-500" : "bg-rose-500"
                                }`}
                                style={{ width: `${Math.min(100, recovery)}%` }}
                              />
                            </div>
                            <span
                              className={`text-[11px] font-bold ${
                                recovery >= 80 ? "text-emerald-600" : recovery >= 50 ? "text-amber-600" : "text-rose-600"
                              }`}
                            >
                              {recovery}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 4. DEBTORS TABLE ACROSS ALL 4 BUILDINGS */}
        <div className="rounded-2xl border border-border/70 bg-card shadow-2xs overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 p-4 bg-muted/5">
            <div>
              <h2 className="text-sm md:text-base font-black text-text tracking-tight flex items-center gap-2">
                <AlertTriangle size={16} className="text-amber-500" />
                <span>Danh sách Khách thuê còn công nợ (Top Aging Debt)</span>
              </h2>
              <p className="text-xs text-muted font-medium mt-0.5">
                Ưu tiên đôn đốc các hóa đơn chưa thu hoặc đã quá hạn thanh toán trên toàn hệ thống.
              </p>
            </div>
            <span className="text-xs font-bold text-rose-600 dark:text-rose-400">
              Tổng nợ: {formatVnd(summary.debt)}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="border-b border-border/70 bg-card text-[10px] uppercase font-black text-muted select-none">
                <tr>
                  <th className="px-4 py-3">Khách thuê / Phòng</th>
                  <th className="px-4 py-3">Mã Hóa đơn</th>
                  <th className="px-4 py-3 text-right">Tổng tiền HĐ</th>
                  <th className="px-4 py-3 text-right">Đã xử lý</th>
                  <th className="px-4 py-3 text-right">Còn nợ lại</th>
                  <th className="px-4 py-3 text-center">Tình trạng quá hạn</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {debtRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted font-medium">
                      🎉 Tuyệt vời! Hiện không có công nợ tồn đọng nào cần thu.
                    </td>
                  </tr>
                ) : (
                  debtRows.map((item) => (
                    <tr key={item.id} className="hover:bg-muted/10 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-500/20 to-orange-500/20 text-amber-700 dark:text-amber-300 font-bold text-xs flex items-center justify-center shrink-0 border border-amber-500/30">
                            {item.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-text text-xs">{item.name}</div>
                            <div className="flex items-center gap-1 text-[10px] text-muted">
                              <span className="font-semibold text-primary">P.{item.roomCode}</span>
                              {item.building && <span>• {item.building}</span>}
                              {item.phone && <span>• {item.phone}</span>}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3 font-mono font-semibold text-text text-xs">
                        {item.code}
                      </td>

                      <td className="px-4 py-3 text-right font-mono font-bold text-text">
                        {formatVnd(item.total)}
                      </td>

                      <td className="px-4 py-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {formatVnd(item.settled)}
                      </td>

                      <td className="px-4 py-3 text-right font-mono font-black text-rose-600 dark:text-rose-400">
                        {formatVnd(item.debt)}
                      </td>

                      <td className="px-4 py-3 text-center">
                        {item.daysOverdue > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 border border-rose-500/20">
                            Quá hạn {item.daysOverdue} ngày
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20">
                            Trong hạn
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 5. CONTRACT LIFECYCLE & STATS */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <Card className="p-4 rounded-xl border border-border/70 bg-card shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-muted">Tổng hóa đơn thuê/phí</span>
              <FileText size={16} className="text-primary" />
            </div>
            <div className="mt-2 font-mono font-black text-xl text-text">{summary.invoiceCount}</div>
            <div className="mt-1 text-[11px] text-muted">Đã loại trừ hóa đơn cọc giữ phòng</div>
          </Card>

          <Card className="p-4 rounded-xl border border-border/70 bg-card shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-muted">Đang hiệu lực</span>
              <CheckCircle2 size={16} className="text-emerald-500" />
            </div>
            <div className="mt-2 font-mono font-black text-xl text-emerald-600 dark:text-emerald-400">
              {summary.activeContracts}
            </div>
            <div className="mt-1 text-[11px] text-emerald-600">Khách đang thuê và sinh sống</div>
          </Card>

          <Card className="p-4 rounded-xl border border-border/70 bg-card shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-muted">Sắp hết hạn (30 ngày)</span>
              <Clock size={16} className="text-amber-500" />
            </div>
            <div className="mt-2 font-mono font-black text-xl text-amber-600 dark:text-amber-400">
              {summary.expiringContracts}
            </div>
            <div className="mt-1 text-[11px] text-amber-600">Cần chủ động liên hệ gia hạn</div>
          </Card>

          <Card className="p-4 rounded-xl border border-border/70 bg-card shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-muted">Hóa đơn chưa thu</span>
              <Layers size={16} className="text-muted" />
            </div>
            <div className="mt-2 font-mono font-black text-xl text-muted">
              {summary.debtInvoiceCount}
            </div>
            <div className="mt-1 text-[11px] text-muted">Cần theo dõi thanh toán</div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="rounded-xl border border-border bg-card p-3 shadow-xl text-xs">
      <div className="font-bold text-text mb-1.5 pb-1 border-b border-border/60">{label}</div>
      {payload.map((entry: any, index: number) => (
        <div key={`item-${index}`} className="flex items-center justify-between gap-4 py-0.5">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-muted font-medium">{entry.name}:</span>
          </div>
          <span className="font-mono font-bold text-text">{formatVnd(Number(entry.value))}</span>
        </div>
      ))}
    </div>
  );
}

function PieTooltip({ active, payload }: any) {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0];
  return (
    <div className="rounded-xl border border-border bg-card p-2.5 shadow-xl text-xs">
      <div className="flex items-center gap-1.5 mb-1">
        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: data.payload.color }} />
        <span className="font-bold text-text">{data.name}</span>
      </div>
      <div className="font-mono font-black text-text">{formatVnd(Number(data.payload.displayValue))}</div>
    </div>
  );
}
