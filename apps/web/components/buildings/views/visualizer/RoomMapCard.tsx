"use client";

import React from "react";
import type { RoomOperationalViewModel } from "./building-view.types";
import { PRIMARY_STATUS_CONFIG, WARNING_CONFIG } from "./status-config";
import { getRoomDisplayName, formatRoomCompactName } from "../../building-labels";
import { Users, CreditCard, ShieldAlert, Calendar, Settings } from "lucide-react";

interface Props {
  roomVM: RoomOperationalViewModel;
  isSelected: boolean;
  onSelect: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

export default function RoomMapCard({ roomVM, isSelected, onSelect, onMouseEnter, onMouseLeave }: Props) {
  const { room, primaryStatus, warnings, remainingContractDays, currentOccupants } = roomVM;
  const statusConfig = PRIMARY_STATUS_CONFIG[primaryStatus] || PRIMARY_STATUS_CONFIG.unknown;

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect();
    }
  };

  // Derive display values safely (unified formatter)
  const roomNameCompact = formatRoomCompactName(room);
  const capacity = room.capacity || 2;
  
  let tenantDisplay = "Sẵn sàng cho thuê";
  if (primaryStatus === "occupied") {
    tenantDisplay = room.tenant?.name || "Khách thuê";
  } else if (primaryStatus === "deposited") {
    tenantDisplay = "Đã cọc giữ chỗ";
  } else if (primaryStatus === "maintenance") {
    tenantDisplay = "Đang bảo trì hệ thống";
  } else if (primaryStatus === "unknown") {
    tenantDisplay = "Chưa có thông tin";
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={`group relative bg-card border rounded-[16px] p-4 transition-all duration-300 flex flex-col justify-between h-[160px] cursor-pointer text-left focus:ring-2 focus:ring-primary focus:outline-none ${
        isSelected
          ? "border-primary shadow-[0_0_15px_rgba(99,102,241,0.2)] bg-indigo-500/[0.01]"
          : "border-border/60 hover:border-primary/40 hover:shadow-md hover:translate-y-[-2px]"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-[15px] text-text tracking-tight">{roomNameCompact}</span>
        <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${statusConfig.solidBg}`}>
          {statusConfig.label}
        </span>
      </div>

      {/* Occupant density row */}
      <div className="flex items-center gap-1.5 text-[11px] font-bold text-muted my-2">
        <Users size={12} className="text-muted/70" />
        <span>{currentOccupants} / {capacity} người ở</span>
      </div>

      {/* Main Tenant Display */}
      <div className="flex flex-col min-w-0 flex-1 justify-center">
        <span className={`text-[13px] font-extrabold truncate ${primaryStatus === 'vacant' ? 'italic text-muted/80' : 'text-text'}`}>
          {tenantDisplay}
        </span>
        {primaryStatus === "occupied" && room.monthlyPrice && (
          <span className="text-[12px] text-primary font-black mt-0.5">
            {formatMoney(room.monthlyPrice)} / tháng
          </span>
        )}
      </div>

      {/* Active warnings and alerts lists */}
      {warnings.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2.5">
          {warnings.map((w, index) => {
            const config = WARNING_CONFIG[w.id];
            if (!config) return null;
            return (
              <div 
                key={index} 
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded-[4px] text-[8px] font-black uppercase tracking-wider ${config.bg}`}
                title={w.message}
              >
                <config.Icon size={9} />
                {config.label}
              </div>
            );
          })}
        </div>
      )}

      {/* Bottom Row: Contract deadline / price details */}
      <div className="flex items-center justify-between border-t border-border/40 pt-2.5 mt-2.5 text-[11px] text-muted">
        {primaryStatus === "occupied" && remainingContractDays !== undefined ? (
          <span className="font-bold">
            Hợp đồng: <strong className={remainingContractDays <= 15 ? "text-rose-500" : remainingContractDays <= 30 ? "text-amber-500" : "text-text"}>Còn {remainingContractDays} ngày</strong>
          </span>
        ) : primaryStatus === "deposited" ? (
          <span className="font-bold text-sky-500">Chờ ký hợp đồng</span>
        ) : primaryStatus === "maintenance" ? (
          <span className="font-bold text-amber-600">Đang kiểm tra kỹ thuật</span>
        ) : (
          <span className="font-bold text-emerald-500">Sẵn sàng nhận khách</span>
        )}
      </div>
    </div>
  );
}
