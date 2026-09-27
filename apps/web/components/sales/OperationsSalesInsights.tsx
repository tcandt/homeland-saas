"use client";

import React from "react";
import { AlertTriangle, Calendar, CheckCircle2, Clock, Loader2, Sparkles, TrendingUp } from "lucide-react";
import { useSalesSummaryQuery } from "@/lib/queries/sales.queries";
import { getOperationsSalesInsights } from "@/lib/sales/operations-sales-insights";

export default function OperationsSalesInsights() {
  const summaryQuery = useSalesSummaryQuery();
  const state = getOperationsSalesInsights(summaryQuery.data, {
    isLoading: summaryQuery.isLoading,
    isError: summaryQuery.isError,
  });

  return (
    <div className="bg-card border border-border rounded-[16px] md:rounded-[20px] p-[16px] md:p-[20px] shadow-sm relative overflow-hidden flex flex-col md:flex-row gap-[16px] md:items-center">
      <div className="flex items-center gap-[12px] md:w-[220px] shrink-0">
        <div className="w-[36px] h-[36px] rounded-[10px] bg-indigo-500/10 flex items-center justify-center shrink-0 text-indigo-500">
          <Sparkles size={18} />
        </div>
        <div>
          <div className="text-[12px] font-bold text-muted uppercase tracking-widest">Tổng quan</div>
          <div className="font-black text-[15px] text-text">Sales Insights</div>
        </div>
      </div>

      <InsightsContent state={state} />
    </div>
  );
}

function InsightsContent({ state }: { state: ReturnType<typeof getOperationsSalesInsights> }) {
  if (state.kind === "loading") {
    return <InsightMessage icon={<Loader2 size={14} className="animate-spin" />} text="Đang tải chỉ số Sales" color="text-primary" />;
  }
  if (state.kind === "error") {
    return <InsightMessage icon={<AlertTriangle size={14} />} text="Không thể tải chỉ số Sales" color="text-danger" />;
  }
  if (state.kind === "unavailable") {
    return <InsightMessage icon={<Calendar size={14} />} text="Chưa có lead để tổng hợp" color="text-muted" />;
  }

  const { stale, active, proposal, won, total } = state.metrics;
  return (
    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-[8px] md:gap-[12px] mt-2 md:mt-0 w-full">
      <InsightCard icon={<Clock size={14} />} text={`${stale} lead chưa cập nhật 7 ngày`} color="text-rose-500 bg-rose-500/10" />
      <InsightCard icon={<TrendingUp size={14} />} text={`${active} lead đang trong pipeline`} color="text-blue-500 bg-blue-500/10" />
      <InsightCard icon={<Calendar size={14} />} text={`${proposal} lead ở bước đề xuất`} color="text-indigo-500 bg-indigo-500/10" />
      <InsightCard icon={<CheckCircle2 size={14} />} text={`${won}/${total} lead đã chốt`} color="text-success bg-success/10" />
    </div>
  );
}

function InsightMessage({ icon, text, color }: { icon: React.ReactNode; text: string; color: string }) {
  return <div className={`flex flex-1 items-center gap-2 text-[13px] font-medium ${color}`}>{icon}<span>{text}</span></div>;
}

function InsightCard({ icon, text, color }: { icon: React.ReactNode; text: string; color: string }) {
  return (
    <div className="flex items-center gap-[8px] py-[4px] w-full">
      <div className={`w-[20px] h-[20px] rounded-[6px] flex items-center justify-center shrink-0 ${color}`}>
        {icon}
      </div>
      <span className="font-medium text-[13px] text-text truncate flex-1">{text}</span>
    </div>
  );
}
