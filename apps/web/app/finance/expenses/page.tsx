"use client";

import React, { useMemo, useState } from "react";
import { CheckCircle2, CircleDollarSign, Clock3, FileText, Wallet } from "lucide-react";
import {
  Area,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
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
import { Select } from "@/components/ui/Select";
import { useExpensesQuery } from "@/lib/queries/finance.queries";

const formatVnd = (value: number) => `${Number(value || 0).toLocaleString("vi-VN")} đ`;
const shortVnd = (value: number) => {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}M đ`;
  if (Math.abs(value) >= 1_000) return `${Math.round(value / 1_000)}K đ`;
  return formatVnd(value);
};

const formatPercent = (value: number) => {
  if (value > 0 && value < 1) return `${value.toFixed(1)}%`;
  return `${Math.round(value)}%`;
};

const categoryMeta: Record<string, { label: string; color: string; soft: string }> = {
  UTILITY: { label: "Điện, nước", color: "#6d5dfc", soft: "bg-[#6d5dfc]/10 text-[#6d5dfc]" },
  CLEANING: { label: "Vệ sinh, bảo trì", color: "#79a7ff", soft: "bg-[#79a7ff]/10 text-[#4f7df3]" },
  MAINTENANCE: { label: "Vệ sinh, bảo trì", color: "#79a7ff", soft: "bg-[#79a7ff]/10 text-[#4f7df3]" },
  REPAIR: { label: "Vệ sinh, bảo trì", color: "#79a7ff", soft: "bg-[#79a7ff]/10 text-[#4f7df3]" },
  SUPPLIES: { label: "Dịch vụ", color: "#4ac58f", soft: "bg-[#4ac58f]/10 text-[#149868]" },
  STAFF: { label: "Dịch vụ", color: "#4ac58f", soft: "bg-[#4ac58f]/10 text-[#149868]" },
  REFUND: { label: "Khác", color: "#ff8b5c", soft: "bg-[#ff8b5c]/10 text-[#f97316]" },
  OTHER: { label: "Khác", color: "#ff8b5c", soft: "bg-[#ff8b5c]/10 text-[#f97316]" },
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
      const label = categoryMeta[key]?.label || "Khác";
      const date = new Date(expense.date || expense.createdAt || Date.now());

      total += amount;
      byCategory.set(label, (byCategory.get(label) || 0) + amount);
      if (!Number.isNaN(date.getTime()) && date.getFullYear() === analyticsYear) monthly[date.getMonth()] += amount;
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
    : [{ label: "Chưa có dữ liệu", amount: 1, percent: 100, color: "#d1d5db", soft: "bg-slate-100 text-slate-500" }];

  const monthlyChartData = analytics.monthly.map((amount, index) => ({
    month: `T${index + 1}`,
    amount,
  }));

  return (
    <AppShell>
      <div data-testid="finance-expenses-root" className="flex min-h-full w-full flex-col gap-[16px] md:gap-[20px]">
        <div className="sticky top-[87px] z-40 -mx-[16px] -mt-[16px] border-b border-border/70 bg-background/95 px-[16px] py-[12px] shadow-[0_12px_30px_rgba(15,23,42,0.06)] backdrop-blur supports-[backdrop-filter]:bg-background/85 md:top-[80px]">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3 xl:grid-cols-[1.25fr_repeat(4,1fr)]">
            <OverviewCard year={selectedYear} yearOptions={storedYearOptions} onYearChange={setSelectedYear} />
            <ExpenseStatCard icon={Wallet} label="Tổng chi phí năm" value={formatVnd(analytics.total)} tone="text-rose-500 bg-rose-500/10" />
            <ExpenseStatCard icon={Clock3} label="Chờ duyệt" value={`${analytics.pending} khoản`} tone="text-amber-600 bg-amber-500/10" />
            <ExpenseStatCard icon={CheckCircle2} label="Đã duyệt" value={formatVnd(analytics.approved)} tone="text-[#6366f1] bg-[#6366f1]/10" />
            <ExpenseStatCard icon={CircleDollarSign} label="Đã chi" value={formatVnd(analytics.paid)} tone="text-[#059669] bg-emerald-500/10" />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 2xl:grid-cols-[1fr_1.25fr_0.85fr]">
          <section className="rounded-[16px] border border-border bg-card p-5 shadow-sm xl:col-span-2 2xl:col-span-1">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[15px] font-black text-text">Chi phí theo danh mục</h2>
              <button className="rounded-[10px] border border-border bg-surface/60 px-3 py-2 text-[12px] font-bold text-text">Năm {analyticsYear}</button>
            </div>
            <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-stretch">
              <div className="flex w-full items-center justify-center rounded-[14px] border border-border/70 bg-surface/30 p-3 sm:w-[184px]">
                <div className="relative h-[148px] w-[148px] shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryChartData}
                        dataKey="amount"
                        nameKey="label"
                        innerRadius={47}
                        outerRadius={66}
                        paddingAngle={2}
                        stroke="var(--card)"
                        strokeWidth={4}
                      >
                        {categoryChartData.map((category) => (
                          <Cell key={category.label} fill={category.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<ExpenseChartTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <div className="text-[22px] font-black leading-none text-text">{shortVnd(analytics.total).replace(" đ", "")}</div>
                    <div className="mt-1 text-[11px] font-bold text-muted">Tổng chi phí</div>
                  </div>
                </div>
              </div>
              <div className="grid w-full content-center gap-3">
                {(analytics.categories.length ? analytics.categories : [{ label: "Chưa có dữ liệu", amount: 0, percent: 0, color: "#d1d5db", soft: "bg-slate-100 text-slate-500" }]).slice(0, 4).map((category) => (
                  <div key={category.label} className="grid grid-cols-[14px_1fr_auto] items-center gap-3 rounded-[12px] px-2 py-1.5 hover:bg-surface/60">
                    <span className="h-2.5 w-2.5 rounded-full ring-4 ring-surface" style={{ backgroundColor: category.color }} />
                    <div className="min-w-0">
                      <div className="flex items-center justify-between gap-3">
                        <div className="truncate text-[12px] font-black text-text">{category.label}</div>
                        <div className="hidden text-[11px] font-bold text-muted sm:block">{formatVnd(category.amount)}</div>
                      </div>
                      <div className="mt-1 h-1.5 rounded-full bg-surface">
                        <div className="h-1.5 rounded-full" style={{ width: `${Math.min(category.percent, 100)}%`, backgroundColor: category.color }} />
                      </div>
                    </div>
                    <div className="text-[12px] font-bold text-muted">{formatPercent(category.percent)}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="rounded-[16px] border border-border bg-card p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[15px] font-black text-text">Xu hướng chi phí</h2>
              <button className="rounded-[10px] border border-border bg-surface/60 px-3 py-2 text-[12px] font-bold text-text">Theo tháng</button>
            </div>
            <div className="h-[230px] rounded-[14px] border border-border/70 bg-surface/20 px-3 py-4">
              <div className="h-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={monthlyChartData} margin={{ top: 12, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="expenseArea" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6d3df8" stopOpacity={0.18} />
                        <stop offset="95%" stopColor="#6d3df8" stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="expenseBar" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.92} />
                        <stop offset="100%" stopColor="#c4b5fd" stopOpacity={0.72} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="rgba(148,163,184,0.18)" vertical={false} />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "var(--muted)", fontSize: 11, fontWeight: 700 }} />
                    <YAxis
                      width={48}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "var(--muted)", fontSize: 11, fontWeight: 700 }}
                      tickFormatter={(value) => shortVnd(Number(value)).replace(" đ", "")}
                    />
                    <Tooltip cursor={{ fill: "rgba(109,61,248,0.06)" }} content={<ExpenseChartTooltip />} />
                    <Area type="monotone" dataKey="amount" fill="url(#expenseArea)" stroke="transparent" />
                    <Bar dataKey="amount" radius={[8, 8, 0, 0]} barSize={10}>
                      {monthlyChartData.map((item) => (
                        <Cell key={item.month} fill={item.amount === analytics.maxMonth && item.amount > 0 ? "#6d3df8" : "url(#expenseBar)"} />
                      ))}
                    </Bar>
                    <Line
                      type="monotone"
                      dataKey="amount"
                      stroke="#6d3df8"
                      strokeWidth={2}
                      dot={{ r: 3, fill: "var(--card)", stroke: "#6d3df8", strokeWidth: 2 }}
                      activeDot={{ r: 5, fill: "#6d3df8", stroke: "var(--card)", strokeWidth: 3 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>

          <section className="rounded-[16px] border border-border bg-card p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[15px] font-black text-text">Top hạng mục</h2>
              <button className="rounded-[10px] border border-border bg-surface/60 px-3 py-2 text-[12px] font-bold text-text">Theo giá trị</button>
            </div>
            <div className="grid gap-4">
              {(analytics.categories.length ? analytics.categories : [{ label: "Chưa có dữ liệu", amount: 0, percent: 0, color: "#d1d5db", soft: "bg-slate-100 text-slate-500" }]).slice(0, 4).map((category) => (
                <div key={category.label} className="rounded-[12px] border border-transparent p-1 hover:border-border hover:bg-surface/40">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${category.soft}`}>
                        <FileText size={14} />
                      </span>
                      <span className="truncate text-[12px] font-black text-text">{category.label}</span>
                    </div>
                    <div className="shrink-0 text-right text-[12px] font-black text-text">{formatVnd(category.amount)}</div>
                  </div>
                  <div className="h-2 rounded-full bg-surface">
                    <div className="h-2 rounded-full" style={{ width: `${Math.min(category.percent, 100)}%`, backgroundColor: category.color }} />
                  </div>
                  <div className="mt-1 text-right text-[11px] font-bold text-muted">{formatPercent(category.percent)}</div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <ExpenseTable defaultYear={selectedYear} onCreateExpense={() => setExpenseModalOpen(true)} />
      </div>

      <ExpenseCreateModal isOpen={isExpenseModalOpen} onClose={() => setExpenseModalOpen(false)} />
    </AppShell>
  );
}

