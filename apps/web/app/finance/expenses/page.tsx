"use client";

import React, { useMemo, useState } from "react";
import {
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleDollarSign,
  Clock3,
  Layers,
  PieChart as PieIcon,
  Receipt,
  TrendingUp,
  Wallet,
} from "lucide-react";
import {
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
import { Card } from "@/components/ui/Card";
import { useExpensesQuery } from "@/lib/queries/finance.queries";

function formatCompactNumber(value: number) {
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(1).replace(/\.0$/, "")}B ₫`;
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}M ₫`;
  }
  if (value >= 100_000) {
    return `${(value / 1_000).toFixed(0)}k ₫`;
  }
  return `${Number(value || 0).toLocaleString("vi-VN")} ₫`;
}

const formatVnd = (value: number) => `${Number(value || 0).toLocaleString("vi-VN")} ₫`;

const formatPercent = (value: number) => `${(value || 0).toFixed(1)}%`;

const categoryMeta: Record<string, { label: string; color: string }> = {
  UTILITY: { label: "Điện nước", color: "#6366f1" },
  REPAIR: { label: "Sửa chữa", color: "#3b82f6" },
  CLEANING: { label: "Vệ sinh", color: "#10b981" },
  SUPPLIES: { label: "Vật tư", color: "#f59e0b" },
  MAINTENANCE: { label: "Bảo trì", color: "#0ea5e9" },
  MARKETING: { label: "Marketing", color: "#8b5cf6" },
  REFUND: { label: "Hoàn cọc", color: "#ec4899" },
  STAFF: { label: "Nhân sự", color: "#14b8a6" },
  OTHER: { label: "Khác", color: "#64748b" },
};

function buildYearRange(year: number) {
  return {
    startDate: new Date(year, 0, 1).toISOString(),
    endDate: new Date(year, 11, 31, 23, 59, 59, 999).toISOString(),
  };
}

