import React from "react";
import { UserCheck, DoorOpen, CalendarClock, Wrench, Sparkles, AlertCircle } from "lucide-react";

export default function RoomStatusSummary() {
  return (
    <div className="grid grid-cols-3 xl:grid-cols-6 gap-[10px] md:gap-[16px]">
      <StatusCard 
        title="Đang thuê" 
        count="145" 
        color="bg-[#22c55e]/10 text-[#22c55e]"
        icon={<UserCheck size={18} />}
        borderColor="border-border"
        hoverBorder="hover:border-[#22c55e]/50"
      />
      <StatusCard 
        title="Trống" 
        count="23" 
        color="bg-muted/10 text-muted"
        icon={<DoorOpen size={18} />}
        borderColor="border-border"
        hoverBorder="hover:border-muted/50"
      />
      <StatusCard 
        title="Đặt cọc" 
        count="8" 
        color="bg-[#3b82f6]/10 text-[#3b82f6]"
        icon={<CalendarClock size={18} />}
        borderColor="border-border"
        hoverBorder="hover:border-[#3b82f6]/50"
      />
      <StatusCard 
        title="Sắp hết hạn" 
        count="5" 
        color="bg-[#f97316]/10 text-[#f97316]"
        icon={<AlertCircle size={18} />}
        borderColor="border-border"
        hoverBorder="hover:border-[#f97316]/50"
      />
      <StatusCard 
        title="Đang dọn" 
        count="4" 
        color="bg-[#a855f7]/10 text-[#a855f7]"
        icon={<Sparkles size={18} />}
        borderColor="border-border"
        hoverBorder="hover:border-[#a855f7]/50"
      />
      <StatusCard 
        title="Bảo trì" 
        count="2" 
        color="bg-[#ef4444]/10 text-[#ef4444]"
        icon={<Wrench size={18} />}
        borderColor="border-border"
        hoverBorder="hover:border-[#ef4444]/50"
      />
    </div>
  );
}

function StatusCard({ title, count, color, icon, borderColor, hoverBorder }: any) {
  return (
    <div className={`bg-card border ${borderColor} rounded-[12px] md:rounded-[16px] h-[64px] md:h-[86px] p-[8px] md:p-[16px] flex flex-col justify-between shadow-sm hover:shadow-md hover:-translate-y-[3px] ${hoverBorder} transition-all duration-150 cursor-pointer relative overflow-hidden z-0`}>
      <div className="flex justify-between items-start gap-1">
        <span className="text-[9px] md:text-[12px] font-bold text-muted uppercase tracking-wider line-clamp-1 leading-tight">{title}</span>
        <div className={`w-[18px] h-[18px] md:w-[24px] md:h-[24px] rounded-[4px] md:rounded-[6px] flex items-center justify-center shrink-0 ${color}`}>
          <div className="md:hidden">
            {React.cloneElement(icon as React.ReactElement, { size: 10 })}
          </div>
          <div className="hidden md:block">
            {React.cloneElement(icon as React.ReactElement, { size: 14 })}
          </div>
        </div>
      </div>
      <div className="flex items-end justify-between">
        <span className="font-black text-[16px] md:text-[22px] text-text leading-none">{count}</span>
      </div>
    </div>
  );
}
