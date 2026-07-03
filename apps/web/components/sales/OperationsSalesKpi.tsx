"use client";

import React from "react";
import { Users, UserCheck, CalendarClock, CreditCard, CheckCircle2, CircleDollarSign, Coins, TrendingUp } from "lucide-react";

export default function OperationsSalesKpi() {
  const kpis = [
    { label: "LEAD MỚI", value: "24", trend: "+12%", trendUp: true, icon: Users, color: "text-blue-500", bg: "bg-blue-500/10" },
    { label: "ĐANG CHĂM SÓC", value: "156", trend: "+5%", trendUp: true, icon: UserCheck, color: "text-[#f97316]", bg: "bg-[#f97316]/10" },
    { label: "HẸN HÔM NAY", value: "12", trend: "-2", trendUp: false, icon: CalendarClock, color: "text-rose-500", bg: "bg-rose-500/10" },
    { label: "CHỜ ĐẶT CỌC", value: "8", trend: "+3", trendUp: true, icon: CreditCard, color: "text-purple-500", bg: "bg-purple-500/10" },
    { label: "ĐÃ CHỐT", value: "45", trend: "+18%", trendUp: true, icon: CheckCircle2, color: "text-[#10b981]", bg: "bg-[#10b981]/10" },
    { label: "DOANH THU DK", value: "850M", trend: "+25%", trendUp: true, icon: CircleDollarSign, color: "text-emerald-600 dark:text-emerald-500", bg: "bg-emerald-500/10" },
    { label: "HOA HỒNG", value: "42.5M", trend: "+25%", trendUp: true, icon: Coins, color: "text-yellow-600 dark:text-yellow-500", bg: "bg-yellow-500/10" },
    { label: "CONVERSION", value: "18.5%", trend: "+2.4%", trendUp: true, icon: TrendingUp, color: "text-[#6366f1]", bg: "bg-[#6366f1]/10" }
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-[12px]">
      {kpis.map((kpi, index) => {
        const Icon = kpi.icon;
        return (
          <div key={index} className="bg-card border border-border rounded-[16px] p-[16px] flex flex-col justify-between shadow-sm hover:shadow-md hover:border-border/80 transition-all group h-[80px] md:h-[90px]">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-muted uppercase tracking-wider truncate mr-2 group-hover:text-text transition-colors">
                {kpi.label}
              </span>
              <div className={`w-[24px] h-[24px] rounded-full flex items-center justify-center shrink-0 ${kpi.bg}`}>
                <Icon size={12} className={kpi.color} />
              </div>
            </div>
            
            <div className="flex items-end justify-between mt-auto">
              <span className="text-[18px] md:text-[20px] font-black text-text leading-none tracking-tight">
                {kpi.value}
              </span>
              <span className={`text-[11px] font-bold ${kpi.trendUp ? 'text-[#10b981]' : 'text-rose-500'}`}>
                {kpi.trendUp ? '↗' : '↘'} {kpi.trend}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
