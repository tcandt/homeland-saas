import React from "react";
import { Sparkles, AlertTriangle, TrendingDown, FileWarning, Wallet, TrendingUp } from "lucide-react";

export default function OperationsFinanceInsights() {
  const insights = [
    { text: "Công nợ tăng 18% so với tháng trước", icon: TrendingDown, color: "text-rose-500" },
    { text: "7 giao dịch chưa đối soát", icon: FileWarning, color: "text-[#f97316]" },
    { text: "Chi phí điện LK01 tăng bất thường 22%", icon: AlertTriangle, color: "text-rose-500" },
    { text: "LK08.24 lợi nhuận giảm 10%", icon: TrendingDown, color: "text-[#0ea5e9]" },
    { text: "3 khoản chi chưa có chứng từ", icon: Wallet, color: "text-[#a855f7]" },
  ];

  return (
    <div className="bg-card border border-border rounded-[16px] p-[16px] md:p-[20px] flex items-center gap-[16px] overflow-x-auto no-scrollbar shadow-sm">
      <div className="flex items-center gap-[8px] pr-[16px] border-r border-border/50 shrink-0">
        <div className="w-[36px] h-[36px] rounded-full bg-[#8b5cf6]/10 flex items-center justify-center">
          <Sparkles size={18} className="text-[#8b5cf6]" />
        </div>
        <div className="flex flex-col">
          <span className="font-black text-[12px] text-text uppercase tracking-wider">Accounting</span>
          <span className="font-bold text-[14px] text-text leading-tight">Insights</span>
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
    </div>
  );
}
