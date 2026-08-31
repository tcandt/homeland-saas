"use client";

import React from "react";
import { ChevronRight, Bookmark, Coins, FileText, RefreshCcw, CheckCircle2 } from "lucide-react";
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
  border: string;
};

const formatMoney = (amount: number) =>
  new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(amount);

export default function OperationsDepositPipeline() {
  const { statusFilter, setStatusFilter, buildingFilter } = useDepositStore();
  const { data: statsData, isLoading } = useDepositStatsQuery(buildingFilter !== 'ALL' ? buildingFilter : undefined);

  const stageIcons: Record<string, any> = {
    DRAFT: Bookmark,
    PAID: Coins,
    CONVERTED_TO_CONTRACT: FileText,
    REFUNDED: RefreshCcw,
    CANCELLED: CheckCircle2,
  };

  const stageColors: Record<string, { color: string; bg: string; border: string }> = {
    DRAFT: { color: "text-[#0ea5e9]", bg: "bg-[#0ea5e9]/10", border: "border-[#0ea5e9]" },
    PAID: { color: "text-[#f97316]", bg: "bg-[#f97316]/10", border: "border-[#f97316]" },
    CONVERTED_TO_CONTRACT: { color: "text-[#6366f1]", bg: "bg-[#6366f1]/10", border: "border-[#6366f1]" },
    REFUNDED: { color: "text-rose-500", bg: "bg-rose-500/10", border: "border-rose-500" },
    CANCELLED: { color: "text-[#8b5cf6]", bg: "bg-[#8b5cf6]/10", border: "border-[#8b5cf6]" },
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
    border: stageColors[p.key]?.border || "border-primary",
  }));

  if (isLoading) {
    return (
      <Card
        data-testid="deposits-pipeline-skeleton"
        className="p-[16px] flex items-center justify-between gap-[8px] overflow-x-auto no-scrollbar"
      >
        {Array.from({ length: 5 }).map((_, idx) => (
          <React.Fragment key={idx}>
            <div className="flex-1 min-w-[160px] p-[12px] rounded-[12px] border border-border/60 bg-black/5 dark:bg-white/5">
              <div className="flex items-center gap-[8px] mb-[12px]">
                <Skeleton className="w-[24px] h-[24px] rounded-full" />
                <Skeleton className="h-3 w-24" />
              </div>
              <div className="flex items-end justify-between">
                <div className="flex items-end gap-[4px]">
                  <Skeleton className="h-7 w-8" />
                  <Skeleton className="h-3 w-14 mb-[2px]" />
                </div>
                <Skeleton className="h-4 w-20" />
              </div>
            </div>
            {idx < 4 && (
              <div className="flex items-center justify-center text-muted px-[4px]">
                <ChevronRight size={16} className="opacity-20" />
              </div>
            )}
          </React.Fragment>
        ))}
      </Card>
    );
  }

  return (
    <Card
      tabIndex={0}
      data-testid="deposits-pipeline"
      className="p-[16px] flex items-center justify-between gap-[8px] overflow-x-auto no-scrollbar focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      {pipeline.map((stage, idx) => {
        const isSelected = statusFilter === stage.statusCode;
        return (
          <React.Fragment key={stage.id}>
            <div
              onClick={() => setStatusFilter(isSelected ? 'ALL' : stage.statusCode)}
              className={`flex-1 min-w-[160px] p-[12px] rounded-[12px] border cursor-pointer transition-all duration-200 group relative overflow-hidden ${
                isSelected
                  ? `${stage.border} shadow-sm ${stage.bg}`
                  : "border-transparent hover:border-border hover:bg-black/5 dark:hover:bg-white/5"
              }`}
            >
              <div className="flex items-center gap-[8px] mb-[12px]">
                <div className={`w-[24px] h-[24px] rounded-full flex items-center justify-center ${isSelected ? "bg-background" : stage.bg}`}>
                  <stage.icon size={12} className={stage.color} />
                </div>
                <span className={`font-black text-[11px] uppercase tracking-wider ${isSelected ? stage.color : "text-muted group-hover:text-text"} transition-colors`}>
                  {stage.label}
                </span>
              </div>

              <div className="flex items-end justify-between">
                <div className="flex items-end gap-[4px]">
                  <span className="font-black text-[22px] leading-none text-text">{stage.count}</span>
                  <span className="text-[11px] font-bold text-muted mb-[2px]">phiếu</span>
                </div>
                <span className={`font-black text-[14px] ${isSelected ? stage.color : "text-text"}`}>
                  {formatMoney(stage.amount)}đ
                </span>
              </div>
            </div>

            {idx < pipeline.length - 1 && (
              <div className="flex items-center justify-center text-muted px-[4px]">
                <ChevronRight size={16} className="opacity-30" />
              </div>
            )}
          </React.Fragment>
        );
      })}
    </Card>
  );
}
