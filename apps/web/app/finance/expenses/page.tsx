"use client";

import React, { useMemo, useState } from "react";
import {
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  FileText,
  Wallet,
  PieChart as PieIcon,
  TrendingUp,
  Plus,
  Filter,
} from "lucide-react";
import {
  Area,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import AppShell from "@/components/layout/AppShell";
import ExpenseCreateModal from "@/components/finance/ExpenseCreateModal";
import ExpenseTable from "@/components/finance/ExpenseTable";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useExpensesQuery } from "@/lib/queries/finance.queries";

const formatVnd = (value: number) => `${Number(value || 0).toLocaleString("vi-VN")} đ`;

const formatPercent = (value: number) => {
  if (value > 0 && value < 1) return `${value.toFixed(1)}%`;
  return `${Math.round(value)}%`;
};

const categoryMeta: Record<string, { label: string; color: string; soft: string }> = {
  UTILITY: { label: "Điện, nước", color: "#6366f1", soft: "bg-indigo-500/10 text-indigo-600" },
  CLEANING: { label: "Vệ sinh, bảo trì", color: "#0ea5e9", soft: "bg-sky-500/10 text-sky-600" },
  MAINTENANCE: { label: "Vệ sinh, bảo trì", color: "#0ea5e9", soft: "bg-sky-500/10 text-sky-600" },
  REPAIR: { label: "Sửa chữa", color: "#8b5cf6", soft: "bg-purple-500/10 text-purple-600" },
  SUPPLIES: { label: "Vật tư & DV", color: "#10b981", soft: "bg-emerald-500/10 text-emerald-600" },
  STAFF: { label: "Nhân sự", color: "#14b8a6", soft: "bg-teal-500/10 text-teal-600" },
  REFUND: { label: "Hoàn cọc / Khách", color: "#f59e0b", soft: "bg-amber-500/10 text-amber-600" },
  OTHER: { label: "Chi phí khác", color: "#f43f5e", soft: "bg-rose-500/10 text-rose-600" },
};

function buildYearRange(year: number) {
  return {
    startDate: new Date(year, 0, 1).toISOString(),
    endDate: new Date(year, 11, 31, 23, 59, 59, 999).toISOString(),
  };
}

