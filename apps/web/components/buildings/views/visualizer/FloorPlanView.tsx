"use client";

import React, { useMemo } from "react";
import type { Floor } from "../../building.types";
import type { FloorOperationalViewModel, RoomOperationalViewModel } from "./building-view.types";
import { toFloorOperationalViewModel } from "./buildingOperationalAdapter";
import FloorPlanCanvas from "./FloorPlanCanvas";
import { PRIMARY_STATUS_CONFIG } from "./status-config";
import { Users, Info, Calendar, AlertTriangle, Layers, Edit2, Trash2 } from "lucide-react";

interface Props {
  floor: Floor;
  activeRoomId: string | null;
  onSelectRoom: (roomId: string) => void;
  hoveredRoomId: string | null;
  onHoverRoom: (roomId: string | null) => void;
  onAddRoom: (floorId: string) => void;
  onEditFloor: (floorId: string) => void;
  onDeleteFloor: (floorId: string) => void;
  permissions: {
    canCreateRoom: boolean;
    canUpdateFloor: boolean;
    canDeleteFloor: boolean;
  };
}

export default function FloorPlanView({
  floor,
  activeRoomId,
  onSelectRoom,
  hoveredRoomId,
  onHoverRoom,
  onAddRoom,
  onEditFloor,
  onDeleteFloor,
  permissions
}: Props) {
  // Convert floor domain data to Operational ViewModel
  const floorVM = useMemo(() => {
    return toFloorOperationalViewModel(floor);
  }, [floor]);

  // Extract alerts/warnings specific to this floor
  const expiringRooms = useMemo(() => {
    return floorVM.rooms.filter(r => r.warnings.some(w => w.id === "contract_expiring"));
  }, [floorVM.rooms]);

  const warningRooms = useMemo(() => {
    return floorVM.rooms.filter(r => r.warnings.some(w => w.id === "payment_overdue" || w.id === "temp_residence_missing"));
  }, [floorVM.rooms]);

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount);
  };

  const getFloorName = (floorNumber: number) => {
    if (floorNumber === 1) return "Tầng trệt";
    return `Tầng ${floorNumber - 1}`;
  };

  const cleanRoomName = (name: string) => {
    let clean = name.trim();
    if (clean.toLowerCase().startsWith("phòng ")) {
      clean = clean.substring(6).trim();
    } else if (clean.toLowerCase().startsWith("p.")) {
      clean = clean.substring(2).trim();
    }
    return clean;
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 xl:gap-8 w-full select-none">
      
      {/* LEFT AREA: MAP CANVAS (approx 68% width on desktop) */}
      <div className="flex-grow lg:flex-[68] flex flex-col bg-card border border-border/60 rounded-[20px] p-5 shadow-sm min-h-[580px] justify-between relative">
        <div className="absolute top-0 right-0 w-[150px] h-[150px] bg-primary/5 rounded-full blur-[40px] pointer-events-none" />
        
        {/* Floor plan operations header */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/40 pb-3.5 mb-2">
          <div>
            <h3 className="font-black text-[13px] uppercase tracking-widest text-muted">
              Sơ đồ phòng {getFloorName(floor.number)}
            </h3>
          </div>
          
          <div className="flex items-center gap-2">
            {permissions.canUpdateFloor && (
              <button
                type="button"
                onClick={() => onEditFloor(floor.id)}
                className="flex items-center gap-1 px-3 py-1.5 bg-background border border-border hover:bg-slate-50 dark:hover:bg-white/5 text-[11px] font-bold rounded-xl transition-all shadow-sm focus:outline-none"
              >
                <Edit2 size={12} className="text-muted" />
                Sửa tầng
              </button>
            )}
            {permissions.canDeleteFloor && (
              <button
                type="button"
                onClick={() => onDeleteFloor(floor.id)}
                className="flex items-center gap-1 px-3 py-1.5 bg-rose-500/5 hover:bg-rose-500/10 border border-rose-500/20 text-[11px] font-bold text-rose-500 rounded-xl transition-all shadow-sm focus:outline-none"
              >
                <Trash2 size={12} />
                Xóa tầng
              </button>
            )}
          </div>
        </div>

        <FloorPlanCanvas
          roomsVM={floorVM.rooms}
          activeRoomId={activeRoomId}
          onSelectRoom={onSelectRoom}
          hoveredRoomId={hoveredRoomId}
          onHoverRoom={onHoverRoom}
          onAddRoom={() => onAddRoom(floor.id)}
          permissions={{ canCreateRoom: permissions.canCreateRoom }}
        />
      </div>

      {/* RIGHT AREA: FLOOR OPERATION PANEL (approx 32% width on desktop) */}
      <div className="w-full lg:w-[32%] shrink-0 flex flex-col gap-5">
        
        {/* Floor overall stats dashboard */}
        <div className="bg-card border border-border/60 rounded-[20px] p-5 shadow-sm relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-[180px] h-[180px] bg-primary/5 rounded-full blur-[40px] pointer-events-none" />
          
          <h3 className="font-black text-[13px] uppercase tracking-widest text-muted border-b border-border/40 pb-3 mb-4">
            Tổng quan {getFloorName(floor.number)}
          </h3>

          <div className="grid grid-cols-2 gap-3.5 mb-4">
            <div className="bg-background/50 border border-border/40 rounded-xl p-3 text-center">
              <span className="block text-[9px] font-black uppercase text-muted tracking-wider">Đang thuê</span>
              <span className="text-[18px] font-black text-emerald-500">{floorVM.occupiedRooms} / {floorVM.totalRooms} phòng</span>
            </div>
            <div className="bg-background/50 border border-border/40 rounded-xl p-3 text-center">
              <span className="block text-[9px] font-black uppercase text-muted tracking-wider">Phòng trống</span>
              <span className="text-[18px] font-black text-text">{floorVM.vacantRooms} / {floorVM.totalRooms} phòng</span>
            </div>
          </div>

          <div className="flex flex-col gap-3.5 border-t border-border/30 pt-3.5">
            <div className="flex justify-between items-center text-[12px] font-bold">
              <span className="text-muted">Cư dân hiện tại</span>
              <span className="text-text flex items-center gap-1"><Users size={12} /> {floorVM.residentCount} người</span>
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex justify-between items-center text-[12px] font-bold">
                <span className="text-muted">Tỷ lệ lấp đầy</span>
                <span className="text-primary">{floorVM.occupancyRate}%</span>
              </div>
              <div className="w-full h-2 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary rounded-full transition-all duration-500" 
                  style={{ width: `${floorVM.occupancyRate}%` }} 
                />
              </div>
            </div>
          </div>
        </div>

        {/* Expiring contracts list */}
        {expiringRooms.length > 0 && (
          <div className="bg-card border border-border/60 rounded-[20px] p-5 shadow-sm">
            <h3 className="font-black text-[13px] uppercase tracking-widest text-muted border-b border-border/40 pb-3 mb-3 flex items-center gap-1.5">
              <Calendar size={14} className="text-orange-500" />
              Hợp đồng sắp hết hạn
            </h3>
            <div className="flex flex-col gap-2">
              {expiringRooms.map(rVM => {
                const roomRawName = rVM.room.name || rVM.room.number;
                return (
                  <div
                    key={rVM.room.id}
                    onClick={() => onSelectRoom(rVM.room.id)}
                    className="flex items-center justify-between p-2.5 rounded-xl border border-orange-500/20 bg-orange-500/[0.02] text-[12px] font-bold text-orange-600 dark:text-orange-400 cursor-pointer hover:bg-orange-500/10 transition-all shadow-sm"
                  >
                    <span>Phòng P.{cleanRoomName(roomRawName)}</span>
                    <span>Còn {rVM.remainingContractDays} ngày</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Warnings / Debt list */}
        {warningRooms.length > 0 && (
          <div className="bg-card border border-border/60 rounded-[20px] p-5 shadow-sm">
            <h3 className="font-black text-[13px] uppercase tracking-widest text-muted border-b border-border/40 pb-3 mb-3 flex items-center gap-1.5">
              <AlertTriangle size={14} className="text-rose-500" />
              Cảnh báo tầng
            </h3>
            <div className="flex flex-col gap-2">
              {warningRooms.map(rVM => {
                const roomRawName = rVM.room.name || rVM.room.number;
                return (
                  <div
                    key={rVM.room.id}
                    onClick={() => onSelectRoom(rVM.room.id)}
                    className="flex flex-col gap-1 p-2.5 rounded-xl border border-rose-500/20 bg-rose-500/[0.02] text-[12px] font-bold text-rose-600 dark:text-rose-400 cursor-pointer hover:bg-rose-500/10 transition-all shadow-sm"
                  >
                    <div className="flex items-center justify-between w-full">
                      <span>Phòng P.{cleanRoomName(roomRawName)}</span>
                      <span className="text-[10px] uppercase font-black">Lỗi vận hành</span>
                    </div>
                    <div className="text-[10px] text-muted truncate">
                      {rVM.warnings.map(w => w.label).join(", ")}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Room inventories list */}
        <div className="bg-card border border-border/60 rounded-[20px] p-5 shadow-sm flex flex-col justify-between flex-1">
          <h3 className="font-black text-[13px] uppercase tracking-widest text-muted border-b border-border/40 pb-3 mb-3">
            Danh sách phòng
          </h3>

          <div className="flex flex-col gap-2">
            {floorVM.rooms.map((rVM) => {
              const isSelected = activeRoomId === rVM.room.id;
              const isHovered = hoveredRoomId === rVM.room.id;
              const statusConfig = PRIMARY_STATUS_CONFIG[rVM.primaryStatus] || PRIMARY_STATUS_CONFIG.unknown;
              const roomRawName = rVM.room.name || rVM.room.number;
              
              return (
                <button
                  key={rVM.room.id}
                  type="button"
                  onClick={() => onSelectRoom(rVM.room.id)}
                  onMouseEnter={() => onHoverRoom(rVM.room.id)}
                  onMouseLeave={() => onHoverRoom(null)}
                  className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between focus:ring-2 focus:ring-primary focus:outline-none ${
                    isSelected 
                      ? "bg-primary/[0.06] border-primary shadow-sm" 
                      : isHovered 
                      ? "bg-slate-50 dark:bg-white/5 border-border" 
                      : "bg-background/40 border-border/60"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-[13px] font-black text-text">
                      P.{cleanRoomName(roomRawName)}
                    </span>
                    <span className={`px-1.5 py-0.5 rounded-[4px] text-[8px] font-black uppercase tracking-wider ${statusConfig.solidBg}`}>
                      {statusConfig.label}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-[11px] text-muted shrink-0">
                    <span className="font-bold text-text flex items-center gap-0.5">
                      <Users size={10} /> {rVM.currentOccupants}/{rVM.room.capacity || 2}
                    </span>
                    <span className="font-bold text-primary">
                      {formatMoney(rVM.room.monthlyPrice)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

      </div>

    </div>
  );
}
