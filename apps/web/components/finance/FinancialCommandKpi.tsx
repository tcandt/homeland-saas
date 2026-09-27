import React from "react";
import { CircleDollarSign, Landmark, Minus, PieChart, Wallet, type LucideIcon } from "lucide-react";
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
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-32 animate-pulse rounded-2xl border border-border/60 bg-card/60" />
        ))}
      </div>
    );
  }

  const kpisData = (dashboard as any)?.kpisRaw || {};
  const collectionRate =
    Number(kpisData.totalRevenue || 0) + Number(kpisData.totalDebt || 0) > 0
      ? Math.round(
          (Number(kpisData.totalRevenue || 0) / (Number(kpisData.totalRevenue || 0) + Number(kpisData.totalDebt || 0))) * 100,
        )
      : 0;

  const netProfit = Number(kpisData.netProfit || 0);

  const kpis: FinanceKpiCard[] = [
    {
      label: "Doanh thu ghi nhận",
      value: Number(kpisData.totalRevenue || 0).toLocaleString("vi-VN"),
      unit: "đ",
      detail: "Doanh thu thuê phòng và dịch vụ trong kỳ.",
      formula: `Tỷ lệ thu ${collectionRate}%`,
      icon: CircleDollarSign,
      color: "text-emerald-700 dark:text-emerald-300",
      bg: "bg-emerald-500/10 border border-emerald-500/20",
    },
    {
      label: "Tiền mặt ròng",
      value: Number(kpisData.netCashFlow || 0).toLocaleString("vi-VN"),
      unit: "đ",
      detail: "Dòng tiền thực còn lại sau khi trừ chi.",
      formula: "Tiền vào - tiền ra",
      icon: Landmark,
      color: "text-sky-700 dark:text-sky-300",
      bg: "bg-sky-500/10 border border-sky-500/20",
    },
    {
      label: "Phải thu",
      value: Number(kpisData.totalDebt || 0).toLocaleString("vi-VN"),
      unit: "đ",
      detail: "Công nợ còn chờ khách thuê thanh toán.",
      formula: "Chưa thu",
      icon: Minus,
      color: "text-amber-700 dark:text-amber-300",
      bg: "bg-amber-500/10 border border-amber-500/20",
    },
    {
      label: "Chi phí vận hành",
      value: Number(kpisData.totalExpense || 0).toLocaleString("vi-VN"),
      unit: "đ",
      detail: "Chi phí vận hành & bảo trì.",
      formula: "Tổng chi phí",
      icon: Wallet,
      color: "text-rose-700 dark:text-rose-300",
      bg: "bg-rose-500/10 border border-rose-500/20",
    },
    {
      label: "Lợi nhuận ròng",
      value: netProfit.toLocaleString("vi-VN"),
      unit: "đ",
      detail: "Kết quả kinh doanh P&L.",
      formula: "Doanh thu - Chi phí",
      icon: PieChart,
      color: netProfit >= 0 ? "text-primary" : "text-rose-700 dark:text-rose-300",
      bg: netProfit >= 0 ? "bg-primary/10 border border-primary/20" : "bg-rose-500/10 border border-rose-500/20",
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
    <div data-testid="finance-kpi-grid" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
      {kpis.map((kpi) => (
        <Card
          key={kpi.label}
          data-testid={`finance-kpi-card-${toTestId(kpi.label)}`}
          className="group relative flex min-h-[128px] flex-col justify-between overflow-hidden rounded-2xl border border-border/70 bg-card p-4 shadow-2xs transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md motion-reduce:hover:translate-y-0"
        >
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[11px] font-black uppercase tracking-[0.12em] text-muted transition-colors group-hover:text-text">
              {kpi.label}
            </span>
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${kpi.bg}`}>
              <kpi.icon size={17} className={kpi.color} />
            </div>
          </div>

          <div className="mt-3 flex items-baseline gap-1">
            <span className="truncate font-mono text-xl font-black leading-none tracking-tight text-text">
              {kpi.value}
            </span>
            {kpi.unit && <span className={`text-xs font-black ${kpi.color}`}>{kpi.unit}</span>}
          </div>

          <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted">
            <span className="truncate font-semibold">{kpi.formula}</span>
            <span className="sr-only">{kpi.detail}</span>
          </div>
        </Card>
      ))}
    </div>
  );
}
