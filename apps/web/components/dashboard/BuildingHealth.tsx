import React from "react";
import { Building2, ChevronRight } from "lucide-react";
import { useDashboardData } from "@/app/dashboard-context";

export default function BuildingHealth() {
  const data = useDashboardData();
  const buildings = ((data as any).buildingHealth || []).slice(0, 4).map((building: any) => ({
    code: building.id || building.code || building.name,
    name: building.name || building.id,
    rooms: Number(building.rooms || 0),
    health: Number(building.fillRate || 0),
    occupied: Number(building.occupied || 0),
    empty: Number(building.vacant || 0),
    warning: Number(building.warning || 0),
    warningType: building.status || "Ổn định",
    warningColor: building.statusType === "success" ? "text-[#22c55e]" : building.statusType === "danger" ? "text-[#ef4444]" : building.statusType === "pending" ? "text-[#f97316]" : "text-[#f97316]",
    comingSoon: building.statusType === "pending" || building.layoutStatus === "pending",
  }));

  return (
    <div className="bg-card border border-border rounded-[20px] p-[20px] md:p-[24px] shadow-sm flex flex-col h-full">
      <div className="flex justify-between items-center mb-[20px]">
        <h3 className="font-black text-[14px] md:text-[14px] text-text md:uppercase m-0">Tình hình tòa nhà</h3>
        <a href="/buildings" className="text-[#4f46e5] text-[13px] font-bold hover:underline">Xem tất cả <ChevronRight size={14} className="inline md:hidden" /></a>
      </div>

      {buildings.length === 0 ? (
        <div className="flex flex-1 items-center justify-center py-8 text-center text-[13px] font-bold text-muted">
          Chưa có tòa nhà nào trong DB.
        </div>
      ) : (
        <div className="flex flex-col gap-[16px] flex-1">
          {buildings.map((building: any) => (
            <div key={building.code} className="flex flex-col md:flex-row md:items-center justify-between pb-[16px] border-b border-border/50 last:border-0 last:pb-0">
              <div className="hidden md:flex items-center justify-between w-full">
                <div className="flex items-center gap-[12px] w-[130px]">
                  <div className="w-[36px] h-[36px] rounded-[8px] bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Building2 size={17} />
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-[13px] text-text leading-tight truncate">{building.code}</div>
                    <div className="text-[11px] text-muted font-medium">{building.comingSoon ? "Coming Soon" : `${building.rooms} phòng`}</div>
                  </div>
                </div>

                <ProgressRing value={building.health} />

                <Metric value={building.comingSoon ? "—" : `${building.occupied}/${building.rooms}`} label="Đang thuê" />
                <Metric value={building.comingSoon ? "—" : String(building.empty)} label="Phòng trống" />

                <div className="text-center w-[95px]">
                  <div className={`font-black text-[13px] leading-tight ${building.warningColor}`}>{building.warning}</div>
                  <div className={`text-[10px] font-bold ${building.warningColor}`}>{building.warningType}</div>
                </div>

                <a href={`/buildings/${building.code}`} className="w-[24px] h-[24px] rounded-full border border-border flex items-center justify-center text-muted hover:bg-black/5 dark:hover:bg-white/5 shrink-0 transition-colors">
                  <ChevronRight size={14} />
                </a>
              </div>

              <div className="flex md:hidden items-center justify-between w-full">
                <div className="flex items-center gap-[10px] w-[112px] shrink-0">
                  <div className="w-[40px] h-[40px] rounded-[10px] bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Building2 size={18} />
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-[14px] text-text leading-tight truncate">{building.code}</div>
                    <div className="text-[11px] text-muted font-medium mt-0.5">{building.comingSoon ? "Coming Soon" : `${building.rooms} phòng`}</div>
                  </div>
                </div>

                <div className="flex-1 flex items-center gap-3 px-2">
                  <div className="flex-1 h-[4px] bg-black/5 dark:bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-[#22c55e] rounded-full" style={{ width: `${building.health}%` }} />
                  </div>
                  <span className="font-bold text-[12px] text-text">{building.comingSoon ? "—%" : `${building.health}%`}</span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex flex-col items-end justify-center">
                    <div className="text-[10px] font-bold text-[#22c55e] mb-[2px]">{building.comingSoon ? "Chưa có thông tin phòng" : `${building.empty} phòng trống`}</div>
                    <div className={`text-[10px] font-bold ${building.warningColor}`}>{building.warning} {building.warningType}</div>
                  </div>
                  <ChevronRight size={16} className="text-muted" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <a href="/buildings" className="hidden md:block mt-[20px] text-center py-[12px] border border-border/80 rounded-[12px] text-[#4f46e5] text-[13px] font-bold hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
        Xem báo cáo chi tiết -&gt;
      </a>
    </div>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center w-[60px]">
      <div className="font-black text-[13px] text-text leading-tight">{value}</div>
      <div className="text-[10px] text-muted font-medium">{label}</div>
    </div>
  );
}

function ProgressRing({ value }: { value: number }) {
  return (
    <div className="w-[36px] h-[36px] relative shrink-0">
      <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
        <circle cx="18" cy="18" r="15.9154943" fill="none" stroke="#f1f5f9" strokeWidth="3" />
        <circle cx="18" cy="18" r="15.9154943" fill="none" stroke={value === 100 ? "#22c55e" : "#8b5cf6"} strokeWidth="3" strokeDasharray={`${value} 100`} strokeLinecap="round" className="transition-all duration-1000 ease-out" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center font-bold text-[11px] text-text">{value}%</div>
    </div>
  );
}
