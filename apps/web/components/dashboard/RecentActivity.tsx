import React from "react";
import { MessageSquare, Calendar } from "lucide-react";
import { useDashboardData } from "@/app/dashboard-context";

export default function RecentActivity() {
  const context = useDashboardData();
  const activities: any[] = context?.recentActivity || [];

  if (activities.length === 0) {
    return (
      <div className="bg-card border border-border rounded-[20px] p-[24px] shadow-sm flex flex-col h-full items-center justify-center min-h-[200px]">
        <div className="flex justify-between items-center mb-[16px] w-full">
          <h3 className="font-black text-[14px] text-text uppercase m-0">Hoạt động gần đây</h3>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-1.5 py-6">
          <Calendar size={20} className="text-muted/60" />
          <span className="text-muted font-bold text-[13px]">Chưa có hoạt động nào gần đây</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-[20px] p-[24px] shadow-sm flex flex-col h-full">
      <div className="flex justify-between items-center mb-[24px]">
        <h3 className="font-black text-[14px] text-text uppercase m-0">Hoạt động gần đây</h3>
        <a href="#" className="text-[#4f46e5] text-[13px] font-bold hover:underline">Xem tất cả</a>
      </div>

      <div className="flex flex-col gap-[20px] flex-1">
        {activities.map((act, i) => (
          <div key={i} className="flex items-start gap-[12px]">
            <div className="text-[11px] font-bold text-muted/70 w-[35px] mt-[6px]">{act.time}</div>
            
            {act.avatar ? (
              <img src={act.avatar} alt="Avatar" className="w-[32px] h-[32px] rounded-full object-cover shrink-0 border border-border/50" />
            ) : (
              act.icon
            )}

            <div className="flex-1 min-w-0">
              <div className="font-bold text-[13px] text-text leading-tight mb-1 line-clamp-2">{act.title}</div>
              <div className="text-[12px] text-muted font-medium">{act.desc}</div>
            </div>

            {act.amount && (
              <div className={`font-black text-[12px] shrink-0 ${act.amountColor} mt-[6px]`}>
                {act.amount}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
