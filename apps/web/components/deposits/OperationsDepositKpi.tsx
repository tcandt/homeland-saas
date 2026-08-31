"use client";

import React from "react";
import { 
  Coins, 
  ShieldCheck, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  Wallet,
  ArrowUpRight,
  TrendingUp
} from "lucide-react";
import { useDepositStatsQuery } from "@/lib/queries/deposits.queries";
import { useDepositStore } from "@/lib/stores/deposit.store";
import { Card } from "../ui/Card";
import { Skeleton } from "../ui/Skeleton";

interface OperationsDepositKpiProps {
  onCreateClick?: () => void;
}

export default function OperationsDepositKpi({ onCreateClick }: OperationsDepositKpiProps) {
  const { buildingFilter } = useDepositStore();
  const { data: statsData, isLoading } = useDepositStatsQuery(buildingFilter !== 'ALL' ? buildingFilter : undefined);
  const kpi = statsData?.kpi || {};

  if (isLoading) {
    return (
      <div data-testid="deposits-kpi-grid" className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 md:gap-4">
        {Array.from({ length: 6 }).map((_, idx) => (
          <Card key={idx} className="p-4 flex flex-col justify-between h-[104px] rounded-2xl border border-border/50 shadow-xs">
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-20 rounded-md" />
              <Skeleton className="w-8 h-8 rounded-xl" />
            </div>
            <div className="flex flex-col gap-1">
              <Skeleton className="h-6 w-24 rounded-md" />
              <Skeleton className="h-2.5 w-16 rounded-md" />
            </div>
          </Card>
        ))}
      </div>
    );
  }

  const totalFund = Number(kpi.totalFund) || 0;
  const securityFund = Number(kpi.securityFund) || 0;
  const bookingFund = Number(kpi.bookingFund) || 0;
  const refundPendingCount = Number(kpi.refundPendingCount) || 0;
  const refundOverdueCount = Number(kpi.refundOverdueCount) || 0;
  const refundedCount = Number(kpi.refundedCount) || 0;

  const formatVndCompact = (val: number) => {
    if (val >= 1_000_000_000) {
      return `${(val / 1_000_000_000).toFixed(2).replace(/\.?0+$/, '')} tỷ`;
    }
    if (val >= 1_000_000) {
      return `${(val / 1_000_000).toFixed(1).replace(/\.?0+$/, '')}M`;
    }
    return new Intl.NumberFormat("vi-VN").format(val);
  };

  const formatVndFull = (val: number) => {
    return new Intl.NumberFormat("vi-VN").format(val) + " đ";
  };

  const kpis = [
    {
      id: "total",
      label: "Tổng quỹ cọc",
      displayValue: totalFund > 0 ? formatVndCompact(totalFund) : "0",
      unit: totalFund > 0 && totalFund < 1_000_000 ? "đ" : totalFund >= 1_000_000 ? "đ" : "đ",
      subtext: "Quỹ tiền đang giữ",
      icon: Wallet,
      color: "text-indigo-600 dark:text-indigo-400",
      bgGradient: "from-indigo-500/[0.08] to-indigo-500/[0.02]",
      iconBg: "bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400",
      borderGlow: "group-hover:border-indigo-500/40",
      activePill: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
    },
    {
      id: "security",
      label: "Cọc bảo đảm",
      displayValue: securityFund > 0 ? formatVndCompact(securityFund) : "0",
      unit: "đ",
      subtext: "Hợp đồng thuê",
      icon: ShieldCheck,
      color: "text-purple-600 dark:text-purple-400",
      bgGradient: "from-purple-500/[0.08] to-purple-500/[0.02]",
      iconBg: "bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400",
      borderGlow: "group-hover:border-purple-500/40",
      activePill: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
    },
    {
      id: "booking",
      label: "Cọc giữ chỗ",
      displayValue: bookingFund > 0 ? formatVndCompact(bookingFund) : "0",
      unit: "đ",
      subtext: "Chờ lên HĐ",
      icon: Coins,
      color: "text-amber-600 dark:text-amber-400",
      bgGradient: "from-amber-500/[0.08] to-amber-500/[0.02]",
      iconBg: "bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400",
      borderGlow: "group-hover:border-amber-500/40",
      activePill: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    },
    {
      id: "pending_refund",
      label: "Sắp hoàn tiền",
      displayValue: refundPendingCount.toString(),
      unit: "phiếu",
      subtext: "Đang chờ chuyển",
      icon: Clock,
      color: "text-sky-600 dark:text-sky-400",
      bgGradient: "from-sky-500/[0.08] to-sky-500/[0.02]",
      iconBg: "bg-sky-500/10 border border-sky-500/20 text-sky-600 dark:text-sky-400",
      borderGlow: "group-hover:border-sky-500/40",
      activePill: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
    },
    {
      id: "overdue",
      label: "Hoàn quá hạn",
      displayValue: refundOverdueCount.toString(),
      unit: "phiếu",
      subtext: refundOverdueCount > 0 ? "Cần xử lý gấp" : "Không quá hạn",
      icon: AlertTriangle,
      color: refundOverdueCount > 0 ? "text-rose-600 dark:text-rose-400" : "text-slate-400",
      bgGradient: refundOverdueCount > 0 ? "from-rose-500/[0.12] to-rose-500/[0.03]" : "from-slate-500/[0.05] to-transparent",
      iconBg: refundOverdueCount > 0 ? "bg-rose-500/10 border border-rose-500/25 text-rose-600 dark:text-rose-400" : "bg-black/5 dark:bg-white/5 border border-border text-muted",
      borderGlow: refundOverdueCount > 0 ? "border-rose-500/30 group-hover:border-rose-500/50" : "group-hover:border-border",
      activePill: refundOverdueCount > 0 ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 font-black" : "bg-black/5 dark:bg-white/5 text-muted",
    },
    {
      id: "refunded",
      label: "Đã hoàn (tháng)",
      displayValue: refundedCount.toString(),
      unit: "phiếu",
      subtext: "Tháng hiện tại",
      icon: CheckCircle2,
      color: "text-emerald-600 dark:text-emerald-400",
      bgGradient: "from-emerald-500/[0.08] to-emerald-500/[0.02]",
      iconBg: "bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400",
      borderGlow: "group-hover:border-emerald-500/40",
      activePill: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    },
  ];

  return (
    <div data-testid="deposits-kpi-grid" className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 md:gap-3.5">
      {kpis.map((item) => (
        <div
          key={item.id}
          className={`group relative flex flex-col justify-between p-3.5 md:p-4 rounded-2xl border border-border/70 bg-gradient-to-b ${item.bgGradient} bg-card/60 backdrop-blur-sm shadow-xs transition-all duration-200 hover:-translate-y-1 hover:shadow-md ${item.borderGlow}`}
        >
          {/* Top Row: Label & Icon */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-muted uppercase tracking-wider truncate group-hover:text-text transition-colors">
              {item.label}
            </span>
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-2xs transition-transform duration-200 group-hover:scale-105 ${item.iconBg}`}>
              <item.icon size={15} />
            </div>
          </div>

          {/* Value Row */}
          <div className="mt-2 flex flex-col">
            <div className="flex items-baseline gap-1">
              <span className="font-mono font-black text-[22px] md:text-[25px] text-text leading-none tracking-tight">
                {item.displayValue}
              </span>
              {item.unit && (
                <span className={`text-[12px] font-bold ${item.color}`}>
                  {item.unit}
                </span>
              )}
            </div>
            <span className="text-[11px] font-medium text-muted mt-1 truncate">
              {item.subtext}
            </span>
          </div>

          {/* Micro ambient glow effect */}
          <div className="absolute right-0 bottom-0 w-16 h-16 bg-current opacity-[0.03] rounded-full blur-xl pointer-events-none group-hover:opacity-[0.07] transition-opacity" />
        </div>
      ))}
    </div>
  );
}
