"use client";

import React, { useState } from "react";
import { AlertCircle, CheckCircle2, Clock } from "lucide-react";
import type { TaskStatus } from "@/lib/api/tasks.api";
import OperationsDetailDrawer from "./OperationsDetailDrawer";
import OperationsTicketCard, { TicketData } from "./OperationsTicketCard";

const columns: { status: TaskStatus; title: string; color: string }[] = [
  { status: "TODO", title: "Cần làm", color: "text-primary bg-primary/10 border-primary" },
  { status: "IN_PROGRESS", title: "Đang xử lý", color: "text-[#f97316] bg-[#f97316]/10 border-[#f97316]" },
  { status: "REVIEW", title: "Chờ duyệt", color: "text-[#a855f7] bg-[#a855f7]/10 border-[#a855f7]" },
  { status: "DONE", title: "Hoàn thành", color: "text-success bg-success/10 border-success" },
  { status: "CANCELLED", title: "Đã hủy", color: "text-muted bg-muted/10 border-muted" },
];

function isOverdue(ticket: TicketData) {
  return Boolean(ticket.dueDate && new Date(ticket.dueDate).getTime() < Date.now() && !["DONE", "CANCELLED"].includes(ticket.status));
}

export default function OperationsBoard({
  tickets,
  isLoading,
  isUpdating,
  onStatusChange,
}: {
  tickets: TicketData[];
  isLoading?: boolean;
  isUpdating?: boolean;
  onStatusChange: (ticket: TicketData, status: TaskStatus) => Promise<void>;
}) {
  const [selectedTicket, setSelectedTicket] = useState<TicketData | null>(null);

  return (
    <>
      <div className="flex-1 min-h-0 flex gap-[16px] overflow-x-auto no-scrollbar pb-[20px]">
        {columns.map((column) => {
          const columnTickets = tickets.filter((ticket) => ticket.status === column.status);
          const overdue = columnTickets.filter(isOverdue).length;
          const urgent = columnTickets.filter((ticket) => ticket.priority === "URGENT").length;
          return (
            <div key={column.status} className="flex-shrink-0 w-[320px] xl:w-[calc(25%-12px)] flex flex-col gap-[12px]">
              <div className="flex flex-col gap-[8px] sticky top-0 bg-background/95 backdrop-blur-sm z-10 pb-[4px]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-[8px]">
                    <div className={`w-[12px] h-[12px] rounded-full border-[3px] ${column.color}`} />
                    <h3 className="font-black text-[15px] text-text">{column.title}</h3>
                  </div>
                  <span className="bg-black/5 dark:bg-white/5 px-[8px] py-[2px] rounded-[6px] text-[12px] font-bold text-muted">{columnTickets.length}</span>
                </div>
                {overdue > 0 || urgent > 0 ? (
                  <div className="flex items-center gap-[8px] mt-[4px]">
                    {overdue > 0 ? <span className="flex items-center gap-[4px] text-[10px] font-bold text-rose-500 bg-rose-500/10 px-[6px] py-[2px] rounded-[4px]"><Clock size={10} /> {overdue} quá hạn</span> : null}
                    {urgent > 0 ? <span className="flex items-center gap-[4px] text-[10px] font-bold text-amber-500 bg-amber-500/10 px-[6px] py-[2px] rounded-[4px]"><AlertCircle size={10} /> {urgent} khẩn</span> : null}
                  </div>
                ) : null}
              </div>

              <div className="flex flex-col gap-[12px] pb-[40px]">
                {columnTickets.map((ticket) => <OperationsTicketCard key={ticket.id} ticket={ticket} onClick={() => setSelectedTicket(ticket)} />)}
                {isLoading ? <div className="text-[12px] font-bold text-muted p-[20px]">Đang tải công việc...</div> : null}
                {!isLoading && columnTickets.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-[24px] border-2 border-dashed border-border rounded-[8px] bg-black/5 dark:bg-white/5 opacity-70">
                    <CheckCircle2 size={24} className="text-muted mb-[8px]" />
                    <span className="text-[12px] font-bold text-muted">Không có công việc</span>
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      <OperationsDetailDrawer ticket={selectedTicket} onClose={() => setSelectedTicket(null)} onStatusChange={onStatusChange} isUpdating={isUpdating} />
    </>
  );
}
