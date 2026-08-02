"use client";

import React from "react";
import { Phone, Mail, MessageCircle, Edit, MoreHorizontal, Clock3 } from "lucide-react";
import { formatSalesDate, getSalesStageLabel, SalesLeadRecord } from "./sales.types";

export default function OperationsSalesLeadCard({ lead }: { lead: SalesLeadRecord }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => window.dispatchEvent(new CustomEvent("open-sales-drawer", { detail: lead }))}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          window.dispatchEvent(new CustomEvent("open-sales-drawer", { detail: lead }));
        }
      }}
      className="text-left bg-card border border-border rounded-[16px] p-[16px] shadow-sm hover:shadow-md hover:-translate-y-[2px] hover:border-[#6366f1]/50 transition-all duration-300 relative group overflow-hidden cursor-pointer"
    >
      <div className="flex items-start justify-between mb-[16px]">
        <div className="flex items-center gap-[12px] min-w-0">
          <div className="w-[40px] h-[40px] rounded-full bg-[#6366f1]/10 flex items-center justify-center border border-[#6366f1]/20 shrink-0">
            <span className="font-black text-[14px] text-[#6366f1]">{(lead.name || "L").slice(0, 1).toUpperCase()}</span>
          </div>
          <div className="flex flex-col min-w-0">
            <h3 className="font-bold text-[15px] text-text group-hover:text-[#6366f1] transition-colors cursor-pointer truncate">{lead.name}</h3>
            <div className="flex items-center gap-[6px] text-[12px] font-medium text-muted">
              <span>{lead.phone}</span>
              <span>•</span>
              <span>{getSalesStageLabel(lead.status)}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-bold px-[8px] py-[4px] rounded-[6px] text-text bg-black/5 dark:bg-white/5 border border-border">
            {getSalesStageLabel(lead.status)}
          </span>
          <span className="text-muted opacity-0 group-hover:opacity-100 transition-opacity">
            <MoreHorizontal size={16} />
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-y-[12px] gap-x-[16px] mb-[16px]">
        <InfoItem icon={<Phone size={14} />} label="SĐT" value={lead.phone} valueClass="text-blue-500 font-bold" />
        <InfoItem icon={<Mail size={14} />} label="Email" value={lead.email || "Chưa cập nhật"} />
        <InfoItem icon={<MessageCircle size={14} />} label="Ghi chú" value={lead.notes || "Chưa có ghi chú"} valueClass="line-clamp-2" />
      </div>

      <div className="pt-[16px] border-t border-border flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-[11px] font-medium text-muted">Tạo lúc</span>
          <span className="text-[14px] font-black text-[#8b5cf6] flex items-center gap-1">
            <Clock3 size={14} /> {formatSalesDate(lead.createdAt)}
          </span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[11px] font-medium text-muted">Cập nhật</span>
          <span className="text-[13px] font-bold text-text">{formatSalesDate(lead.updatedAt)}</span>
        </div>
      </div>

      <div className="absolute top-[16px] right-[16px] flex gap-[8px] opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="w-[32px] h-[32px] rounded-[8px] bg-background border border-border flex items-center justify-center text-muted hover:text-[#6366f1] transition-colors shadow-sm">
          <Edit size={14} />
        </div>
      </div>
    </div>
  );
}

function InfoItem({ icon, label, value, valueClass = "text-text" }: any) {
  return (
    <div className="flex flex-col gap-[2px]">
      <div className="flex items-center gap-[6px] text-muted">
        {icon}
        <span className="text-[11px] font-medium">{label}</span>
      </div>
      <span className={`text-[13px] truncate font-medium ${valueClass}`}>{value}</span>
    </div>
  );
}
