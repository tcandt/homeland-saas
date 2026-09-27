"use client";

import React, { useEffect } from "react";
import { CalendarClock, CheckCircle2, ClipboardList, RefreshCcw, UserRound } from "lucide-react";
import { Drawer } from "@/components/ui/Drawer";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { TaskStatus } from "@/lib/api/tasks.api";
import { TicketData } from "./OperationsTicketCard";

const statusLabel: Record<TaskStatus, string> = {
  TODO: "Cần làm",
  IN_PROGRESS: "Đang xử lý",
  REVIEW: "Chờ duyệt",
  DONE: "Hoàn thành",
  CANCELLED: "Đã hủy",
};

const priorityLabel = {
  LOW: "Thấp",
  MEDIUM: "Trung bình",
  HIGH: "Cao",
  URGENT: "Khẩn",
} as const;

const transitions: Record<TaskStatus, TaskStatus[]> = {
  TODO: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["TODO", "REVIEW", "CANCELLED"],
  REVIEW: ["IN_PROGRESS", "DONE", "CANCELLED"],
  DONE: ["REVIEW"],
  CANCELLED: ["TODO"],
};

function formatDate(value: string | null) {
  if (!value) return "Chưa đặt";
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default function OperationsDetailDrawer({
  ticket,
  onClose,
  onStatusChange,
  isUpdating,
}: {
  ticket: TicketData | null;
  onClose: () => void;
  onStatusChange: (ticket: TicketData, status: TaskStatus) => Promise<void>;
  isUpdating?: boolean;
}) {
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  if (!ticket) return null;

  const changeStatus = async (status: TaskStatus) => {
    try {
      await onStatusChange(ticket, status);
      onClose();
    } catch {
      // The page displays the failed update state and keeps this task open.
    }
  };

  return (
    <Drawer
      isOpen={Boolean(ticket)}
      onClose={onClose}
      title={<span className="font-black text-[20px] text-text">Chi tiết công việc</span>}
      size="lg"
      className="p-6 flex flex-col gap-6"
      footer={
        <div className="flex justify-end">
          <Button variant="ghost" onClick={onClose} className="text-muted hover:text-text">Đóng</Button>
        </div>
      }
    >
      <div className="bg-card border border-border rounded-[8px] p-5 shadow-sm flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-2 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="primary">{statusLabel[ticket.status]}</Badge>
              <Badge variant={ticket.priority === "URGENT" ? "error" : ticket.priority === "HIGH" ? "warning" : "neutral"}>
                Ưu tiên: {priorityLabel[ticket.priority]}
              </Badge>
            </div>
            <h3 className="font-black text-[22px] text-text leading-tight">{ticket.title}</h3>
          </div>
          <span className="text-[12px] font-bold text-muted shrink-0">#{ticket.id.slice(-8)}</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-[16px] pt-[16px] border-t border-border/50">
          <DetailField icon={<CalendarClock size={14} />} label="Hạn xử lý" value={formatDate(ticket.dueDate)} />
          <DetailField icon={<UserRound size={14} />} label="Người phụ trách" value={ticket.assigneeId ? "Đã được giao" : "Chưa được giao"} />
          <DetailField icon={<RefreshCcw size={14} />} label="Cập nhật gần nhất" value={formatDate(ticket.updatedAt)} />
        </div>
      </div>

      <div className="bg-card border border-border rounded-[8px] p-5 shadow-sm flex flex-col gap-3">
        <h4 className="font-black text-[15px] text-text flex items-center gap-2"><ClipboardList size={16} className="text-muted" /> Mô tả</h4>
        <p className="text-[14px] text-text/80 leading-relaxed whitespace-pre-wrap">
          {ticket.description || "Công việc này chưa có mô tả."}
        </p>
      </div>

      <div className="bg-card border border-border rounded-[8px] p-5 shadow-sm flex flex-col gap-3">
        <h4 className="font-black text-[15px] text-text flex items-center gap-2"><CheckCircle2 size={16} className="text-muted" /> Chuyển trạng thái</h4>
        <div className="flex flex-wrap gap-2">
          {transitions[ticket.status].map((status) => (
            <Button key={status} variant={status === "CANCELLED" ? "danger" : "outline"} onClick={() => void changeStatus(status)} isLoading={isUpdating} disabled={isUpdating}>
              {statusLabel[status]}
            </Button>
          ))}
        </div>
      </div>
    </Drawer>
  );
}

function DetailField({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex flex-col gap-[4px]">
      <span className="text-[11px] font-bold text-muted uppercase">{label}</span>
      <span className="text-[13px] font-bold text-text flex items-center gap-1">{icon} {value}</span>
    </div>
  );
}
