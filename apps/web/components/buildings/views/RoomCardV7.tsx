"use client";

import React, { useState } from "react";
import type { Room } from "../building.types";
import { MoreHorizontal, Eye, Edit, UserPlus, Receipt, CreditCard, FileText } from "lucide-react";
import { getRoomDisplayName } from "../building-labels";

interface Props {
  room: Room;
  onOpenRoomModal: (roomId: string, initialTab?: string) => void;
}

export default function RoomCardV7({ room, onOpenRoomModal }: Props) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const roomLabel = getRoomDisplayName(room);

  let statusText = "";
  let statusColor = "";
  let statusBg = "";
  let daysRemaining = "-";
  let tenantName = "Trống";
  let debt = room.debt || 0;
  let price = room.contract?.rentPrice;
  let occupantsCount = 0;

  if (room.status === "occupied") {
    statusText = "Đang thuê";
    statusColor = "text-indigo-500";
    statusBg = "bg-indigo-500/10";
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
    statusColor = "text-indigo-500";
    statusBg = "bg-indigo-500/10";
  } else if (room.status === "maintenance") {
    statusText = "Bảo trì";
    statusColor = "text-blue-500";
    statusBg = "bg-blue-500/10";
  }

  const allTenantNames: string[] = [];
  if (room.rentalType === "whole") {
    if (room.tenant) {
      allTenantNames.push(room.tenant.name);
    }
    if (room.sharedTenants && room.sharedTenants.length > 0) {
      room.sharedTenants.forEach(st => allTenantNames.push(st.name));
    }
    occupantsCount = allTenantNames.length;
    if (room.contract) {
      const end = new Date(room.contract.endDate).getTime();
      const now = new Date().getTime();
      const diff = Math.ceil((end - now) / (1000 * 3600 * 24));
      daysRemaining = diff > 0 ? `${diff} ngày` : "Hết hạn";
    }
  } else if (room.rentalType === "shared") {
    const tenantsCount = room.sharedTenants?.length || 0;
    occupantsCount = tenantsCount;
    if (room.sharedTenants && room.sharedTenants.length > 0) {
      room.sharedTenants.forEach(st => allTenantNames.push(st.name));
    }
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
      className="group relative bg-card border border-border/80 hover:border-border rounded-[12px] p-3 transition-all hover:shadow-md min-h-[130px] flex flex-col justify-between gap-2"
      onMouseLeave={() => setIsMenuOpen(false)}
    >
      {/* Context Menu Overlay */}
      {isMenuOpen && (
        <div className="absolute inset-0 bg-card/95 backdrop-blur-sm z-10 rounded-[12px] border border-[#6366f1]/50 p-2 flex flex-wrap content-center justify-center gap-2 animate-in fade-in zoom-in-95 duration-200">
          <button onClick={() => onOpenRoomModal(room.id, "overview")} className="flex items-center gap-1.5 px-3 py-1.5 bg-black/5 dark:bg-white/5 hover:bg-[#6366f1] hover:text-white rounded-[6px] text-[11px] font-bold text-text transition-colors"><Eye size={14}/> Xem</button>
          <button onClick={() => onOpenRoomModal(room.id, "overview")} className="flex items-center gap-1.5 px-3 py-1.5 bg-black/5 dark:bg-white/5 hover:bg-[#6366f1] hover:text-white rounded-[6px] text-[11px] font-bold text-text transition-colors"><Edit size={14}/> Sửa</button>
          <button onClick={() => onOpenRoomModal(room.id, "rental_flow")} className="flex items-center gap-1.5 px-3 py-1.5 bg-black/5 dark:bg-white/5 hover:bg-[#6366f1] hover:text-white rounded-[6px] text-[11px] font-bold text-text transition-colors"><UserPlus size={14}/> Thêm Khách</button>
          <button onClick={() => onOpenRoomModal(room.id, "finances")} className="flex items-center gap-1.5 px-3 py-1.5 bg-black/5 dark:bg-white/5 hover:bg-[#6366f1] hover:text-white rounded-[6px] text-[11px] font-bold text-text transition-colors"><Receipt size={14}/> Hóa Đơn</button>
          <button onClick={() => onOpenRoomModal(room.id, "finances")} className="flex items-center gap-1.5 px-3 py-1.5 bg-black/5 dark:bg-white/5 hover:bg-[#6366f1] hover:text-white rounded-[6px] text-[11px] font-bold text-text transition-colors"><CreditCard size={14}/> Thu Tiền</button>
          <button onClick={() => onOpenRoomModal(room.id, "tenants")} className="flex items-center gap-1.5 px-3 py-1.5 bg-black/5 dark:bg-white/5 hover:bg-[#6366f1] hover:text-white rounded-[6px] text-[11px] font-bold text-text transition-colors"><FileText size={14}/> Hợp Đồng</button>
        </div>
      )}

      {/* Card Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-0 pr-1">
          <span className="font-black text-[16px] text-text whitespace-nowrap truncate">P.{roomLabel}</span>
          <span className="px-1.5 py-0.5 rounded-[4px] bg-background border border-border text-[10px] font-bold text-muted uppercase whitespace-nowrap shrink-0">{room.type}</span>
          <span className={`px-2 py-0.5 rounded-[4px] text-[10px] font-black uppercase whitespace-nowrap shrink-0 ${statusBg} ${statusColor}`}>{statusText}</span>
        </div>
        <button 
          onClick={(e) => { e.stopPropagation(); setIsMenuOpen(!isMenuOpen); }}
          className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/5 text-muted transition-colors opacity-0 group-hover:opacity-100"
        >
          <MoreHorizontal size={14} />
        </button>
      </div>

      {/* Room layout detail tags */}
      <div className="flex flex-wrap gap-1 mt-1 shrink-0">
        {room.type === "2PN" ? (
          <>
            <span className="px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-500 text-[8px] font-black uppercase tracking-tight">Phòng lớn</span>
            <span className="px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-500 text-[8px] font-black uppercase tracking-tight">2 PN mini riêng</span>
            <span className="px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-500 text-[8px] font-black uppercase tracking-tight">1 P.Khách</span>
            <span className="px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-500 text-[8px] font-black uppercase tracking-tight">1 WC</span>
            <span className="px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-500 text-[8px] font-black uppercase tracking-tight">1 bếp</span>
          </>
        ) : (
          <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 text-[8px] font-black uppercase tracking-tight">1 giường đơn</span>
        )}
      </div>

      {/* Density Middle Row */}
      <div className="flex flex-col mt-2">
        {allTenantNames.length > 0 ? (
          <div className="flex flex-col gap-0.5 mb-1">
            {allTenantNames.map((name, idx) => (
              <div key={idx} className="flex flex-wrap items-center justify-between text-[13px] gap-1">
                <span className="font-bold text-text truncate flex-1 min-w-0">{name}</span>
                {idx === 0 && <span className="text-muted font-medium whitespace-nowrap ml-2 shrink-0">{price ? `${formatMoney(price)}/th` : '-'}</span>}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between text-[13px] gap-1 mb-1">
            <span className="font-bold italic text-muted truncate flex-1 min-w-0">Chưa có khách</span>
            <span className="text-muted font-medium whitespace-nowrap ml-2 shrink-0">{price ? `${formatMoney(price)}/th` : '-'}</span>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between text-[11px] mt-1 gap-1">
          <span className="text-muted whitespace-nowrap">{occupantsCount} người ở</span>
          <span className="text-muted text-right whitespace-nowrap ml-auto">Còn: <strong className="text-text">{daysRemaining}</strong></span>
        </div>
      </div>

      {/* Footer / Debt */}
      <div className="flex items-center justify-between mt-auto pt-2 border-t border-border/50">
        <span className="text-[11px] font-bold text-muted">Công nợ:</span>
        <span className={`font-black text-[13px] ${debt > 0 ? 'text-rose-500' : 'text-indigo-500'}`}>
          {debt > 0 ? formatMoney(debt) : 'Không nợ'}
        </span>
      </div>
      
    </div>
  );
}
