"use client";

import React from "react";
import { Phone, CalendarClock, CreditCard, ChevronRight, MessageSquare, PhoneCall, ShieldAlert, ShieldCheck, Shield, FileText, CheckCircle2, FileSignature, Edit, User } from "lucide-react";
import { Card } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";

export default function TenantCard({ tenant, onClick }: { tenant: any, onClick: () => void }) {
  const getStatusConfig = (status: string) => {
    switch (status) {
      case "Đang thuê": return "bg-[#22c55e]/10 text-[#22c55e]";
      case "Sắp hết hạn": return "bg-[#f97316]/10 text-[#f97316]";
      case "Quá hạn": return "bg-[#ef4444]/10 text-[#ef4444]";
      case "Đặt cọc": return "bg-[#3b82f6]/10 text-[#3b82f6]";
      default: return "bg-muted/10 text-muted";
    }
  };

  return (
    <Card 
      data-testid="tenant-card"
      onClick={onClick}
      className="relative cursor-pointer group overflow-hidden flex flex-col h-[230px] hover:-translate-y-[3px] hover:border-[#6366f1] transition-all duration-150 p-0"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-[16px] pb-[12px]">
        <div className="flex items-center gap-3">
          <img src={tenant.avatar || "https://ui-avatars.com/api/?name=" + encodeURIComponent(tenant.fullName || tenant.name || "Khách")} className="w-[44px] h-[44px] rounded-full object-cover border border-border/50 shrink-0" alt="" />
          <div className="flex flex-col">
            <h3 className="font-black text-[16px] leading-tight text-text truncate">{tenant.fullName || tenant.name || "Khách thuê"}</h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="font-bold text-[12px] text-muted">{tenant.code || tenant.id?.slice(0, 8) || "N/A"}</span>
              <span className="w-1 h-1 rounded-full bg-border"></span>
              <span className="font-bold text-[12px] text-text">{tenant.contracts?.[0]?.room?.number || tenant.room || 'Chưa xếp phòng'}</span>
            </div>
          </div>
        </div>
        <Badge variant={tenant.status === 'ACTIVE' || tenant.status === 'Đang thuê' ? 'success' : tenant.status === 'Sắp hết hạn' ? 'warning' : tenant.status === 'Quá hạn' ? 'error' : tenant.status === 'Đặt cọc' ? 'primary' : 'neutral'}>
          {tenant.status === 'ACTIVE' ? 'Đang thuê' : tenant.status === 'INACTIVE' ? 'Đã rời đi' : tenant.status}
        </Badge>
      </div>

      {/* Body Info Grid */}
      <div className="flex-1 px-[16px] grid grid-cols-[1fr_auto_1fr] gap-x-[12px] gap-y-[10px]">
        {/* Col 1: Info */}
        <div className="flex flex-col gap-1.5 border-r border-border/40 pr-[12px]">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-muted uppercase tracking-wider mb-0.5">Liên hệ</span>
            <span className="text-[12px] font-bold text-text">{tenant.phone}</span>
          </div>
          <div className="flex flex-col mt-auto">
            <span className="text-[10px] font-bold text-muted uppercase tracking-wider mb-0.5">Ngày vào</span>
            <span className="text-[12px] font-medium text-text">{tenant.entryDate}</span>
          </div>
        </div>

        {/* Col 2: Finance */}
        <div className="flex flex-col gap-1.5 border-r border-border/40 pr-[12px]">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-muted uppercase tracking-wider mb-0.5">Tiền phòng / Cọc</span>
            <span className="text-[12px] font-bold text-text">{(tenant.rent || 0).toLocaleString()} đ / {(tenant.deposit || 0).toLocaleString()} đ</span>
          </div>
          <div className="flex flex-col mt-auto">
            <span className="text-[10px] font-bold text-muted uppercase tracking-wider mb-0.5">Công nợ</span>
            <span className={`text-[13px] font-black ${tenant.debt > 0 ? 'text-[#ef4444]' : 'text-[#22c55e]'}`}>
              {tenant.debt > 0 ? `${(tenant.debt || 0).toLocaleString()} đ` : '0 đ'}
            </span>
          </div>
        </div>

        {/* Col 3: Contract & Status */}
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-muted uppercase tracking-wider mb-0.5">Hợp đồng</span>
            <span className="text-[12px] font-bold text-text">Còn {tenant.contractDays || 0} ngày</span>
          </div>
          <div className="flex flex-col mt-auto">
            <span className="text-[10px] font-bold text-muted uppercase tracking-wider mb-0.5">Tạm trú</span>
            <span className={`text-[12px] font-bold ${tenant.tempResidence === 'Đã khai báo' ? 'text-[#22c55e]' : 'text-rose-500'}`}>
              {tenant.tempResidence}
            </span>
          </div>
        </div>
      </div>

      {/* Footer & Risk */}
      <div className="p-[16px] pt-[12px] mt-auto border-t border-border/40 flex items-center justify-between">
        <RiskBadge risk={tenant.risk} />
        <Button variant="ghost" size="sm" onClick={onClick} className="text-[#6366f1] font-bold text-[12px] px-2 h-8">
          Hồ sơ chi tiết <ChevronRight size={14} className="ml-1" />
        </Button>
      </div>

      {/* Quick Actions Hover Overlay */}
      <div className="absolute inset-0 bg-card/70 backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col justify-center items-center z-10">
        <div className="grid grid-cols-4 gap-[8px] p-[16px] w-full scale-95 group-hover:scale-100 transition-transform duration-300">
          <QuickActionBtn icon={<User size={16} />} label="Hồ sơ" color="text-[#3b82f6]" bg="bg-[#3b82f6]/10" hoverBg="hover:bg-[#3b82f6]/20" onClick={onClick} />
          <QuickActionBtn icon={<FileText size={16} />} label="Hợp đồng" color="text-[#8b5cf6]" bg="bg-[#8b5cf6]/10" hoverBg="hover:bg-[#8b5cf6]/20" />
          <QuickActionBtn icon={<CheckCircle2 size={16} />} label="Thu tiền" color="text-[#22c55e]" bg="bg-[#22c55e]/10" hoverBg="hover:bg-[#22c55e]/20" />
          <QuickActionBtn icon={<MessageSquare size={16} />} label="Zalo" color="text-blue-500" bg="bg-blue-500/10" hoverBg="hover:bg-blue-500/20" />
          <QuickActionBtn icon={<PhoneCall size={16} />} label="Gọi điện" color="text-[#8b5cf6]" bg="bg-[#8b5cf6]/10" hoverBg="hover:bg-[#8b5cf6]/20" />
          <QuickActionBtn icon={<FileSignature size={16} />} label="Gia hạn" color="text-[#f97316]" bg="bg-[#f97316]/10" hoverBg="hover:bg-[#f97316]/20" />
          <QuickActionBtn icon={<Shield size={16} />} label="Tạm trú" color="text-rose-500" bg="bg-rose-500/10" hoverBg="hover:bg-rose-500/20" />
          <QuickActionBtn icon={<Edit size={16} />} label="Sửa" color="text-muted" bg="bg-muted/10" hoverBg="hover:bg-muted/20" />
        </div>
      </div>
    </Card>
  );
}

function QuickActionBtn({ icon, label, color, bg, hoverBg, onClick }: any) {
  return (
    <button onClick={(e) => { e.stopPropagation(); onClick?.(); }} className={`flex flex-col items-center justify-center gap-[4px] h-[56px] rounded-[12px] ${bg} ${hoverBg} transition-all duration-200 cursor-pointer shadow-sm hover:-translate-y-1 w-full border-none`}>
      <div className={`${color}`}>{icon}</div>
      <span className={`text-[10px] font-bold tracking-wide ${color}`}>{label}</span>
    </button>
  );
}

function RiskBadge({ risk }: { risk: string }) {
  if (risk === 'low' || !risk) return <Badge variant="success"><ShieldCheck size={12} className="mr-1" /> Rủi ro thấp</Badge>;
  if (risk === 'medium') return <Badge variant="warning"><Shield size={12} className="mr-1" /> Rủi ro TB</Badge>;
  return <Badge variant="error"><ShieldAlert size={12} className="mr-1" /> Rủi ro cao</Badge>;
}
