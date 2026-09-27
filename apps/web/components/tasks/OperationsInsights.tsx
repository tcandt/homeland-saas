import React from "react";
import { AlertTriangle, CheckSquare2, CircleOff, Clock, ListChecks, Loader2 } from "lucide-react";
import type { TaskRecord } from "@/lib/api/tasks.api";
import { getOperationsInsights } from "@/lib/tasks/operations-insights";

export default function OperationsInsights({
  tasks,
  isLoading,
  isError,
}: {
  tasks?: TaskRecord[];
  isLoading?: boolean;
  isError?: boolean;
}) {
  const state = getOperationsInsights(tasks, { isLoading, isError });

  return (
    <div className="bg-card border border-border rounded-[16px] md:rounded-[20px] p-[16px] md:p-[20px] shadow-sm relative overflow-hidden flex flex-col md:flex-row md:items-center gap-[16px] md:gap-[24px]">
      <div className="flex items-center gap-[10px] md:w-[220px] shrink-0">
        <div className="w-[36px] h-[36px] md:w-[44px] md:h-[44px] rounded-[10px] md:rounded-[12px] bg-[#8b5cf6]/10 flex items-center justify-center shrink-0">
          <ListChecks size={20} className="text-[#8b5cf6]" />
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] md:text-[11px] font-bold text-muted uppercase tracking-wider">Tổng quan</span>
          <span className="font-black text-[15px] md:text-[16px] text-text leading-tight">Công việc vận hành</span>
        </div>
      </div>

      <div className="hidden md:block w-[1px] h-[40px] bg-border/50 shrink-0" />

      <InsightsContent state={state} />
    </div>
  );
}

function InsightsContent({ state }: { state: ReturnType<typeof getOperationsInsights> }) {
  if (state.kind === "loading") {
    return <InsightMessage icon={<Loader2 size={16} className="animate-spin" />} text="Đang tải chỉ số công việc" color="text-primary" />;
  }

  if (state.kind === "error") {
    return <InsightMessage icon={<AlertTriangle size={16} />} text="Không thể tải dữ liệu công việc" color="text-danger" />;
  }

  if (state.kind === "unavailable") {
    return <InsightMessage icon={<CircleOff size={16} />} text="Chưa có dữ liệu công việc để tổng hợp" color="text-muted" />;
  }

  const insights = [
    { icon: <ListChecks size={14} />, text: `${state.metrics.open} công việc đang mở`, color: "text-primary" },
    { icon: <Clock size={14} />, text: `${state.metrics.overdue} công việc quá hạn`, color: "text-rose-500" },
    { icon: <AlertTriangle size={14} />, text: `${state.metrics.urgent} công việc khẩn đang mở`, color: "text-[#f97316]" },
    { icon: <CheckSquare2 size={14} />, text: `${state.metrics.review} công việc chờ duyệt`, color: "text-[#8b5cf6]" },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-x-[20px] gap-y-[10px] md:gap-y-[12px] w-full">
      {insights.map((insight) => <InsightMetric key={insight.text} {...insight} />)}
    </div>
  );
}

function InsightMessage({ icon, text, color }: { icon: React.ReactNode; text: string; color: string }) {
  return (
    <div className="flex items-center gap-[8px] py-[4px] w-full text-[13px] font-medium text-muted">
      <div className={`flex items-center justify-center shrink-0 ${color}`}>
        {icon}
      </div>
      <span>{text}</span>
    </div>
  );
}

function InsightMetric({ icon, text, color }: { icon: React.ReactNode; text: string; color: string }) {
  return (
    <div className="flex items-center gap-[8px] py-[4px] w-full">
      <div className={`flex items-center justify-center shrink-0 ${color}`}>{icon}</div>
      <span className="font-medium text-[13px] text-text truncate flex-1">{text}</span>
    </div>
  );
}
