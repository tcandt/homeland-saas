"use client";

import React from "react";
import { CalendarClock, TrendingUp } from "lucide-react";
import { useRoomsQuery } from "@/lib/queries/rooms.queries";

export default function ForecastPanel() {
  const { data: rooms = [] } = useRoomsQuery({ limit: 100 });

  const forecastRows = rooms
    .filter((room: any) => room.contract?.endDate)
    .map((room: any) => {
      const daysLeft = Math.ceil((new Date(room.contract.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      return {
        name: room.code || room.number,
        building: room.building?.name || room.buildingName || "",
        daysLeft,
        score: Math.max(0, Math.min(100, Math.round(((30 - daysLeft) / 30) * 100))),
      };
    })
    .filter((row: any) => row.daysLeft <= 30)
    .sort((a: any, b: any) => a.daysLeft - b.daysLeft)
    .slice(0, 4);

  return (
    <div className="bg-card border border-border rounded-[20px] p-[24px] shadow-sm flex flex-col h-full">
      <div className="flex justify-between items-center mb-[24px]">
        <h3 className="font-black text-[14px] text-text uppercase m-0">Dự báo 30 ngày tới</h3>
        <span className="text-[13px] font-bold text-muted">Từ hợp đồng thật</span>
      </div>

      {forecastRows.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 py-8 text-center text-muted">
          <CalendarClock size={20} />
          <span className="text-[13px] font-bold">Chưa có hợp đồng sắp hết hạn</span>
          <span className="text-[12px] text-muted/70 font-medium">
            Khi dữ liệu hợp đồng có ngày kết thúc, dự báo sẽ được tự động cập nhật.
          </span>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-[20px] flex-1">
            {forecastRows.map((f: any, i: number) => (
              <div key={`${f.name}-${i}`} className="flex items-center gap-[16px]">
                <div className="flex items-center gap-[12px] w-[120px] shrink-0">
                  <div className="w-[32px] h-[32px] rounded-[6px] bg-black/10 dark:bg-white/10 overflow-hidden shrink-0 flex items-center justify-center">
                    <TrendingUp size={14} className="text-[#3b82f6]" />
                  </div>
                  <div className="font-bold text-[13px] text-text">{f.name}</div>
                </div>

                <div className="flex-1 h-[8px] bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-[#3b82f6] rounded-full transition-all duration-500" style={{ width: `${f.score}%` }} />
                </div>

                <div className="w-[70px] text-right font-black text-[13px] text-text shrink-0">
                  {f.daysLeft} ngày
                </div>
              </div>
            ))}
          </div>

          <div className="mt-[24px] text-center font-bold text-[13px] text-[#3b82f6]">
            Dự báo được tính từ ngày hết hạn hợp đồng
          </div>
        </>
      )}
    </div>
  );
}
