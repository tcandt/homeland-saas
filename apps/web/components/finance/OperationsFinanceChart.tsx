"use client";

import React from "react";

const data = [
  { name: 'T1', revenue: 280, expense: 65, profit: 215, debt: 45 },
  { name: 'T2', revenue: 295, expense: 70, profit: 225, debt: 30 },
  { name: 'T3', revenue: 310, expense: 68, profit: 242, debt: 55 },
  { name: 'T4', revenue: 305, expense: 80, profit: 225, debt: 60 },
  { name: 'T5', revenue: 330, expense: 75, profit: 255, debt: 85 },
  { name: 'T6', revenue: 345, expense: 85, profit: 260, debt: 125 },
];

export default function OperationsFinanceChart() {
  const maxVal = Math.max(...data.map(d => Math.max(d.revenue, d.expense, d.profit, d.debt)));

  return (
    <div className="bg-card border border-border rounded-[16px] p-[20px] shadow-sm flex flex-col gap-[20px]">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-[12px]">
        <div className="flex flex-col">
          <h3 className="font-black text-[16px] text-text">Dòng tiền & Lợi nhuận (Cash Flow & Profit)</h3>
          <span className="text-[13px] text-muted font-medium">Phân tích Thu, Chi, Lợi nhuận và Công nợ 6 tháng gần nhất</span>
        </div>
        <div className="flex items-center gap-[12px] flex-wrap">
          <div className="flex items-center gap-[6px]">
            <div className="w-[12px] h-[12px] rounded-[3px] bg-[#10b981]" />
            <span className="text-[12px] font-bold text-text">Thu thực nhận</span>
          </div>
          <div className="flex items-center gap-[6px]">
            <div className="w-[12px] h-[12px] rounded-[3px] bg-rose-500" />
            <span className="text-[12px] font-bold text-text">Tổng chi</span>
          </div>
          <div className="flex items-center gap-[6px]">
            <div className="w-[12px] h-[12px] rounded-[3px] bg-[#6366f1]" />
            <span className="text-[12px] font-bold text-text">Lợi nhuận</span>
          </div>
          <div className="flex items-center gap-[6px]">
            <div className="w-[12px] h-[2px] bg-[#f97316]" />
            <span className="text-[12px] font-bold text-text">Công nợ</span>
          </div>
        </div>
      </div>

      <div className="w-full h-[280px] md:h-[320px] flex items-end justify-between relative mt-[20px] pb-[30px]">
        {/* Y-axis Guides */}
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-[30px] z-0">
          {[400, 300, 200, 100, 0].map(val => (
            <div key={val} className="w-full border-t border-border/50 border-dashed flex items-end">
              <span className="text-[11px] font-bold text-muted -mt-[16px] bg-card pr-2">{val}M</span>
            </div>
          ))}
        </div>

        {/* Data Bars */}
        <div className="w-full h-full flex justify-around items-end relative z-10 pl-[40px]">
          {data.map((d, i) => (
            <div key={i} className="flex flex-col items-center justify-end h-full relative group">
              <div className="flex items-end gap-[2px] md:gap-[4px] h-full relative">
                {/* Revenue Bar */}
                <div 
                  className="w-[12px] md:w-[24px] bg-[#10b981] rounded-t-[4px] hover:opacity-80 transition-opacity"
                  style={{ height: `${(d.revenue / 400) * 100}%` }}
                />
                {/* Expense Bar */}
                <div 
                  className="w-[12px] md:w-[24px] bg-rose-500 rounded-t-[4px] hover:opacity-80 transition-opacity"
                  style={{ height: `${(d.expense / 400) * 100}%` }}
                />
                {/* Profit Bar */}
                <div 
                  className="w-[12px] md:w-[24px] bg-[#6366f1] rounded-t-[4px] hover:opacity-80 transition-opacity"
                  style={{ height: `${(d.profit / 400) * 100}%` }}
                />
              </div>

              {/* Debt Line Point (Simulated with absolute position) */}
              <div 
                className="absolute w-[8px] h-[8px] md:w-[12px] md:h-[12px] bg-card border-2 border-[#f97316] rounded-full z-20"
                style={{ bottom: `calc(${(d.debt / 400) * 100}% + 30px)` }}
              />

              <div className="absolute -bottom-[30px] font-bold text-[12px] text-muted group-hover:text-text transition-colors">
                {d.name}
              </div>

              {/* Tooltip on hover */}
              <div className="absolute -top-[80px] bg-popover border border-border shadow-lg p-[10px] rounded-[10px] opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-30 flex flex-col gap-1 w-[140px] left-1/2 -translate-x-1/2">
                <span className="font-bold text-[11px] text-muted mb-1">{d.name}/2026</span>
                <span className="font-bold text-[12px] text-[#10b981] leading-none">Thu: {d.revenue}M</span>
                <span className="font-bold text-[12px] text-rose-500 leading-none">Chi: {d.expense}M</span>
                <span className="font-bold text-[12px] text-[#6366f1] leading-none">Lãi: {d.profit}M</span>
                <span className="font-bold text-[12px] text-[#f97316] leading-none">Nợ: {d.debt}M</span>
              </div>
            </div>
          ))}

          {/* SVG Line to connect Debt Points */}
          <svg className="absolute inset-0 w-full h-[calc(100%-30px)] pointer-events-none z-10" preserveAspectRatio="none">
            <polyline 
              fill="none" 
              stroke="#f97316" 
              strokeWidth="2"
              strokeDasharray="4 4"
              points={data.map((d, i) => `${(i + 0.5) * (100 / data.length)}%,${100 - (d.debt / 400) * 100}%`).join(' ')}
            />
          </svg>
        </div>
      </div>
    </div>
  );
}
