"use client";

import React, { useMemo, useState } from "react";
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
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  Home,
  Layers,
  PieChart as PieIcon,
  Receipt,
  RefreshCw,
  Search,
  Sparkles,
  TrendingUp,
  Users,
  Wallet,
  WalletCards,
  Zap,
} from "lucide-react";
import toast from "react-hot-toast";
import AppShell from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { getInvoiceFinancials } from "@/lib/invoices/invoice-financials";
import { useBuildingsQuery } from "@/lib/queries/buildings.queries";
import { useContractsQuery } from "@/lib/queries/contracts.queries";
import { useInvoicesQuery } from "@/lib/queries/invoices.queries";
import { useRoomsQuery } from "@/lib/queries/rooms.queries";
import { financeApi } from "@/lib/api/finance.api";

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

type TimePeriod = "30D" | "THIS_MONTH" | "THIS_QUARTER" | "THIS_YEAR" | "6M" | "ALL";
type ViewTab = "OVERVIEW" | "BUILDINGS" | "DEBT" | "CONTRACTS";

export default function ReportsPage() {
  const [selectedBuilding, setSelectedBuilding] = useState<string>("ALL");
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>("6M");
  const [activeTab, setActiveTab] = useState<ViewTab>("OVERVIEW");
  const [isExporting, setIsExporting] = useState(false);

  const buildingsQuery = useBuildingsQuery({ limit: 100 });
  const invoicesQuery = useInvoicesQuery({ limit: 300 });
  const contractsQuery = useContractsQuery({ limit: 300 });
  const roomsQuery = useRoomsQuery({ limit: 300 });

  const rawBuildings = getList(buildingsQuery.data);
  const rawInvoices = getList(invoicesQuery.data).filter((invoice) =>
    reportableInvoiceStatuses.has(invoice.status)
  );
  const rawContracts = getList(contractsQuery.data);
  const rawRooms = getList(roomsQuery.data);

  const isLoading =
    invoicesQuery.isLoading || contractsQuery.isLoading || roomsQuery.isLoading;
  const isError = invoicesQuery.isError || contractsQuery.isError || roomsQuery.isError;

  // Filter items by selected building
  const invoices = useMemo(() => {
    if (selectedBuilding === "ALL") return rawInvoices;
    return rawInvoices.filter((inv) => {
      const bCode = inv?.room?.building?.code || inv?.building?.code || inv?.buildingCode;
      const bId = inv?.room?.building?.id || inv?.building?.id || inv?.buildingId;
      return bCode === selectedBuilding || bId === selectedBuilding;
    });
  }, [rawInvoices, selectedBuilding]);

  const contracts = useMemo(() => {
    if (selectedBuilding === "ALL") return rawContracts;
    return rawContracts.filter((c) => {
      const bCode = c?.room?.building?.code || c?.building?.code || c?.buildingCode;
      const bId = c?.room?.building?.id || c?.building?.id || c?.buildingId;
      return bCode === selectedBuilding || bId === selectedBuilding;
    });
  }, [rawContracts, selectedBuilding]);

  const rooms = useMemo(() => {
    if (selectedBuilding === "ALL") return rawRooms;
    return rawRooms.filter((r) => {
      const bCode = r?.building?.code || r?.buildingCode;
      const bId = r?.building?.id || r?.buildingId;
      return bCode === selectedBuilding || bId === selectedBuilding;
    });
  }, [rawRooms, selectedBuilding]);

  // Overall Financial & Operational Summary
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

  // 6-Month Revenue & Collection Trend
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

  // Revenue by Category / Source Structure
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

  // Building Performance Table
  const buildingRows = useMemo(() => {
    const grouped = new Map<
      string,
      { code: string; name: string; totalRooms: number; occupiedRooms: number; revenue: number; collected: number; debt: number }
    >();

    // Seed with all known buildings
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

    // Populate room metrics
    rawRooms.forEach((r: any) => {
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

    // Populate invoice revenue
    rawInvoices.forEach((invoice) => {
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
  }, [rawBuildings, rawInvoices, rawRooms]);

  // Top Debtors Table
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

  // Export handlers
  const handleExportPdf = async () => {
    setIsExporting(true);
    try {
      await financeApi.exportPdfReport();
      toast.success("Đã xuất báo cáo PDF thành công");
    } catch (err: any) {
      toast.error(err?.message || "Không thể xuất file PDF");
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      await financeApi.exportExcelReport();
      toast.success("Đã xuất báo cáo Excel thành công");
    } catch (err: any) {
      toast.error(err?.message || "Không thể xuất file Excel");
    } finally {
      setIsExporting(false);
    }
  };

  const handleRefresh = () => {
    invoicesQuery.refetch();
    contractsQuery.refetch();
    roomsQuery.refetch();
    buildingsQuery.refetch();
    toast.success("Đã làm mới dữ liệu báo cáo");
  };

  return (
    <AppShell>
      <div data-testid="reports-root" className="flex flex-col gap-3.5 pb-10">
        {/* 1. TOP HEADER & INTERACTIVE CONTROLS */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 rounded-2xl border border-border/70 bg-card p-4 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary border border-primary/20 shrink-0">
              <BarChart3 size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base md:text-lg font-black text-text tracking-tight">
                  Trung tâm Báo cáo & Phân tích (Analytics Center)
                </h1>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Realtime DB
                </span>
              </div>
              <p className="text-xs text-muted font-medium mt-0.5">
                Báo cáo tổng hợp dòng tiền, công nợ, hiệu suất khai thác phòng và vòng đời hợp đồng.
              </p>
            </div>
          </div>

          {/* Action Filters & Export Buttons */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* Building Filter */}
            <div className="relative">
              <select
                value={selectedBuilding}
                onChange={(e) => setSelectedBuilding(e.target.value)}
                className="h-9 rounded-xl border border-border/70 bg-background pl-3 pr-8 text-xs font-bold text-text outline-none transition focus:border-primary cursor-pointer shadow-2xs appearance-none"
              >
                <option value="ALL">🏢 Tất cả tòa nhà ({rawBuildings.length})</option>
                {rawBuildings.map((b: any) => (
                  <option key={b.id || b.code} value={b.code || b.id}>
                    {b.name} ({b.code})
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
            </div>

            {/* Refresh Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              className="h-9 px-3 rounded-xl gap-1.5 text-xs font-bold shadow-2xs hover:border-primary"
              title="Làm mới dữ liệu"
            >
              <RefreshCw size={13} className={isLoading ? "animate-spin text-primary" : ""} />
              <span className="hidden sm:inline">Làm mới</span>
            </Button>

            {/* Export Excel */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportExcel}
              disabled={isExporting}
              className="h-9 px-3 rounded-xl gap-1.5 text-xs font-bold shadow-2xs border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10 hover:border-emerald-500"
            >
              <FileSpreadsheet size={14} />
              <span>Excel</span>
            </Button>

            {/* Export PDF */}
            <Button
              variant="primary"
              size="sm"
              onClick={handleExportPdf}
              disabled={isExporting}
              className="h-9 px-3.5 rounded-xl gap-1.5 text-xs font-bold shadow-2xs"
            >
              <Download size={14} />
              <span>Xuất PDF</span>
            </Button>
          </div>
        </div>

        {/* 2. 6 SLIM LUXURY KPI METRIC CARDS */}
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
              <span>Hiệu suất khai thác</span>
            </div>
          </Card>
        </div>

        {/* 3. VIEW MODE TABS */}
        <div className="flex items-center gap-1.5 border-b border-border/60 pb-1 overflow-x-auto">
          {[
            { key: "OVERVIEW", label: "Tổng quan & Xu hướng", icon: <TrendingUp size={13} /> },
            { key: "BUILDINGS", label: "Hiệu suất Tòa nhà", icon: <Building2 size={13} /> },
            { key: "DEBT", label: "Công nợ khách thuê", icon: <AlertTriangle size={13} /> },
            { key: "CONTRACTS", label: "Vòng đời Hợp đồng", icon: <FileText size={13} /> },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key as ViewTab)}
              className={`flex items-center gap-1.5 h-8.5 px-3.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                activeTab === tab.key
                  ? "bg-primary text-white shadow-2xs"
                  : "text-muted hover:bg-muted/10 hover:text-text"
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* 4. MAIN CHARTS & ANALYTICS SECTION */}
        {activeTab === "OVERVIEW" && (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-3.5">
            {/* 6-Month Revenue vs Collection Area Chart (8 Cols) */}
            <div className="xl:col-span-8 rounded-2xl border border-border/70 bg-card p-4 md:p-5 shadow-2xs flex flex-col justify-between">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-3">
                <div>
                  <h2 className="text-sm md:text-base font-black text-text tracking-tight flex items-center gap-2">
                    <TrendingUp size={16} className="text-primary" />
                    <span>Xu hướng Doanh thu vs Thực thu (6 tháng gần nhất)</span>
                  </h2>
                  <p className="text-xs text-muted font-medium mt-0.5">
                    So sánh dòng tiền phát sinh trên hóa đơn và số tiền thực tế đã thu hồi về tài khoản.
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
        )}

        {/* 5. DETAILED ANALYTICS SECTIONS */}
        {(activeTab === "OVERVIEW" || activeTab === "BUILDINGS") && (
          <div className="rounded-2xl border border-border/70 bg-card shadow-2xs overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 p-4 bg-muted/5">
              <div>
                <h2 className="text-sm md:text-base font-black text-text tracking-tight flex items-center gap-2">
                  <Building2 size={16} className="text-primary" />
                  <span>Hiệu suất kinh doanh & Thu hồi theo Tòa nhà</span>
                </h2>
                <p className="text-xs text-muted font-medium mt-0.5">
                  Chi tiết doanh thu, số tiền đã thu, công nợ và tỷ lệ lấp đầy của từng cơ sở.
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
        )}

        {/* 6. DEBTORS TABLE */}
        {(activeTab === "OVERVIEW" || activeTab === "DEBT") && (
          <div className="rounded-2xl border border-border/70 bg-card shadow-2xs overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 p-4 bg-muted/5">
              <div>
                <h2 className="text-sm md:text-base font-black text-text tracking-tight flex items-center gap-2">
                  <AlertTriangle size={16} className="text-amber-500" />
                  <span>Danh sách Khách thuê còn công nợ (Top Aging Debt)</span>
                </h2>
                <p className="text-xs text-muted font-medium mt-0.5">
                  Ưu tiên đôn đốc các hóa đơn chưa thu hoặc đã quá hạn thanh toán.
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
        )}

        {/* 7. CONTRACT LIFECYCLE & STATS */}
        {(activeTab === "OVERVIEW" || activeTab === "CONTRACTS") && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <Card className="p-4 rounded-xl border border-border/70 bg-card shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-muted">Tổng số hợp đồng</span>
                <FileText size={16} className="text-primary" />
              </div>
              <div className="mt-2 font-mono font-black text-xl text-text">{contracts.length}</div>
              <div className="mt-1 text-[11px] text-muted">Dữ liệu trên toàn hệ thống</div>
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
        )}
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
