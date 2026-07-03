import React from "react";
import { Coins, ShieldCheck, Clock, AlertTriangle, CheckCircle2, Wallet } from "lucide-react";

export default function OperationsDepositKpi() {
  const kpis = [
    { label: "Tổng quỹ cọc", value: "345M", unit: "", icon: Wallet, color: "text-[#6366f1]", bg: "bg-[#6366f1]/10", border: "border-[#6366f1]/20" },
    { label: "Cọc bảo đảm", value: "280M", unit: "", icon: ShieldCheck, color: "text-[#10b981]", bg: "bg-[#10b981]/10", border: "border-[#10b981]/20" },
    { label: "Cọc giữ chỗ", value: "65M", unit: "", icon: Coins, color: "text-[#f97316]", bg: "bg-[#f97316]/10", border: "border-[#f97316]/20" },
    { label: "Sắp hoàn tiền", value: "5", unit: "phiếu", icon: Clock, color: "text-[#0ea5e9]", bg: "bg-[#0ea5e9]/10", border: "border-[#0ea5e9]/20" },
    { label: "Hoàn quá hạn", value: "2", unit: "phiếu", icon: AlertTriangle, color: "text-rose-500", bg: "bg-rose-500/10", border: "border-rose-500/20" },
    { label: "Đã hoàn (Tháng)", value: "18", unit: "phiếu", icon: CheckCircle2, color: "text-muted", bg: "bg-black/5 dark:bg-white/5", border: "border-border" },
  ];

  return (
    <div data-testid="deposits-kpi-grid" className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-[16px]">
      {kpis.map((kpi, idx) => (
        <div 
          key={idx} 
          className="bg-card border border-border rounded-[16px] p-[16px] flex flex-col justify-center gap-[8px] h-[80px] md:h-[90px] shadow-sm hover:shadow-md hover:-translate-y-[2px] transition-all cursor-pointer relative overflow-hidden group"
        >
          <div className="flex items-center justify-between z-10">
            <span className="font-bold text-[12px] md:text-[13px] text-muted uppercase tracking-wide group-hover:text-text transition-colors">{kpi.label}</span>
            <div className={`w-[28px] h-[28px] rounded-full flex items-center justify-center ${kpi.bg}`}>
              <kpi.icon size={14} className={kpi.color} />
            </div>
          </div>
          <div className="flex items-end gap-[6px] z-10">
            <span className="font-black text-[24px] md:text-[28px] text-text leading-none">{kpi.value}</span>
            {kpi.unit && <span className={`text-[12px] font-bold mb-[2px] ${kpi.color}`}>{kpi.unit}</span>}
          </div>
          
          {/* Subtle gradient background effect on hover */}
          <div className={`absolute -right-4 -bottom-4 w-16 h-16 rounded-full blur-xl opacity-0 group-hover:opacity-20 transition-opacity duration-300 ${kpi.bg.replace('/10', '')}`} />
        </div>
      ))}
    </div>
  );
}
