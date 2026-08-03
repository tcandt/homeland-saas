"use client";

import React, { useMemo } from "react";
import type { Building } from "../building.types";
import { CreditCard, Home, ShieldCheck, ShieldAlert, UserCheck } from "lucide-react";

interface BuildingKpiRowProps {
  building: Building;
}

export default function BuildingKpiRow({ building }: BuildingKpiRowProps) {
  const stats = useMemo(() => {
    let totalRooms = 0;
    let occupiedRooms = 0;
    let vacantRooms = 0;
    let depositedRooms = 0;
    let maintenanceRooms = 0;
    let expiringRooms = 0;
    
    let totalRevenue = 0;
    let totalDeposit = 0;
    let residentCount = 0;
    let totalResidentsWithResidence = 0;

    building.floors.forEach(floor => {
      floor.rooms.forEach(room => {
        totalRooms++;
        
        if (room.status === "occupied" || room.status === "expiring_soon") occupiedRooms++;
        else if (room.status === "vacant") vacantRooms++;
        else if (room.status === "deposited") depositedRooms++;
        else if (room.status === "maintenance") maintenanceRooms++;

        // Sync revenue
        if (room.rentalType === "whole") {
          if (room.contract) {
            totalRevenue += room.contract.rentPrice || room.monthlyPrice || 0;
            totalDeposit += room.contract.deposit || 0;
          }
          if (room.tenant) {
            residentCount += 1 + (room.roommates?.length || 0);
            if (room.tenant.tempResidence) totalResidentsWithResidence++;
            (room.roommates || []).forEach(rm => {
              if (rm.tempResidence) totalResidentsWithResidence++;
            });
          }
        }
      });
    });

    const tempResidencePercent = residentCount > 0 
      ? Math.round((totalResidentsWithResidence / residentCount) * 100) 
      : 100;

    return {
      totalRooms,
      occupiedRooms,
      vacantRooms,
      depositedRooms,
      maintenanceRooms,
      expiringRooms,
      totalRevenue,
      tempResidencePercent
    };
  }, [building]);

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(amount);
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 w-full">
      {/* 1. Revenue */}
      <div className="bg-card border border-border/40 dark:border-white/5 rounded-xl p-4 shadow-sm flex items-center gap-3 h-full transition-shadow hover:shadow-md">
        <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <CreditCard size={18} />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-[10px] font-black uppercase text-muted tracking-wider">Doanh thu dự kiến</span>
          <span className="text-[15px] font-extrabold text-text mt-0.5 truncate">{formatMoney(stats.totalRevenue)}</span>
        </div>
      </div>

      {/* 2. Occupied */}
      <div className="bg-card border border-border/40 dark:border-white/5 rounded-xl p-4 shadow-sm flex items-center gap-3 h-full transition-shadow hover:shadow-md">
        <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
          <Home size={18} />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-[10px] font-black uppercase text-muted tracking-wider">Phòng đã thuê</span>
          <span className="text-[15px] font-extrabold text-text mt-0.5">
            {stats.occupiedRooms} <span className="text-xs text-muted font-normal">/ {stats.totalRooms} phòng</span>
          </span>
        </div>
      </div>

      {/* 3. Vacant */}
      <div className="bg-card border border-border/40 dark:border-white/5 rounded-xl p-4 shadow-sm flex items-center gap-3 h-full transition-shadow hover:shadow-md">
        <div className="w-10 h-10 rounded-lg bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0">
          <ShieldCheck size={18} />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-[10px] font-black uppercase text-muted tracking-wider">Phòng còn trống</span>
          <span className="text-[15px] font-extrabold text-text mt-0.5">
            {stats.vacantRooms} <span className="text-xs text-muted font-normal">phòng trống</span>
          </span>
        </div>
      </div>

      {/* 4. Expiring Contracts */}
      <div className="bg-card border border-border/40 dark:border-white/5 rounded-xl p-4 shadow-sm flex items-center gap-3 h-full transition-shadow hover:shadow-md">
        <div className="w-10 h-10 rounded-lg bg-orange-500/10 text-orange-500 flex items-center justify-center shrink-0">
          <ShieldAlert size={18} />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-[10px] font-black uppercase text-muted tracking-wider">Sắp hết hạn cọc</span>
          <span className="text-[15px] font-extrabold text-text mt-0.5">
            0 <span className="text-xs text-muted font-normal">phòng</span>
          </span>
        </div>
      </div>

      {/* 5. Temporary Residence */}
      <div className="bg-card border border-border/40 dark:border-white/5 rounded-xl p-4 shadow-sm flex items-center gap-3 col-span-2 md:col-span-1 h-full transition-shadow hover:shadow-md">
        <div className="w-10 h-10 rounded-lg bg-violet-500/10 text-violet-500 flex items-center justify-center shrink-0">
          <UserCheck size={18} />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-[10px] font-black uppercase text-muted tracking-wider">Khai báo tạm trú</span>
          <span className="text-[15px] font-extrabold text-text mt-0.5">{stats.tempResidencePercent}% <span className="text-xs text-muted font-normal">cư dân</span></span>
        </div>
      </div>
    </div>
  );
}
