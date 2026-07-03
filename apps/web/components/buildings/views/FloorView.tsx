"use client";

import React from "react";
import { Building, Room } from "../mockData";
import { SelectedNode } from "../MasterDetailBuildings";
import { Settings, Image as ImageIcon, Users, AlertTriangle, ShieldAlert, CreditCard, FileText, Plus, Eye, Trash2, Edit2, Upload, MessageSquare } from "lucide-react";
import { Button } from "../../ui/Button";

interface Props {
  building: Building;
  floorId: string;
  onSelectNode: (node: SelectedNode) => void;
  onOpenRoomModal: (roomId: string, initialTab?: string) => void;
  onAddRoom: (floorId: string) => void;
  onEditRoom: (roomId: string) => void;
  onDeleteRoom: (roomId: string) => void;
  onAddTenant: (roomId: string) => void;
  onCreateInvoice: (roomId: string) => void;
  onViewContract: (roomId: string) => void;
  onUploadRoomImages: (roomId: string) => void;
  onDeleteFloor: (floorId: string) => void;
}

export default function FloorView({
  building,
  floorId,
  onSelectNode,
  onOpenRoomModal,
  onAddRoom,
  onEditRoom,
  onDeleteRoom,
  onAddTenant,
  onCreateInvoice,
  onViewContract,
  onUploadRoomImages,
  onDeleteFloor
}: Props) {
  const floor = building.floors.find(f => f.id === floorId);
  if (!floor) return <div className="p-8 text-center text-muted font-bold">Floor not found</div>;

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "occupied":
        return { color: "bg-emerald-500", text: "Đang thuê", borderColor: "border-emerald-500/20", textColor: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10" };
      case "vacant":
        return { color: "bg-zinc-400", text: "Trống", borderColor: "border-zinc-300 dark:border-zinc-700", textColor: "text-muted", bg: "bg-black/5 dark:bg-white/5" };
      case "deposited":
        return { color: "bg-purple-500", text: "Đặt cọc", borderColor: "border-purple-500/20", textColor: "text-purple-600 dark:text-purple-400", bg: "bg-purple-500/10" };
      case "expiring_soon":
        return { color: "bg-amber-500", text: "Sắp hết hạn", borderColor: "border-amber-500/20", textColor: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10" };
      case "maintenance":
        return { color: "bg-blue-500", text: "Bảo trì", borderColor: "border-blue-500/20", textColor: "text-blue-600 dark:text-blue-400", bg: "bg-blue-500/10" };
      default:
        return { color: "bg-zinc-400", text: "Không xác định", borderColor: "border-border", textColor: "text-muted", bg: "bg-black/5" };
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-300 h-full">
      
      {/* Floor Header Operations */}
      <div className="flex items-center justify-between flex-wrap gap-4 border-b border-border/40 pb-4">
        <div className="flex flex-col">
          <h3 className="font-black text-[16px] uppercase tracking-widest text-muted">
            Phòng thuộc Tầng {floor.number} ({floor.rooms.length})
          </h3>
          {floor.notes && <span className="text-[12px] text-muted mt-0.5">{floor.notes}</span>}
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="outline"
            onClick={() => onDeleteFloor(floor.id)}
            className="text-danger border-danger/20 hover:bg-danger/10"
          >
            <Trash2 size={14} className="mr-1.5" /> Xóa tầng
          </Button>
          <Button 
            onClick={() => onAddRoom(floor.id)}
          >
            <Plus size={14} className="mr-1.5" /> Thêm phòng mới
          </Button>
        </div>
      </div>

      {/* Grid of Room Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
        {floor.rooms.map(room => {
          const status = getStatusConfig(room.status);
          
          // Warnings calculations
          const isExpiring = room.status === "expiring_soon";
          const isMaintenance = room.status === "maintenance";
          const hasOverdue = room.rentalType === "whole" 
            ? (room.invoices?.some(inv => inv.status === "unpaid") || (room.debt ?? 0) > 0)
            : (room.sharedTenants?.some(st => st.invoices?.some(inv => inv.status === "unpaid") || st.debt > 0));
          
          // Missing temporary residence warning
          let missingTempResidence = false;
          if (room.status === "occupied" || room.status === "expiring_soon") {
            if (room.rentalType === "whole") {
              if (room.tenant && !room.tenant.tempResidence) missingTempResidence = true;
              if (room.roommates?.some(rm => !rm.tempResidence)) missingTempResidence = true;
            } else if (room.rentalType === "shared") {
              if (room.sharedTenants?.some(st => !st.tempResidence)) missingTempResidence = true;
            }
          }

          // Occupancy count
          let occupantsCount = 0;
          let occupantsMax = room.capacity;
          let tenantDisplay = "";
          
          if (room.rentalType === "whole" && room.tenant) {
            occupantsCount = 1 + (room.roommates?.length ?? 0);
            tenantDisplay = room.tenant.name;
          } else if (room.rentalType === "shared") {
            occupantsCount = room.sharedTenants?.length ?? 0;
            tenantDisplay = `${occupantsCount} khách ở ghép`;
          }

          return (
            <div 
              key={room.id}
              className={`group relative flex flex-col border border-border/60 rounded-[16px] bg-card overflow-hidden hover:border-[#6366f1]/50 hover:shadow-lg transition-all duration-300`}
            >
              {/* Thumbnail Container */}
              <div className="relative aspect-[16/10] w-full bg-muted overflow-hidden shrink-0">
                {room.images && room.images.length > 0 ? (
                  <img 
                    src={room.images[0]} 
                    alt={`P.${room.number}`} 
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-muted">
                    <ImageIcon size={32} className="mb-2 opacity-40" />
                    <span className="text-[11px] font-bold">Không có hình ảnh</span>
                  </div>
                )}
                {/* Dark overlay on image */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />
                
                {/* Status Badge */}
                <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-[8px] bg-black/60 backdrop-blur-md border border-white/10 text-white text-[11px] font-bold uppercase tracking-wider">
                  <div className={`w-2 h-2 rounded-full ${status.color}`} />
                  {status.text}
                </div>

                {/* Area & Room Type Tag */}
                <div className="absolute top-3 right-3 px-2 py-1 rounded-[8px] bg-black/60 backdrop-blur-md border border-white/10 text-white text-[11px] font-bold">
                  {room.type} • {room.area}m²
                </div>

                {/* Room Number Overlay */}
                <div className="absolute bottom-3 left-4">
                  <span className="font-black text-[24px] text-white tracking-tight leading-none">P.{room.number}</span>
                </div>
              </div>

              {/* Warnings and Alerts Banner */}
              {(isExpiring || isMaintenance || hasOverdue || missingTempResidence) && (
                <div className="flex flex-col gap-1 px-4 py-2 border-b border-border/40 bg-rose-500/[0.02] dark:bg-rose-500/[0.01]">
                  {isExpiring && (
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                      <AlertTriangle size={12} /> Hợp đồng sắp hết hạn
                    </div>
                  )}
                  {isMaintenance && (
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-blue-600 dark:text-blue-400">
                      <Settings size={12} className="animate-spin-slow" /> Phòng đang bảo trì
                    </div>
                  )}
                  {hasOverdue && (
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-rose-600 dark:text-rose-400">
                      <CreditCard size={12} /> Quá hạn thanh toán
                    </div>
                  )}
                  {missingTempResidence && (
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-rose-500">
                      <ShieldAlert size={12} /> Thiếu khai báo tạm trú
                    </div>
                  )}
                </div>
              )}

              {/* Room Card Body */}
              <div className="p-4 flex flex-col gap-3 flex-1 justify-between">
                <div>
                  <div className="flex justify-between items-baseline mb-2">
                    <span className="text-[11px] font-black text-muted uppercase tracking-wider">Giá thuê tháng</span>
                    <span className="font-black text-[16px] text-text">{room.price.toLocaleString('vi-VN')} đ{room.rentalType === 'shared' ? ' / giường' : ''}</span>
                  </div>

                  <div className="flex items-center justify-between text-[12px] text-muted border-t border-border/40 pt-3">
                    <span className="font-medium">Người đang ở / Sức chứa</span>
                    <span className="font-bold text-text flex items-center gap-1">
                      <Users size={12} /> {occupantsCount}/{occupantsMax} người
                    </span>
                  </div>
                </div>

                {/* Tenant overview */}
                <div className="border-t border-border/40 pt-3">
                  {room.status === "vacant" ? (
                    <span className="text-[12px] font-medium text-muted italic">Chưa có người thuê</span>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="w-[24px] h-[24px] rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center">
                        <Users size={12} className="text-muted" />
                      </div>
                      <span className="text-[12px] font-bold text-text truncate max-w-[180px]">{tenantDisplay}</span>
                      <span className="ml-auto text-[10px] font-black uppercase text-muted bg-black/5 dark:bg-white/5 px-1.5 py-0.5 rounded-[4px]">
                        {room.rentalType === "whole" ? "Nguyên phòng" : "Ở ghép"}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* HOVER QUICK ACTIONS OVERLAY */}
              <div className="absolute inset-0 bg-background/95 dark:bg-card/95 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col p-4 justify-between z-10">
                <div className="flex items-center justify-between border-b border-border/40 pb-2">
                  <span className="font-black text-[18px] text-text">P.{room.number} Quick Actions</span>
                  <button 
                    onClick={() => onOpenRoomModal(room.id)}
                    className="w-[28px] h-[28px] rounded-full bg-black/5 dark:bg-white/5 hover:bg-[#6366f1]/10 hover:text-[#6366f1] transition-colors flex items-center justify-center"
                  >
                    <Eye size={14} />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 my-auto">
                  <button 
                    onClick={() => onOpenRoomModal(room.id, "overview")}
                    className="flex items-center gap-1.5 bg-background hover:bg-black/5 dark:hover:bg-white/5 border border-border/60 rounded-[8px] p-2 text-[11px] font-bold text-text transition-colors"
                  >
                    <Edit2 size={12} className="text-muted" /> Chỉnh sửa
                  </button>
                  <button 
                    onClick={() => onAddTenant(room.id)}
                    className="flex items-center gap-1.5 bg-background hover:bg-black/5 dark:hover:bg-white/5 border border-border/60 rounded-[8px] p-2 text-[11px] font-bold text-text transition-colors"
                  >
                    <Plus size={12} className="text-muted" /> Thêm khách
                  </button>
                  <button 
                    onClick={() => onCreateInvoice(room.id)}
                    className="flex items-center gap-1.5 bg-background hover:bg-black/5 dark:hover:bg-white/5 border border-border/60 rounded-[8px] p-2 text-[11px] font-bold text-text transition-colors"
                  >
                    <CreditCard size={12} className="text-muted" /> Tạo hóa đơn
                  </button>
                  <button 
                    onClick={() => onViewContract(room.id)}
                    className="flex items-center gap-1.5 bg-background hover:bg-black/5 dark:hover:bg-white/5 border border-border/60 rounded-[8px] p-2 text-[11px] font-bold text-text transition-colors"
                  >
                    <FileText size={12} className="text-muted" /> Hợp đồng
                  </button>
                  <button 
                    onClick={() => onUploadRoomImages(room.id)}
                    className="flex items-center gap-1.5 bg-background hover:bg-black/5 dark:hover:bg-white/5 border border-border/60 rounded-[8px] p-2 text-[11px] font-bold text-text transition-colors col-span-2 justify-center"
                  >
                    <Upload size={12} className="text-muted" /> Upload ảnh
                  </button>
                </div>

                <div className="flex gap-2 border-t border-border/40 pt-2 shrink-0">
                  <button 
                    onClick={() => onDeleteRoom(room.id)}
                    className="flex-1 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-500 rounded-[8px] py-1.5 text-[11px] font-bold transition-colors flex items-center justify-center gap-1"
                  >
                    <Trash2 size={12} /> Xóa phòng
                  </button>
                  <button 
                    onClick={() => onOpenRoomModal(room.id)}
                    className="flex-1 bg-[#6366f1] hover:bg-[#4f46e5] text-white rounded-[8px] py-1.5 text-[11px] font-bold transition-colors flex items-center justify-center gap-1 shadow-sm"
                  >
                    <Eye size={12} /> Chi tiết
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
