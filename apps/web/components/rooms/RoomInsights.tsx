"use client";

import React from "react";
import { Sparkles, AlertCircle, AlertTriangle, Shield, Zap, Wrench } from "lucide-react";
import { useRoomsQuery } from "@/lib/queries/rooms.queries";
import { Card } from "../ui/Card";
import { Skeleton } from "../ui/Skeleton";

export default function RoomInsights() {
  const { data: rooms = [], isLoading } = useRoomsQuery({ limit: 100 });

  if (isLoading) {
    return (
      <Card className="p-[16px] md:p-[20px] shadow-sm relative overflow-hidden flex flex-col md:flex-row gap-[16px] md:items-center">
        <div className="flex items-center gap-[12px] md:w-[220px] shrink-0">
          <Skeleton className="w-[36px] h-[36px] rounded-[10px]" />
          <div className="space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-4 w-28" />
          </div>
        </div>
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-[8px] md:gap-[12px] mt-2 md:mt-0 w-full">
          {Array.from({ length: 5 }).map((_, idx) => (
            <div key={idx} className="flex items-center gap-[8px] py-[4px] w-full">
              <Skeleton className="w-[20px] h-[20px] rounded-[6px] shrink-0" />
              <Skeleton className="h-3 w-full rounded-full" />
            </div>
          ))}
        </div>
      </Card>
    );
  }

  const expiringSoon = rooms.filter((room: any) => {
    const endDate = room.contract?.endDate;
    if (!endDate) return false;
    const daysLeft = (new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return daysLeft >= 0 && daysLeft <= 30;
  }).length;

  const overduePayment = rooms.filter((room: any) => Number(room.debt) > 0).length;
  const vacant = rooms.filter((room: any) => room.status === "vacant").length;
  const maintenance = rooms.filter((room: any) => room.status === "maintenance").length;
  const deposited = rooms.filter((room: any) => room.status === "deposited").length;

  const insights = [
    { icon: <AlertCircle size={14} />, text: `${expiringSoon} phòng sắp hết hạn hợp đồng`, color: "text-orange-500 bg-orange-500/10" },
    { icon: <AlertTriangle size={14} />, text: `${overduePayment} phòng có công nợ`, color: "text-rose-500 bg-rose-500/10" },
    { icon: <Shield size={14} />, text: `${vacant} phòng đang trống`, color: "text-blue-500 bg-blue-500/10" },
    { icon: <Zap size={14} />, text: `${deposited} phòng đang ở trạng thái đặt cọc`, color: "text-yellow-600 dark:text-yellow-500 bg-yellow-500/10" },
    { icon: <Wrench size={14} />, text: `${maintenance} phòng đang bảo trì`, color: "text-indigo-500 bg-indigo-500/10" },
  ];

  return (
    <div className="bg-card border border-border rounded-[16px] md:rounded-[20px] p-[16px] md:p-[20px] shadow-sm relative overflow-hidden flex flex-col md:flex-row gap-[16px] md:items-center">
      <div className="absolute top-0 right-0 w-[200px] h-[200px] bg-[#6366f1]/5 rounded-full blur-[40px] -z-10 pointer-events-none" />

      <div className="flex items-center gap-[12px] md:w-[220px] shrink-0">
        <div className="w-[36px] h-[36px] rounded-[10px] bg-[#6366f1]/10 flex items-center justify-center shrink-0 text-[#6366f1]">
          <Sparkles size={18} />
        </div>
        <div>
          <div className="text-[12px] font-bold text-muted uppercase tracking-widest">AI HomeLand</div>
          <div className="font-black text-[15px] text-text">Room Insights</div>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-[8px] md:gap-[12px] mt-2 md:mt-0 w-full">
        {insights.map((item) => (
          <InsightCard key={item.text} {...item} />
        ))}
      </div>
    </div>
  );
}

function InsightCard({ icon, text, color }: any) {
  return (
    <div className="flex items-center gap-[8px] py-[4px] w-full">
      <div className={`w-[20px] h-[20px] rounded-[6px] flex items-center justify-center shrink-0 ${color}`}>
        {icon}
      </div>
      <span className="font-medium text-[13px] text-text truncate flex-1">{text}</span>
    </div>
  );
}
