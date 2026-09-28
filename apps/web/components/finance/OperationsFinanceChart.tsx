"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  BarChart3,
  Calendar,
  CircleDollarSign,
  TrendingUp,
} from "lucide-react";
import { useInvoicesQuery } from "@/lib/queries/invoices.queries";
import { useLedgerQuery, useBankTransactionsQuery } from "@/lib/queries/finance.queries";
import { useDashboardQuery } from "@/lib/queries/dashboard.queries";
import { Card } from "@/components/ui/Card";
import { getInvoiceFinancials, isBookingHoldInvoice } from "@/lib/invoices/invoice-financials";

const formatVnd = (value: number) => `${Number(value || 0).toLocaleString("vi-VN")} ₫`;

function formatMillions(val: number) {
  const abs = Math.abs(val);
  if (abs >= 1_000_000_000) {
    return `${(val / 1_000_000_000).toFixed(1).replace(/\.0$/, "")}B`;
  }
  if (abs >= 1_000_000) {
    return `${(val / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (abs >= 1_000) {
    return `${(val / 1_000).toFixed(0)}K`;
  }
  return String(val);
}

type ChartViewMode = "all" | "profit" | "compare";

export default function OperationsFinanceChart() {
  const [mounted, setMounted] = useState(false);
  const [periodMonths, setPeriodMonths] = useState<6 | 12>(6);
  const [viewMode, setViewMode] = useState<ChartViewMode>("all");

  useEffect(() => {
    setMounted(true);
  }, []);

  const { data: invoicesData, isLoading: isInvoicesLoading } = useInvoicesQuery({ limit: 1000 });
  const { data: ledgerData, isLoading: isLedgerLoading } = useLedgerQuery();
  const { data: bankData, isLoading: isBankLoading } = useBankTransactionsQuery({ limit: 1000 });
  const { data: dashboard, isLoading: isDashboardLoading } = useDashboardQuery();

  const invoices = Array.isArray(invoicesData?.data) ? invoicesData.data : [];
  const ledgerRows = Array.isArray(ledgerData) ? ledgerData : [];
  const bankRows = Array.isArray(bankData?.rows) ? bankData.rows : [];

  // Generate recent months strictly computed from REAL invoices & ledger entries
  const chartData = useMemo(() => {
    const now = new Date();
    const count = periodMonths;

    return Array.from({ length: count }, (_, idx) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (count - 1 - idx), 1);
      const targetMonth = d.getMonth();
      const targetYear = d.getFullYear();
      const isCurrent = idx === count - 1;
      const monthLabel = isCurrent
        ? `T${targetMonth + 1}/${String(targetYear).slice(2)} (Nay)`
        : `T${targetMonth + 1}/${String(targetYear).slice(2)}`;

      // 1. Real invoice collection and debt for this month.
      let monthRevenue = 0;
      let monthDebt = 0;

      for (const inv of invoices) {
        if (isBookingHoldInvoice(inv)) continue;
        const invDate = new Date(inv.issueDate || inv.createdAt || inv.dueDate);
        if (!Number.isNaN(invDate.getTime())) {
          if (invDate.getMonth() === targetMonth && invDate.getFullYear() === targetYear) {
            const financials = getInvoiceFinancials(inv);
            monthRevenue += financials.paid;
            monthDebt += financials.remaining;
          }
        }
      }

      // Fallback if current month has dashboard revenue
      const kpisRaw = (dashboard as any)?.kpisRaw || {};
      if (isCurrent && monthRevenue === 0 && Number(kpisRaw.totalRevenue || 0) > 0) {
        monthRevenue = Number(kpisRaw.totalRevenue || 0);
        monthDebt = Number(kpisRaw.totalDebt || 0);
      }

      // 2. Real Expenses from Ledger & Bank Outflow
      let monthExpense = 0;

      for (const leg of ledgerRows) {
        const legDate = new Date(leg.date);
        if (!Number.isNaN(legDate.getTime())) {
          if (legDate.getMonth() === targetMonth && legDate.getFullYear() === targetYear) {
            if (leg.sourceType === "EXPENSE" || (leg.accountCode && String(leg.accountCode).startsWith("6"))) {
              monthExpense += Number(leg.debit || leg.credit || 0);
            }
          }
        }
      }

      // Fallback to bank outflow if ledger is empty for this month
      if (monthExpense === 0) {
        for (const bank of bankRows) {
          const bankDate = new Date(bank.createdAt);
          if (!Number.isNaN(bankDate.getTime())) {
            if (bankDate.getMonth() === targetMonth && bankDate.getFullYear() === targetYear) {
              if (bank.direction === "OUT") {
                monthExpense += Number(bank.amount || 0);
              }
            }
          }
        }
      }

      if (isCurrent && monthExpense === 0 && Number(kpisRaw.totalExpense || 0) > 0) {
        monthExpense = Number(kpisRaw.totalExpense || 0);
      }

      const monthProfit = monthRevenue - monthExpense;
      const profitMargin = monthRevenue > 0 ? Math.round((monthProfit / monthRevenue) * 100) : 0;

      return {
        month: monthLabel,
        fullMonth: `Tháng ${targetMonth + 1}, ${targetYear}`,
        revenue: monthRevenue,
        expense: monthExpense,
        profit: monthProfit,
        debt: monthDebt,
        profitMargin,
        isCurrent,
      };
    });
  }, [invoices, ledgerRows, bankRows, dashboard, periodMonths]);

  // Aggregate current period summary
  const summary = useMemo(() => {
    const totalRevenue = chartData.reduce((acc, curr) => acc + curr.revenue, 0);
    const totalExpense = chartData.reduce((acc, curr) => acc + curr.expense, 0);
    const totalProfit = totalRevenue - totalExpense;
    const margin = totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 100) : 0;
    return { totalRevenue, totalExpense, totalProfit, margin };
  }, [chartData]);

  const isLoading = isInvoicesLoading || isLedgerLoading || isBankLoading || isDashboardLoading;

  return (
    <Card
      data-testid="finance-chart"
      className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border/70 bg-card p-5 shadow-2xs transition-all duration-200 hover:border-border hover:shadow-card md:p-6"
    >
      {/* Top Header: Title & Segmented Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between border-b border-border/50 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <BarChart3 size={15} />
            </div>
            <h3 className="text-base font-black tracking-tight text-text md:text-lg">
              Biến động Thu chi & Lợi nhuận
            </h3>
          </div>
          <p className="mt-0.5 text-xs text-muted">
            Doanh thu thực nhận, chi phí vận hành và lợi nhuận ròng qua các kỳ (loại trừ tiền cọc giữ phòng).
          </p>

          {/* Stripe-style Main Metric Headline */}
          <div className="mt-3 flex flex-wrap items-baseline gap-2.5">
            <span className="font-mono text-2xl font-black text-text md:text-3xl">
              {formatVnd(summary.totalRevenue)}
            </span>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-black text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <TrendingUp size={13} />
                Lợi nhuận ròng: {formatVnd(summary.totalProfit)}
              </span>
              <span className="text-xs font-semibold text-muted">
                (Biên LN {summary.margin}%)
              </span>
            </div>
          </div>
        </div>

        {/* View Mode & Period Segmented Tabs */}
        <div className="flex flex-wrap items-center gap-2 self-start">
          {/* Timeframe selector */}
          <div className="inline-flex rounded-xl border border-border/70 bg-surface/70 p-0.5 shadow-2xs text-xs font-bold">
            <button
              type="button"
              onClick={() => setPeriodMonths(6)}
              className={`rounded-lg px-2.5 py-1 transition ${
                periodMonths === 6
                  ? "bg-card text-text shadow-xs font-black"
                  : "text-muted hover:text-text"
              }`}
            >
              6T
            </button>
            <button
              type="button"
              onClick={() => setPeriodMonths(12)}
              className={`rounded-lg px-2.5 py-1 transition ${
                periodMonths === 12
                  ? "bg-card text-text shadow-xs font-black"
                  : "text-muted hover:text-text"
              }`}
            >
              12T
            </button>
          </div>

          {/* Mode selector */}
          <div className="inline-flex rounded-xl border border-border/70 bg-surface/70 p-0.5 shadow-2xs text-xs font-bold">
            <button
              type="button"
              onClick={() => setViewMode("all")}
              className={`rounded-lg px-3 py-1 transition ${
                viewMode === "all"
                  ? "bg-card text-text shadow-xs font-black"
                  : "text-muted hover:text-text"
              }`}
            >
              Tất cả
            </button>
            <button
              type="button"
              onClick={() => setViewMode("profit")}
              className={`rounded-lg px-3 py-1 transition ${
                viewMode === "profit"
                  ? "bg-card text-text shadow-xs font-black"
                  : "text-muted hover:text-text"
              }`}
            >
              Lợi nhuận
            </button>
            <button
              type="button"
              onClick={() => setViewMode("compare")}
              className={`rounded-lg px-3 py-1 transition ${
                viewMode === "compare"
                  ? "bg-card text-text shadow-xs font-black"
                  : "text-muted hover:text-text"
              }`}
            >
              Thu vs Chi
            </button>
          </div>
        </div>
      </div>

      {/* Main Recharts Graph */}
      <div className="relative min-h-[300px] w-full pt-4 select-none md:min-h-[320px]">
        {(!mounted || isLoading) && (
          <div className="flex h-[300px] w-full items-center justify-center rounded-xl bg-surface/30">
            <div className="flex flex-col items-center gap-2">
              <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <span className="text-xs font-semibold text-muted">Đang tải dữ liệu tài chính...</span>
            </div>
          </div>
        )}

        {mounted && !isLoading && (
          <ResponsiveContainer width="100%" height={300}>
            {viewMode === "profit" ? (
              <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="profitAreaOnly" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.35} />
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "var(--muted)", fontSize: 11, fontWeight: 600 }}
                  dy={8}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "var(--muted)", fontSize: 10, fontWeight: 600 }}
                  tickFormatter={formatMillions}
                />
                <Tooltip content={<CustomFinanceTooltip />} />
                <Area
                  type="monotone"
                  dataKey="profit"
                  name="Lợi nhuận ròng"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#profitAreaOnly)"
                  dot={false}
                  activeDot={{ r: 5, fill: "#10b981", stroke: "#ffffff", strokeWidth: 2 }}
                />
              </ComposedChart>
            ) : (
              <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="revenueBarGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity={1} />
                    <stop offset="100%" stopColor="#4f46e5" stopOpacity={0.9} />
                  </linearGradient>
                  <linearGradient id="expenseBarGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f43f5e" stopOpacity={1} />
                    <stop offset="100%" stopColor="#e11d48" stopOpacity={0.9} />
                  </linearGradient>
                  <linearGradient id="profitAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.35} />
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "var(--muted)", fontSize: 11, fontWeight: 600 }}
                  dy={8}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "var(--muted)", fontSize: 10, fontWeight: 600 }}
                  tickFormatter={formatMillions}
                />
                <Tooltip content={<CustomFinanceTooltip />} />

                <Bar
                  dataKey="revenue"
                  name="Thực thu"
                  fill="url(#revenueBarGrad)"
                  radius={[5, 5, 0, 0]}
                  maxBarSize={32}
                />

                <Bar
                  dataKey="expense"
                  name="Tổng chi"
                  fill="url(#expenseBarGrad)"
                  radius={[5, 5, 0, 0]}
                  maxBarSize={32}
                />

                {viewMode === "all" && (
                  <Area
                    type="monotone"
                    dataKey="profit"
                    name="Lợi nhuận ròng"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    fill="url(#profitAreaGrad)"
                    dot={false}
                    activeDot={{ r: 5, fill: "#10b981", stroke: "#ffffff", strokeWidth: 2 }}
                  />
                )}

                {viewMode === "all" && (
                  <Line
                    type="monotone"
                    dataKey="debt"
                    name="Công nợ"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    dot={false}
                    activeDot={{ r: 5, fill: "#f59e0b", stroke: "#ffffff", strokeWidth: 2 }}
                  />
                )}
              </ComposedChart>
            )}
          </ResponsiveContainer>
        )}
      </div>

      {/* Clean Minimalist Legend at Bottom */}
      <div className="mt-3 flex flex-wrap items-center justify-center gap-4 border-t border-border/40 pt-3 text-xs text-muted">
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-xs bg-indigo-500" />
          <span className="font-semibold text-text">Thực thu thuê/phí</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-xs bg-rose-500" />
          <span className="font-semibold text-text">Tổng chi phí</span>
        </div>
        {viewMode !== "compare" && (
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20" />
            <span className="font-semibold text-text">Lợi nhuận ròng</span>
          </div>
        )}
        {viewMode === "all" && (
          <div className="flex items-center gap-1.5">
            <div className="h-1 w-2.5 rounded-full bg-amber-500" />
            <span className="font-semibold text-text">Công nợ tồn</span>
          </div>
        )}
      </div>
    </Card>
  );
}

function CustomFinanceTooltip({ active, payload }: any) {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0].payload;
  const isPositive = data.profit >= 0;

  return (
    <div className="z-50 min-w-[200px] rounded-xl border border-border/80 bg-card/95 p-3 shadow-xl backdrop-blur-md">
      <div className="flex items-center justify-between border-b border-border/60 pb-1.5">
        <span className="text-xs font-black text-text">{data.fullMonth}</span>
        {data.isCurrent && (
          <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[9px] font-black text-primary">
            Hiện tại
          </span>
        )}
      </div>

      <div className="mt-2 flex flex-col gap-1.5 text-xs">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 text-muted">
            <div className="h-2 w-2 rounded-xs bg-indigo-500" />
            <span>Thực thu:</span>
          </div>
          <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
            {formatVnd(data.revenue)}
          </span>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 text-muted">
            <div className="h-2 w-2 rounded-xs bg-rose-500" />
            <span>Tổng chi:</span>
          </div>
          <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
            {formatVnd(data.expense)}
          </span>
        </div>

        <div className="border-t border-border/50 pt-1 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 text-muted">
            <div className="h-2 w-2 rounded-full bg-emerald-500" />
            <span>Lợi nhuận ròng:</span>
          </div>
          <span
            className={`font-mono font-black ${
              isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
            }`}
          >
            {formatVnd(data.profit)}
          </span>
        </div>

        {data.debt > 0 && (
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 text-muted">
              <div className="h-1 w-2 rounded-full bg-amber-500" />
              <span>Công nợ:</span>
            </div>
            <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
              {formatVnd(data.debt)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
