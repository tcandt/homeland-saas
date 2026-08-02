"use client";

import React from "react";
import { Bell, Clock } from "lucide-react";
import { useDashboardData } from "@/app/dashboard-context";

export default function RecentActivityTimeline() {
  const context = useDashboardData();
  const activities = (context as any)?.recentActivity || [];

  if (activities.length === 0) {
    return (
      <div className="bg-card border border-border rounded-[16px] p-5 shadow-sm flex flex-col gap-4 h-full min-h-[300px] items-center justify-center text-center text-muted">
        <Clock size={20} />
        <span className="text-[13px] font-bold">Chưa có hoạt động gần đây</span>
        <span className="text-[12px]">Các sự kiện thật sẽ hiển thị khi hệ thống có dữ liệu phát sinh.</span>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-[16px] p-5 shadow-sm flex flex-col gap-4 h-full min-h-[300px]">
      <div className="flex flex-col gap-4 relative">
        <div className="absolute left-[15px] top-4 bottom-4 w-[2px] bg-border/50 rounded-full" />
        {activities.map((act: any, idx: number) => (
          <div key={act.id || idx} className="flex gap-4 relative group">
            <div className="w-[32px] h-[32px] rounded-full shrink-0 flex items-center justify-center relative z-10 bg-primary/10 text-primary ring-4 ring-card">
              {act.icon || <Bell size={14} />}
            </div>
            <div className="flex flex-col pb-4">
              <span className="font-bold text-[13px] text-text group-hover:text-primary transition-colors">{act.title}</span>
              <span className="text-[12px] text-muted mt-0.5 leading-relaxed">{act.desc}</span>
              <span className="text-[11px] font-medium text-muted/70 mt-1">{act.time}</span>
            </div>
          </div>
        ))}
      </div>
      <button className="w-full py-2.5 mt-auto rounded-[8px] bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-[12px] font-bold text-text transition-colors">
        Xem toàn bộ lịch sử
      </button>
    </div>
  );
}
