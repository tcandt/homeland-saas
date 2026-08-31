import React from "react";
import { Building, CheckCircle, DollarSign, Minus, PieChart, TrendingUp, Wallet, type LucideIcon } from "lucide-react";
import { useDashboardQuery } from "@/lib/queries/dashboard.queries";
import { Card } from "../ui/Card";

type FinanceKpiCard = {
  label: string;
  value: string;
  unit: string;
  detail: string;
  formula: string;
  icon: LucideIcon;
  color: string;
  bg: string;
};

export default function FinancialCommandKpi() {
  const { data: dashboard, isLoading } = useDashboardQuery();

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-8 shrink-0">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl border border-border/60 bg-card/60" />
        ))}
      </div>
    );
  }

  const kpisData = (dashboard as any)?.kpisRaw || {};
  const occupancy = (dashboard as any)?.occupancy || {};
  const collectionRate =
    Number(kpisData.totalRevenue || 0) + Number(kpisData.totalDebt || 0) > 0
      ? Math.round(
          (Number(kpisData.totalRevenue || 0) / (Number(kpisData.totalRevenue || 0) + Number(kpisData.totalDebt || 0))) * 100,
        )
      : 0;

  const netProfit = Number(kpisData.netProfit || 0);

  const kpis: FinanceKpiCard[] = [
    {
      label: "Tiền mặt ròng",
      value: Number(kpisData.netCashFlow || 0).toLocaleString("vi-VN"),
      unit: "đ",
      detail: "Dòng tiền thực còn lại sau khi đã trừ chi.",
      formula: "Thu - Chi",
      icon: DollarSign,
      color: "text-indigo-600 dark:text-indigo-400",
      bg: "bg-indigo-500/10 border border-indigo-500/20",
    },
    {
      label: "Doanh thu P&L",
      value: Number(kpisData.totalRevenue || 0).toLocaleString("vi-VN"),
      unit: "đ",
      detail: "Doanh thu ghi nhận trong kỳ.",
      formula: "Tổng doanh thu",
      icon: TrendingUp,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-500/10 border border-emerald-500/20",
    },
    {
      label: "Chi phí P&L",
      value: Number(kpisData.totalExpense || 0).toLocaleString("vi-VN"),
      unit: "đ",
      detail: "Chi phí vận hành & bảo trì.",
      formula: "Tổng chi phí",
      icon: Wallet,
      color: "text-rose-600 dark:text-rose-400",
      bg: "bg-rose-500/10 border border-rose-500/20",
    },
    {
      label: "Lợi nhuận ròng",
      value: netProfit.toLocaleString("vi-VN"),
      unit: "đ",
      detail: "Kết quả kinh doanh P&L.",
      formula: "Doanh thu - Chi phí",
      icon: PieChart,
      color: netProfit >= 0 ? "text-indigo-600 dark:text-indigo-400" : "text-rose-600 dark:text-rose-400",
      bg: netProfit >= 0 ? "bg-indigo-500/10 border border-indigo-500/20" : "bg-rose-500/10 border border-rose-500/20",
    },
    {
      label: "Phải thu",
      value: Number(kpisData.totalDebt || 0).toLocaleString("vi-VN"),
      unit: "đ",
      detail: "Công nợ còn chờ thu.",
      formula: "Chưa thu",
      icon: Minus,
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-500/10 border border-amber-500/20",
    },
    {
      label: "Tiền cọc giữ",
      value: Number(kpisData.depositHeld || 0).toLocaleString("vi-VN"),
      unit: "đ",
      detail: "Tiền đặt cọc đang giữ.",
      formula: "Quỹ cọc",
      icon: Building,
      color: "text-sky-600 dark:text-sky-400",
      bg: "bg-sky-500/10 border border-sky-500/20",
    },
    {
      label: "Tỷ lệ thu",
      value: `${collectionRate}%`,
      unit: "",
      detail: "Tỷ lệ thu tiền so với phát sinh.",
      formula: "Tỷ lệ thanh toán",
      icon: CheckCircle,
      color: "text-indigo-600 dark:text-indigo-400",
      bg: "bg-indigo-500/10 border border-indigo-500/20",
    },
    {
      label: "Lấp đầy",
      value: `${Math.round(Number(occupancy.rate || 0))}%`,
      unit: "",
      detail: "Tỷ lệ phòng đang có khách.",
      formula: "Tỷ lệ thuê",
      icon: TrendingUp,
      color: "text-purple-600 dark:text-purple-400",
      bg: "bg-purple-500/10 border border-purple-500/20",
    },
  ];

  const toTestId = (label: string) =>
    label
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

  return (
    <div data-testid="finance-kpi-grid" className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-8 shrink-0">
      {kpis.map((kpi) => (
        <Card
          key={kpi.label}
          data-testid={`finance-kpi-card-${toTestId(kpi.label)}`}
          className="group relative flex flex-col justify-between rounded-xl border border-border/60 bg-card p-3 shadow-2xs transition-all hover:border-primary/30 min-h-[96px]"
        >
          <div className="flex items-center justify-between gap-1.5">
            <span className="truncate text-[10px] font-bold uppercase tracking-wider text-muted group-hover:text-text transition-colors">
              {kpi.label}
            </span>
            <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${kpi.bg}`}>
              <kpi.icon size={12} className={kpi.color} />
            </div>
          </div>

          <div className="mt-1.5 flex items-baseline gap-1">
            <span className="truncate font-mono font-black text-base leading-none text-text">
              {kpi.value}
            </span>
            {kpi.unit && <span className={`text-[10px] font-bold ${kpi.color}`}>{kpi.unit}</span>}
          </div>

          <div className="mt-1 flex items-center justify-between text-[10px] text-muted">
            <span className="truncate font-medium">{kpi.formula}</span>
          </div>
        </Card>
      ))}
    </div>
  );
}
