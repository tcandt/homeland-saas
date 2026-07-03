import React from "react";
import { PieChart, Home, Zap, Wrench, Shield } from "lucide-react";

const categories = [
  { name: "Tiền thuê phòng", amount: "260.000.000 đ", percent: 75.3, icon: <Home size={14} className="text-[#4f46e5]" />, color: "bg-[#4f46e5]" },
  { name: "Tiền điện nước", amount: "65.500.000 đ", percent: 18.9, icon: <Zap size={14} className="text-[#f97316]" />, color: "bg-[#f97316]" },
  { name: "Phí dịch vụ", amount: "15.000.000 đ", percent: 4.3, icon: <Shield size={14} className="text-[#22c55e]" />, color: "bg-[#22c55e]" },
  { name: "Sửa chữa & Khác", amount: "5.000.000 đ", percent: 1.5, icon: <Wrench size={14} className="text-[#8b5cf6]" />, color: "bg-[#8b5cf6]" },
];

export default function RevenueBreakdown() {
  return (
    <div className="bg-card border border-border rounded-[20px] p-[20px] shadow-sm flex flex-col h-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-[16px] font-black text-text">Cơ cấu Doanh thu</h3>
          <p className="text-[12px] font-medium text-muted mt-1">Phân bổ nguồn thu tháng này</p>
        </div>
        <div className="w-[32px] h-[32px] rounded-[10px] bg-black/5 dark:bg-white/5 flex items-center justify-center shrink-0">
          <PieChart size={16} className="text-text" />
        </div>
      </div>

      <div className="flex flex-col gap-5 flex-1 justify-center">
        {categories.map((cat, i) => (
          <div key={i} className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-[24px] h-[24px] rounded-[6px] bg-black/5 dark:bg-white/5 flex items-center justify-center`}>
                  {cat.icon}
                </div>
                <span className="text-[13px] font-bold text-text">{cat.name}</span>
              </div>
              <span className="text-[13px] font-black text-text">{cat.amount}</span>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="flex-1 h-[6px] bg-black/5 dark:bg-white/5 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full ${cat.color}`} 
                  style={{ width: `${cat.percent}%` }}
                ></div>
              </div>
              <span className="text-[11px] font-bold text-muted w-[36px] text-right">{cat.percent}%</span>
            </div>
          </div>
        ))}
      </div>
      
      <button className="w-full mt-6 py-2.5 text-[13px] font-bold text-text bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 rounded-[10px] transition-colors">
        Xem chi tiết báo cáo
      </button>
    </div>
  );
}
