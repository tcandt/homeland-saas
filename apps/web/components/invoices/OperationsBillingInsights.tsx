import React from "react";
import { Sparkles, AlertTriangle, Users, MessageSquare, TrendingDown, Building2 } from "lucide-react";
import { Card } from "../ui/Card";

export default function OperationsBillingInsights() {
  const insights = [
    { text: "14 hóa đơn quá hạn cần nhắc nợ", icon: AlertTriangle, color: "text-rose-500" },
    { text: "3 hóa đơn cần gửi Zalo hôm nay", icon: MessageSquare, color: "text-[#0ea5e9]" },
    { text: "8 khách chưa thanh toán tháng này", icon: Users, color: "text-[#f97316]" },
    { text: "LK01 có công nợ cao nhất", icon: Building2, color: "text-[#6366f1]" },
    { text: "Tỷ lệ thu hồi giảm 6% so với tháng trước", icon: TrendingDown, color: "text-rose-500" },
  ];

  return (
    <Card className="p-[16px] md:p-[20px] flex items-center gap-[16px] overflow-x-auto no-scrollbar shadow-sm">
      <div className="flex items-center gap-[8px] pr-[16px] border-r border-border/50 shrink-0">
        <div className="w-[36px] h-[36px] rounded-full bg-[#6366f1]/10 flex items-center justify-center">
          <Sparkles size={18} className="text-[#6366f1]" />
        </div>
        <div className="flex flex-col">
          <span className="font-black text-[12px] text-text uppercase tracking-wider">AI Operations</span>
          <span className="font-bold text-[14px] text-text leading-tight">Insight Center</span>
        </div>
      </div>

      <div className="flex items-center gap-[24px] pl-[8px]">
        {insights.map((item, idx) => (
          <button 
            key={idx} 
            className="flex items-center gap-[6px] shrink-0 group hover:opacity-80 transition-opacity"
          >
            <item.icon size={14} className={item.color} />
            <span className="font-semibold text-[13px] text-text group-hover:underline underline-offset-4 decoration-border">
              {item.text}
            </span>
          </button>
        ))}
      </div>
    </Card>
  );
}
