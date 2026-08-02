"use client";

import React, { useMemo, useState } from "react";
import { ChevronRight, FilePlus, Send, AlertTriangle, CheckCircle2, Receipt } from "lucide-react";
import { Card } from "../ui/Card";
import { Skeleton } from "../ui/Skeleton";
import { useInvoicesQuery } from "@/lib/queries/invoices.queries";

type Stage = {
  id: number;
  label: string;
  icon: any;
  count: number;
  amount: number;
  percent: number;
  color: string;
  bg: string;
  border: string;
};

const formatMoney = (amount: number) =>
  new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(amount);

export default function OperationsBillingPipeline() {
  const [activeStage, setActiveStage] = useState<number | null>(null);
  const { data, isLoading } = useInvoicesQuery({ limit: 100 });
  const invoices = (data as any)?.data || [];

  const totalAmount = invoices.reduce((sum: number, invoice: any) => sum + (Number(invoice.totalAmount ?? invoice.total ?? 0) || 0), 0);

  const pipeline = useMemo<Stage[]>(() => {
    const stages: Array<{ id: number; label: string; icon: any; statuses: string[]; color: string; bg: string; border: string; }> = [
      {
        id: 1,
        label: "Nháp",
        icon: FilePlus,
        statuses: ["DRAFT"],
        color: "text-[#6366f1]",
        bg: "bg-[#6366f1]/10",
        border: "border-[#6366f1]",
      },
      {
        id: 2,
        label: "Đã gửi",
        icon: Send,
        statuses: ["ISSUED"],
        color: "text-[#0ea5e9]",
        bg: "bg-[#0ea5e9]/10",
        border: "border-[#0ea5e9]",
      },
      {
        id: 3,
        label: "Thanh toán 1 phần",
        icon: Receipt,
        statuses: ["PARTIALLY_PAID"],
        color: "text-[#f97316]",
        bg: "bg-[#f97316]/10",
        border: "border-[#f97316]",
      },
      {
        id: 4,
        label: "Đã thu",
        icon: CheckCircle2,
        statuses: ["PAID"],
        color: "text-[#8b5cf6]",
        bg: "bg-[#8b5cf6]/10",
        border: "border-[#8b5cf6]",
      },
      {
        id: 5,
        label: "Quá hạn",
        icon: AlertTriangle,
        statuses: ["OVERDUE"],
        color: "text-rose-500",
        bg: "bg-rose-500/10",
        border: "border-rose-500",
      },
    ];

    return stages.map((stage) => {
      const stageItems = invoices.filter((invoice: any) => stage.statuses.includes(invoice.status));
      const amount = stageItems.reduce((sum: number, invoice: any) => sum + (Number(invoice.totalAmount ?? invoice.total ?? 0) || 0), 0);
      return {
        id: stage.id,
        label: stage.label,
        icon: stage.icon,
        count: stageItems.length,
        amount,
        percent: totalAmount > 0 ? Math.round((amount / totalAmount) * 100) : 0,
        color: stage.color,
        bg: stage.bg,
        border: stage.border,
      };
    });
  }, [invoices, totalAmount]);

  if (isLoading) {
    return (
      <Card
        data-testid="billing-pipeline-skeleton"
        className="p-[16px] flex items-center justify-between gap-[8px] overflow-x-auto no-scrollbar"
      >
        {Array.from({ length: 5 }).map((_, idx) => (
          <React.Fragment key={idx}>
            <div className="flex-1 min-w-[160px] p-[12px] rounded-[12px] border border-border/60 bg-black/5 dark:bg-white/5">
              <div className="flex items-center justify-between mb-[12px]">
                <div className="flex items-center gap-[8px]">
                  <Skeleton className="w-[24px] h-[24px] rounded-full" />
                  <Skeleton className="h-3 w-16" />
                </div>
                <Skeleton className="h-4 w-10" />
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
      data-testid="billing-pipeline"
      className="p-[16px] flex items-center justify-between gap-[8px] overflow-x-auto no-scrollbar focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      {pipeline.map((stage, idx) => (
        <React.Fragment key={stage.id}>
          <div
            onClick={() => setActiveStage(activeStage === stage.id ? null : stage.id)}
            className={`flex-1 min-w-[160px] p-[12px] rounded-[12px] border cursor-pointer transition-all duration-200 group relative overflow-hidden ${
              activeStage === stage.id
                ? `${stage.border} shadow-sm ${stage.bg}`
                : "border-transparent hover:border-border hover:bg-black/5 dark:hover:bg-white/5"
            }`}
          >
            <div className="flex items-center justify-between mb-[12px]">
              <div className="flex items-center gap-[8px]">
                <div className={`w-[24px] h-[24px] rounded-full flex items-center justify-center ${activeStage === stage.id ? "bg-background" : stage.bg}`}>
                  <stage.icon size={12} className={stage.color} />
                </div>
                <span className={`font-black text-[11px] uppercase tracking-wider ${activeStage === stage.id ? stage.color : "text-muted group-hover:text-text"} transition-colors`}>
                  {stage.label}
                </span>
              </div>
              <span className={`font-bold text-[11px] px-[6px] py-[2px] rounded-[4px] ${activeStage === stage.id ? "bg-background text-text" : "bg-black/5 dark:bg-white/5 text-muted"}`}>
                {stage.percent}%
              </span>
            </div>

            <div className="flex items-end justify-between">
              <div className="flex items-end gap-[4px]">
                <span className="font-black text-[22px] leading-none text-text">{stage.count}</span>
                <span className="text-[11px] font-bold text-muted mb-[2px]">hóa đơn</span>
              </div>
              <span className={`font-black text-[14px] ${activeStage === stage.id ? stage.color : "text-text"}`}>
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
      ))}
    </Card>
  );
}
