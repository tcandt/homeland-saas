"use client";

import React from "react";
import { Building2, TrendingUp, AlertTriangle } from "lucide-react";

export default function OperationsFinanceBuildingPL() {
  const buildings = [
    { name: "LK01.31", revenue: "95M", expense: "18M", profit: "77M", debt: "5M", occ: "100%", margin: "81%", status: "Tốt", color: "text-[#8b5cf6]", bg: "bg-[#8b5cf6]/10" },
    { name: "LK02.15", revenue: "120M", expense: "25M", profit: "95M", debt: "12M", occ: "95%", margin: "79%", status: "Tốt", color: "text-[#8b5cf6]", bg: "bg-[#8b5cf6]/10" },
    { name: "LK05.08", revenue: "85M", expense: "35M", profit: "50M", debt: "45M", occ: "80%", margin: "58%", status: "Cần theo dõi", color: "text-[#f97316]", bg: "bg-[#f97316]/10" },
    { name: "LK08.24", revenue: "45M", expense: "32M", profit: "13M", debt: "65M", occ: "65%", margin: "28%", status: "Rủi ro", color: "text-rose-500", bg: "bg-rose-500/10" },
  ];

  return (
    <div className="bg-card border border-border rounded-[16px] p-[20px] shadow-sm flex flex-col gap-[20px]">
      <div className="flex flex-col">
        <h3 className="font-black text-[16px] text-text">Lãi / Lỗ theo tòa nhà (Profit & Loss)</h3>
        <span className="text-[13px] text-muted font-medium">Hiệu quả kinh doanh và chỉ số sức khỏe tài chính từng chi nhánh</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-[16px]">
        {buildings.map((b, i) => (
          <div key={i} className="border border-border rounded-[12px] p-[16px] flex flex-col gap-[16px] hover:border-[#8b5cf6]/30 hover:shadow-sm transition-all group">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-[8px]">
                <div className="w-[32px] h-[32px] rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center">
                  <Building2 size={16} className="text-text" />
                </div>
                <span className="font-black text-[15px] text-text">{b.name}</span>
              </div>
              <span className={`text-[10px] font-black uppercase px-[8px] py-[4px] rounded-[6px] ${b.color} ${b.bg}`}>{b.status}</span>
            </div>

            <div className="grid grid-cols-2 gap-y-[12px] gap-x-[8px]">
              <div className="flex flex-col gap-[2px]">
                <span className="text-[11px] font-bold text-muted uppercase">Doanh thu</span>
                <span className="text-[15px] font-black text-[#8b5cf6]">{b.revenue}</span>
              </div>
              <div className="flex flex-col gap-[2px] items-end">
                <span className="text-[11px] font-bold text-muted uppercase">Chi phí</span>
                <span className="text-[15px] font-black text-rose-500">{b.expense}</span>
              </div>
              <div className="flex flex-col gap-[2px]">
                <span className="text-[11px] font-bold text-muted uppercase">Lợi nhuận</span>
                <span className="text-[15px] font-black text-[#6366f1]">{b.profit}</span>
              </div>
              <div className="flex flex-col gap-[2px] items-end">
                <span className="text-[11px] font-bold text-muted uppercase">Công nợ</span>
                <span className={`text-[15px] font-black ${b.status === 'Rủi ro' ? 'text-rose-500' : 'text-text'}`}>{b.debt}</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-[12px] border-t border-border/50">
              <div className="flex flex-col gap-[2px]">
                <span className="text-[11px] font-bold text-muted uppercase">Lấp đầy</span>
                <span className="text-[13px] font-black text-text">{b.occ}</span>
              </div>
              <div className="flex flex-col gap-[2px] items-end">
                <span className="text-[11px] font-bold text-muted uppercase">Margin</span>
                <span className={`text-[13px] font-black ${b.status === 'Rủi ro' ? 'text-rose-500' : 'text-[#0ea5e9]'}`}>{b.margin}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
