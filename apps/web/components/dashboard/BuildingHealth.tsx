import React from "react";
import { ChevronRight } from "lucide-react";
import { useDashboardData } from "@/app/dashboard-context";

export default function BuildingHealth() {
  const data = useDashboardData();
  const buildings = ((data as any).buildings || (data as any).buildingHealth || []).slice(0, 4).map((b: any) => ({
    name: b.id,
    rooms: `${b.rooms} phòng`,
    health: b.fillRate,
    occupied: `${Math.round((b.fillRate / 100) * b.rooms)}/${b.rooms}`,
    empty: String(b.rooms - Math.round((b.fillRate / 100) * b.rooms)),
    warning: "0",
    warningType: b.status,
    warningColor: b.statusType === "success" ? "text-[#22c55e]" : b.statusType === "danger" ? "text-[#ef4444]" : "text-[#f97316]"
  }));

  return (
    <div className="bg-card border border-border rounded-[20px] p-[20px] md:p-[24px] shadow-sm flex flex-col h-full">
      <div className="flex justify-between items-center mb-[20px]">
        <h3 className="font-black text-[14px] md:text-[14px] text-text md:uppercase m-0">Tình hình tòa nhà</h3>
        <a href="#" className="text-[#4f46e5] text-[13px] font-bold hover:underline">Xem tất cả <ChevronRight size={14} className="inline md:hidden" /></a>
      </div>

      <div className="flex flex-col gap-[16px] flex-1">
        {buildings.map((b: any, i: number) => (
          <div key={i} className="flex flex-col md:flex-row md:items-center justify-between pb-[16px] border-b border-border/50 last:border-0 last:pb-0">
            
            {/* --- DESKTOP LAYOUT --- */}
            <div className="hidden md:flex items-center justify-between w-full">
              {/* Image + Name */}
              <div className="flex items-center gap-[12px] w-[110px]">
                <div className="w-[36px] h-[36px] rounded-[8px] bg-black/20 dark:bg-white/20 overflow-hidden shrink-0">
                  <img src={`https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=100&h=100&fit=crop`} alt={b.name} className="w-full h-full object-cover" />
                </div>
                <div>
                  <div className="font-bold text-[13px] text-text leading-tight">{b.name}</div>
                  <div className="text-[11px] text-muted font-medium">{b.rooms}</div>
                </div>
              </div>

              {/* Circular Progress */}
              <div className="w-[36px] h-[36px] relative shrink-0">
                <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
                  <circle cx="18" cy="18" r="15.9154943" fill="none" stroke="#f1f5f9" strokeWidth="3" />
                  <circle cx="18" cy="18" r="15.9154943" fill="none" stroke={b.health === 100 ? "#22c55e" : "#10b981"} strokeWidth="3" strokeDasharray={`${b.health} 100`} strokeLinecap="round" className="transition-all duration-1000 ease-out" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center font-bold text-[11px] text-text">{b.health}%</div>
              </div>

              {/* Occupied */}
              <div className="text-center w-[50px]">
                <div className="font-black text-[13px] text-text leading-tight">{b.occupied}</div>
                <div className="text-[10px] text-muted font-medium">Đang thuê</div>
              </div>

              {/* Empty */}
              <div className="text-center w-[60px]">
                <div className="font-black text-[13px] text-text leading-tight">{b.empty}</div>
                <div className="text-[10px] text-muted font-medium">Phòng trống</div>
              </div>

              {/* Warning */}
              <div className="text-center w-[85px]">
                <div className={`font-black text-[13px] leading-tight ${b.warningColor}`}>{b.warning}</div>
                <div className={`text-[10px] font-bold ${b.warningColor}`}>{b.warningType}</div>
              </div>

              {/* Arrow */}
              <button className="w-[24px] h-[24px] rounded-full border border-border flex items-center justify-center text-muted hover:bg-black/5 dark:hover:bg-white/5 shrink-0 transition-colors">
                <ChevronRight size={14} />
              </button>
            </div>


            {/* --- MOBILE LAYOUT --- */}
            <div className="flex md:hidden items-center justify-between w-full">
              {/* Image + Name */}
              <div className="flex items-center gap-[10px] w-[100px] shrink-0">
                <div className="w-[40px] h-[40px] rounded-[10px] bg-black/20 dark:bg-white/20 overflow-hidden shrink-0">
                  <img src={`https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=100&h=100&fit=crop`} alt={b.name} className="w-full h-full object-cover" />
                </div>
                <div>
                  <div className="font-bold text-[14px] text-text leading-tight">{b.name}</div>
                  <div className="text-[11px] text-muted font-medium mt-0.5">{b.rooms}</div>
                </div>
              </div>

              {/* Horizontal Progress Bar */}
              <div className="flex-1 flex items-center gap-3 px-2">
                <div className="flex-1 h-[4px] bg-black/5 dark:bg-white/5 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-[#22c55e] rounded-full" 
                    style={{ width: `${b.health}%` }}
                  ></div>
                </div>
                <span className="font-bold text-[12px] text-text">{b.health}%</span>
              </div>

              {/* Status Text + Arrow */}
              <div className="flex items-center gap-2 shrink-0">
                <div className="flex flex-col items-end justify-center">
                  {b.empty === "0" ? (
                    <div className="text-[11px] font-bold text-[#22c55e]">{b.warningType}</div>
                  ) : (
                    <>
                      <div className="text-[10px] font-bold text-[#22c55e] mb-[2px]">{b.empty} phòng trống</div>
                      <div className={`text-[10px] font-bold ${b.warningColor}`}>{b.warning} {b.warningType}</div>
                    </>
                  )}
                </div>
                <ChevronRight size={16} className="text-muted" />
              </div>
            </div>

          </div>
        ))}
      </div>

      <a href="#" className="hidden md:block mt-[20px] text-center py-[12px] border border-border/80 rounded-[12px] text-[#4f46e5] text-[13px] font-bold hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
        Xem báo cáo chi tiết {`->`}
      </a>
    </div>
  );
}
