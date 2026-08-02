"use client";

import React, { useMemo } from "react";
import { FileWarning, ShieldAlert, DoorOpen, Wrench, AlertTriangle, ChevronRight, Loader2 } from "lucide-react";
import { useRoomsQuery } from "@/lib/queries/rooms.queries";

export default function OperationalAlerts() {
  const { data: roomsData, isLoading } = useRoomsQuery({ limit: 100 });

  const alerts = useMemo(() => {
    const rooms = (roomsData as any)?.data?.items || (roomsData as any)?.data || [];
    const expiringContracts: { room: string; building: string }[] = [];
    const missingTempRes: { room: string; building: string; tenantName: string }[] = [];
    const vacantRooms: { room: string; building: string }[] = [];
    const maintenanceRooms: { room: string; building: string }[] = [];
    const overdueRooms: { room: string; building: string; amount: number }[] = [];

    rooms.forEach((room: any) => {
      const building = room.building?.name || room.buildingName || "Chưa rõ tòa nhà";
      if (room.status === "vacant") vacantRooms.push({ room: room.code || room.number, building });
      if (room.status === "maintenance") maintenanceRooms.push({ room: room.code || room.number, building });
      if (room.status === "occupied" || room.status === "expiring_soon") {
        const endDate = room.contract?.endDate;
        if (endDate) {
          const daysLeft = Math.ceil((new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          if (daysLeft >= 0 && daysLeft <= 30) expiringContracts.push({ room: room.code || room.number, building });
        }
      }

      if (room.rentalType === "whole") {
        if (room.tenant && !room.tenant.tempResidence) {
          missingTempRes.push({ room: room.code || room.number, building, tenantName: room.tenant.name });
        }
        if (room.debt && room.debt > 0) overdueRooms.push({ room: room.code || room.number, building, amount: room.debt });
      } else {
        room.sharedTenants?.forEach((st: any) => {
          if (!st.tempResidence) missingTempRes.push({ room: `${room.code || room.number} - ${st.bedPosition || ""}`.trim(), building, tenantName: st.name });
          if (st.debt && st.debt > 0) overdueRooms.push({ room: `${room.code || room.number} - ${st.bedPosition || ""}`.trim(), building, amount: st.debt });
        });
      }
    });

    return { expiringContracts, missingTempRes, vacantRooms, maintenanceRooms, overdueRooms };
  }, [roomsData]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="col-span-full flex items-center justify-center py-6 text-muted">
          <Loader2 className="w-4 h-4 animate-spin mr-2" /> Đang tải cảnh báo...
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
      <AlertCard icon={<FileWarning size={16} />} iconBg="bg-orange-500/10 text-orange-500" title="Sắp hết hạn HĐ" count={alerts.expiringContracts.length} countColor="text-text" actionLabel="Chi tiết" actionColor="text-orange-500" />
      <AlertCard icon={<ShieldAlert size={16} />} iconBg="bg-rose-500/10 text-rose-500" title="Chưa ĐK tạm trú" count={alerts.missingTempRes.length} countColor="text-text" actionLabel="Chi tiết" actionColor="text-rose-500" />
      <AlertCard icon={<DoorOpen size={16} />} iconBg="bg-black/5 dark:bg-white/5 text-text" title="Phòng trống" count={alerts.vacantRooms.length} countColor="text-text" actionLabel="Chi tiết" actionColor="text-text" />
      <AlertCard icon={<Wrench size={16} />} iconBg="bg-blue-500/10 text-blue-500" title="Đang bảo trì" count={alerts.maintenanceRooms.length} countColor="text-text" actionLabel="Chi tiết" actionColor="text-blue-500" />
      <AlertCard icon={<AlertTriangle size={16} />} iconBg="bg-rose-500/10 text-rose-500" title="Khách nợ tiền" count={alerts.overdueRooms.length} countColor="text-text" actionLabel="Xử lý ngay" actionColor="text-rose-500" />
    </div>
  );
}

function AlertCard({ icon, iconBg, count, title, countColor, actionLabel, actionColor }: any) {
  return (
    <div className="bg-card border border-border rounded-[16px] p-4 flex flex-col hover:border-primary/30 cursor-pointer transition-colors group">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${iconBg}`}>
          {icon}
        </div>
        <span className="font-bold text-[13px] text-text">{title}</span>
      </div>
      <div className="flex items-end justify-between mt-auto">
        <span className={`font-black text-[28px] leading-none ${countColor}`}>{count}</span>
        <span className={`text-[12px] font-bold flex items-center group-hover:underline ${actionColor}`}>{actionLabel} <ChevronRight size={14} /></span>
      </div>
    </div>
  );
}
