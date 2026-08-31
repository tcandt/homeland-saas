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
import { getInvoiceFinancials } from "@/lib/invoices/invoice-financials";
import { useBuildingsQuery } from "@/lib/queries/buildings.queries";
import { useContractsQuery } from "@/lib/queries/contracts.queries";
import { useInvoicesQuery } from "@/lib/queries/invoices.queries";
import { useRoomsQuery } from "@/lib/queries/rooms.queries";

function getList(response: any): any[] {
  if (Array.isArray(response)) return response;
  const data = response?.data;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

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

function buildingLabel(item: any) {
  return (
    item?.room?.building?.name ||
    item?.room?.building?.code ||
    item?.building?.name ||
    item?.building?.code ||
    item?.buildingCode ||
    "Toàn hệ thống"
  );
}

const reportableInvoiceStatuses = new Set(["ISSUED", "PARTIALLY_PAID", "OVERDUE", "PAID"]);

const PIE_COLORS = ["#6366f1", "#10b981", "#0ea5e9", "#f59e0b", "#ec4899", "#8b5cf6", "#14b8a6"];

export default function ReportsPage() {
  const buildingsQuery = useBuildingsQuery({ limit: 100 });
  const invoicesQuery = useInvoicesQuery({ limit: 500 });
  const contractsQuery = useContractsQuery({ limit: 500 });
  const roomsQuery = useRoomsQuery({ limit: 500 });

  const rawBuildings = getList(buildingsQuery.data);
  const invoices = getList(invoicesQuery.data).filter((invoice) =>
    reportableInvoiceStatuses.has(invoice.status)
  );
  const contracts = getList(contractsQuery.data);
  const rooms = getList(roomsQuery.data);

  const isLoading =
    invoicesQuery.isLoading || contractsQuery.isLoading || roomsQuery.isLoading;

  // Overall Financial & Operational Summary for all 4 buildings combined
  const summary = useMemo(() => {
    const totals = invoices.reduce(
      (result, invoice) => {
        const financials = getInvoiceFinancials(invoice);
        result.totalRevenue += financials.total;
        result.collected += financials.paid;
        result.settled += financials.settled;
        result.debt += financials.remaining;
        if (financials.remaining > 0) result.debtInvoiceCount += 1;
        return result;
      },
      { totalRevenue: 0, collected: 0, settled: 0, debt: 0, debtInvoiceCount: 0 }
    );

    const activeContracts = contracts.filter((contract) => contract.status === "ACTIVE").length;
    const expiringContracts = contracts.filter((contract) => contract.status === "EXPIRING").length;

    const occupiedRooms = rooms.filter((room) =>
      ["occupied", "rented", "active", "expiring_soon"].includes(
        String(room.status || "").toLowerCase()
      )
    ).length;

    const occupancyRate = rooms.length ? (occupiedRooms / rooms.length) * 100 : 0;
    const recoveryRate = totals.totalRevenue ? (totals.settled / totals.totalRevenue) * 100 : 0;
    const revPar = rooms.length ? Math.round(totals.totalRevenue / rooms.length) : 0;

    return {
      ...totals,
      activeContracts,
      expiringContracts,
      totalRooms: rooms.length,
      occupiedRooms,
      occupancyRate,
      recoveryRate,
      revPar,
    };
  }, [contracts, invoices, rooms]);

  // 6-Month Combined Revenue & Collection Trend
  const revenueTrend = useMemo(() => {
    const current = new Date();
    const months = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(current.getFullYear(), current.getMonth() - (5 - index), 1);
      return {
        key: `${date.getFullYear()}-${date.getMonth()}`,
        label: `T${date.getMonth() + 1}/${date.getFullYear()}`,
        revenue: 0,
        collected: 0,
        debt: 0,
      };
    });
    const byMonth = new Map(months.map((month) => [month.key, month]));

    invoices.forEach((invoice) => {
      const date = new Date(invoice.createdAt || invoice.dueDate);
      if (Number.isNaN(date.getTime())) return;
      const month = byMonth.get(`${date.getFullYear()}-${date.getMonth()}`);
      if (!month) return;
      const financials = getInvoiceFinancials(invoice);
      month.revenue += financials.total;
      month.collected += financials.paid;
      month.debt += financials.remaining;
    });

    return months;
  }, [invoices]);

  // Revenue Structure (Donut Chart)
  const revenueStructure = useMemo(() => {
    if (summary.totalRevenue <= 0) {
      return [{ label: "Chưa có phát sinh", value: 1, displayValue: 0, color: "#94a3b8" }];
    }

    const map = new Map<string, number>();
    invoices.forEach((invoice) => {
      const items = invoice.items || invoice.invoiceItems || [];
      if (Array.isArray(items) && items.length > 0) {
        items.forEach((item: any) => {
          const type = item.type || item.category || "Tiền phòng";
          const title =
            type === "ROOM" || type === "RENT"
              ? "Tiền thuê phòng"
              : type === "ELECTRICITY" || type === "ELECTRIC"
              ? "Tiền điện"
              : type === "WATER"
              ? "Tiền nước"
              : type === "SERVICE" || type === "SERVICE_FEE"
              ? "Dịch vụ & Tiện ích"
              : type === "PARKING"
              ? "Gửi xe"
              : item.name || "Khác";
          const amount = Number(item.amount || item.total || item.unitPrice * (item.quantity || 1) || 0);
          map.set(title, (map.get(title) || 0) + amount);
        });
      } else {
        const title = "Tiền thuê phòng";
        const amt = getInvoiceFinancials(invoice).total;
        map.set(title, (map.get(title) || 0) + amt);
      }
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
  }, [invoices, summary.totalRevenue]);

  // All 4 Buildings Performance Comparison Table
  const buildingRows = useMemo(() => {
    const grouped = new Map<
      string,
      { code: string; name: string; totalRooms: number; occupiedRooms: number; revenue: number; collected: number; debt: number }
    >();

    // Seed with all buildings
    rawBuildings.forEach((b: any) => {
      grouped.set(b.code || b.name, {
        code: b.code || "N/A",
        name: b.name || b.code || "Tòa nhà",
        totalRooms: 0,
        occupiedRooms: 0,
        revenue: 0,
        collected: 0,
        debt: 0,
      });
    });

    // Populate rooms
    rooms.forEach((r: any) => {
      const bKey = r?.building?.code || r?.building?.name || r?.buildingCode || "Chưa rõ";
      if (!grouped.has(bKey)) {
        grouped.set(bKey, {
          code: bKey,
          name: r?.building?.name || bKey,
          totalRooms: 0,
          occupiedRooms: 0,
          revenue: 0,
          collected: 0,
          debt: 0,
        });
      }
      const target = grouped.get(bKey)!;
      target.totalRooms += 1;
      if (["occupied", "rented", "active", "expiring_soon"].includes(String(r.status || "").toLowerCase())) {
        target.occupiedRooms += 1;
      }
    });

    // Populate revenue
    invoices.forEach((invoice) => {
      const bKey = buildingLabel(invoice);
      if (!grouped.has(bKey)) {
        grouped.set(bKey, {
          code: bKey,
          name: bKey,
          totalRooms: 0,
          occupiedRooms: 0,
          revenue: 0,
          collected: 0,
          debt: 0,
        });
      }
      const target = grouped.get(bKey)!;
      const financials = getInvoiceFinancials(invoice);
      target.revenue += financials.total;
      target.collected += financials.paid;
      target.debt += financials.remaining;
    });

    const list = Array.from(grouped.values()).filter(
      (row) => row.revenue > 0 || row.totalRooms > 0
    );

    return list.sort((a, b) => b.revenue - a.revenue);
  }, [rawBuildings, invoices, rooms]);

  // Combined Debtors Table
  const debtRows = useMemo(() => {
    return invoices
      .map((invoice) => {
        const financials = getInvoiceFinancials(invoice);
        const name =
          invoice.customer?.fullName ||
          invoice.customer?.name ||
          invoice.tenant?.name ||
          invoice.tenantName ||
          "Khách thuê";
        const roomCode =
          invoice.room?.code ||
          invoice.roomCode ||
          invoice.contract?.room?.number ||
          invoice.contract?.room?.code ||
          "--";
        const building =
          invoice.room?.building?.code ||
          invoice.building?.code ||
          invoice.buildingCode ||
          "";
        const daysOverdue = invoice.dueDate
          ? Math.max(0, Math.floor((Date.now() - new Date(invoice.dueDate).getTime()) / 86400000))
          : 0;

        return {
          id: invoice.id || invoice.code,
          code: invoice.code || invoice.invoiceNumber || "HD-",
          name,
          phone: invoice.customer?.phone || invoice.tenant?.phone || "--",
          roomCode,
          building,
          total: financials.total,
          paid: financials.paid,
          debt: financials.remaining,
          dueDate: invoice.dueDate,
          daysOverdue,
        };
      })
      .filter((row) => row.debt > 0)
      .sort((a, b) => b.debt - a.debt)
      .slice(0, 10);
  }, [invoices]);

  return (
    <AppShell>
      <div data-testid="reports-root" className="flex flex-col gap-3.5 pb-10">
        {/* 1. 6 SLIM LUXURY KPI METRIC CARDS (AGGREGATED ACROSS ALL 4 BUILDINGS) */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2.5">
          {/* Total Revenue */}
          <Card className="flex flex-col justify-between rounded-xl border border-border/70 bg-card p-3 shadow-2xs hover:border-primary/40 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-muted uppercase tracking-wider">Tổng doanh thu</span>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                <Receipt size={14} />
              </div>
            </div>
            <div className="mt-2 font-mono font-black text-lg text-text tracking-tight leading-tight">
              {isLoading ? "..." : formatCompactVnd(summary.totalRevenue)}
            </div>
            <div className="mt-1 flex items-center gap-1 text-[10px] font-bold text-muted truncate">
              <span>{invoices.length} hóa đơn phát hành</span>
            </div>
          </Card>

          {/* Collected / Paid */}
          <Card className="flex flex-col justify-between rounded-xl border border-border/70 bg-card p-3 shadow-2xs hover:border-emerald-500/40 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-muted uppercase tracking-wider">Thực thu nhận</span>
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
              <span className="text-[10px] font-bold text-muted uppercase tracking-wider">Doanh thu / Phòng</span>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20">
                <TrendingUp size={14} />
              </div>
            </div>
            <div className="mt-2 font-mono font-black text-lg text-teal-600 dark:text-teal-400 tracking-tight leading-tight">
              {isLoading ? "..." : formatCompactVnd(summary.revPar)}
            </div>
            <div className="mt-1 flex items-center gap-1 text-[10px] font-bold text-muted truncate">
              <span>Toàn bộ 4 tòa nhà</span>
            </div>
          </Card>
        </div>

        {/* 2. MAIN CHARTS SECTION */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-3.5">
          {/* 6-Month Revenue vs Collection Area Chart (8 Cols) */}
          <div className="xl:col-span-8 rounded-2xl border border-border/70 bg-card p-4 md:p-5 shadow-2xs flex flex-col justify-between">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-3">
              <div>
                <h2 className="text-sm md:text-base font-black text-text tracking-tight flex items-center gap-2">
                  <TrendingUp size={16} className="text-primary" />
                  <span>Xu hướng Doanh thu vs Thực thu (Tổng hợp 6 tháng)</span>
                </h2>
                <p className="text-xs text-muted font-medium mt-0.5">
                  So sánh dòng tiền phát sinh trên hóa đơn và số tiền thực tế đã thu hồi trên toàn bộ 4 tòa nhà.
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0 text-xs font-bold">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                  <span className="text-text">Phát sinh</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span className="text-text">Thực thu</span>
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
                    name="Doanh thu phát sinh"
                    stroke="#6366f1"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#colorRevenue)"
                  />
                  <Area
                    type="monotone"
                    dataKey="collected"
                    name="Thực nhận"
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
                <span>Cơ cấu nguồn thu</span>
              </h2>
              <p className="text-xs text-muted font-medium mt-0.5">
                Tỷ trọng các nguồn tiền phòng, điện, nước và dịch vụ.
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
                <span className="text-[10px] font-bold text-muted uppercase tracking-wider">Tổng doanh thu</span>
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
                Bảng so sánh doanh thu, số tiền đã thu, công nợ và tỷ lệ lấp đầy của toàn bộ các cơ sở.
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
                  <th className="px-4 py-3 text-right">Doanh thu phát sinh</th>
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
                  <th className="px-4 py-3 text-right">Đã thanh toán</th>
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
                        {formatVnd(item.paid)}
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
              <span className="text-xs font-bold text-muted">Tổng số hợp đồng</span>
              <FileText size={16} className="text-primary" />
            </div>
            <div className="mt-2 font-mono font-black text-xl text-text">{contracts.length}</div>
            <div className="mt-1 text-[11px] text-muted">Toàn bộ 4 tòa nhà</div>
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
              <span className="text-xs font-bold text-muted">Hết hạn / Đã thanh lý</span>
              <Layers size={16} className="text-muted" />
            </div>
            <div className="mt-2 font-mono font-black text-xl text-muted">
              {contracts.filter((c) => ["TERMINATED", "EXPIRED"].includes(c.status)).length}
            </div>
            <div className="mt-1 text-[11px] text-muted">Đã kết thúc hợp đồng</div>
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
