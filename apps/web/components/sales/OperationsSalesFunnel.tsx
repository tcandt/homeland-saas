"use client";

import React from "react";
import { ChevronRight } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSalesLeadsQuery } from "@/lib/queries/sales.queries";
import { SALES_STAGE_LABELS } from "./sales.types";
import { Card } from "../ui/Card";
import { Skeleton } from "../ui/Skeleton";

const funnelStages = [
  { id: "new", status: "NEW", color: "border-blue-500", bg: "bg-blue-500", text: "text-blue-500" },
  { id: "contacted", status: "CONTACTED", color: "border-[#0ea5e9]", bg: "bg-[#0ea5e9]", text: "text-[#0ea5e9]" },
  { id: "qualified", status: "QUALIFIED", color: "border-[#6366f1]", bg: "bg-[#6366f1]", text: "text-[#6366f1]" },
  { id: "proposal", status: "PROPOSAL", color: "border-indigo-500", bg: "bg-indigo-500", text: "text-indigo-500" },
  { id: "won", status: "WON", color: "border-[#8b5cf6]", bg: "bg-[#8b5cf6]", text: "text-[#8b5cf6]" },
  { id: "lost", status: "LOST", color: "border-muted", bg: "bg-muted", text: "text-muted" },
];

export default function OperationsSalesFunnel() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeStage = searchParams.get("stage");
  const { data, isLoading } = useSalesLeadsQuery({ limit: 100 });
  const leads = Array.isArray((data as any)?.data?.data) ? (data as any).data.data : [];
  const totalLeads = Math.max(leads.length, 1);

  const toggleStage = (id: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (activeStage === id) {
      params.delete("stage");
    } else {
      params.set("stage", id);
    }
    router.push(`?${params.toString()}`);
  };

  const totals = funnelStages.map((stage) => ({
    ...stage,
    count: leads.filter((lead: any) => lead.status === stage.status).length,
  }));

  if (isLoading) {
    return (
      <Card className="p-[16px] md:p-[20px] shadow-sm flex flex-col gap-[16px] overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-[8px]">
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-56" />
          </div>
          <Skeleton className="h-8 w-24 rounded-full" />
        </div>
        <div className="flex w-full overflow-x-auto no-scrollbar pb-[10px]">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="flex items-center shrink-0 min-w-[140px] flex-1">
              <div className="flex-1 relative flex flex-col gap-[6px] p-[12px] md:p-[16px] border-t-4 bg-background/50 rounded-[4px]">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-5 w-8 rounded-[4px]" />
                </div>
                <div className="flex flex-col gap-[2px]">
                  <Skeleton className="h-3 w-10" />
                  <Skeleton className="h-4 w-8" />
                </div>
                <Skeleton className="h-[4px] w-full rounded-full mt-[4px]" />
              </div>
              {index < 5 && (
                <div className="shrink-0 mx-[4px] md:mx-[8px] text-border">
                  <ChevronRight size={20} className="opacity-20" />
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>
    );
  }

  return (
    <div className="bg-card border border-border rounded-[16px] p-[16px] md:p-[20px] shadow-sm flex flex-col gap-[16px] overflow-hidden">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-[8px]">
        <div>
          <h3 className="font-black text-[16px] text-text">Sales Funnel</h3>
          <p className="text-[13px] text-muted font-medium">Phân bổ lead theo trạng thái thật từ DB</p>
        </div>
        {activeStage && (
          <button
            onClick={() => {
              const params = new URLSearchParams(searchParams.toString());
              params.delete("stage");
              router.push(`?${params.toString()}`);
            }}
            className="text-[12px] font-bold text-rose-500 hover:text-rose-600 hover:underline px-3 py-1 bg-rose-500/10 rounded-full transition-colors self-start md:self-auto"
          >
            Bỏ chọn phễu
          </button>
        )}
      </div>

      <div className="flex w-full overflow-x-auto no-scrollbar pb-[10px]">
        {totals.map((stage, index) => {
          const isActive = activeStage === stage.id;
          const isDimmed = activeStage !== null && activeStage !== stage.id;
          const percentage = Math.round((stage.count / totalLeads) * 100);
          const label = SALES_STAGE_LABELS[stage.status] || stage.status;

          return (
            <div key={stage.id} className="flex items-center shrink-0 min-w-[140px] flex-1">
              <div
                onClick={() => toggleStage(stage.id)}
                className={`flex-1 relative flex flex-col gap-[6px] p-[12px] md:p-[16px] border-t-4 bg-background/50 cursor-pointer transition-all duration-200
                  ${stage.color}
                  ${isActive ? "bg-black/5 dark:bg-white/5 shadow-inner scale-[1.02] z-10 rounded-[8px]" : ""}
                  ${isDimmed ? "opacity-40 hover:opacity-80" : "hover:bg-black/5 dark:hover:bg-white/5"}
                  ${!isActive && !isDimmed ? "rounded-[4px]" : ""}
                `}
              >
                <div className="flex items-center justify-between">
                  <span className="font-black text-[14px] text-text">{label}</span>
                  <span className={`text-[12px] font-bold px-[6px] py-[2px] rounded-[4px] ${stage.text} bg-background border border-border`}>
                    {stage.count}
                  </span>
                </div>

                <div className="flex flex-col gap-[2px]">
                  <span className="text-[11px] font-medium text-muted">Tỷ lệ</span>
                  <span className={`font-bold text-[14px] text-text leading-none`}>{percentage}%</span>
                </div>

                <div className="w-full h-[4px] bg-border rounded-full mt-[4px] overflow-hidden">
                  <div className={`h-full ${stage.bg}`} style={{ width: `${percentage}%` }} />
                </div>
              </div>

              {index < totals.length - 1 && (
                <div className={`shrink-0 mx-[4px] md:mx-[8px] text-border ${isDimmed ? "opacity-40" : ""}`}>
                  <ChevronRight size={20} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
