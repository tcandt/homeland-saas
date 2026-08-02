"use client";

import React, { useState } from "react";
import { AlertCircle, Clock, CheckCircle2 } from "lucide-react";
import OperationsTicketCard, { TicketData, TicketStatus } from "./OperationsTicketCard";
import OperationsDetailDrawer from "./OperationsDetailDrawer";

const tickets: TicketData[] = [];

const columns: { title: TicketStatus, color: string, urgent: number, overdue: number }[] = [
  { title: "Cần làm", color: "text-[#6366f1] bg-[#6366f1]/10 border-[#6366f1]", urgent: 0, overdue: 0 },
  { title: "Đang xử lý", color: "text-[#f97316] bg-[#f97316]/10 border-[#f97316]", urgent: 0, overdue: 0 },
  { title: "Chờ duyệt", color: "text-[#a855f7] bg-[#a855f7]/10 border-[#a855f7]", urgent: 0, overdue: 0 },
  { title: "Hoàn thành", color: "text-[#8b5cf6] bg-[#8b5cf6]/10 border-[#8b5cf6]", urgent: 0, overdue: 0 },
];

export default function OperationsBoard() {
  const [selectedTicket, setSelectedTicket] = useState<TicketData | null>(null);

  return (
    <>
      <div className="flex-1 min-h-0 flex gap-[16px] overflow-x-auto no-scrollbar pb-[20px]">
        {columns.map((col) => {
          const colTickets = tickets.filter(t => t.status === col.title);
          return (
            <div key={col.title} className="flex-shrink-0 w-[320px] xl:w-[calc(25%-12px)] flex flex-col gap-[12px]">
              
              {/* Column Header */}
              <div className="flex flex-col gap-[8px] sticky top-0 bg-background/95 backdrop-blur-sm z-10 pb-[4px]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-[8px]">
                    <div className={`w-[12px] h-[12px] rounded-full border-[3px] ${col.color}`} />
                    <h3 className="font-black text-[15px] text-text">{col.title}</h3>
                  </div>
                  <span className="bg-black/5 dark:bg-white/5 px-[8px] py-[2px] rounded-[6px] text-[12px] font-bold text-muted">{colTickets.length}</span>
                </div>
                
                {/* Column Stats */}
                {(col.urgent > 0 || col.overdue > 0) && (
                  <div className="flex items-center gap-[8px] mt-[4px]">
                    {col.overdue > 0 && <span className="flex items-center gap-[4px] text-[10px] font-bold text-rose-500 bg-rose-500/10 px-[6px] py-[2px] rounded-[4px]"><Clock size={10}/> {col.overdue} Quá hạn</span>}
                    {col.urgent > 0 && <span className="flex items-center gap-[4px] text-[10px] font-bold text-amber-500 bg-amber-500/10 px-[6px] py-[2px] rounded-[4px]"><AlertCircle size={10}/> {col.urgent} Khẩn</span>}
                  </div>
                )}
              </div>

              {/* Column Body */}
              <div className="flex flex-col gap-[12px] pb-[40px]">
                {colTickets.map(ticket => (
                  <OperationsTicketCard 
                    key={ticket.id} 
                    ticket={ticket} 
                    onClick={() => setSelectedTicket(ticket)} 
                  />
                ))}
                
                {colTickets.length === 0 && (
                  <div className="flex flex-col items-center justify-center p-[24px] border-2 border-dashed border-border rounded-[16px] bg-black/5 dark:bg-white/5 opacity-70">
                    <CheckCircle2 size={24} className="text-muted mb-[8px]" />
                    <span className="text-[12px] font-bold text-muted">Không có việc nào</span>
                  </div>
                )}
              </div>

            </div>
          );
        })}
      </div>

      <OperationsDetailDrawer 
        ticket={selectedTicket} 
        onClose={() => setSelectedTicket(null)} 
      />
    </>
  );
}
