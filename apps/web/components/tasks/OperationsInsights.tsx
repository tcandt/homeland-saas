import React from "react";
import { Sparkles, AlertTriangle, Clock, Wrench, MessageSquareWarning, TrendingUp } from "lucide-react";

export default function OperationsInsights() {
  return (
    <div className="bg-card border border-border rounded-[16px] md:rounded-[20px] p-[16px] md:p-[20px] shadow-sm relative overflow-hidden flex flex-col md:flex-row md:items-center gap-[16px] md:gap-[24px]">
      {/* Decorative gradient */}
      <div className="absolute top-0 right-0 w-[150px] md:w-[300px] h-full bg-gradient-to-l from-[#10b981]/5 to-transparent pointer-events-none" />
      
      {/* Title */}
      <div className="flex items-center gap-[10px] md:w-[220px] shrink-0">
        <div className="w-[36px] h-[36px] md:w-[44px] md:h-[44px] rounded-[10px] md:rounded-[12px] bg-[#10b981]/10 flex items-center justify-center shrink-0">
          <Sparkles size={20} className="text-[#10b981]" />
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] md:text-[11px] font-bold text-muted uppercase tracking-wider">AI Operations</span>
          <span className="font-black text-[15px] md:text-[16px] text-text leading-tight">Insight Center</span>
        </div>
      </div>

      {/* Vertical divider on Desktop */}
      <div className="hidden md:block w-[1px] h-[40px] bg-border/50 shrink-0" />

      {/* Insights Links Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-x-[20px] gap-y-[10px] md:gap-y-[12px] w-full">
        <InsightLink 
          icon={<AlertTriangle size={14} />} 
          text="2 sự cố khẩn cấp chưa tiếp nhận" 
          color="text-rose-500" 
          hover="hover:bg-rose-500/5"
        />
        <InsightLink 
          icon={<Clock size={14} />} 
          text="3 ticket quá hạn SLA" 
          color="text-[#f97316]" 
          hover="hover:bg-[#f97316]/5"
        />
        <InsightLink 
          icon={<Wrench size={14} />} 
          text="LK01 có nhiều yêu cầu nhất" 
          color="text-[#6366f1]" 
          hover="hover:bg-[#6366f1]/5"
        />
        <InsightLink 
          icon={<MessageSquareWarning size={14} />} 
          text="5 tin nhắn khách chưa phản hồi" 
          color="text-amber-500" 
          hover="hover:bg-amber-500/5"
        />
        <InsightLink 
          icon={<TrendingUp size={14} />} 
          text="Chi phí sửa chữa tháng này tăng 18%" 
          color="text-[#10b981]" 
          hover="hover:bg-[#10b981]/5"
        />
      </div>
    </div>
  );
}

function InsightLink({ icon, text, color, hover }: any) {
  return (
    <div className={`flex items-center gap-[8px] py-[4px] cursor-pointer transition-all duration-200 ${hover} group w-full rounded-[6px] -ml-[4px] px-[4px]`}>
      <div className={`flex items-center justify-center shrink-0 ${color}`}>
        {icon}
      </div>
      <span className="font-medium text-[13px] text-text group-hover:text-[#10b981] group-hover:underline transition-all truncate flex-1">{text}</span>
    </div>
  );
}
