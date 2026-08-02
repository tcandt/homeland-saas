import React from "react";
import { UserCheck, DoorOpen, CalendarClock, Wrench, Sparkles, AlertCircle } from "lucide-react";
import { useRoomsQuery } from "@/lib/queries/rooms.queries";
import { Skeleton } from "../ui/Skeleton";

export default function RoomStatusSummary() {
  const { data: rooms = [], isLoading } = useRoomsQuery();

  if (isLoading) {
    return (
      <div className="grid grid-cols-3 xl:grid-cols-6 gap-[10px] md:gap-[16px]">
        {Array.from({ length: 6 }).map((_, idx) => (
          <div key={idx} className="bg-card border border-border rounded-[12px] md:rounded-[16px] h-[64px] md:h-[86px] p-[8px] md:p-[16px] flex flex-col justify-between shadow-sm">
            <div className="flex justify-between items-start gap-1">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="w-[18px] h-[18px] md:w-[24px] md:h-[24px] rounded-[6px]" />
            </div>
            <Skeleton className="h-5 w-10" />
          </div>
        ))}
      </div>
    );
  }

  const occupiedCount = rooms.filter((r: any) => r.status === "occupied").length;
  const vacantCount = rooms.filter((r: any) => r.status === "vacant").length;
  const depositedCount = rooms.filter((r: any) => r.status === "deposited").length;
  const cleaningCount = rooms.filter((r: any) => r.status === "cleaning").length;
  const maintenanceCount = rooms.filter((r: any) => r.status === "maintenance").length;
  
  const expiringCount = rooms.filter((r: any) => {
    if (!r.contract?.endDate) return false;
    const end = new Date(r.contract.endDate).getTime();
    const now = new Date().getTime();
    const daysLeft = (end - now) / (1000 * 3600 * 24);
    return daysLeft >= 0 && daysLeft <= 30;
  }).length;

  return (
    <div className="grid grid-cols-3 xl:grid-cols-6 gap-[10px] md:gap-[16px]">
      <StatusCard 
        title="Đang thuê" 
        count={occupiedCount.toString()} 
        color="bg-[#22c55e]/10 text-[#22c55e]"
        icon={<UserCheck size={18} />}
        borderColor="border-border"
        hoverBorder="hover:border-[#22c55e]/50"
      />
      <StatusCard 
        title="Trống" 
        count={vacantCount.toString()} 
        color="bg-muted/10 text-muted"
        icon={<DoorOpen size={18} />}
        borderColor="border-border"
        hoverBorder="hover:border-muted/50"
      />
      <StatusCard 
        title="Đặt cọc" 
        count={depositedCount.toString()} 
        color="bg-[#3b82f6]/10 text-[#3b82f6]"
        icon={<CalendarClock size={18} />}
        borderColor="border-border"
        hoverBorder="hover:border-[#3b82f6]/50"
      />
      <StatusCard 
        title="Sắp hết hạn" 
        count={expiringCount.toString()} 
        color="bg-[#f97316]/10 text-[#f97316]"
        icon={<AlertCircle size={18} />}
        borderColor="border-border"
        hoverBorder="hover:border-[#f97316]/50"
      />
      <StatusCard 
        title="Đang dọn" 
        count={cleaningCount.toString()} 
        color="bg-[#a855f7]/10 text-[#a855f7]"
        icon={<Sparkles size={18} />}
        borderColor="border-border"
        hoverBorder="hover:border-[#a855f7]/50"
      />
      <StatusCard 
        title="Bảo trì" 
        count={maintenanceCount.toString()} 
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
            {React.cloneElement(icon as any, { size: 10 })}
          </div>
          <div className="hidden md:block">
            {React.cloneElement(icon as any, { size: 14 })}
          </div>
        </div>
      </div>
      <div className="flex items-end justify-between">
        <span className="font-black text-[16px] md:text-[22px] text-text leading-none">{count}</span>
      </div>
    </div>
  );
}
