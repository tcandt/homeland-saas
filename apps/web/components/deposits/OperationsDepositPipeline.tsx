"use client";

import React from "react";
import { ChevronRight, Bookmark, Coins, FileText, RefreshCcw, CheckCircle2, XCircle } from "lucide-react";
import { Card } from "../ui/Card";
import { Skeleton } from "../ui/Skeleton";
import { useDepositStatsQuery } from "@/lib/queries/deposits.queries";
import { useDepositStore } from "@/lib/stores/deposit.store";

type Stage = {
  id: number;
  label: string;
  statusCode: string;
  icon: any;
  count: number;
  amount: number;
  color: string;
  bg: string;
  activeBorder: string;
  activeBg: string;
};

const formatMoney = (amount: number) =>
  new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(amount) + " đ";

export default function OperationsDepositPipeline() {
  const { statusFilter, setStatusFilter, buildingFilter } = useDepositStore();
  const { data: statsData, isLoading } = useDepositStatsQuery(buildingFilter !== 'ALL' ? buildingFilter : undefined);

  const stageIcons: Record<string, any> = {
    DRAFT: Bookmark,
    PAID: Coins,
    CONVERTED_TO_CONTRACT: FileText,
    REFUNDED: RefreshCcw,
    CANCELLED: XCircle,
  };

  const stageColors: Record<string, { color: string; bg: string; activeBorder: string; activeBg: string }> = {
    DRAFT: { color: "text-sky-600 dark:text-sky-400", bg: "bg-sky-500/10", activeBorder: "border-sky-500 ring-2 ring-sky-500/20", activeBg: "bg-sky-500/[0.08]" },
    PAID: { color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10", activeBorder: "border-emerald-500 ring-2 ring-emerald-500/20", activeBg: "bg-emerald-500/[0.08]" },
    CONVERTED_TO_CONTRACT: { color: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-500/10", activeBorder: "border-indigo-500 ring-2 ring-indigo-500/20", activeBg: "bg-indigo-500/[0.08]" },
    REFUNDED: { color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10", activeBorder: "border-amber-500 ring-2 ring-amber-500/20", activeBg: "bg-amber-500/[0.08]" },
    CANCELLED: { color: "text-rose-600 dark:text-rose-400", bg: "bg-rose-500/10", activeBorder: "border-rose-500 ring-2 ring-rose-500/20", activeBg: "bg-rose-500/[0.08]" },
  };

  const rawPipeline = statsData?.pipeline || [];
  const pipeline: Stage[] = rawPipeline.map((p: any) => ({
    id: p.id,
    label: p.label,
    statusCode: p.key,
    icon: stageIcons[p.key] || Bookmark,
    count: Number(p.count) || 0,
    amount: Number(p.amount) || 0,
    color: stageColors[p.key]?.color || "text-primary",
    bg: stageColors[p.key]?.bg || "bg-primary/10",
    activeBorder: stageColors[p.key]?.activeBorder || "border-primary ring-2 ring-primary/20",
    activeBg: stageColors[p.key]?.activeBg || "bg-primary/5",
  }));

  if (isLoading) {
    return (
      <div
        data-testid="deposits-pipeline-skeleton"
        className="p-3.5 bg-card/60 border border-border/60 rounded-2xl flex items-center justify-between gap-2 overflow-x-auto no-scrollbar shadow-xs"
      >
        {Array.from({ length: 5 }).map((_, idx) => (
          <React.Fragment key={idx}>
            <div className="flex-1 min-w-[140px] p-3 rounded-xl border border-border/40 bg-black/5 dark:bg-white/5">
              <div className="flex items-center gap-2 mb-2">
                <Skeleton className="w-5 h-5 rounded-md" />
                <Skeleton className="h-3 w-20" />
              </div>
              <div className="flex items-baseline justify-between">
                <Skeleton className="h-5 w-8" />
                <Skeleton className="h-4 w-16" />
              </div>
            </div>
            {idx < 4 && (
              <div className="flex items-center justify-center text-muted px-1">
                <ChevronRight size={14} className="opacity-20" />
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
    );
  }

  return (
    <div
      tabIndex={0}
      data-testid="deposits-pipeline"
      className="p-2.5 md:p-3 bg-card/60 border border-border/60 rounded-2xl flex items-center justify-between gap-1.5 md:gap-2 overflow-x-auto no-scrollbar shadow-xs backdrop-blur-sm focus-visible:outline-none"
    >
      {pipeline.map((stage, idx) => {
        const isSelected = statusFilter === stage.statusCode;
        return (
          <React.Fragment key={stage.id}>
            <div
              onClick={() => setStatusFilter(isSelected ? 'ALL' : stage.statusCode)}
              className={`flex-1 min-w-[140px] p-2.5 md:p-3 rounded-xl border cursor-pointer transition-all duration-200 group relative ${
                isSelected
                  ? `${stage.activeBorder} ${stage.activeBg} shadow-xs`
                  : "border-border/40 bg-card hover:border-border hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
              }`}
            >
              {/* Header: Icon & Stage name */}
              <div className="flex items-center gap-1.5 mb-2">
                <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${stage.bg}`}>
                  <stage.icon size={11} className={stage.color} />
                </div>
                <span className={`font-bold text-[11px] uppercase tracking-wide truncate ${isSelected ? stage.color : "text-muted group-hover:text-text"} transition-colors`}>
                  {stage.label}
                </span>
              </div>

              {/* Body: Count & Amount */}
              <div className="flex items-baseline justify-between gap-2">
                <div className="flex items-baseline gap-1">
                  <span className="font-mono font-black text-[18px] leading-none text-text">
                    {stage.count}
                  </span>
                  <span className="text-[10px] font-bold text-muted">
                    phiếu
                  </span>
                </div>
                <span className={`font-mono font-bold text-[12px] ${isSelected ? stage.color : "text-text"}`}>
                  {formatMoney(stage.amount)}
                </span>
              </div>
            </div>

            {idx < pipeline.length - 1 && (
              <div className="flex items-center justify-center text-muted shrink-0">
                <ChevronRight size={14} className="opacity-30" />
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
