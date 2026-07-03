"use client";

import React, { useState } from "react";
import { Room } from "../mockData";
import { MoreHorizontal, Eye, Edit, UserPlus, Receipt, CreditCard, FileText } from "lucide-react";

interface Props {
  room: Room;
  onOpenRoomModal: (roomId: string, initialTab?: string) => void;
}

export default function RoomCardV7({ room, onOpenRoomModal }: Props) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  let statusText = "";
  let statusColor = "";
  let statusBg = "";
  let daysRemaining = "-";
  let tenantName = "Trống";
  let debt = room.debt || 0;
  let price = room.price;
  let occupantsCount = 0;

  if (room.status === "occupied") {
    statusText = "Đang thuê";
    statusColor = "text-emerald-500";
    statusBg = "bg-emerald-500/10";
  } else if (room.status === "vacant") {
    statusText = "Phòng trống";
    statusColor = "text-rose-500";
    statusBg = "bg-rose-500/10";
  } else if (room.status === "expiring_soon") {
    statusText = "Sắp hết hạn";
    statusColor = "text-orange-500";
    statusBg = "bg-orange-500/10";
  } else if (room.status === "deposited") {
    statusText = "Đã cọc";
    statusColor = "text-purple-500";
    statusBg = "bg-purple-500/10";
  } else if (room.status === "maintenance") {
    statusText = "Bảo trì";
    statusColor = "text-blue-500";
    statusBg = "bg-blue-500/10";
  }

  if (room.rentalType === "whole") {
    if (room.tenant) {
      tenantName = room.tenant.name;
      occupantsCount = 1 + (room.roommates?.length || 0);
    }
    if (room.contract) {
      const end = new Date(room.contract.endDate).getTime();
      const now = new Date().getTime();
      const diff = Math.ceil((end - now) / (1000 * 3600 * 24));
      daysRemaining = diff > 0 ? `${diff} ngày` : "Hết hạn";
    }
  } else if (room.rentalType === "shared") {
    const tenantsCount = room.sharedTenants?.length || 0;
    occupantsCount = tenantsCount;
    tenantName = tenantsCount > 0 ? `${tenantsCount} khách ghép` : "Trống";
    if (tenantsCount > 0) {
      debt = room.sharedTenants?.reduce((acc, st) => acc + (st.debt || 0), 0) || 0;
      const minDays = Math.min(...(room.sharedTenants?.map(st => st.remainingDays) || [0]));
      daysRemaining = `${minDays} ngày (gần nhất)`;
    }
  }

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount);
  };

  return (
    <div 
      className="group relative bg-card border border-border/80 hover:border-border rounded-[12px] p-3 transition-all hover:shadow-md h-[130px] flex flex-col justify-between"
      onMouseLeave={() => setIsMenuOpen(false)}
    >
      {/* Context Menu Overlay */}
      {isMenuOpen && (
        <div className="absolute inset-0 bg-card/95 backdrop-blur-sm z-10 rounded-[12px] border border-[#6366f1]/50 p-2 flex flex-wrap content-center justify-center gap-2 animate-in fade-in zoom-in-95 duration-200">
          <button onClick={() => onOpenRoomModal(room.id, "overview")} className="flex items-center gap-1.5 px-3 py-1.5 bg-black/5 dark:bg-white/5 hover:bg-[#6366f1] hover:text-white rounded-[6px] text-[11px] font-bold text-text transition-colors"><Eye size={14}/> Xem</button>
          <button onClick={() => onOpenRoomModal(room.id, "overview")} className="flex items-center gap-1.5 px-3 py-1.5 bg-black/5 dark:bg-white/5 hover:bg-[#6366f1] hover:text-white rounded-[6px] text-[11px] font-bold text-text transition-colors"><Edit size={14}/> Sửa</button>
          <button onClick={() => onOpenRoomModal(room.id, "tenants")} className="flex items-center gap-1.5 px-3 py-1.5 bg-black/5 dark:bg-white/5 hover:bg-[#6366f1] hover:text-white rounded-[6px] text-[11px] font-bold text-text transition-colors"><UserPlus size={14}/> Thêm Khách</button>
          <button onClick={() => onOpenRoomModal(room.id, "finances")} className="flex items-center gap-1.5 px-3 py-1.5 bg-black/5 dark:bg-white/5 hover:bg-[#6366f1] hover:text-white rounded-[6px] text-[11px] font-bold text-text transition-colors"><Receipt size={14}/> Hóa Đơn</button>
          <button onClick={() => onOpenRoomModal(room.id, "finances")} className="flex items-center gap-1.5 px-3 py-1.5 bg-black/5 dark:bg-white/5 hover:bg-[#6366f1] hover:text-white rounded-[6px] text-[11px] font-bold text-text transition-colors"><CreditCard size={14}/> Thu Tiền</button>
          <button onClick={() => onOpenRoomModal(room.id, "tenants")} className="flex items-center gap-1.5 px-3 py-1.5 bg-black/5 dark:bg-white/5 hover:bg-[#6366f1] hover:text-white rounded-[6px] text-[11px] font-bold text-text transition-colors"><FileText size={14}/> Hợp Đồng</button>
        </div>
      )}

      {/* Card Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-black text-[16px] text-text">P.{room.number}</span>
          <span className="px-1.5 py-0.5 rounded-[4px] bg-background border border-border text-[10px] font-bold text-muted uppercase">{room.type}</span>
          <span className={`px-2 py-0.5 rounded-[4px] text-[10px] font-black uppercase ${statusBg} ${statusColor}`}>{statusText}</span>
        </div>
        <button 
          onClick={(e) => { e.stopPropagation(); setIsMenuOpen(!isMenuOpen); }}
          className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/5 text-muted transition-colors opacity-0 group-hover:opacity-100"
        >
          <MoreHorizontal size={14} />
        </button>
      </div>

      {/* Density Middle Row */}
      <div className="flex flex-col mt-2">
        <div className="flex items-center justify-between text-[13px]">
          <span className="font-bold text-text truncate max-w-[140px]">{tenantName}</span>
          <span className="text-muted font-medium">{formatMoney(price)}/th</span>
        </div>
        <div className="flex items-center justify-between text-[11px] mt-0.5">
          <span className="text-muted">{occupantsCount} người ở</span>
          <span className="text-muted text-right">Còn: <strong className="text-text">{daysRemaining}</strong></span>
        </div>
      </div>

      {/* Footer / Debt */}
      <div className="flex items-center justify-between mt-auto pt-2 border-t border-border/50">
        <span className="text-[11px] font-bold text-muted">Công nợ:</span>
        <span className={`font-black text-[13px] ${debt > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
          {debt > 0 ? formatMoney(debt) : 'Không nợ'}
        </span>
      </div>
      
    </div>
  );
}
