import React from "react";
import { Sparkles, Clock, AlertTriangle, PenTool, UserMinus, FileWarning } from "lucide-react";
import { Card } from "../ui/Card";

export default function OperationsContractInsights() {
  const insights = [
    { text: "9 hợp đồng sắp hết hạn trong 30 ngày", icon: Clock, color: "text-[#f97316]" },
    { text: "4 hợp đồng chưa ký đủ file", icon: FileWarning, color: "text-rose-500" },
    { text: "6 hợp đồng có công nợ chưa xử lý", icon: AlertTriangle, color: "text-rose-500" },
    { text: "3 hợp đồng cần gia hạn tuần này", icon: PenTool, color: "text-[#6366f1]" },
    { text: "2 khách sắp trả phòng", icon: UserMinus, color: "text-[#a855f7]" },
  ];

  return (
    <Card className="p-[16px] md:p-[20px] flex items-center gap-[16px] overflow-x-auto no-scrollbar">
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
