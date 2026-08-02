"use client";

import React from "react";
import { TrendingUp, TrendingDown } from "lucide-react";

export default function OperationsFinanceBreakdown() {
  const revSources = [
    { label: "Tiền thuê phòng", amount: "250.0M", percent: 72, trend: "+5.2%", trendUp: true },
    { label: "Điện, Nước", amount: "45.5M", percent: 13, trend: "+12.1%", trendUp: true },
    { label: "Phí dịch vụ", amount: "25.0M", percent: 7, trend: "0%", trendUp: true },
    { label: "Tiền cọc", amount: "20.0M", percent: 6, trend: "-15.5%", trendUp: false },
    { label: "Khác", amount: "5.0M", percent: 2, trend: "+2.1%", trendUp: true },
  ];

  const expSources = [
    { label: "Nhân sự", amount: "35.0M", percent: 41, trend: "0%", trendUp: true, abnormal: false },
    { label: "Sửa chữa, Bảo trì", amount: "20.5M", percent: 24, trend: "+45.2%", trendUp: false, abnormal: true },
    { label: "Điện, Nước", amount: "15.2M", percent: 18, trend: "+5.1%", trendUp: false, abnormal: false },
    { label: "Hoàn cọc", amount: "10.0M", percent: 12, trend: "-20.0%", trendUp: true, abnormal: false },
    { label: "Khác", amount: "4.5M", percent: 5, trend: "+1.2%", trendUp: false, abnormal: false },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-[24px]">
      
      {/* Revenue Breakdown */}
      <div className="bg-card border border-border rounded-[16px] p-[20px] shadow-sm flex flex-col gap-[16px]">
        <div className="flex flex-col border-b border-border/50 pb-3">
          <h3 className="font-black text-[16px] text-text">Cơ cấu Doanh thu</h3>
          <span className="text-[13px] text-muted font-medium">Phân rã các nguồn thu trong tháng</span>
        </div>
        
        <div className="flex flex-col gap-[12px]">
          {revSources.map((item, idx) => (
            <div key={idx} className="flex flex-col gap-[6px]">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[13px] text-text">{item.label}</span>
                <div className="flex items-center gap-[12px]">
                  <span className="font-black text-[14px] text-[#8b5cf6]">{item.amount}</span>
                  <div className={`flex items-center gap-[2px] w-[50px] justify-end ${item.trendUp ? 'text-[#8b5cf6]' : 'text-rose-500'}`}>
                    {item.trend !== '0%' && (item.trendUp ? <TrendingUp size={10} /> : <TrendingDown size={10} />)}
                    <span className="text-[10px] font-bold">{item.trend}</span>
                  </div>
                </div>
              </div>
              <div className="w-full h-[6px] bg-black/5 dark:bg-white/5 rounded-full overflow-hidden flex relative">
                <div 
                  className="h-full bg-[#8b5cf6] rounded-full" 
                  style={{ width: `${item.percent}%` }} 
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Expense Breakdown */}
      <div className="bg-card border border-border rounded-[16px] p-[20px] shadow-sm flex flex-col gap-[16px]">
        <div className="flex flex-col border-b border-border/50 pb-3">
          <h3 className="font-black text-[16px] text-text">Cơ cấu Chi phí</h3>
          <span className="text-[13px] text-muted font-medium">Phân rã các nguồn chi trong tháng</span>
        </div>
        
        <div className="flex flex-col gap-[12px]">
          {expSources.map((item, idx) => (
            <div key={idx} className="flex flex-col gap-[6px]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-[6px]">
                  <span className="font-bold text-[13px] text-text">{item.label}</span>
                  {item.abnormal && <span className="text-[9px] font-black uppercase bg-rose-500/10 text-rose-500 px-[6px] py-[2px] rounded-[4px]">Bất thường</span>}
                </div>
                <div className="flex items-center gap-[12px]">
                  <span className="font-black text-[14px] text-rose-500">{item.amount}</span>
                  <div className={`flex items-center gap-[2px] w-[50px] justify-end ${item.trendUp ? 'text-[#8b5cf6]' : 'text-rose-500'}`}>
                    {item.trend !== '0%' && (item.trendUp ? <TrendingDown size={10} /> : <TrendingUp size={10} />)}
                    <span className="text-[10px] font-bold">{item.trend}</span>
                  </div>
                </div>
              </div>
              <div className="w-full h-[6px] bg-black/5 dark:bg-white/5 rounded-full overflow-hidden flex relative">
                <div 
                  className={`h-full ${item.abnormal ? 'bg-rose-500' : 'bg-[#f43f5e]'} rounded-full`} 
                  style={{ width: `${item.percent}%` }} 
                />
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
