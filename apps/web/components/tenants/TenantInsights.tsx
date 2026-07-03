import React from "react";
import { Sparkles, FileWarning, ShieldAlert, Clock, UserPlus, FileSignature } from "lucide-react";
import { Card } from "../ui/Card";

export default function TenantInsights() {
  return (
    <Card className="p-4 md:p-5 relative overflow-hidden flex flex-col md:flex-row md:items-center gap-4 md:gap-6">
      {/* Decorative gradient */}
      <div className="absolute top-0 right-0 w-[150px] md:w-[300px] h-full bg-gradient-to-l from-[#6366f1]/5 to-transparent pointer-events-none" />
      
      {/* Title */}
      <div className="flex items-center gap-[10px] md:w-[220px] shrink-0">
        <div className="w-[36px] h-[36px] md:w-[44px] md:h-[44px] rounded-[10px] md:rounded-[12px] bg-[#6366f1]/10 flex items-center justify-center shrink-0">
          <Sparkles size={20} className="text-[#6366f1]" />
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] md:text-[11px] font-bold text-muted uppercase tracking-wider">AI HomeLand</span>
          <span className="font-black text-[15px] md:text-[16px] text-text leading-tight">Tenant Insights</span>
        </div>
      </div>

      {/* Vertical divider on Desktop */}
      <div className="hidden md:block w-[1px] h-[40px] bg-border/50 shrink-0" />

      {/* Insights Links Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-x-[20px] gap-y-[10px] md:gap-y-[12px] w-full">
        <InsightLink 
          icon={<FileWarning size={14} />} 
          text="5 khách sắp hết hạn" 
          color="text-[#f97316]" 
          hover="hover:bg-[#f97316]/5"
        />
        <InsightLink 
          icon={<ShieldAlert size={14} />} 
          text="3 khách chưa khai báo" 
          color="text-rose-500" 
          hover="hover:bg-rose-500/5"
        />
        <InsightLink 
          icon={<Clock size={14} />} 
          text="2 khách nợ trên 30 ngày" 
          color="text-[#ef4444]" 
          hover="hover:bg-[#ef4444]/5"
        />
        <InsightLink 
          icon={<FileSignature size={14} />} 
          text="1 khách cần gia hạn" 
          color="text-[#a855f7]" 
          hover="hover:bg-[#a855f7]/5"
        />
        <InsightLink 
          icon={<UserPlus size={14} />} 
          text="4 khách mới tuần này" 
          color="text-[#10b981]" 
          hover="hover:bg-[#10b981]/5"
        />
      </div>
    </Card>
  );
}

function InsightLink({ icon, text, color, hover }: any) {
  return (
    <div className={`flex items-center gap-[8px] py-[4px] cursor-pointer transition-all duration-200 ${hover} group w-full rounded-[6px] -ml-[4px] px-[4px]`}>
      <div className={`flex items-center justify-center shrink-0 ${color}`}>
        {icon}
      </div>
      <span className="font-medium text-[13px] text-text group-hover:text-[#6366f1] group-hover:underline transition-all truncate flex-1">{text}</span>
    </div>
  );
}
