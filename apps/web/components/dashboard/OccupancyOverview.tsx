"use client";

import React, { useMemo } from "react";
import { useRoomsQuery } from "@/lib/queries/rooms.queries";

export default function OccupancyOverview() {
  const { data: roomsData } = useRoomsQuery({ limit: 100 });

  const stats = useMemo(() => {
    const rooms = (roomsData as any)?.data?.items || (roomsData as any)?.data || [];
    let total = 0;
    let occupied = 0;
    let vacant = 0;
    let deposited = 0;
    let maintenance = 0;
    let shared = 0;

    rooms.forEach((room: any) => {
      total += 1;
      if (room.status === "occupied" || room.status === "expiring_soon") occupied += 1;
      else if (room.status === "vacant") vacant += 1;
      else if (room.status === "deposited") deposited += 1;
      else if (room.status === "maintenance") maintenance += 1;
      if (room.rentalType === "shared") shared += 1;
    });

    const occupancyRate = total > 0 ? Math.round((occupied / total) * 100) : 0;
    return { total, occupied, vacant, deposited, maintenance, shared, occupancyRate };
  }, [roomsData]);

  return (
    <div className="bg-card border border-border rounded-[16px] p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center gap-8">
      <div className="flex flex-col items-center justify-center w-[120px] shrink-0">
        <div className="relative w-[100px] h-[100px] rounded-full flex items-center justify-center border-[8px] border-indigo-500/20">
          <svg className="absolute inset-0 w-full h-full -rotate-90">
            <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" strokeWidth="8" className="text-indigo-500" strokeDasharray={`${(stats.occupancyRate / 100) * 289} 289`} />
          </svg>
          <div className="flex flex-col items-center justify-center">
            <span className="font-black text-[22px] text-text">{stats.occupancyRate}%</span>
            <span className="text-[10px] uppercase font-bold text-muted">Lấp đầy</span>
          </div>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-2 md:grid-cols-3 gap-4 w-full">
        <Stat title="Tổng số phòng" value={stats.total} className="bg-black/5 dark:bg-white/5" />
        <Stat title="Đang thuê" value={stats.occupied} className="bg-indigo-500/10 text-indigo-600 dark:text-indigo-500" />
        <Stat title="Trống" value={stats.vacant} className="bg-rose-500/10 text-rose-500" />
        <Stat title="Đã cọc" value={stats.deposited} className="bg-indigo-500/10 text-indigo-500" />
        <Stat title="Bảo trì" value={stats.maintenance} className="bg-blue-500/10 text-blue-500" />
        <Stat title="Phòng ở ghép" value={stats.shared} className="bg-orange-500/10 text-orange-500" />
      </div>
    </div>
  );
}

function Stat({ title, value, className = "" }: any) {
  return (
    <div className={`rounded-[12px] p-4 flex flex-col gap-1 ${className}`}>
      <span className="text-[11px] font-bold uppercase text-muted">{title}</span>
      <span className="font-black text-[20px] text-text">{value}</span>
    </div>
  );
}