export default function FinanceExpensesPage() {
  const [isExpenseModalOpen, setExpenseModalOpen] = useState(false);
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(String(currentYear));
  const { data: allExpenseData } = useExpensesQuery();
  const allExpenses = Array.isArray(allExpenseData) ? allExpenseData : [];

  const storedYearOptions = useMemo(() => {
    const years = new Set<string>([String(currentYear)]);
    allExpenses.forEach((expense: any) => {
      const date = new Date(expense.date || expense.createdAt || "");
      if (!Number.isNaN(date.getTime())) years.add(String(date.getFullYear()));
    });
    return Array.from(years)
      .sort((a, b) => Number(b) - Number(a))
      .map((year) => ({ value: year, label: `Năm ${year}` }));
  }, [allExpenses, currentYear]);

  const analyticsYear = Number(selectedYear) || currentYear;
  const { data } = useExpensesQuery(buildYearRange(analyticsYear));
  const expenses = Array.isArray(data) ? data : [];

  const analytics = useMemo(() => {
    const byCategory = new Map<string, number>();
    const monthly = Array.from({ length: 12 }, () => 0);
    let total = 0;
    let pending = 0;
    let approved = 0;
    let paid = 0;

    expenses.forEach((expense: any) => {
      const amount = Number(expense.amount || 0);
      const key = expense.category || "OTHER";
      const label = categoryMeta[key]?.label || "Chi phí khác";
      const date = new Date(expense.date || expense.createdAt || Date.now());

      total += amount;
      byCategory.set(label, (byCategory.get(label) || 0) + amount);
      if (!Number.isNaN(date.getTime()) && date.getFullYear() === analyticsYear) {
        monthly[date.getMonth()] += amount;
      }
      if (expense.status === "PENDING") pending += 1;
      if (expense.status === "APPROVED") approved += amount;
      if (expense.status === "PAID") paid += amount;
    });

    const categories = Array.from(byCategory.entries())
      .map(([label, amount]) => {
        const meta = Object.values(categoryMeta).find((item) => item.label === label) || categoryMeta.OTHER;
        return {
          label,
          amount,
          color: meta.color,
          soft: meta.soft,
          percent: total > 0 ? (amount / total) * 100 : 0,
        };
      })
      .sort((a, b) => b.amount - a.amount);

    return { total, pending, approved, paid, categories, monthly, maxMonth: Math.max(...monthly, 1) };
  }, [analyticsYear, expenses]);

  const categoryChartData = analytics.categories.length
    ? analytics.categories
    : [{ label: "Chưa có dữ liệu", amount: 1, percent: 100, color: "#94a3b8", soft: "bg-slate-100 text-slate-500" }];

  const monthlyChartData = analytics.monthly.map((amount, index) => ({
    month: `T${index + 1}`,
    amount,
  }));

  return (
    <AppShell>
      <div
        data-testid="finance-expenses-root"
        className="-m-4 min-h-[calc(100dvh-87px)] w-[calc(100%+32px)] overflow-auto bg-background md:min-h-[calc(100dvh-80px)] p-2.5 md:p-3 flex flex-col gap-3"
      >
        {/* 1. TOP 4 SLIM KPI CARDS */}
        <div className="flex flex-col gap-2.5">

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-2.5 shrink-0">
            <KpiCard
              title="Tổng chi phí năm"
              value={formatVnd(analytics.total)}
              subtext={`Năm ${analyticsYear}`}
              icon={<Wallet size={16} className="text-rose-600 dark:text-rose-400" />}
              iconBg="bg-rose-500/10 border border-rose-500/20"
              valueColor="text-rose-600 dark:text-rose-400"
            />
            <KpiCard
              title="Chờ duyệt chi"
              value={`${analytics.pending} khoản`}
              subtext={analytics.pending > 0 ? "Cần phê duyệt" : "Không có khoản chờ"}
              highlight={analytics.pending > 0}
              highlightColor="text-amber-500"
              icon={<Clock3 size={16} className="text-amber-600 dark:text-amber-400" />}
              iconBg="bg-amber-500/10 border border-amber-500/20"
            />
            <KpiCard
              title="Đã duyệt chi"
              value={formatVnd(analytics.approved)}
              subtext="Đã được chấp thuận"
              icon={<CheckCircle2 size={16} className="text-indigo-600 dark:text-indigo-400" />}
              iconBg="bg-indigo-500/10 border border-indigo-500/20"
              valueColor="text-indigo-600 dark:text-indigo-400"
            />
            <KpiCard
              title="Đã thanh toán (Đã chi)"
              value={formatVnd(analytics.paid)}
              subtext="Hoàn tất chi tiền"
              icon={<CircleDollarSign size={16} className="text-emerald-600 dark:text-emerald-400" />}
              iconBg="bg-emerald-500/10 border border-emerald-500/20"
              valueColor="text-emerald-600 dark:text-emerald-400"
            />
          </div>
        </div>

        {/* 2. COMPACT ANALYTICS CHARTS (Category Breakdown & Monthly Trend) */}
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          {/* Card 1: Category Breakdown */}
          <Card className="rounded-xl border border-border/70 bg-card p-4 shadow-2xs flex flex-col justify-between gap-3">
            <div className="flex items-center justify-between border-b border-border/50 pb-2.5">
              <span className="text-xs font-black text-text flex items-center gap-1.5">
                <PieIcon size={14} className="text-primary" /> Phân bổ theo danh mục
              </span>
              <span className="text-[10px] font-bold text-muted bg-muted/10 px-2 py-0.5 rounded-md">
                Năm {analyticsYear}
              </span>
            </div>

            <div className="flex items-center gap-4">
              <div className="relative h-[120px] w-[120px] shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryChartData}
                      dataKey="amount"
                      nameKey="label"
                      innerRadius={36}
                      outerRadius={56}
                      stroke="none"
                    >
                      {categoryChartData.map((item, index) => (
                        <Cell key={`cell-${index}`} fill={item.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-[9px] font-bold text-muted uppercase">Tổng</span>
                  <span className="text-xs font-mono font-black text-text">
                    {analytics.total >= 1_000_000 ? `${(analytics.total / 1_000_000).toFixed(1)}M` : formatVnd(analytics.total)}
                  </span>
                </div>
              </div>

              {/* Category Legend List */}
              <div className="flex-1 flex flex-col gap-1.5 overflow-y-auto max-h-[130px] pr-1">
                {analytics.categories.length === 0 ? (
                  <div className="text-[11px] text-muted font-medium py-4 text-center">Chưa có chi phí</div>
                ) : (
                  analytics.categories.map((c) => (
                    <div key={c.label} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                        <span className="text-[11px] font-medium text-text truncate max-w-[110px]">{c.label}</span>
                      </div>
                      <div className="flex items-center gap-2 font-mono text-[11px] shrink-0">
                        <span className="text-muted font-semibold">{formatPercent(c.percent)}</span>
                        <span className="font-bold text-text">{formatVnd(c.amount)}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </Card>

          {/* Card 2: 12-Month Expense Trend */}
          <Card className="rounded-xl border border-border/70 bg-card p-4 shadow-2xs flex flex-col justify-between gap-3 lg:col-span-2">
            <div className="flex items-center justify-between border-b border-border/50 pb-2.5">
              <span className="text-xs font-black text-text flex items-center gap-1.5">
                <TrendingUp size={14} className="text-primary" /> Xu hướng chi phí 12 tháng ({analyticsYear})
              </span>
              <span className="text-[10px] font-bold text-muted bg-muted/10 px-2 py-0.5 rounded-md">
                Theo tháng
              </span>
            </div>

            <div className="h-[120px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={monthlyChartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.15} />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "#94a3b8" }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "#94a3b8" }} tickFormatter={(val) => (val >= 1_000_000 ? `${val / 1_000_000}M` : String(val))} />
                  <Tooltip
                    formatter={(val: any) => [formatVnd(Number(val)), "Chi phí"]}
                    contentStyle={{
                      backgroundColor: "var(--card)",
                      borderColor: "var(--border)",
                      borderRadius: 12,
                      fontSize: 11,
                      boxShadow: "0 10px 25px -5px rgba(0,0,0,0.2)",
                    }}
                  />
                  <Bar dataKey="amount" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={28} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        {/* 3. MAIN EXPENSE TABLE (Full-featured list & actions) */}
        <ExpenseTable onCreateExpense={() => setExpenseModalOpen(true)} />
      </div>

      <ExpenseCreateModal isOpen={isExpenseModalOpen} onClose={() => setExpenseModalOpen(false)} />
    </AppShell>
  );
}

function KpiCard({
  title,
  value,
  subtext,
  icon,
  iconBg,
  valueColor,
  highlight,
  highlightColor,
}: {
  title: string;
  value: string;
  subtext?: string;
  icon: React.ReactNode;
  iconBg: string;
  valueColor?: string;
  highlight?: boolean;
  highlightColor?: string;
}) {
  return (
    <Card className="flex items-center gap-3 rounded-xl border border-border/60 bg-card px-3.5 py-2.5 shadow-2xs transition-all hover:border-primary/30">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
        {icon}
      </div>

      <div className="min-w-0 flex-1">
        <div className="text-[10px] md:text-[11px] font-bold text-muted uppercase tracking-wider truncate leading-tight mb-0.5">
          {title}
        </div>
        <div className="flex items-baseline gap-2">
          <span className={`font-mono font-black text-[16px] md:text-[18px] leading-none ${valueColor || "text-text"}`}>
            {value}
          </span>
        </div>
        {subtext && (
          <span className={`text-[10px] md:text-[11px] font-medium truncate block mt-0.5 ${highlight ? highlightColor || "text-rose-500" : "text-muted"}`}>
            {subtext}
          </span>
        )}
      </div>
    </Card>
  );
}
