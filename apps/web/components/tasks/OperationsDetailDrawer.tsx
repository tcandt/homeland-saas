"use client";

import React, { useEffect } from "react";
import { CheckCircle2, MessageSquare, UserPlus, Clock, Paperclip, Building2, User, Wrench, FileText } from "lucide-react";
import { TicketData } from "./OperationsTicketCard";
import { Drawer } from "@/components/ui/Drawer";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Checkbox } from "@/components/ui/Checkbox";

export default function OperationsDetailDrawer({
  ticket,
  onClose,
}: {
  ticket: TicketData | null;
  onClose: () => void;
}) {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  if (!ticket) return null;

  const drawerTitle = (
    <div className="flex items-center gap-[12px]">
      <span className="font-black text-[20px] text-text">Chi tiết ticket</span>
      <span className="bg-black/5 dark:bg-white/5 text-muted font-bold text-[12px] px-[8px] py-[4px] rounded-[6px]">
        #{ticket.id}
      </span>
    </div>
  );

  const drawerFooter = (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-[12px]">
        <Button variant="ghost" className="gap-2 bg-black/5 dark:bg-white/5 text-text">
          <MessageSquare size={16} className="text-primary" /> Nhắn khách
        </Button>
        <Button variant="ghost" className="gap-2 bg-black/5 dark:bg-white/5 text-text">
          <UserPlus size={16} className="text-warning" /> Giao việc
        </Button>
      </div>
      <div className="flex items-center gap-[12px]">
        <Button variant="ghost" onClick={onClose} className="text-muted hover:text-text">
          Đóng ticket
        </Button>
        <Button className="bg-success text-white hover:bg-success/90 gap-2">
          <CheckCircle2 size={16} /> Hoàn thành
        </Button>
      </div>
    </div>
  );

  return (
    <Drawer
      isOpen={!!ticket}
      onClose={onClose}
      title={drawerTitle}
      footer={drawerFooter}
      size="xl"
      className="p-6 flex flex-col gap-6"
    >
      <div className="bg-card border border-border rounded-2xl p-5 shadow-sm flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Badge variant="primary" className="uppercase text-[10px]">{ticket.type}</Badge>
              <Badge
                variant={ticket.priority === "Cao" ? "error" : "warning"}
                className="uppercase text-[10px]"
              >
                Ưu tiên: {ticket.priority}
              </Badge>
            </div>
            <h3 className="font-black text-[22px] text-text leading-tight">{ticket.title}</h3>
          </div>
          <div className="text-right flex flex-col items-end gap-1">
            <span className="text-[12px] font-bold text-muted uppercase tracking-wider">Trạng thái</span>
            <span className="text-[14px] font-black text-warning">{ticket.status}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-[16px] pt-[16px] border-t border-border/50">
          <div className="flex flex-col gap-[4px]">
            <span className="text-[11px] font-bold text-muted uppercase">Phòng / Tòa nhà</span>
            <span className="text-[14px] font-bold text-text flex items-center gap-1">
              <Building2 size={14} className="text-muted" /> {ticket.room} · {ticket.building}
            </span>
          </div>
          <div className="flex flex-col gap-[4px]">
            <span className="text-[11px] font-bold text-muted uppercase">Khách liên quan</span>
            <span className="text-[14px] font-bold text-text flex items-center gap-1">
              <User size={14} className="text-muted" /> {ticket.tenantName}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-bold text-muted uppercase">Người phụ trách</span>
            <span className="text-[14px] font-bold text-text flex items-center gap-1">
              <Wrench size={14} className="text-primary" /> {ticket.assignee}
            </span>
          </div>
          <div className="flex flex-col gap-[4px]">
            <span className="text-[11px] font-bold text-muted uppercase">SLA</span>
            <span className="text-[14px] font-bold text-rose-500 flex items-center gap-1">
              <Clock size={14} /> {ticket.slaStatus}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-[24px]">
        <div className="flex-1 flex flex-col gap-[16px]">
          <div className="bg-card border border-border rounded-[16px] p-[20px] shadow-sm flex flex-col gap-[12px]">
            <h4 className="font-black text-[15px] text-text flex items-center gap-2">
              <FileText size={16} className="text-muted" /> Ghi chú ticket
            </h4>
            <p className="text-[14px] text-text/80 leading-relaxed">
              Nội dung chi tiết sẽ lấy từ dữ liệu ticket thực tế của hệ thống.
            </p>
            <div className="flex items-center gap-[8px] mt-[8px]">
              <div className="w-[80px] h-[80px] rounded-[8px] bg-black/5 dark:bg-white/5 border border-border flex flex-col items-center justify-center text-muted">
                <Paperclip size={20} />
                <span className="text-[10px] font-bold mt-1">Tệp đính kèm</span>
              </div>
              <div className="w-[80px] h-[80px] rounded-[8px] bg-black/5 dark:bg-white/5 border border-border flex flex-col items-center justify-center text-muted">
                <Paperclip size={20} />
                <span className="text-[10px] font-bold mt-1">Ảnh</span>
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-[16px] p-[20px] shadow-sm flex flex-col gap-[12px]">
            <h4 className="font-black text-[15px] text-text flex items-center gap-2">
              <CheckCircle2 size={16} className="text-muted" /> Checklist xử lý
            </h4>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer">
                <Checkbox defaultChecked />
                <span className="text-[14px] font-medium text-text line-through opacity-70">Đã tiếp nhận yêu cầu</span>
              </label>
              <label className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer">
                <Checkbox />
                <span className="text-[14px] font-medium text-text">Kiểm tra nguyên nhân gốc</span>
              </label>
              <label className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer">
                <Checkbox />
                <span className="text-[14px] font-medium text-text">Cập nhật kết quả cho khách</span>
              </label>
            </div>
          </div>
        </div>

        <div className="w-full lg:w-[320px] flex flex-col gap-[16px]">
          <div className="bg-card border border-border rounded-[16px] p-[20px] shadow-sm flex flex-col gap-[16px] flex-1">
            <h4 className="font-black text-[15px] text-text flex items-center gap-2">
              <MessageSquare size={16} className="text-muted" /> Trao đổi nội bộ
            </h4>
            <div className="flex flex-col gap-[12px]">
              <div className="rounded-[12px] bg-black/5 dark:bg-white/5 p-3">
                <p className="text-[13px] text-text">
                  Tin nhắn trao đổi nội bộ sẽ hiển thị ở đây khi ticket có hội thoại thực.
                </p>
              </div>
            </div>
            <div className="relative mt-auto pt-4">
              <Input placeholder="Nhập tin nhắn..." className="rounded-full" />
            </div>
          </div>
        </div>
      </div>
    </Drawer>
  );
}
