"use client";

import React from "react";
import {
  ArrowUpRight,
  CircleDollarSign,
  Landmark,
  Minus,
  PieChart,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useDashboardQuery } from "@/lib/queries/dashboard.queries";
import { Card } from "../ui/Card";

type FinanceKpiCard = {
  label: string;
  value: string;
  unit: string;
  detail: string;
  formula: string;
  badge: string;
  badgeTone: "success" | "warning" | "danger" | "info" | "primary";
  icon: LucideIcon;
  iconColor: string;
  iconBg: string;
};

export default function FinancialCommandKpi() {
  const { data: dashboard, isLoading } = useDashboardQuery();

  if (isLoading) {
    return (
      <div data-testid="finance-kpi-grid" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl border border-border/60 bg-card/60" />
        ))}
      </div>
    );
  }

  const kpisData = (dashboard as any)?.kpisRaw || {};
  const totalRev = Number(kpisData.totalRevenue || 0);
  const totalDebt = Number(kpisData.totalDebt || 0);
  const totalExp = Number(kpisData.totalExpense || 0);
  const netCash = Number(kpisData.netCashFlow || 0);
  const netProfit = Number(kpisData.netProfit || 0);

  const collectionRate =
    totalRev + totalDebt > 0
      ? Math.min(100, Math.max(0, Math.round((totalRev / (totalRev + totalDebt)) * 100)))
      : 100;

  const profitMargin = totalRev > 0 ? Math.round((netProfit / totalRev) * 100) : 0;
  const expenseRatio = totalRev > 0 ? Math.round((totalExp / totalRev) * 100) : 0;

  const kpis: FinanceKpiCard[] = [
    {
      label: "Doanh thu ghi nhận",
      value: totalRev.toLocaleString("vi-VN"),
      unit: "₫",
      detail: "Doanh thu thuê phòng và dịch vụ trong kỳ.",
      formula: `Tỷ lệ thu ${collectionRate}%`,
      badge: `${collectionRate}% đã thu`,
      badgeTone: collectionRate >= 80 ? "success" : "warning",
      icon: CircleDollarSign,
      iconColor: "text-emerald-600 dark:text-emerald-400",
      iconBg: "bg-emerald-500/10 dark:bg-emerald-500/20",
    },
    {
      label: "Tiền mặt ròng",
      value: netCash.toLocaleString("vi-VN"),
      unit: "₫",
      detail: "Dòng tiền thực còn lại sau khi trừ chi.",
      formula: "Tiền vào - tiền ra",
      badge: netCash >= 0 ? "Dòng tiền dương" : "Dòng tiền âm",
      badgeTone: netCash >= 0 ? "info" : "danger",
      icon: Landmark,
      iconColor: "text-sky-600 dark:text-sky-400",
      iconBg: "bg-sky-500/10 dark:bg-sky-500/20",
    },
    {
      label: "Phải thu",
      value: totalDebt.toLocaleString("vi-VN"),
      unit: "₫",
      detail: "Công nợ còn chờ khách thuê thanh toán.",
      formula: "Chưa thu",
      badge: totalDebt > 0 ? `${totalDebt.toLocaleString("vi-VN")} ₫ chờ thu` : "Không có nợ tồn",
      badgeTone: totalDebt > 0 ? "warning" : "success",
      icon: Minus,
      iconColor: "text-amber-600 dark:text-amber-400",
      iconBg: "bg-amber-500/10 dark:bg-amber-500/20",
    },
    {
      label: "Chi phí vận hành",
      value: totalExp.toLocaleString("vi-VN"),
      unit: "₫",
      detail: "Chi phí vận hành & bảo trì.",
      formula: "Tổng chi phí",
      badge: totalExp > 0 ? `${expenseRatio}% / Doanh thu` : "Chưa phát sinh",
      badgeTone: totalExp > 0 ? "danger" : "success",
      icon: Wallet,
      iconColor: "text-rose-600 dark:text-rose-400",
      iconBg: "bg-rose-500/10 dark:bg-rose-500/20",
    },
    {
      label: "Lợi nhuận ròng",
      value: netProfit.toLocaleString("vi-VN"),
      unit: "₫",
      detail: "Kết quả kinh doanh P&L.",
      formula: "Doanh thu - Chi phí",
      badge: `${profitMargin >= 0 ? "+" : ""}${profitMargin}% biên LN`,
      badgeTone: netProfit >= 0 ? "primary" : "danger",
      icon: PieChart,
      iconColor: "text-primary",
      iconBg: "bg-primary/10 dark:bg-primary/20",
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
      {kpis.map((kpi) => {
        const badgeClasses =
          kpi.badgeTone === "success"
            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20"
            : kpi.badgeTone === "warning"
              ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20"
              : kpi.badgeTone === "danger"
                ? "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20"
                : kpi.badgeTone === "info"
                  ? "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20"
                  : "bg-primary/10 text-primary border-primary/20";

        return (
          <Card
            key={kpi.label}
            data-testid={`finance-kpi-card-${toTestId(kpi.label)}`}
            className="group relative flex min-h-[124px] flex-col justify-between overflow-hidden rounded-2xl border border-border/70 bg-card p-4 shadow-2xs transition-all duration-200 hover:-translate-y-0.5 hover:border-border hover:shadow-card motion-reduce:hover:translate-y-0"
          >
            {/* Header: Label & Icon */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted group-hover:text-text transition-colors truncate">
                {kpi.label}
              </span>
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${kpi.iconBg} transition-transform duration-200 group-hover:scale-105`}>
                <kpi.icon size={16} className={kpi.iconColor} />
              </div>
            </div>

            {/* Value */}
            <div className="my-1 flex items-baseline gap-1">
              <span className="truncate font-mono text-xl font-black tracking-tight text-text xl:text-2xl">
                {kpi.value}
              </span>
              <span className="text-xs font-bold text-muted">{kpi.unit}</span>
            </div>

            {/* Bottom Badge & Context */}
            <div className="flex items-center justify-between gap-1 pt-1 border-t border-border/40 text-[11px]">
              <span className={`inline-flex items-center rounded-md border px-2 py-0.5 font-bold ${badgeClasses}`}>
                {kpi.badge}
              </span>
              <span className="font-medium text-muted truncate text-[10px] hidden sm:inline">
                {kpi.formula}
              </span>
              <span className="sr-only">{kpi.detail}</span>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
