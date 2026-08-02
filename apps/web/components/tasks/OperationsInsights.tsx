import React from "react";
import { Sparkles, AlertTriangle, Clock, Wrench, MessageSquareWarning, TrendingUp } from "lucide-react";

const insights = [
  {
    icon: <AlertTriangle size={14} />,
    text: "Chưa có sự cố khẩn cấp được ghi nhận",
    color: "text-rose-500",
    hover: "hover:bg-rose-500/5",
  },
  {
    icon: <Clock size={14} />,
    text: "Không có ticket quá hạn SLA",
    color: "text-[#f97316]",
    hover: "hover:bg-[#f97316]/5",
  },
  {
    icon: <Wrench size={14} />,
    text: "Chưa có khu vực nào cần ưu tiên",
    color: "text-[#6366f1]",
    hover: "hover:bg-[#6366f1]/5",
  },
  {
    icon: <MessageSquareWarning size={14} />,
    text: "Chưa có tin nhắn khách cần phản hồi",
    color: "text-amber-500",
    hover: "hover:bg-amber-500/5",
  },
  {
    icon: <TrendingUp size={14} />,
    text: "Dữ liệu vận hành sẽ hiển thị khi API trả về kết quả",
    color: "text-[#8b5cf6]",
    hover: "hover:bg-[#8b5cf6]/5",
  },
];

export default function OperationsInsights() {
  return (
    <div className="bg-card border border-border rounded-[16px] md:rounded-[20px] p-[16px] md:p-[20px] shadow-sm relative overflow-hidden flex flex-col md:flex-row md:items-center gap-[16px] md:gap-[24px]">
      <div className="absolute top-0 right-0 w-[150px] md:w-[300px] h-full bg-gradient-to-l from-[#8b5cf6]/5 to-transparent pointer-events-none" />

      <div className="flex items-center gap-[10px] md:w-[220px] shrink-0">
        <div className="w-[36px] h-[36px] md:w-[44px] md:h-[44px] rounded-[10px] md:rounded-[12px] bg-[#8b5cf6]/10 flex items-center justify-center shrink-0">
          <Sparkles size={20} className="text-[#8b5cf6]" />
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] md:text-[11px] font-bold text-muted uppercase tracking-wider">AI Operations</span>
          <span className="font-black text-[15px] md:text-[16px] text-text leading-tight">Insight Center</span>
        </div>
      </div>

      <div className="hidden md:block w-[1px] h-[40px] bg-border/50 shrink-0" />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-x-[20px] gap-y-[10px] md:gap-y-[12px] w-full">
        {insights.map((insight) => (
          <InsightLink key={insight.text} {...insight} />
        ))}
      </div>
    </div>
  );
}

function InsightLink({ icon, text, color, hover }: any) {
  return (
    <div className={`flex items-center gap-[8px] py-[4px] transition-all duration-200 ${hover} group w-full rounded-[6px] -ml-[4px] px-[4px]`}>
      <div className={`flex items-center justify-center shrink-0 ${color}`}>
        {icon}
      </div>
      <span className="font-medium text-[13px] text-text group-hover:text-[#8b5cf6] group-hover:underline transition-all truncate flex-1">
        {text}
      </span>
    </div>
  );
}
