"use client";

import React from "react";
import { PhoneCall, MessageCircle, MoreHorizontal, User, Clock } from "lucide-react";
import { useSalesLeadsQuery } from "@/lib/queries/sales.queries";
import { getSalesStageLabel } from "./sales.types";

const pipeline = [
  { id: "new", title: "Mới nhận", status: "NEW" },
  { id: "contacted", title: "Đang xử lý", status: "CONTACTED" },
  { id: "qualified", title: "Đủ điều kiện", status: "QUALIFIED" },
  { id: "proposal", title: "Đề xuất", status: "PROPOSAL" },
  { id: "won", title: "Thành công", status: "WON" },
];

export default function SalesPipeline() {
  const { data } = useSalesLeadsQuery({ limit: 100 });
  const leads = Array.isArray((data as any)?.data?.data) ? (data as any).data.data : [];

  return (
    <div className="flex-1 w-full flex flex-col md:overflow-hidden h-full min-h-[500px]">
      <div className="hidden md:flex flex-1 gap-6 overflow-x-auto pb-4 pt-2 hide-scrollbar">
        {pipeline.map((col) => {
          const columnLeads = leads.filter((lead: any) => lead.status === col.status);
          return (
            <div key={col.id} className="flex-shrink-0 w-[280px] flex flex-col h-full bg-muted/20 dark:bg-muted/10 rounded-2xl p-4 border border-border/50 shadow-inner">
              <div className="flex items-center justify-between mb-4 px-1">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#4f46e5] shadow-sm" />
                  <h3 className="text-[13px] font-black text-text uppercase tracking-wide">{col.title}</h3>
                </div>
                <span className="text-[12px] font-bold text-muted bg-card px-2.5 py-0.5 rounded-full border border-border shadow-sm">{columnLeads.length}</span>
              </div>

              <div className="flex flex-col gap-3 flex-1 overflow-y-auto hide-scrollbar">
                {columnLeads.map((lead: any) => (
                  <LeadCard key={lead.id} lead={lead} />
                ))}
                {columnLeads.length === 0 && (
                  <div className="bg-card border border-dashed border-border rounded-xl p-4 text-center text-[12px] font-medium text-muted">
                    Chưa có lead ở trạng thái này.
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex md:hidden flex-col gap-4">
        {pipeline.map((col) => {
          const columnLeads = leads.filter((lead: any) => lead.status === col.status);
          if (columnLeads.length === 0) return null;
          return (
            <div key={col.id}>
              <h3 className="text-[12px] font-black text-muted uppercase tracking-wider mb-3 px-1 flex items-center gap-1.5">
                <Clock size={14} /> {col.title}
              </h3>
              <div className="flex flex-col gap-3">
                {columnLeads.map((lead: any) => (
                  <LeadCard key={lead.id} lead={lead} mobile />
                ))}
              </div>
            </div>
          );
        })}

        {leads.length === 0 && (
          <div className="flex flex-col items-center justify-center p-8 text-center bg-black/5 dark:bg-white/5 rounded-2xl border border-dashed border-border">
            <span className="text-[13px] font-bold text-muted">Chưa có lead nào trong DB</span>
          </div>
        )}
      </div>
    </div>
  );
}

function LeadCard({ lead, mobile = false }: { lead: any; mobile?: boolean }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 shadow-sm hover:shadow-md hover:border-primary/50 hover:ring-1 hover:ring-primary/20 transition-all flex flex-col gap-3 group relative">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center shrink-0 border border-primary/10">
            <User size={14} className="text-primary" />
          </div>
          <div className="min-w-0">
            <h4 className="text-[13px] font-bold text-text group-hover:text-primary transition-colors truncate">{lead.name}</h4>
            <p className="text-[11px] font-medium text-muted">{lead.phone}</p>
          </div>
        </div>
        <button className="text-muted hover:text-text md:opacity-0 group-hover:opacity-100 transition-opacity" type="button">
          <MoreHorizontal size={16} />
        </button>
      </div>

      <div className="flex items-center gap-2">
        <span className="px-2 py-1 bg-black/5 dark:bg-white/5 rounded-[6px] text-[10px] font-bold text-muted">{getSalesStageLabel(lead.status)}</span>
        <span className="px-2 py-1 bg-[#22c55e]/10 text-[#22c55e] border border-[#22c55e]/20 rounded-[6px] text-[10px] font-bold">{lead.email || "Không có email"}</span>
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-border/50">
        <div className="text-[11px] font-bold text-muted flex items-center gap-1.5">
          <Clock size={12} /> {new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(lead.createdAt))}
        </div>

        <div className={`flex items-center gap-2 ${!mobile ? "opacity-0 group-hover:opacity-100 transition-opacity" : ""}`}>
          <button className="w-[28px] h-[28px] rounded-[8px] bg-[#3b82f6]/10 text-[#3b82f6] flex items-center justify-center hover:bg-[#3b82f6]/20 transition-colors" title="Gọi điện" type="button">
            <PhoneCall size={14} />
          </button>
          <button className="w-[28px] h-[28px] rounded-[8px] bg-[#22c55e]/10 text-[#22c55e] flex items-center justify-center hover:bg-[#22c55e]/20 transition-colors" title="Zalo" type="button">
            <MessageCircle size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
