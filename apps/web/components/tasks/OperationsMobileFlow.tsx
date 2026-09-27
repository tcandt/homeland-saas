"use client";

import React, { useState } from "react";
import { CheckCircle2, ClipboardList, Clock } from "lucide-react";
import type { TaskStatus, TaskSummary } from "@/lib/api/tasks.api";
import OperationsDetailDrawer from "./OperationsDetailDrawer";
import OperationsTicketCard, { TicketData } from "./OperationsTicketCard";

export default function OperationsMobileFlow({
  tickets,
  summary,
  isLoading,
  isUpdating,
  onStatusChange,
}: {
  tickets: TicketData[];
  summary?: TaskSummary;
  isLoading?: boolean;
  isUpdating?: boolean;
  onStatusChange: (ticket: TicketData, status: TaskStatus) => Promise<void>;
}) {
  const [selectedTicket, setSelectedTicket] = useState<TicketData | null>(null);
  const openTasks = summary ? summary.todo + summary.inProgress + summary.review : undefined;

  return (
    <div className="flex flex-col gap-[20px] w-full box-border pb-[100px] bg-background">
      <div className="grid grid-cols-3 gap-3 px-1">
        <MobileKpi icon={<ClipboardList size={15} />} label="Đang mở" value={openTasks} loading={isLoading} />
        <MobileKpi icon={<Clock size={15} />} label="Quá hạn" value={summary?.overdue} loading={isLoading} />
        <MobileKpi icon={<CheckCircle2 size={15} />} label="Hoàn thành" value={summary?.done} loading={isLoading} />
      </div>

      <section className="flex flex-col gap-3 px-1">
        <div className="flex justify-between items-center">
          <h3 className="text-[15px] font-black text-text">Công việc</h3>
          <span className="text-[12px] font-bold text-muted">{tickets.length} mục</span>
        </div>
        {isLoading ? <p className="text-[13px] font-medium text-muted">Đang tải công việc...</p> : null}
        {!isLoading && tickets.length === 0 ? <p className="text-[13px] font-medium text-muted">Chưa có công việc nào.</p> : null}
        {tickets.map((ticket) => <OperationsTicketCard key={ticket.id} ticket={ticket} onClick={() => setSelectedTicket(ticket)} />)}
      </section>

      <OperationsDetailDrawer ticket={selectedTicket} onClose={() => setSelectedTicket(null)} onStatusChange={onStatusChange} isUpdating={isUpdating} />
    </div>
  );
}

function MobileKpi({ icon, label, value, loading }: { icon: React.ReactNode; label: string; value?: number; loading?: boolean }) {
  return (
    <div className="h-[84px] bg-card border border-border rounded-[8px] p-3 flex flex-col justify-between shadow-sm">
      <span className="text-muted">{icon}</span>
      <div>
        <span className="text-[20px] font-black text-text leading-none">{loading || value === undefined ? "-" : value}</span>
        <span className="block text-[10px] font-semibold text-muted mt-1">{label}</span>
      </div>
    </div>
  );
}
