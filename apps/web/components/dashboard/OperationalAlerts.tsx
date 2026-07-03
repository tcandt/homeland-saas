"use client";

import React, { useMemo } from "react";
import { masterBuildings } from "../buildings/mockData";
import { FileWarning, ShieldAlert, DoorOpen, Wrench, AlertTriangle, ChevronRight } from "lucide-react";

export default function OperationalAlerts() {
  const alerts = useMemo(() => {
    const expiringContracts: { room: string; building: string }[] = [];
    const missingTempRes: { room: string; building: string; tenantName: string }[] = [];
    const vacantRooms: { room: string; building: string }[] = [];
    const maintenanceRooms: { room: string; building: string }[] = [];
    const overdueRooms: { room: string; building: string; amount: number }[] = [];

    masterBuildings.forEach(b => {
      b.floors.forEach(f => {
        f.rooms.forEach(r => {
          if (r.status === "expiring_soon") expiringContracts.push({ room: r.number, building: b.name });
          if (r.status === "vacant") vacantRooms.push({ room: r.number, building: b.name });
          if (r.status === "maintenance") maintenanceRooms.push({ room: r.number, building: b.name });
          
          if (r.rentalType === "whole") {
            if (r.tenant && !r.tenant.tempResidence) {
              missingTempRes.push({ room: r.number, building: b.name, tenantName: r.tenant.name });
            }
            r.roommates?.forEach(rm => {
              if (!rm.tempResidence) missingTempRes.push({ room: r.number, building: b.name, tenantName: rm.name });
            });
            if (r.debt && r.debt > 0) overdueRooms.push({ room: r.number, building: b.name, amount: r.debt });
          } else {
            r.sharedTenants?.forEach(st => {
              if (!st.tempResidence) missingTempRes.push({ room: `${r.number} - ${st.bedPosition}`, building: b.name, tenantName: st.name });
              if (st.debt && st.debt > 0) overdueRooms.push({ room: `${r.number} - ${st.bedPosition}`, building: b.name, amount: st.debt });
            });
          }
        });
      });
    });

    return { expiringContracts, missingTempRes, vacantRooms, maintenanceRooms, overdueRooms };
  }, []);

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
      {/* 1. Expiring Contracts */}
      <div className="bg-card border border-border rounded-[16px] p-4 flex flex-col hover:border-orange-500/50 cursor-pointer transition-colors group">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-orange-500/10 text-orange-500 flex items-center justify-center">
            <FileWarning size={16} />
          </div>
          <span className="font-bold text-[13px] text-text">Sắp hết hạn HĐ</span>
        </div>
        <div className="flex items-end justify-between mt-auto">
          <span className="font-black text-[28px] leading-none text-text">{alerts.expiringContracts.length}</span>
          <span className="text-[12px] font-bold text-orange-500 flex items-center group-hover:underline">Chi tiết <ChevronRight size={14}/></span>
        </div>
      </div>

      {/* 2. Missing Temp Residence */}
      <div className="bg-card border border-border rounded-[16px] p-4 flex flex-col hover:border-rose-500/50 cursor-pointer transition-colors group">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center">
            <ShieldAlert size={16} />
          </div>
          <span className="font-bold text-[13px] text-text">Chưa ĐK tạm trú</span>
        </div>
        <div className="flex items-end justify-between mt-auto">
          <span className="font-black text-[28px] leading-none text-text">{alerts.missingTempRes.length}</span>
          <span className="text-[12px] font-bold text-rose-500 flex items-center group-hover:underline">Chi tiết <ChevronRight size={14}/></span>
        </div>
      </div>

      {/* 3. Vacant Rooms */}
      <div className="bg-card border border-border rounded-[16px] p-4 flex flex-col hover:border-text/50 cursor-pointer transition-colors group">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-black/5 dark:bg-white/5 text-text flex items-center justify-center">
            <DoorOpen size={16} />
          </div>
          <span className="font-bold text-[13px] text-text">Phòng trống</span>
        </div>
        <div className="flex items-end justify-between mt-auto">
          <span className="font-black text-[28px] leading-none text-text">{alerts.vacantRooms.length}</span>
          <span className="text-[12px] font-bold text-text flex items-center group-hover:underline">Chi tiết <ChevronRight size={14}/></span>
        </div>
      </div>

      {/* 4. Maintenance */}
      <div className="bg-card border border-border rounded-[16px] p-4 flex flex-col hover:border-blue-500/50 cursor-pointer transition-colors group">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center">
            <Wrench size={16} />
          </div>
          <span className="font-bold text-[13px] text-text">Đang bảo trì</span>
        </div>
        <div className="flex items-end justify-between mt-auto">
          <span className="font-black text-[28px] leading-none text-text">{alerts.maintenanceRooms.length}</span>
          <span className="text-[12px] font-bold text-blue-500 flex items-center group-hover:underline">Chi tiết <ChevronRight size={14}/></span>
        </div>
      </div>

      {/* 5. Overdue Debt Alert */}
      <div className="bg-card border border-border rounded-[16px] p-4 flex flex-col hover:border-rose-500/50 cursor-pointer transition-colors group relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[100px] h-[100px] bg-rose-500/10 rounded-full blur-[30px] -z-10" />
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center">
            <AlertTriangle size={16} />
          </div>
          <span className="font-bold text-[13px] text-text">Khách nợ tiền</span>
        </div>
        <div className="flex items-end justify-between mt-auto">
          <span className="font-black text-[28px] leading-none text-text">{alerts.overdueRooms.length}</span>
          <span className="text-[12px] font-bold text-rose-500 flex items-center group-hover:underline">Xử lý ngay <ChevronRight size={14}/></span>
        </div>
      </div>

    </div>
  );
}