export default function FinanceExpensesPage() {
  const [isExpenseModalOpen, setExpenseModalOpen] = useState(false);
  const [showCharts, setShowCharts] = useState(false);
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(String(currentYear));

  const analyticsYear = Number(selectedYear) || currentYear;
  const { data } = useExpensesQuery(buildYearRange(analyticsYear));
  const expenses = useMemo(() => (Array.isArray(data) ? data : []), [data]);

  // Strictly calculate from real database records (0 mock data)
  const analytics = useMemo(() => {
    const byCategory = new Map<string, number>();
    const monthly = Array.from({ length: 12 }, () => 0);
    let total = 0;
    let pendingCount = 0;
    let pendingAmount = 0;
    let approvedCount = 0;
    let approvedAmount = 0;
    let paidAmount = 0;
    let paidCount = 0;
    let deductedAmount = 0;
    let deductedCount = 0;

    expenses.forEach((expense: any) => {
      const amount = Number(expense.amount || 0);
      const key = expense.category || "OTHER";
      const label = categoryMeta[key]?.label || "Khác";
      const date = new Date(expense.date || expense.createdAt || Date.now());

      total += amount;
      byCategory.set(label, (byCategory.get(label) || 0) + amount);
      if (!Number.isNaN(date.getTime()) && date.getFullYear() === analyticsYear) {
        monthly[date.getMonth()] += amount;
      }
      if (expense.status === "PENDING") {
        pendingCount += 1;
        pendingAmount += amount;
      } else if (expense.status === "APPROVED") {
        approvedCount += 1;
        approvedAmount += amount;
      } else if (expense.status === "PAID") {
        paidCount += 1;
        paidAmount += amount;
        if (expense.settlementStatus === "DEDUCTED_FROM_PROFIT") {
          deductedCount += 1;
          deductedAmount += amount;
        }
      }
    });

    const categories = Array.from(byCategory.entries())
      .map(([label, amount]) => {
        const meta = Object.values(categoryMeta).find((item) => item.label === label) || categoryMeta.OTHER;
        return {
          label,
          amount,
          color: meta.color,
          percent: total > 0 ? (amount / total) * 100 : 0,
        };
      })
      .sort((a, b) => b.amount - a.amount);

    const avgMonthly = total / 12;
    const monthlyChart = monthly.map((amt, idx) => ({
      month: `T${idx + 1}`,
      amount: amt,
      average: Math.round(avgMonthly),
    }));

    return {
      total,
      pendingCount,
      pendingAmount,
      approvedCount,
      approvedAmount,
      paidAmount,
      paidCount,
      deductedAmount,
      deductedCount,
      categories,
      monthlyChart,
    };
  }, [analyticsYear, expenses]);

  return (
    <AppShell>
      <div
        data-testid="finance-expenses-root"
        className="-m-4 h-[calc(100dvh-87px)] w-[calc(100%+32px)] overflow-auto bg-slate-50/60 dark:bg-background md:h-[calc(100dvh-80px)] p-2 md:p-3 flex flex-col gap-2.5 2xl:min-h-0"
      >
        {/* COMPACT KPI HEADER GRID - Synchronized with OperationsContractKpi */}
        <div data-testid="expenses-kpi-grid" className="grid grid-cols-2 lg:grid-cols-5 gap-2.5 shrink-0">
          {/* Card 1: Tổng chi phí */}
          <KpiCard
            title="TỔNG CHI PHÍ"
            value={formatCompactNumber(analytics.total)}
            trend={`Năm ${analyticsYear}`}
            trendColor="text-slate-400 dark:text-slate-500"
            icon={<Wallet size={18} className="text-purple-600 dark:text-purple-400" />}
            iconBg="bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 border border-purple-200/60 dark:border-purple-800/40"
          />

          {/* Card 2: Chờ duyệt chi */}
          <KpiCard
            title="CHỜ DUYỆT CHI"
            value={`${analytics.pendingCount} khoản`}
            trend={analytics.pendingAmount > 0 ? formatCompactNumber(analytics.pendingAmount) : "0 ₫"}
            trendColor="text-amber-600 dark:text-amber-400"
            icon={<Clock3 size={18} className="text-amber-600 dark:text-amber-400" />}
            iconBg="bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/40"
          />

          {/* Card 3: Đã duyệt chi */}
          <KpiCard
            title="ĐÃ DUYỆT CHI"
            value={`${analytics.approvedCount} khoản`}
            trend={analytics.approvedAmount > 0 ? formatCompactNumber(analytics.approvedAmount) : "0 ₫"}
            trendColor="text-indigo-600 dark:text-indigo-400"
            icon={<CheckCircle2 size={18} className="text-indigo-600 dark:text-indigo-400" />}
            iconBg="bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/40"
          />

          {/* Card 4: Đã thanh toán */}
          <KpiCard
            title="ĐÃ THANH TOÁN"
            value={formatCompactNumber(analytics.paidAmount)}
            trend={`${analytics.paidCount} khoản`}
            trendPositive={true}
            icon={<CircleDollarSign size={18} className="text-emerald-600 dark:text-emerald-400" />}
            iconBg="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40"
          />

          {/* Card 5: Khấu trừ owner */}
          <KpiCard
            title="KHẤU TRỪ OWNER"
            value={formatCompactNumber(analytics.deductedAmount)}
            trend={`${analytics.deductedCount} khoản`}
            trendColor="text-rose-600 dark:text-rose-400"
            icon={<Receipt size={18} className="text-rose-600 dark:text-rose-400" />}
            iconBg="bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-800/40"
          />
        </div>

        {/* OPTIONAL EXPANDABLE ANALYTICS SECTION (Smooth, compact, zero mock data) */}
        {showCharts && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5 animate-fadeIn">
            {/* Card 1: Phân bổ theo danh mục */}
            <Card className="lg:col-span-5 rounded-2xl border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-card p-3.5 shadow-[0_2px_8px_rgba(0,0,0,0.03)] flex flex-col justify-between gap-3">
              <div className="flex items-center justify-between pb-2 border-b border-border/50">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 flex items-center justify-center">
                    <PieIcon size={12} />
                  </span>
                  Phân bổ theo danh mục ({analyticsYear})
                </span>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="h-7 rounded-lg border border-border/70 bg-card px-2 text-[11px] font-semibold text-text shadow-2xs outline-none cursor-pointer"
                >
                  <option value={String(currentYear)}>Năm {currentYear}</option>
                  <option value={String(currentYear - 1)}>Năm {currentYear - 1}</option>
                </select>
              </div>

              {analytics.categories.length === 0 ? (
                <div className="h-[150px] flex flex-col items-center justify-center text-xs text-muted-foreground">
                  <PieIcon size={28} className="text-slate-300 dark:text-slate-600 mb-2 stroke-1" />
                  <span>Chưa có dữ liệu chi phí trong năm {analyticsYear}</span>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row items-center gap-4 py-1">
                  <div className="relative h-[140px] w-[140px] shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={analytics.categories}
                          dataKey="amount"
                          nameKey="label"
                          innerRadius={44}
                          outerRadius={64}
                          paddingAngle={2}
                          stroke="none"
                        >
                          {analytics.categories.map((item, index) => (
                            <Cell key={`cell-${index}`} fill={item.color} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                        Tổng
                      </span>
                      <span className="text-xs font-mono font-bold text-slate-900 dark:text-slate-100">
                        {formatCompactNumber(analytics.total)}
                      </span>
                    </div>
                  </div>

                  <div className="flex-1 w-full flex flex-col gap-1.5 overflow-y-auto max-h-[160px] pr-1">
                    {analytics.categories.map((c) => (
                      <div key={c.label} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                          <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">
                            {c.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-2.5 font-mono text-xs shrink-0">
                          <span className="font-semibold text-slate-900 dark:text-slate-100">
                            {formatVnd(c.amount)}
                          </span>
                          <span className="text-muted-foreground font-medium w-10 text-right">
                            {formatPercent(c.percent)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>

            {/* Card 2: Xu hướng chi phí 12 tháng */}
            <Card className="lg:col-span-7 rounded-2xl border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-card p-3.5 shadow-[0_2px_8px_rgba(0,0,0,0.03)] flex flex-col justify-between gap-3">
              <div className="flex items-center justify-between pb-2 border-b border-border/50">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 flex items-center justify-center">
                    <TrendingUp size={12} />
                  </span>
                  Xu hướng chi phí 12 tháng ({analyticsYear})
                </span>
                <div className="flex items-center gap-3">
                  <div className="hidden sm:flex items-center gap-3 text-[11px] font-semibold text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm bg-[#818cf8]" /> Chi phí
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full border-2 border-[#6366f1] bg-white" /> Trung bình
                    </span>
                  </div>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    className="h-7 rounded-lg border border-border/70 bg-card px-2 text-[11px] font-semibold text-text shadow-2xs outline-none cursor-pointer"
                  >
                    <option value={String(currentYear)}>Năm {currentYear}</option>
                    <option value={String(currentYear - 1)}>Năm {currentYear - 1}</option>
                  </select>
                </div>
              </div>

              <div className="h-[155px] w-full pt-1">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={analytics.monthlyChart} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.12} />
                    <XAxis
                      dataKey="month"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 11, fill: "#94a3b8", fontWeight: 500 }}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 10, fill: "#94a3b8" }}
                      tickFormatter={(val) => (val >= 1_000_000 ? `${val / 1_000_000}M` : String(val))}
                    />
                    <Tooltip
                      formatter={(val: any, name: any) => [
                        formatVnd(Number(val)),
                        name === "amount" ? "Chi phí" : "Trung bình",
                      ]}
                      contentStyle={{
                        backgroundColor: "var(--card)",
                        borderColor: "var(--border)",
                        borderRadius: 14,
                        fontSize: 11,
                        boxShadow: "0 10px 25px -5px rgba(0,0,0,0.15)",
                      }}
                    />
                    <Bar
                      dataKey="amount"
                      fill="#818cf8"
                      opacity={0.8}
                      radius={[4, 4, 0, 0]}
                      maxBarSize={28}
                    />
                    <Line
                      type="monotone"
                      dataKey="average"
                      stroke="#6366f1"
                      strokeWidth={2}
                      dot={{ r: 3, fill: "#ffffff", stroke: "#6366f1", strokeWidth: 2 }}
                      activeDot={{ r: 5 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
        )}

        {/* MAIN EXPENSE TABLE (Full-featured list, filters, real project data) */}
        <ExpenseTable
          onCreateExpense={() => setExpenseModalOpen(true)}
          showAnalyticsToggle={true}
          isAnalyticsOpen={showCharts}
          onToggleAnalytics={() => setShowCharts((prev) => !prev)}
        />
      </div>

      <ExpenseCreateModal isOpen={isExpenseModalOpen} onClose={() => setExpenseModalOpen(false)} />
    </AppShell>
  );
}

function KpiCard({
  title,
  value,
  trend,
  trendPositive,
  trendColor,
  icon,
  iconBg,
}: {
  title: string;
  value: string;
  trend?: string;
  trendPositive?: boolean;
  trendColor?: string;
  icon: React.ReactNode;
  iconBg: string;
}) {
  return (
    <Card className="group relative flex items-center gap-3.5 rounded-2xl border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-card px-4 py-3 shadow-[0_2px_8px_rgba(0,0,0,0.03)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-primary/40">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105 ${iconBg}`}>
        {icon}
      </div>

      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate mb-1">
          {title}
        </div>
        <div className="flex items-baseline gap-2">
          <span className="font-mono font-black text-xl 2xl:text-2xl text-slate-800 dark:text-white leading-none">
            {value}
          </span>
          {trend && (
            <span
              className={`text-xs font-semibold ${
                trendColor
                  ? trendColor
                  : trendPositive
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-rose-600 dark:text-rose-400"
              }`}
            >
              {trend}
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}
