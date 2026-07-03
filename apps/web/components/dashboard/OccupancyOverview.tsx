"use client";

import React, { useMemo } from "react";
import { masterBuildings } from "../buildings/mockData";

export default function OccupancyOverview() {
  const stats = useMemo(() => {
    let total = 0;
    let occupied = 0;
    let vacant = 0;
    let deposited = 0;
    let maintenance = 0;
    let shared = 0;
    
    masterBuildings.forEach(b => {
      b.floors.forEach(f => {
        f.rooms.forEach(r => {
          total++;
          if (r.status === "occupied" || r.status === "expiring_soon") occupied++;
          else if (r.status === "vacant") vacant++;
          else if (r.status === "deposited") deposited++;
          else if (r.status === "maintenance") maintenance++;
          
          if (r.rentalType === "shared") shared++;
        });
      });
    });

    const occupancyRate = total > 0 ? Math.round((occupied / total) * 100) : 0;
    return { total, occupied, vacant, deposited, maintenance, shared, occupancyRate };
  }, []);

  return (
    <div className="bg-card border border-border rounded-[16px] p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center gap-8">
      
      {/* Chart/Big Number */}
      <div className="flex flex-col items-center justify-center w-[120px] shrink-0">
        <div className="relative w-[100px] h-[100px] rounded-full flex items-center justify-center border-[8px] border-emerald-500/20">
          <svg className="absolute inset-0 w-full h-full -rotate-90">
            <circle 
              cx="50" cy="50" r="46" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="8" 
              className="text-emerald-500"
              strokeDasharray={`${(stats.occupancyRate / 100) * 289} 289`}
            />
          </svg>
          <div className="flex flex-col items-center justify-center">
            <span className="font-black text-[22px] text-text">{stats.occupancyRate}%</span>
            <span className="text-[10px] uppercase font-bold text-muted">Lấp đầy</span>
          </div>
        </div>
      </div>

      {/* Grid Stats */}
      <div className="flex-1 grid grid-cols-2 md:grid-cols-3 gap-4 w-full">
        <div className="bg-black/5 dark:bg-white/5 rounded-[12px] p-4 flex flex-col gap-1">
          <span className="text-[11px] font-bold uppercase text-muted">Tổng số phòng</span>
          <span className="font-black text-[20px] text-text">{stats.total}</span>
        </div>
        <div className="bg-emerald-500/10 rounded-[12px] p-4 flex flex-col gap-1">
          <span className="text-[11px] font-bold uppercase text-emerald-600 dark:text-emerald-500">Đang thuê</span>
          <span className="font-black text-[20px] text-emerald-600 dark:text-emerald-500">{stats.occupied}</span>
        </div>
        <div className="bg-rose-500/10 rounded-[12px] p-4 flex flex-col gap-1">
          <span className="text-[11px] font-bold uppercase text-rose-500">Trống</span>
          <span className="font-black text-[20px] text-rose-500">{stats.vacant}</span>
        </div>
        <div className="bg-purple-500/10 rounded-[12px] p-4 flex flex-col gap-1">
          <span className="text-[11px] font-bold uppercase text-purple-500">Đã cọc</span>
          <span className="font-black text-[20px] text-purple-500">{stats.deposited}</span>
        </div>
        <div className="bg-blue-500/10 rounded-[12px] p-4 flex flex-col gap-1">
          <span className="text-[11px] font-bold uppercase text-blue-500">Bảo trì</span>
          <span className="font-black text-[20px] text-blue-500">{stats.maintenance}</span>
        </div>
        <div className="bg-orange-500/10 rounded-[12px] p-4 flex flex-col gap-1">
          <span className="text-[11px] font-bold uppercase text-orange-500">Phòng ở ghép</span>
          <span className="font-black text-[20px] text-orange-500">{stats.shared}</span>
        </div>
      </div>

    </div>
  );
}
