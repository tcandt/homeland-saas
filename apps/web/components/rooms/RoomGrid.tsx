"use client";

import React from "react";
import { User, FileText, Receipt, Shield, CheckCircle2, Clock, MapPin, MoreHorizontal, AlertCircle, Wrench, Edit } from "lucide-react";

import { useRoomsQuery } from "@/lib/queries/rooms.queries";
import { useRoomsStore } from "@/lib/hooks/useRoomsStore";
import { Loader2 } from "lucide-react";
import { getRoomDisplayName } from "@/components/buildings/building-labels";

const formatMoney = (amount: number) => {
  return new Intl.NumberFormat("vi-VN").format(amount) + " đ";
};

export default function RoomGrid() {
  const { search, buildingId, floorId, status, type } = useRoomsStore();
  
  const { data: rooms = [], isLoading, isError } = useRoomsQuery({
    search: search || undefined,
    buildingId: buildingId !== 'Tất cả' && buildingId ? buildingId : undefined,
    floorId: floorId !== 'Tất cả' && floorId ? floorId : undefined,
    status: status !== 'Tất cả' && status ? status : undefined,
  });

  if (isLoading) {
    return (
      <div className="flex w-full items-center justify-center p-10">
        <Loader2 className="w-8 h-8 text-[#6366f1] animate-spin" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex w-full items-center justify-center p-10 text-rose-500 font-medium">
        Có lỗi xảy ra khi tải danh sách phòng.
      </div>
    );
  }

  if (rooms.length === 0) {
    return (
      <div className="flex w-full items-center justify-center p-10 text-muted font-medium">
        Không tìm thấy phòng nào phù hợp.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-[12px] md:gap-[20px]" style={{ gridTemplateColumns: typeof window !== 'undefined' && window.innerWidth >= 768 ? 'repeat(auto-fit, minmax(360px, 1fr))' : undefined }}>
      {rooms.map((room: any) => (
        <RoomCard key={room.id} room={room} />
      ))}
    </div>
  );
}

function RoomCard({ room }: { room: any }) {
  const getStatusConfig = (status: any) => {
    switch (status) {
      case "occupied": return { label: "Đang thuê", bg: "bg-[#22c55e]/10", text: "text-[#22c55e]", border: "border-[#22c55e]/20" };
      case "vacant": return { label: "Trống", bg: "bg-muted/10", text: "text-muted", border: "border-border" };
      case "deposited": return { label: "Đặt cọc", bg: "bg-[#3b82f6]/10", text: "text-[#3b82f6]", border: "border-[#3b82f6]/20" };
      case "expiring_soon": return { label: "Sắp hết hạn", bg: "bg-[#f97316]/10", text: "text-[#f97316]", border: "border-[#f97316]/20" };
      case "overdue": return { label: "Quá hạn", bg: "bg-[#ef4444]/10", text: "text-[#ef4444]", border: "border-[#ef4444]/20" };
      case "maintenance": return { label: "Bảo trì", bg: "bg-[#a855f7]/10", text: "text-[#a855f7]", border: "border-[#a855f7]/20" };
      default: return { label: "Không rõ", bg: "bg-gray-100", text: "text-gray-500", border: "border-gray-200" };
    }
  };

  const statusConfig = getStatusConfig(room.status) || { label: "Không rõ", bg: "bg-gray-100", text: "text-gray-500", border: "border-gray-200" };

  return (
    <div className="bg-card border border-border rounded-[16px] md:rounded-[20px] shadow-sm hover:shadow-md hover:-translate-y-[3px] hover:border-[#6366f1] transition-all duration-150 relative group overflow-hidden flex flex-col h-[180px] md:h-[210px]">
      
      {/* Top Header */}
      <div className="flex items-center justify-between p-[12px] md:p-[16px] md:px-[20px] pb-0">
        <div className="flex items-end gap-[6px] md:gap-[8px]">
          <h3 className="font-black text-[22px] md:text-[24px] lg:text-[28px] text-text leading-none tracking-tight">P.{getRoomDisplayName(room)}</h3>
          <span className="text-[12px] md:text-[13px] font-bold text-muted mb-[1px] md:mb-[2px]">{room.type}</span>
        </div>
        <div className={`px-[8px] md:px-[10px] py-[3px] md:py-[4px] rounded-[6px] text-[10px] md:text-[11px] font-black uppercase tracking-wider ${statusConfig.bg} ${statusConfig.text}`}>
          {statusConfig.label}
        </div>
      </div>

      {/* Content Body */}
      <div className="p-[12px] md:p-[16px] md:px-[20px] flex-1 flex flex-col">
        {/* Row 1: Tenant & People */}
        <div className="flex items-center justify-between mb-[10px] md:mb-[12px]">
          <div className="flex items-center gap-[4px] md:gap-[6px]">
            <User size={14} className={room.tenant?.name ? "text-[#6366f1]" : "text-muted opacity-40"} />
            {room.tenant?.name ? (
              <span className="font-bold text-[13px] md:text-[14px] text-text">{room.tenant.name}</span>
            ) : (
              <span className="font-medium text-[12px] md:text-[13px] text-muted italic">Chưa có khách</span>
            )}
          </div>
          {room.capacity !== undefined && (
            <div className="text-[11px] md:text-[12px] font-bold text-muted bg-black/5 dark:bg-white/5 px-1.5 md:px-2 py-0.5 rounded-[4px]">
              {room.tenant ? (room.roommates?.length + 1) : 0}/{room.capacity} người
            </div>
          )}
        </div>

        {/* Row 2: Financials Grid */}
        <div className="grid grid-cols-3 gap-[6px] md:gap-[8px] mb-[10px] md:mb-[12px] border-t border-b border-border/40 py-[8px] md:py-[10px]">
          <div className="flex flex-col">
            <span className="text-[9px] md:text-[10px] font-bold text-muted uppercase tracking-wider">Tiền phòng</span>
            <span className="font-black text-[13px] md:text-[14px] text-text">
              {room.contract?.rentPrice ? formatMoney(room.contract.rentPrice) : '-'}
            </span>
          </div>
          <div className="flex flex-col border-l border-border/40 pl-[6px] md:pl-[8px]">
            <span className="text-[9px] md:text-[10px] font-bold text-muted uppercase tracking-wider">Tiền cọc</span>
            <span className="font-bold text-[12px] md:text-[13px] text-text">{room.contract?.deposit ? formatMoney(room.contract.deposit) : '-'}</span>
          </div>
          <div className="flex flex-col border-l border-border/40 pl-[6px] md:pl-[8px]">
            <span className="text-[9px] md:text-[10px] font-bold text-muted uppercase tracking-wider">Công nợ</span>
            <span className={`font-black text-[13px] md:text-[14px] ${room.debt && room.debt > 0 ? 'text-rose-500' : 'text-indigo-500'}`}>
              {room.debt !== undefined ? formatMoney(room.debt) : '-'}
            </span>
          </div>
        </div>

        {/* Row 3: Meta info */}
        <div className="flex items-center justify-between mt-auto text-[11px] font-medium text-muted">
          {room.contractDays !== undefined ? (
            <div className="flex items-center gap-[4px]">
              <FileText size={12} />
              <span>Hợp đồng còn <strong className={room.contractDays <= 30 ? "text-orange-500 font-bold" : "text-text font-bold"}>{room.contractDays} ngày</strong></span>
            </div>
          ) : (
            <div className="flex items-center gap-[4px] opacity-0"><FileText size={12} /><span>Trống</span></div>
          )}

          {room.tempResidenceStatus && (
            <div className="flex items-center gap-[4px]">
              <Shield size={12} className={room.tempResidenceStatus === 'declared' ? "text-indigo-500" : "text-rose-500"} />
              <span className={room.tempResidenceStatus === 'declared' ? "text-text" : "text-rose-500 font-bold"}>
                {room.tempResidenceStatus === 'declared' ? "Đã khai báo" : "Chưa khai báo"}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions Hover Overlay */}
      <div className="absolute inset-0 bg-card/60 backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col justify-center items-center z-10 rounded-[16px] md:rounded-[20px] border border-border/50">
        <div className="grid grid-cols-3 gap-[10px] p-[20px] w-full max-w-[320px] scale-95 group-hover:scale-100 transition-transform duration-300">
          <QuickActionButton icon={<User size={18} />} label="Khách" color="text-[#3b82f6]" bg="bg-[#3b82f6]/10" hoverBg="hover:bg-[#3b82f6]/20" />
          <QuickActionButton icon={<FileText size={18} />} label="Hợp đồng" color="text-[#8b5cf6]" bg="bg-[#8b5cf6]/10" hoverBg="hover:bg-[#8b5cf6]/20" />
          <QuickActionButton icon={<Receipt size={18} />} label="Hóa đơn" color="text-[#f97316]" bg="bg-[#f97316]/10" hoverBg="hover:bg-[#f97316]/20" />
          <QuickActionButton icon={<CheckCircle2 size={18} />} label="Thu tiền" color="text-[#22c55e]" bg="bg-[#22c55e]/10" hoverBg="hover:bg-[#22c55e]/20" />
          <QuickActionButton icon={<Wrench size={18} />} label="Bảo trì" color="text-[#a855f7]" bg="bg-[#a855f7]/10" hoverBg="hover:bg-[#a855f7]/20" />
          <QuickActionButton icon={<Edit size={18} />} label="Sửa" color="text-muted" bg="bg-muted/10" hoverBg="hover:bg-muted/20" />
        </div>
      </div>
      
      {/* Mobile click area fallback */}
      <a href="#" className="absolute inset-0 z-0 md:hidden" aria-label="View room"></a>
    </div>
  );
}

function QuickActionButton({ icon, label, color, bg, hoverBg }: any) {
  return (
    <button className={`flex flex-col items-center justify-center gap-[6px] h-[68px] rounded-[14px] ${bg} ${hoverBg} transition-all duration-200 cursor-pointer shadow-sm hover:-translate-y-1`}>
      <div className={`${color}`}>{icon}</div>
      <span className={`text-[11px] font-bold tracking-wide ${color}`}>{label}</span>
    </button>
  );
}
