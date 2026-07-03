"use client";

import React from "react";
import { Sparkles, PhoneOff, Facebook, Video, TrendingUp, Calendar, Zap } from "lucide-react";

export default function OperationsSalesInsights() {
  return (
    <div className="bg-card border border-border rounded-[16px] md:rounded-[20px] p-[16px] md:p-[20px] shadow-sm relative overflow-hidden flex flex-col md:flex-row gap-[16px] md:items-center">
      <div className="absolute top-0 right-0 w-[200px] h-[200px] bg-purple-500/5 rounded-full blur-[40px] -z-10 pointer-events-none" />
      
      <div className="flex items-center gap-[12px] md:w-[220px] shrink-0">
        <div className="w-[36px] h-[36px] rounded-[10px] bg-purple-500/10 flex items-center justify-center shrink-0 text-purple-500">
          <Sparkles size={18} />
        </div>
        <div>
          <div className="text-[12px] font-bold text-muted uppercase tracking-widest">AI HomeLand</div>
          <div className="font-black text-[15px] text-text">Sales Insights</div>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-[8px] md:gap-[12px] mt-2 md:mt-0 w-full">
        <InsightCard 
          icon={<PhoneOff size={14} />}
          text="5 lead chưa gọi trong 3 ngày" 
          color="text-rose-500 bg-rose-500/10" 
          hover="hover:border-rose-500/30"
        />
        <InsightCard 
          icon={<Facebook size={14} />}
          text="Facebook tạo 45% lượng lead tuần này" 
          color="text-blue-500 bg-blue-500/10" 
          hover="hover:border-blue-500/30"
        />
        <InsightCard 
          icon={<Video size={14} />}
          text="TikTok đang giảm 12% conversion rate" 
          color="text-yellow-600 dark:text-yellow-500 bg-yellow-500/10" 
          hover="hover:border-yellow-500/30"
        />
        <InsightCard 
          icon={<TrendingUp size={14} />}
          text="Sale Tuấn Đạt đạt 160% KPI tháng" 
          color="text-[#10b981] bg-[#10b981]/10" 
          hover="hover:border-[#10b981]/30"
        />
        <InsightCard 
          icon={<Calendar size={14} />}
          text="3 khách có lịch xem phòng hôm nay" 
          color="text-purple-500 bg-purple-500/10" 
          hover="hover:border-purple-500/30"
        />
        <InsightCard 
          icon={<Zap size={14} />}
          text="2 khách đang do dự, khả năng chốt cao" 
          color="text-[#f97316] bg-[#f97316]/10" 
          hover="hover:border-[#f97316]/30"
        />
      </div>
    </div>
  );
}

function InsightCard({ icon, text, color, hover }: any) {
  return (
    <div className={`flex items-center gap-[8px] py-[4px] cursor-pointer transition-all duration-200 ${hover} group w-full`}>
      <div className={`w-[20px] h-[20px] rounded-[6px] flex items-center justify-center shrink-0 ${color}`}>
        {icon}
      </div>
      <span className="font-medium text-[13px] text-text group-hover:text-purple-500 group-hover:underline transition-all truncate flex-1">{text}</span>
    </div>
  );
}
