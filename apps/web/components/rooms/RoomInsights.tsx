"use client";

import React from "react";
import { Sparkles, AlertCircle, AlertTriangle, Shield, Zap, Wrench } from "lucide-react";

export default function RoomInsights() {
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
        <InsightCard 
          icon={<AlertCircle size={14} />}
          text="7 phòng sắp hết hạn hợp đồng" 
          color="text-orange-500 bg-orange-500/10" 
          hover="hover:border-orange-500/30"
        />
        <InsightCard 
          icon={<AlertTriangle size={14} />}
          text="2 phòng quá hạn thanh toán" 
          color="text-rose-500 bg-rose-500/10" 
          hover="hover:border-rose-500/30"
        />
        <InsightCard 
          icon={<Shield size={14} />}
          text="5 phòng chưa khai báo tạm trú" 
          color="text-blue-500 bg-blue-500/10" 
          hover="hover:border-blue-500/30"
        />
        <InsightCard 
          icon={<Zap size={14} />}
          text="Điện tháng này tăng bất thường" 
          color="text-yellow-600 dark:text-yellow-500 bg-yellow-500/10" 
          hover="hover:border-yellow-500/30"
        />
        <InsightCard 
          icon={<Wrench size={14} />}
          text="1 phòng đang bảo trì" 
          color="text-purple-500 bg-purple-500/10" 
          hover="hover:border-purple-500/30"
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
      <span className="font-medium text-[13px] text-text group-hover:text-[#6366f1] group-hover:underline transition-all truncate flex-1">{text}</span>
    </div>
  );
}
