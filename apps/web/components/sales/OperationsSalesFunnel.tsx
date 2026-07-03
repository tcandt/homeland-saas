"use client";

import React from "react";
import { ChevronRight } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

const funnelStages = [
  { id: "lead", name: "Mới Nhận", count: 24, revenue: "120M", conversion: "100%", color: "border-blue-500", bg: "bg-blue-500", text: "text-blue-500" },
  { id: "contacted", name: "Đã Gọi", count: 18, revenue: "90M", conversion: "75%", color: "border-[#0ea5e9]", bg: "bg-[#0ea5e9]", text: "text-[#0ea5e9]" },
  { id: "consulting", name: "Tư Vấn", count: 15, revenue: "85M", conversion: "62%", color: "border-[#6366f1]", bg: "bg-[#6366f1]", text: "text-[#6366f1]" },
  { id: "viewing", name: "Xem Phòng", count: 12, revenue: "70M", conversion: "50%", color: "border-purple-500", bg: "bg-purple-500", text: "text-purple-500" },
  { id: "negotiating", name: "Thương Lượng", count: 8, revenue: "45M", conversion: "33%", color: "border-[#f97316]", bg: "bg-[#f97316]", text: "text-[#f97316]" },
  { id: "deposit", name: "Đặt Cọc", count: 5, revenue: "30M", conversion: "20%", color: "border-rose-500", bg: "bg-rose-500", text: "text-rose-500" },
  { id: "won", name: "Thành Công", count: 4, revenue: "25M", conversion: "16%", color: "border-[#10b981]", bg: "bg-[#10b981]", text: "text-[#10b981]" },
  { id: "lost", name: "Thất Bại", count: 3, revenue: "0", conversion: "12%", color: "border-muted", bg: "bg-muted", text: "text-muted" },
];

export default function OperationsSalesFunnel() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeStage = searchParams.get("stage");

  const toggleStage = (id: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (activeStage === id) {
      params.delete("stage");
    } else {
      params.set("stage", id);
    }
    router.push(`?${params.toString()}`);
  };

  return (
    <div className="bg-card border border-border rounded-[16px] p-[16px] md:p-[20px] shadow-sm flex flex-col gap-[16px] overflow-hidden">
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-[8px]">
        <div>
          <h3 className="font-black text-[16px] text-text">Sales Funnel</h3>
          <p className="text-[13px] text-muted font-medium">Theo dõi hành trình khách hàng và tỷ lệ chuyển đổi</p>
        </div>
        {activeStage && (
          <button 
            onClick={() => {
              const params = new URLSearchParams(searchParams.toString());
              params.delete("stage");
              router.push(`?${params.toString()}`);
            }}
            className="text-[12px] font-bold text-rose-500 hover:text-rose-600 hover:underline px-3 py-1 bg-rose-500/10 rounded-full transition-colors self-start md:self-auto"
          >
            Bỏ chọn phễu
          </button>
        )}
      </div>

      <div className="flex w-full overflow-x-auto no-scrollbar pb-[10px]">
        {funnelStages.map((stage, index) => {
          const isActive = activeStage === stage.id;
          const isDimmed = activeStage !== null && activeStage !== stage.id;

          return (
            <div key={stage.id} className="flex items-center shrink-0 min-w-[140px] flex-1">
              {/* Stage Card */}
              <div 
                onClick={() => toggleStage(stage.id)}
                className={`flex-1 relative flex flex-col gap-[6px] p-[12px] md:p-[16px] border-t-4 bg-background/50 cursor-pointer transition-all duration-200
                  ${stage.color}
                  ${isActive ? 'bg-black/5 dark:bg-white/5 shadow-inner scale-[1.02] z-10 rounded-[8px]' : ''}
                  ${isDimmed ? 'opacity-40 hover:opacity-80' : 'hover:bg-black/5 dark:hover:bg-white/5'}
                  ${!isActive && !isDimmed ? 'rounded-[4px]' : ''}
                `}
              >
                <div className="flex items-center justify-between">
                  <span className="font-black text-[14px] text-text">{stage.name}</span>
                  <span className={`text-[12px] font-bold px-[6px] py-[2px] rounded-[4px] ${stage.text} bg-background border border-border`}>
                    {stage.count}
                  </span>
                </div>
                
                <div className="flex flex-col gap-[2px]">
                  <span className="text-[11px] font-medium text-muted">Dự kiến</span>
                  <span className="font-bold text-[14px] text-text leading-none">{stage.revenue}</span>
                </div>

                <div className="mt-[4px] flex items-center justify-between">
                  <span className="text-[11px] font-bold text-muted">Tỉ lệ</span>
                  <span className={`text-[12px] font-bold ${stage.text}`}>{stage.conversion}</span>
                </div>

                {/* Progress bar visual */}
                <div className="w-full h-[4px] bg-border rounded-full mt-[4px] overflow-hidden">
                  <div className={`h-full ${stage.bg}`} style={{ width: stage.conversion }} />
                </div>
              </div>

              {/* Separator Arrow */}
              {index < funnelStages.length - 1 && (
                <div className={`shrink-0 mx-[4px] md:mx-[8px] text-border ${isDimmed ? 'opacity-40' : ''}`}>
                  <ChevronRight size={20} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
