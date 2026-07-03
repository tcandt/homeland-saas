"use client";

import React from "react";
import { Phone, MessageSquare, Mail, Calendar, Eye, CreditCard, FileSignature, Edit, MapPin, Building, Briefcase, Flame } from "lucide-react";

export default function OperationsSalesLeadCard({ lead }: { lead: any }) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "Mới Nhận": return "text-blue-500 bg-blue-500/10";
      case "Consulting": return "text-[#6366f1] bg-[#6366f1]/10";
      case "Viewing": return "text-purple-500 bg-purple-500/10";
      case "Negotiating": return "text-[#f97316] bg-[#f97316]/10";
      case "Deposit": return "text-rose-500 bg-rose-500/10";
      default: return "text-muted bg-border";
    }
  };

  const getHotLevelColor = (level: string) => {
    switch (level) {
      case "Hot": return "text-rose-500 bg-rose-500/10 border-rose-500/20";
      case "Warm": return "text-[#f97316] bg-[#f97316]/10 border-[#f97316]/20";
      case "Cold": return "text-blue-500 bg-blue-500/10 border-blue-500/20";
      default: return "text-muted bg-border border-border";
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-rose-500";
    if (score >= 70) return "text-[#f97316]";
    if (score >= 50) return "text-yellow-600 dark:text-yellow-500";
    return "text-muted";
  };

  return (
    <div className="bg-card border border-border rounded-[16px] p-[16px] shadow-sm hover:shadow-md hover:-translate-y-[3px] hover:border-[#6366f1]/50 transition-all duration-300 relative group overflow-hidden">
      
      {/* Header */}
      <div className="flex items-start justify-between mb-[16px]">
        <div className="flex items-center gap-[12px]">
          <img src={lead.avatar} alt={lead.name} className="w-[40px] h-[40px] rounded-full object-cover border border-border" />
          <div className="flex flex-col">
            <h3 className="font-bold text-[15px] text-text group-hover:text-[#6366f1] transition-colors cursor-pointer">{lead.name}</h3>
            <div className="flex items-center gap-[6px] text-[12px] font-medium text-muted">
              <span>{lead.id}</span>
              <span>•</span>
              <span className={`px-[6px] py-[2px] rounded-[4px] border ${getHotLevelColor(lead.hotLevel)} font-bold text-[10px] uppercase flex items-center gap-1`}>
                {lead.hotLevel === 'Hot' && <Flame size={10} />}
                {lead.hotLevel}
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-[4px]">
          <span className={`text-[12px] font-bold px-[8px] py-[4px] rounded-[6px] ${getStatusColor(lead.status)}`}>
            {lead.status}
          </span>
          <span className={`text-[13px] font-black ${getScoreColor(lead.score)} flex items-center gap-1`}>
            <Zap size={12} className={getScoreColor(lead.score)} />
            {lead.score} pts
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="grid grid-cols-2 gap-y-[12px] gap-x-[16px] mb-[16px]">
        <InfoItem icon={<Phone size={14} />} label="SĐT" value={lead.phone} valueClass="text-blue-500 font-bold" />
        <InfoItem icon={<Mail size={14} />} label="Nguồn" value={lead.source} />
        <InfoItem icon={<Briefcase size={14} />} label="Nghề nghiệp" value={lead.job} />
        <InfoItem icon={<Building size={14} />} label="Tòa nhà" value={lead.building} />
        <div className="col-span-2">
          <InfoItem icon={<MapPin size={14} />} label="Nhu cầu" value={`${lead.need} (${lead.budget})`} />
        </div>
        <InfoItem icon={<Calendar size={14} />} label="Lịch xem" value={lead.viewingSchedule} valueClass={lead.viewingSchedule.includes('Hôm nay') ? 'text-[#f97316] font-bold' : ''} />
        <InfoItem icon={<Calendar size={14} />} label="Follow-up" value={lead.nextFollowup} valueClass={lead.nextFollowup.includes('Hôm nay') ? 'text-rose-500 font-bold' : ''} />
      </div>

      {/* Footer */}
      <div className="pt-[16px] border-t border-border flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-[11px] font-medium text-muted">Dự kiến thu</span>
          <span className="text-[14px] font-black text-[#10b981]">{lead.expectedRevenue}đ</span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[11px] font-medium text-muted">Sales Phụ trách</span>
          <div className="flex items-center gap-[6px]">
            <div className="w-[16px] h-[16px] bg-purple-500/20 rounded-full flex items-center justify-center">
              <span className="text-[8px] font-bold text-purple-500">{lead.salesName[0]}</span>
            </div>
            <span className="text-[13px] font-bold text-text">{lead.salesName}</span>
          </div>
        </div>
      </div>

      {/* Hover Quick Actions */}
      <div className="absolute inset-0 bg-card/95 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-center gap-[12px] z-10">
        <div className="flex items-center gap-[8px]">
          <ActionButton icon={<Phone size={14} />} label="Gọi" color="bg-blue-500" />
          <ActionButton icon={<MessageSquare size={14} />} label="Zalo" color="bg-[#0ea5e9]" />
          <ActionButton icon={<Mail size={14} />} label="Email" color="bg-purple-500" />
        </div>
        <div className="flex items-center gap-[8px]">
          <ActionButton icon={<Calendar size={14} />} label="Hẹn lịch" color="bg-[#f97316]" outline />
          <ActionButton icon={<Eye size={14} />} label="Xem phòng" color="bg-emerald-500" outline />
          <ActionButton icon={<CreditCard size={14} />} label="Đặt cọc" color="bg-rose-500" outline />
        </div>
        <div className="absolute top-[16px] right-[16px] flex gap-[8px]">
          <button className="w-[32px] h-[32px] rounded-[8px] bg-background border border-border flex items-center justify-center text-muted hover:text-[#6366f1] transition-colors shadow-sm">
            <Edit size={14} />
          </button>
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

function ActionButton({ icon, label, color, outline = false }: any) {
  return (
    <button className={`h-[36px] px-[16px] rounded-[10px] flex items-center gap-[6px] text-[13px] font-bold transition-transform active:scale-95 shadow-sm
      ${outline ? `bg-background border border-border text-text hover:bg-black/5 dark:hover:bg-white/5` : `${color} text-white hover:opacity-90`}
    `}>
      {icon}
      {label}
    </button>
  );
}

function Zap({ size, className }: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
    </svg>
  );
}
