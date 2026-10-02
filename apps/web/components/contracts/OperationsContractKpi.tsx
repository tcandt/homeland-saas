"use client";

import React, { useMemo } from "react";
import { FileText, Compass, Clock, AlertTriangle } from "lucide-react";
import { Card } from "../ui/Card";
import { useContractsQuery } from "@/lib/queries/contracts.queries";
import { getOperationsContractKpiSummary } from "@/lib/contracts/operations-contract-kpi";

function formatCompactNumber(value: number) {
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(1).replace(/\.0$/, "")}B`;
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (value >= 100_000) {
    return `${(value / 1_000).toFixed(0)}k`;
  }
  return value.toLocaleString("vi-VN");
}

export default function OperationsContractKpi() {
  const { data } = useContractsQuery({ page: 1, limit: 10 });
  const contracts = useMemo(
    () => (data as any)?.data || (data as any)?.items || [],
    [data],
  );
  const totalContracts = (data as any)?.meta?.total ?? contracts.length;
  const summary = useMemo(() => getOperationsContractKpiSummary(contracts), [contracts]);

  const activePercent = totalContracts > 0 ? Math.round((summary.active / (contracts.length || 1)) * 100) : 0;
  const debtPercent = totalContracts > 0 ? Math.round((summary.debt / (contracts.length || 1)) * 100) : 0;

  return (
    <div data-testid="contracts-kpi-grid" className="grid grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
      <KpiCard
        title="TỔNG HỢP ĐỒNG"
        value={formatCompactNumber(totalContracts)}
        trend="+2 tháng này"
        trendPositive={true}
        icon={<FileText size={18} className="text-purple-600 dark:text-purple-400" />}
        iconBg="bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 border border-purple-200/60 dark:border-purple-800/40"
      />
      <KpiCard
        title="ĐANG HIỆU LỰC"
        value={formatCompactNumber(summary.active)}
        trend={`${activePercent}% tổng số`}
        trendColor="text-slate-400 dark:text-slate-500"
        icon={<Compass size={18} className="text-emerald-600 dark:text-emerald-400" />}
        iconBg="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40"
      />
      <KpiCard
        title="SẮP HẾT HẠN"
        value={formatCompactNumber(summary.expiring)}
        trend="< 30 ngày"
        trendColor="text-amber-600 dark:text-amber-400"
        icon={<Clock size={18} className="text-amber-600 dark:text-amber-400" />}
        iconBg="bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/40"
      />
      <KpiCard
        title="CÓ CÔNG NỢ"
        value={formatCompactNumber(summary.debt)}
        trend={`${debtPercent > 0 ? `${debtPercent}% tổng số` : "0% tổng số"}`}
        trendColor="text-rose-600 dark:text-rose-400"
        icon={<AlertTriangle size={18} className="text-rose-600 dark:text-rose-400" />}
        iconBg="bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-800/40"
      />
    </div>
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
    <Card className="group relative flex items-center gap-3.5 rounded-2xl border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-card px-4 py-3.5 shadow-[0_2px_8px_rgba(0,0,0,0.03)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-primary/40">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105 ${iconBg}`}>
        {icon}
      </div>

      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate mb-1">
          {title}
        </div>
        <div className="flex items-baseline gap-2">
          <span className="font-mono font-black text-2xl text-slate-800 dark:text-white leading-none">
            {value}
          </span>
          {trend && (
            <span
              className={`text-[11px] font-semibold truncate ${
                trendPositive
                  ? "text-emerald-600 dark:text-emerald-400"
                  : trendColor || "text-slate-400 dark:text-slate-500"
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
