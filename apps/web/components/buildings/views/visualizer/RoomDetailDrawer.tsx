"use client";

import React, { useEffect, useMemo } from "react";
import { useRoomDetailQuery } from "@/lib/queries/rooms.queries";
import { useInvoicesQuery } from "@/lib/queries/invoices.queries";
import { toRoomOperationalItem } from "./buildingOperationalAdapter";
import { PRIMARY_STATUS_CONFIG, WARNING_CONFIG } from "./status-config";
import { 
  X, User, Phone, Mail, FileText, Calendar, CreditCard, 
  ShieldAlert, Eye, Plus, Loader2, Trash2 
} from "lucide-react";
import { formatRoomCompactName } from "../../building-labels";
import dayjs from "dayjs";

interface Props {
  roomId: string;
  onClose: () => void;
  onOpenRoomModal: (roomId: string, tab?: string) => void;
  onDeleteRoom: (roomId: string) => void;
}

export default function RoomDetailDrawer({ roomId, onClose, onOpenRoomModal, onDeleteRoom }: Props) {
  // Query full room details and invoices dynamically
  const { data: room, isLoading: isRoomLoading, isError } = useRoomDetailQuery(roomId, !!roomId);
  const { data: invoicesResponse, isLoading: isInvoicesLoading } = useInvoicesQuery({ roomId });

  const invoices = useMemo(() => {
    return Array.isArray(invoicesResponse?.data) 
      ? invoicesResponse.data 
      : Array.isArray(invoicesResponse) 
      ? invoicesResponse 
      : [];
  }, [invoicesResponse]);

  // Derive operational ViewModel
  const roomVM = useMemo(() => {
    if (!room) return null;
    return toRoomOperationalItem(room, invoices);
  }, [room, invoices]);

  // Handle ESC key press to close drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(amount);
  };

  if (isRoomLoading) {
    return (
      <div className="fixed inset-y-0 right-0 w-full sm:w-[440px] bg-card border-l border-border/80 shadow-2xl z-[1000] flex flex-col items-center justify-center p-8 select-none">
        <Loader2 className="w-8 h-8 text-primary animate-spin mb-2" />
        <span className="text-[13px] font-bold text-muted">Đang tải chi tiết phòng...</span>
      </div>
    );
  }

  if (isError || !room || !roomVM) {
    return (
      <div className="fixed inset-y-0 right-0 w-full sm:w-[440px] bg-card border-l border-border/80 shadow-2xl z-[1000] flex flex-col p-6 select-none">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-semibold text-[16px] text-text">Không tìm thấy phòng</h3>
          <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-slate-50"><X size={18} /></button>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center text-center text-muted">
          <X size={32} className="text-rose-500 mb-2" />
          <span className="text-[13px] font-bold">Phòng đã bị xóa hoặc không có quyền truy cập.</span>
        </div>
      </div>
    );
  }

  const { primaryStatus, warnings, paymentStatus, tempResidenceStatus, remainingContractDays, currentOccupants } = roomVM;
  const statusConfig = PRIMARY_STATUS_CONFIG[primaryStatus] || PRIMARY_STATUS_CONFIG.unknown;
  const activeRent = room.contract?.rentPrice && room.contract.rentPrice > 0 ? room.contract.rentPrice : undefined;

  // Compile occupants names list
  const occupantsList: string[] = [];
  if (room.tenant) {
    occupantsList.push(room.tenant.name);
    if (room.roommates) {
      room.roommates.forEach(rm => occupantsList.push(rm.name));
    }
  } else if (room.sharedTenants && room.sharedTenants.length > 0) {
    room.sharedTenants.forEach(st => occupantsList.push(st.name));
  }

  return (
    <>
      {/* Background shadow click overlay to close (reduced opacity to 0.15) */}
      <div className="fixed inset-0 bg-black/15 backdrop-blur-[1px] z-[990]" onClick={onClose} />
      
      {/* Right Drawer Panel Container (width expanded to 440px) */}
      <div className="fixed inset-y-0 right-0 w-full sm:w-[440px] bg-card border-l border-border/80 shadow-2xl z-[1000] flex flex-col overflow-hidden animate-in slide-in-from-right duration-250 select-none">
        
        {/* Drawer Header */}
        <div className="flex items-center justify-between p-5 border-b border-border/40 bg-black/[0.01] dark:bg-white/[0.01] shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-[18px] text-text tracking-tight">{formatRoomCompactName(room)}</h2>
            <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${statusConfig.solidBg}`}>
              {statusConfig.label}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg border border-border/60 hover:bg-slate-50 dark:hover:bg-white/5 text-muted hover:text-text transition-colors focus:ring-2 focus:ring-primary focus:outline-none"
            aria-label="Đóng Drawer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable Drawer Body Content */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 scrollbar-hide">
          
          {/* Section A: Secondary Alerts list banner */}
          {warnings.length > 0 && (
            <div className="flex flex-col gap-2">
              {warnings.map((w, index) => {
                const config = WARNING_CONFIG[w.id];
                if (!config) return null;
                return (
                  <div key={index} className={`flex items-start gap-2.5 p-3 rounded-xl ${config.bg}`}>
                    <config.Icon size={16} className="mt-0.5 shrink-0" />
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[11px] font-bold uppercase tracking-wider">{config.label}</span>
                      <span className="text-[11px] opacity-90 leading-normal">{w.message}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Section B: Rent Cost & Contract Period (Dividers instead of boxed cards) */}
          <div className="flex flex-col pb-5 border-b border-border/40 gap-3.5">
            <h3 className="text-[13px] font-semibold text-text">
              Thông tin thuê phòng
            </h3>

            <div className="flex justify-between items-baseline text-[13px]">
              <span className="text-muted font-medium">Giá thuê tháng:</span>
              <span className="text-[16px] font-semibold text-indigo-500">
                {activeRent ? `${formatMoney(activeRent)}` : "Thiết lập khi khách vào ở"}
              </span>
            </div>

            <div className="flex justify-between items-center text-[13px]">
              <span className="text-muted font-medium">Tiền đặt cọc:</span>
              <span className="font-semibold text-text">
                {room.contract?.deposit ? formatMoney(room.contract.deposit) : "Chưa đóng cọc"}
              </span>
            </div>

            {room.contract && (
              <div className="flex flex-col gap-2 pt-2">
                <div className="flex justify-between items-center text-[13px]">
                  <span className="text-muted font-medium">Thời hạn hợp đồng:</span>
                  <span className="font-semibold text-text flex items-center gap-1">
                    <Calendar size={13} className="text-muted" />
                    {dayjs(room.contract.startDate).format("DD/MM/YYYY")} - {dayjs(room.contract.endDate).format("DD/MM/YYYY")}
                  </span>
                </div>
                {remainingContractDays !== undefined && (
                  <div className="flex justify-between items-center text-[13px]">
                    <span className="text-muted font-medium">Thời gian còn lại:</span>
                    <span className={`font-semibold uppercase text-[12px] ${
                      remainingContractDays <= 15 
                        ? "text-rose-500" 
                        : remainingContractDays <= 30 
                        ? "text-amber-500" 
                        : "text-emerald-500"
                    }`}>
                      Còn {remainingContractDays} ngày
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Section C: Main Tenant profile (Dividers instead of boxed cards) */}
          <div className="flex flex-col pb-5 border-b border-border/40 gap-3.5">
            <h3 className="text-[13px] font-semibold text-text">
              Khách thuê chính
            </h3>

            {room.tenant ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                    <User size={16} />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-semibold text-[14px] text-text">{room.tenant.name}</span>
                    <span className="text-[11px] font-semibold text-emerald-500 uppercase tracking-wider">Đang ở</span>
                  </div>
                </div>

                <div className="flex flex-col gap-2 pt-1 text-[13px] text-text">
                  <div className="flex items-center gap-2">
                    <Phone size={13} className="text-muted" />
                    {room.tenant.phone}
                  </div>
                  {room.tenant.email && (
                    <div className="flex items-center gap-2">
                      <Mail size={13} className="text-muted" />
                      {room.tenant.email}
                    </div>
                  )}
                  {room.tenant.cccd && (
                    <div className="flex items-center gap-2">
                      <FileText size={13} className="text-muted" />
                      CCCD: {room.tenant.cccd}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="py-2 text-muted text-[13px]">
                Chưa có khách thuê chính
              </div>
            )}
          </div>

          {/* Section D: Occupants names inventory (Dividers instead of boxed cards) */}
          <div className="flex flex-col pb-5 border-b border-border/40 gap-3.5">
            <div className="flex justify-between items-center">
              <h3 className="text-[13px] font-semibold text-text">
                Danh sách cư dân
              </h3>
              <span className="text-[11px] font-semibold text-text bg-background border border-border px-1.5 py-0.5 rounded">
                {currentOccupants} / {room.capacity || 2} người
              </span>
            </div>

            {occupantsList.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {occupantsList.map((name, index) => (
                  <div 
                    key={index} 
                    className="flex items-center gap-1 bg-background border border-border/40 rounded-lg px-2.5 py-1 text-[12px] font-semibold text-text"
                  >
                    <User size={11} className="text-muted" />
                    {name}
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-2 text-muted text-[13px]">
                Phòng trống
              </div>
            )}
          </div>

          {/* Section E: Operational status checkers (Dividers instead of boxed cards) */}
          <div className="flex flex-col pb-5 border-b border-border/40 gap-3.5">
            <h3 className="text-[13px] font-semibold text-text">
              Trạng thái vận hành
            </h3>

            <div className="flex justify-between items-center text-[13px]">
              <span className="text-muted font-medium">Thanh toán hóa đơn:</span>
              <span className={`font-semibold uppercase text-[12px] flex items-center gap-1 ${
                paymentStatus === "overdue" 
                  ? "text-rose-500" 
                  : paymentStatus === "due" 
                  ? "text-amber-500" 
                  : paymentStatus === "paid" 
                  ? "text-emerald-500" 
                  : "text-muted"
              }`}>
                <CreditCard size={13} />
                {paymentStatus === "overdue" 
                  ? "Quá hạn thu" 
                  : paymentStatus === "due" 
                  ? "Chờ thanh toán" 
                  : paymentStatus === "paid" 
                  ? "Đã thanh toán" 
                  : "Chưa xác định"}
              </span>
            </div>

            <div className="flex justify-between items-center text-[13px]">
              <span className="text-muted font-medium">Khai báo tạm trú:</span>
              <span className={`font-semibold uppercase text-[12px] flex items-center gap-1 ${
                tempResidenceStatus === "declared" 
                  ? "text-emerald-500" 
                  : tempResidenceStatus === "missing" 
                  ? "text-rose-500" 
                  : tempResidenceStatus === "partial" 
                  ? "text-amber-500" 
                  : "text-muted"
              }`}>
                <ShieldAlert size={13} />
                {tempResidenceStatus === "declared" 
                  ? "Đã hoàn tất" 
                  : tempResidenceStatus === "missing" 
                  ? "Chưa khai báo" 
                  : tempResidenceStatus === "partial" 
                  ? "Khai báo thiếu" 
                  : "Chưa xác định"}
              </span>
            </div>
          </div>

          {/* Danger Area (moved out of actions footer to end of scroll) */}
          <div className="flex flex-col gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                if (confirm("Bạn có chắc chắn muốn xóa phòng này? Toàn bộ hợp đồng, hóa đơn và cư dân liên quan sẽ bị xóa.")) {
                  onDeleteRoom(roomId);
                  onClose();
                }
              }}
              className="text-[12px] font-semibold text-rose-500 hover:text-rose-600 transition-colors flex items-center gap-1 w-fit focus:outline-none focus:underline"
            >
              <Trash2 size={12} />
              Xóa phòng khỏi hệ thống
            </button>
          </div>

        </div>

        {/* Sticky Actions Footer */}
        <div className="border-t border-border/40 p-5 bg-card flex flex-col gap-3 shrink-0">
          <button
            type="button"
            onClick={() => onOpenRoomModal(roomId, "overview")}
            className="w-full flex items-center justify-center gap-1.5 bg-primary hover:bg-primary/95 text-white font-semibold rounded-xl py-2.5 text-[13px] transition-colors shadow-sm focus:ring-2 focus:ring-primary focus:outline-none"
          >
            <Eye size={14} />
            Xem hồ sơ phòng
          </button>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => onOpenRoomModal(roomId, "finances")}
              className="flex items-center justify-center gap-1.5 bg-background hover:bg-slate-50 dark:hover:bg-white/5 border border-border rounded-xl py-2.5 text-[12px] font-semibold text-text transition-colors shadow-sm focus:ring-2 focus:ring-primary focus:outline-none"
            >
              <CreditCard size={13} />
              Tạo hóa đơn
            </button>
            <button
              type="button"
              onClick={() => onOpenRoomModal(roomId, "rental_flow")}
              className="flex items-center justify-center gap-1.5 bg-background hover:bg-slate-50 dark:hover:bg-white/5 border border-border rounded-xl py-2.5 text-[12px] font-semibold text-text transition-colors shadow-sm focus:ring-2 focus:ring-primary focus:outline-none"
            >
              <Plus size={13} />
              Đăng ký khách ở
            </button>
          </div>
        </div>

      </div>
    </>
  );
}
