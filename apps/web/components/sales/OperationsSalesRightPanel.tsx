"use client";

import React from "react";
import { Calendar, Target, Users, PhoneCall, CheckCircle2, Clock3, BadgeAlert } from "lucide-react";
import { useSalesLeadsQuery } from "@/lib/queries/sales.queries";
import { formatSalesDate, getSalesStageLabel } from "./sales.types";

export default function OperationsSalesRightPanel() {
  const { data } = useSalesLeadsQuery({ limit: 100 });
  const leads = Array.isArray((data as any)?.data?.data) ? (data as any).data.data : [];
  const recentLeads = [...leads]
    .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 4);
  const won = leads.filter((lead: any) => lead.status === "WON").length;
  const active = leads.filter((lead: any) => ["CONTACTED", "QUALIFIED", "PROPOSAL"].includes(lead.status)).length;
  const stale = leads.filter((lead: any) => {
    const created = new Date(lead.createdAt);
    return !Number.isNaN(created.getTime()) && Date.now() - created.getTime() > 1000 * 60 * 60 * 24 * 7 && lead.status !== "WON" && lead.status !== "LOST";
  }).length;

  return (
    <div className="flex flex-col gap-[20px] pb-[100px]">
      <div className="bg-card border border-border rounded-[16px] p-[20px] shadow-sm flex flex-col gap-[16px]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-[8px]">
            <Calendar size={18} className="text-[#6366f1]" />
            <h3 className="font-black text-[15px] text-text">Lead gần đây</h3>
          </div>
          <span className="bg-[#6366f1]/10 text-[#6366f1] text-[11px] font-bold px-[8px] py-[2px] rounded-[6px]">{recentLeads.length} lead</span>
        </div>

        <div className="flex flex-col gap-[12px]">
          {recentLeads.map((lead: any) => (
            <LeadRow key={lead.id} lead={lead} />
          ))}
          {recentLeads.length === 0 && (
            <div className="text-center py-[20px] text-muted text-[13px] font-medium border border-dashed border-border rounded-[12px]">
              Chưa có lead nào trong DB.
            </div>
          )}
        </div>
      </div>

      <div className="bg-card border border-border rounded-[16px] p-[20px] shadow-sm flex flex-col gap-[16px]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-[8px]">
            <Target size={18} className="text-rose-500" />
            <h3 className="font-black text-[15px] text-text">Trạng thái hiện tại</h3>
          </div>
        </div>

        <div className="flex flex-col gap-[12px]">
          <SourceItem icon={<Users size={14} />} name="Tổng lead" value={String(leads.length)} color="text-blue-500 bg-blue-500/10" />
          <SourceItem icon={<PhoneCall size={14} />} name="Đang xử lý" value={String(active)} color="text-orange-500 bg-orange-500/10" />
          <SourceItem icon={<CheckCircle2 size={14} />} name="Đã chốt" value={String(won)} color="text-indigo-500 bg-indigo-500/10" />
          <SourceItem icon={<BadgeAlert size={14} />} name="Cần kiểm tra" value={String(stale)} color="text-rose-500 bg-rose-500/10" />
        </div>
      </div>

      <div className="bg-card border border-border rounded-[16px] p-[20px] shadow-sm flex flex-col gap-[16px]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-[8px]">
            <Clock3 size={18} className="text-yellow-500" />
            <h3 className="font-black text-[15px] text-text">Lead tạo gần nhất</h3>
          </div>
        </div>

        <div className="flex flex-col gap-[16px]">
          {recentLeads.map((lead: any, index: number) => (
            <SalesItem key={lead.id} rank={index + 1} name={lead.name} phone={lead.phone} status={getSalesStageLabel(lead.status)} createdAt={lead.createdAt} />
          ))}
        </div>
      </div>
    </div>
  );
}

function LeadRow({ lead }: any) {
  return (
    <div className="bg-background border border-border rounded-[12px] p-[12px]">
      <div className="font-bold text-[13px] text-text">{lead.name}</div>
      <div className="text-[12px] text-muted mt-1">{lead.phone}</div>
      <div className="text-[11px] text-muted mt-2 line-clamp-2">{lead.notes || "Chưa có ghi chú"}</div>
    </div>
  );
}

function SourceItem({ icon, name, value, color }: any) {
  return (
    <div className="flex items-center justify-between group cursor-default hover:bg-black/5 dark:hover:bg-white/5 p-1 rounded-md transition-colors">
      <div className="flex items-center gap-[12px]">
        <div className={`w-[28px] h-[28px] rounded-[8px] flex items-center justify-center ${color}`}>
          {icon}
        </div>
        <div className="flex flex-col">
          <span className="text-[13px] font-bold text-text">{name}</span>
        </div>
      </div>
      <span className="text-[13px] font-black text-[#8b5cf6]">{value}</span>
    </div>
  );
}

function SalesItem({ rank, name, phone, status, createdAt }: any) {
  return (
    <div className="flex items-center gap-[12px]">
      <div className={`w-[24px] h-[24px] rounded-full flex items-center justify-center text-[12px] font-bold ${rank === 1 ? "bg-yellow-500/20 text-yellow-600" : rank === 2 ? "bg-slate-300/30 text-slate-500" : "bg-orange-500/20 text-orange-600"}`}>
        {rank}
      </div>
      <div className="flex flex-col flex-1">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-bold text-text">{name}</span>
          <span className="text-[11px] font-bold text-[#6366f1]">{status}</span>
        </div>
        <div className="flex items-center justify-between mt-[2px]">
          <span className="text-[11px] font-medium text-muted">{phone}</span>
          <span className="text-[11px] font-bold text-muted">{formatSalesDate(createdAt)}</span>
        </div>
      </div>
    </div>
  );
}