function ExpenseChartTooltip({ active, payload, label }: any) {
  if (!active || !Array.isArray(payload) || payload.length === 0) return null;
  const item = payload[0];
  const name = item?.name || item?.payload?.label || label || "Chi phí";
  const value = Number(item?.value || item?.payload?.amount || 0);
  const percent = Number(item?.payload?.percent || 0);

  return (
    <div className="rounded-[10px] border border-border bg-card px-3 py-2 text-[12px] shadow-[0_14px_35px_rgba(15,23,42,0.16)]">
      <div className="font-black text-text">{name}</div>
      <div className="mt-1 font-bold text-muted">{formatVnd(value)}</div>
      {percent > 0 && <div className="mt-0.5 text-[11px] font-bold text-muted">{formatPercent(percent)}</div>}
    </div>
  );
}

function OverviewCard({
  year,
  yearOptions,
  onYearChange,
}: {
  year: string;
  yearOptions: Array<{ value: string; label: string }>;
  onYearChange: (year: string) => void;
}) {
  return (
    <div className="relative overflow-hidden rounded-[16px] border border-[#8b5cf6]/20 bg-gradient-to-br from-[#f5f1ff] via-card to-card p-4 shadow-[0_14px_34px_rgba(109,61,248,0.08)]">
      <div className="absolute -right-8 -top-10 h-28 w-28 rounded-full bg-[#8b5cf6]/10 blur-2xl" />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <div className="text-[14px] font-black text-text">Tổng quan chi phí</div>
          <div className="mt-1 text-[11px] font-bold text-muted">Dữ liệu đã lưu trữ</div>
        </div>
        <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[#8b5cf6]/10 text-[#6d3df8]">
          <FileText size={15} />
        </div>
      </div>
      <Select value={year} onChange={(event) => onYearChange(event.target.value)} options={yearOptions} className="relative mt-4 bg-card/80" />
    </div>
  );
}

function ExpenseStatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string;
  hint?: string;
  tone: string;
}) {
  return (
    <div className="rounded-[14px] border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-[10px] font-black uppercase tracking-wide text-muted">{label}</div>
          <div className="mt-3 truncate text-[20px] font-black leading-none text-text">{value}</div>
          {hint && <div className="mt-3 text-[12px] font-bold text-[#059669]">{hint}</div>}
        </div>
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] ${tone}`}>
          <Icon size={16} />
        </div>
      </div>
    </div>
  );
}
