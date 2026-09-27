"use client";

import { CalendarClock, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import type { TaskPriority, TaskRecord } from "@/lib/api/tasks.api";

export type TicketData = TaskRecord;

function priorityLabel(priority: TaskPriority) {
  return {
    LOW: "Thấp",
    MEDIUM: "Trung bình",
    HIGH: "Cao",
    URGENT: "Khẩn",
  }[priority];
}

function priorityVariant(priority: TaskPriority): "success" | "warning" | "error" | "neutral" {
  if (priority === "URGENT") return "error";
  if (priority === "HIGH") return "warning";
  if (priority === "MEDIUM") return "neutral";
  return "success";
}

function formatDate(value: string | null) {
  if (!value) return "Chưa đặt hạn";
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium" }).format(new Date(value));
}

export default function OperationsTicketCard({
  ticket,
  onClick,
}: {
  ticket: TicketData;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full bg-card border border-border rounded-[8px] p-[14px] text-left shadow-sm hover:shadow-md hover:-translate-y-[1px] transition-all duration-200 flex flex-col gap-[10px]"
    >
      <div className="flex items-start justify-between gap-[8px]">
        <h4 className="font-bold text-[14px] text-text leading-snug line-clamp-2">{ticket.title}</h4>
        <Badge variant={priorityVariant(ticket.priority)} className="shrink-0">
          {priorityLabel(ticket.priority)}
        </Badge>
      </div>

      {ticket.description ? (
        <p className="text-[12px] leading-relaxed text-muted line-clamp-2">{ticket.description}</p>
      ) : null}

      <div className="flex flex-col gap-[6px] border-t border-border/50 pt-[10px] text-[11px] text-muted">
        <span className="flex items-center gap-[5px]">
          <CalendarClock size={12} /> Hạn xử lý: {formatDate(ticket.dueDate)}
        </span>
        <span className="flex items-center gap-[5px]">
          <UserRound size={12} /> {ticket.assigneeId ? "Đã giao người phụ trách" : "Chưa giao người phụ trách"}
        </span>
      </div>
    </button>
  );
}
