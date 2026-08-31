"use client";

import React, { useMemo } from "react";
import { 
  Coins, 
  ShieldCheck, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  Wallet,
  CalendarClock
} from "lucide-react";
import { useDepositStatsQuery } from "@/lib/queries/deposits.queries";
import { useDepositStore } from "@/lib/stores/deposit.store";
import { Card } from "../ui/Card";
import { Skeleton } from "../ui/Skeleton";

const formatVnd = (value: number) => `${Number(value || 0).toLocaleString("vi-VN")} đ`;

export default function OperationsDepositKpi() {
  const { buildingFilter } = useDepositStore();
  const { data: statsData, isLoading } = useDepositStatsQuery(buildingFilter !== 'ALL' ? buildingFilter : undefined);
  const kpi = statsData?.kpi || {};

  const summary = useMemo(() => {
    const totalFund = Number(kpi.totalFund) || 0;
    const securityFund = Number(kpi.securityFund) || 0;
    const bookingFund = Number(kpi.bookingFund) || 0;
    const refundPendingCount = Number(kpi.refundPendingCount) || 0;
    const refundOverdueCount = Number(kpi.refundOverdueCount) || 0;
    const refundedCount = Number(kpi.refundedCount) || 0;

    return {
      totalFund,
      securityFund,
      bookingFund,
      refundPendingCount,
      refundOverdueCount,
      refundedCount,
    };
  }, [kpi]);

  if (isLoading) {
    return (
      <div data-testid="deposits-kpi-grid" className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-2.5 shrink-0">
        {Array.from({ length: 4 }).map((_, idx) => (
          <Card key={idx} className="flex items-center gap-3 rounded-xl border border-border/60 bg-card px-3.5 py-2.5 shadow-2xs">
            <Skeleton className="w-9 h-9 rounded-xl shrink-0" />
            <div className="flex flex-col gap-1 min-w-0 flex-1">
              <Skeleton className="h-3 w-20 rounded" />
              <Skeleton className="h-5 w-28 rounded" />
            </div>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div data-testid="deposits-kpi-grid" className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-2.5 shrink-0">
      {/* 1. Tổng quỹ cọc */}
      <KpiCard
        title="Tổng quỹ cọc"
        value={formatVnd(summary.totalFund)}
        subtext="Quỹ tiền cọc đang lưu giữ"
        icon={<Wallet size={16} className="text-indigo-600 dark:text-indigo-400" />}
        iconBg="bg-indigo-500/10 border border-indigo-500/20"
      />

      {/* 2. Cọc bảo đảm */}
      <KpiCard
        title="Cọc bảo đảm HĐ"
        value={formatVnd(summary.securityFund)}
        subtext="Hợp đồng thuê dài hạn"
        icon={<ShieldCheck size={16} className="text-purple-600 dark:text-purple-400" />}
        iconBg="bg-purple-500/10 border border-purple-500/20"
      />

      {/* 3. Cọc giữ chỗ */}
      <KpiCard
        title="Cọc giữ chỗ phòng"
        value={formatVnd(summary.bookingFund)}
        subtext="Chờ ký hợp đồng thuê"
        icon={<Coins size={16} className="text-amber-600 dark:text-amber-400" />}
        iconBg="bg-amber-500/10 border border-amber-500/20"
      />

      {/* 4. Hoàn cọc & Quá hạn */}
      <KpiCard
        title="Cần hoàn / Quá hạn"
        value={`${summary.refundPendingCount} phiếu`}
        subtext={
          summary.refundOverdueCount > 0 
            ? `${summary.refundOverdueCount} phiếu quá hạn cần xử lý` 
            : summary.refundedCount > 0 
              ? `Đã hoàn ${summary.refundedCount} phiếu trong tháng`
              : "Không có phiếu quá hạn"
        }
        highlight={summary.refundOverdueCount > 0}
        highlightColor="text-rose-600 dark:text-rose-400"
        icon={
          summary.refundOverdueCount > 0 ? (
            <AlertTriangle size={16} className="text-rose-600 dark:text-rose-400" />
          ) : (
            <CalendarClock size={16} className="text-sky-600 dark:text-sky-400" />
          )
        }
        iconBg={
          summary.refundOverdueCount > 0 
            ? "bg-rose-500/10 border border-rose-500/20" 
            : "bg-sky-500/10 border border-sky-500/20"
        }
      />
    </div>
  );
}

function KpiCard({
  title,
  value,
  subtext,
  icon,
  iconBg,
  highlight,
  highlightColor,
}: {
  title: string;
  value: string;
  subtext?: string;
  icon: React.ReactNode;
  iconBg: string;
  highlight?: boolean;
  highlightColor?: string;
}) {
  return (
    <Card
      className={`flex items-center gap-3 rounded-xl border px-3.5 py-2.5 shadow-2xs transition-all hover:border-primary/30 ${
        highlight
          ? "border-rose-500/30 dark:border-rose-500/20 bg-rose-500/[0.02]"
          : "border-border/60 bg-card"
      }`}
    >
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
        {icon}
      </div>

      <div className="min-w-0 flex-1">
        <div className="text-[10px] md:text-[11px] font-bold text-muted uppercase tracking-wider truncate leading-tight mb-0.5">
          {title}
        </div>
        <div className="flex items-baseline gap-2">
          <span className="font-mono font-black text-[16px] md:text-[18px] text-text leading-none">
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
