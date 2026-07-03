"use client";

import React from "react";
import { Clock, MessageSquare, Paperclip, ChevronRight, Share, CheckCircle2, Phone, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

export type TicketStatus = "Cần làm" | "Đang xử lý" | "Chờ duyệt" | "Hoàn thành";
export type TicketPriority = "Cao" | "TB" | "Thấp";
export type TicketType = "Bảo trì" | "CSKH" | "Tài chính" | "Hợp đồng" | "Dọn phòng";

export interface TicketData {
  id: string;
  title: string;
  type: TicketType;
  room: string;
  building: string;
  tenantName: string;
  priority: TicketPriority;
  slaStatus: string;
  assignee: string;
  comments: number;
  attachments: number;
  createdAt: string;
  status: TicketStatus;
}

export default function OperationsTicketCard({ ticket, onClick }: { ticket: TicketData, onClick: () => void }) {
  
  const getPriorityVariant = (p: TicketPriority): "error" | "warning" | "success" | "neutral" | "primary" => {
    if (p === 'Cao') return "error";
    if (p === 'TB') return "warning";
    return "success";
  };

  const getTypeVariant = (t: TicketType): "error" | "warning" | "success" | "neutral" | "primary" => {
    if (t === 'Bảo trì') return "primary";
    if (t === 'CSKH') return "warning";
    if (t === 'Dọn phòng') return "neutral"; // fallback
    return "neutral";
  };

  const isOverdue = ticket.slaStatus.includes("Quá hạn");

  return (
    <div 
      className="bg-card border border-border rounded-[14px] p-[14px] shadow-sm hover:shadow-md hover:-translate-y-[2px] transition-all duration-200 cursor-pointer flex flex-col gap-[10px] relative group overflow-hidden"
    >
      {/* Header: Title & Type */}
      <div className="flex items-start justify-between gap-[8px]">
        <h4 className="font-bold text-[14px] text-text leading-snug line-clamp-2">{ticket.title}</h4>
        <Badge variant={getTypeVariant(ticket.type)} className="shrink-0 uppercase text-[10px]">
          {ticket.type}
        </Badge>
      </div>

      {/* Info Rows */}
      <div className="flex flex-col gap-[6px]">
        {/* Room & Tenant */}
        <div className="flex items-center justify-between text-[12px]">
          <span className="font-bold text-text bg-black/5 dark:bg-white/5 px-[6px] py-[2px] rounded-[4px]">{ticket.room} · {ticket.building}</span>
          <span className="font-medium text-muted truncate max-w-[100px]">{ticket.tenantName}</span>
        </div>
        
        {/* Priority & Assignee */}
        <div className="flex items-center justify-between mt-[4px]">
          <div className="flex items-center gap-[6px]">
            <Badge variant={getPriorityVariant(ticket.priority)}>Ưu tiên: {ticket.priority}</Badge>
            <Badge variant={isOverdue ? 'error' : 'success'} className="flex items-center gap-[4px]">
              <Clock size={10} /> {ticket.slaStatus}
            </Badge>
          </div>
          <div className="flex items-center gap-[6px]">
            <div className="w-[18px] h-[18px] rounded-full bg-[#6366f1] text-white flex items-center justify-center text-[9px] font-bold">
              {ticket.assignee.charAt(0)}
            </div>
            <span className="text-[11px] font-bold text-text truncate max-w-[60px]">{ticket.assignee}</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="pt-[10px] border-t border-border/50 flex items-center justify-between text-muted mt-[4px]">
        <div className="flex items-center gap-[12px] text-[11px] font-medium">
          <span className="flex items-center gap-[4px]"><MessageSquare size={12} /> {ticket.comments}</span>
          {ticket.attachments > 0 && <span className="flex items-center gap-[4px]"><Paperclip size={12} /> {ticket.attachments}</span>}
        </div>
        <span className="text-[10px]">{ticket.createdAt}</span>
      </div>

      <div className="absolute inset-0 bg-card/80 backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center z-10">
        <div className="flex flex-wrap items-center justify-center gap-[8px] p-[12px] w-full scale-95 group-hover:scale-100 transition-transform duration-300">
          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onClick(); }} className="text-[#6366f1] hover:text-[#6366f1] hover:bg-[#6366f1]/10">
            <ChevronRight size={16} />
          </Button>
          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); }} className="text-blue-500 hover:text-blue-500 hover:bg-blue-500/10">
            <Share size={14} />
          </Button>
          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); }} className="text-amber-500 hover:text-amber-500 hover:bg-amber-500/10">
            <MessageSquare size={14} />
          </Button>
          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); }} className="text-[#10b981] hover:text-[#10b981] hover:bg-[#10b981]/10">
            <Phone size={14} />
          </Button>
          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); }} className="text-[#a855f7] hover:text-[#a855f7] hover:bg-[#a855f7]/10">
            <CheckCircle2 size={14} />
          </Button>
        </div>
      </div>
    </div>
  );
}
