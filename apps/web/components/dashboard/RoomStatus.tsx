"use client";

import React from "react";
import { DoorOpen, UserCheck, CalendarClock, Sparkles, Wrench, AlertCircle } from "lucide-react";
import { useRoomsQuery } from "@/lib/queries/rooms.queries";

export default function RoomStatus() {
  const { data: rooms = [], isLoading } = useRoomsQuery({ limit: 100 });

  const counts = rooms.reduce(
    (acc: any, room: any) => {
      switch (room.status) {
        case "occupied":
          acc.occupied += 1;
          break;
        case "vacant":
          acc.vacant += 1;
          break;
        case "deposited":
          acc.deposited += 1;
          break;
        case "cleaning":
          acc.cleaning += 1;
          break;
        case "maintenance":
          acc.maintenance += 1;
          break;
        default:
          break;
      }

      acc.total += 1;
      return acc;
    },
    { total: 0, occupied: 0, vacant: 0, deposited: 0, cleaning: 0, maintenance: 0 },
  );

  const expiringCount = rooms.filter((room: any) => {
    const endDate = room.contract?.endDate;
    if (!endDate) return false;
    const diff = (new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 30;
  }).length;

  const stats = [
    { label: "Đang thuê", count: counts.occupied, icon: UserCheck, color: "text-[#22c55e]" },
    { label: "Trống", count: counts.vacant, icon: DoorOpen, color: "text-muted" },
    { label: "Đã cọc", count: counts.deposited, icon: CalendarClock, color: "text-[#3b82f6]" },
    { label: "Sắp hết hạn", count: expiringCount, icon: AlertCircle, color: "text-[#f97316]" },
    { label: "Đang dọn", count: counts.cleaning, icon: Sparkles, color: "text-[#a855f7]" },
    { label: "Bảo trì", count: counts.maintenance, icon: Wrench, color: "text-[#ef4444]" },
  ];

  return (
    <div className="bg-card border border-border rounded-[20px] p-[24px] shadow-sm flex flex-col h-full">
      <div className="flex justify-between items-center mb-[24px]">
        <h3 className="font-black text-[14px] text-text uppercase m-0">Tình trạng phòng</h3>
        <span className="text-[13px] font-bold text-muted">{isLoading ? "Đang tải..." : `${counts.total} phòng từ DB`}</span>
      </div>

      {counts.total === 0 && !isLoading ? (
        <div className="flex-1 flex items-center justify-center text-center text-muted font-medium">Chưa có dữ liệu phòng để hiển thị.</div>
      ) : (
        <div className="flex items-center justify-between flex-1 gap-[20px]">
          <div className="relative w-[140px] h-[140px] shrink-0">
            <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
              <circle cx="18" cy="18" r="15.9154943" fill="none" stroke="#f1f5f9" strokeWidth="4" />
              <circle
                cx="18"
                cy="18"
                r="15.9154943"
                fill="none"
                stroke="#3b82f6"
                strokeWidth="5"
                strokeDasharray={`${Math.max(0, (counts.occupied / Math.max(counts.total, 1)) * 100)} 100`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <div className="text-[24px] font-black leading-none mb-1">{counts.total}</div>
              <div className="text-[10px] font-bold text-muted uppercase">Tổng phòng</div>
            </div>
          </div>

          <div className="flex flex-col gap-[12px] flex-1">
            {stats.map((s) => (
              <div key={s.label} className="flex items-center justify-between">
                <div className="flex items-center gap-[8px]">
                  <div className={`w-[8px] h-[8px] rounded-full ${s.color.replace("text-", "bg-")}`} />
                  <span className="text-[13px] font-bold text-text">{s.label}</span>
                </div>
                <div className="flex items-center gap-[6px]">
                  <span className="text-[13px] font-black text-text">{s.count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
