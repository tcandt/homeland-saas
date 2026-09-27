import React from "react";
import { CheckCircle2, CircleOff, ClipboardList, Clock, Loader2, ShieldCheck } from "lucide-react";
import type { TaskSummary } from "@/lib/api/tasks.api";

export default function OperationsKpi({
  summary,
  isLoading,
}: {
  summary?: TaskSummary;
  isLoading?: boolean;
}) {
  const openTasks = summary ? summary.todo + summary.inProgress + summary.review : undefined;
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-[12px] md:gap-[16px]">
      <KpiCard icon={<ClipboardList size={16} className="text-primary" />} iconBg="bg-primary/10" value={openTasks} loading={isLoading} label="Đang mở" />
      <KpiCard icon={<Clock size={16} className="text-rose-500" />} iconBg="bg-rose-500/10" value={summary?.overdue} loading={isLoading} label="Quá hạn" />
      <KpiCard icon={<Loader2 size={16} className="text-[#f97316]" />} iconBg="bg-[#f97316]/10" value={summary?.inProgress} loading={isLoading} label="Đang xử lý" />
      <KpiCard icon={<CheckCircle2 size={16} className="text-[#a855f7]" />} iconBg="bg-[#a855f7]/10" value={summary?.review} loading={isLoading} label="Chờ duyệt" />
      <KpiCard icon={<ShieldCheck size={16} className="text-success" />} iconBg="bg-success/10" value={summary?.done} loading={isLoading} label="Hoàn thành" />
      <KpiCard icon={<CircleOff size={16} className="text-muted" />} iconBg="bg-muted/10" value={summary?.cancelled} loading={isLoading} label="Đã hủy" />
    </div>
  );
}

function KpiCard({
  icon,
  iconBg,
  value,
  loading,
  label,
}: {
  icon: React.ReactNode;
  iconBg: string;
  value?: number;
  loading?: boolean;
  label: string;
}) {
  return (
    <div className="bg-card border border-border rounded-[8px] p-[16px] flex flex-col justify-between shadow-sm min-h-[80px] md:min-h-[90px]">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-bold text-muted uppercase tracking-wider">{label}</span>
        <div className={`w-[28px] h-[28px] rounded-[8px] flex items-center justify-center ${iconBg}`}>{icon}</div>
      </div>
      <span className="font-black text-[22px] md:text-[26px] text-text leading-none mt-[4px]">
        {loading || value === undefined ? "-" : value}
      </span>
    </div>
  );
}
