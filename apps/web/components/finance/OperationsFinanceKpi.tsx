import React from "react";
import { TrendingUp, TrendingDown, DollarSign, Wallet, Minus, FileWarning, AlertTriangle, PieChart } from "lucide-react";

export default function OperationsFinanceKpi() {
  const kpis = [
    { label: "Tổng thu", value: "345.5M", unit: "VNĐ", icon: DollarSign, color: "text-[#10b981]", bg: "bg-[#10b981]/10", border: "border-[#10b981]/20", trend: "+12.5%", trendUp: true },
    { label: "Tổng chi", value: "85.2M", unit: "VNĐ", icon: Wallet, color: "text-rose-500", bg: "bg-rose-500/10", border: "border-rose-500/20", trend: "-5.2%", trendUp: false },
    { label: "Lợi nhuận ròng", value: "260.3M", unit: "VNĐ", icon: TrendingUp, color: "text-[#6366f1]", bg: "bg-[#6366f1]/10", border: "border-[#6366f1]/20", trend: "+18.4%", trendUp: true },
    { label: "Biên lợi nhuận", value: "75.3%", unit: "", icon: PieChart, color: "text-[#0ea5e9]", bg: "bg-[#0ea5e9]/10", border: "border-[#0ea5e9]/20", trend: "+2.1%", trendUp: true },
    { label: "Công nợ thu", value: "125.0M", unit: "VNĐ", icon: Minus, color: "text-[#f97316]", bg: "bg-[#f97316]/10", border: "border-[#f97316]/20", trend: "+8.5%", trendUp: false },
    { label: "Tiền đã thu", value: "220.5M", unit: "VNĐ", icon: DollarSign, color: "text-[#10b981]", bg: "bg-[#10b981]/10", border: "border-[#10b981]/20", trend: "+15.2%", trendUp: true },
    { label: "Chưa đối soát", value: "12", unit: "GD", icon: FileWarning, color: "text-[#a855f7]", bg: "bg-[#a855f7]/10", border: "border-[#a855f7]/20", trend: "-2", trendUp: true },
    { label: "Chi bất thường", value: "3", unit: "GD", icon: AlertTriangle, color: "text-rose-500", bg: "bg-rose-500/10", border: "border-rose-500/20", trend: "+1", trendUp: false },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-[12px] md:gap-[16px]">
      {kpis.map((kpi, idx) => (
        <div 
          key={idx} 
          className="bg-card border border-border rounded-[16px] p-[16px] flex flex-col justify-between h-[80px] md:h-[90px] shadow-sm hover:shadow-md transition-all cursor-pointer relative overflow-hidden group"
        >
          <div className="flex items-center justify-between z-10">
            <span className="font-bold text-[11px] md:text-[12px] text-muted uppercase tracking-wide group-hover:text-text transition-colors truncate pr-2">{kpi.label}</span>
            <div className={`w-[24px] h-[24px] rounded-full flex items-center justify-center shrink-0 ${kpi.bg}`}>
              <kpi.icon size={12} className={kpi.color} />
            </div>
          </div>
          
          <div className="flex items-end justify-between z-10 mt-[8px]">
            <div className="flex items-baseline gap-[4px]">
              <span className="font-black text-[18px] md:text-[22px] text-text leading-none">{kpi.value}</span>
              {kpi.unit && <span className={`text-[10px] font-bold ${kpi.color}`}>{kpi.unit}</span>}
            </div>
            <div className="flex items-center gap-[2px]">
              {kpi.trendUp ? <TrendingUp size={10} className="text-[#10b981]" /> : <TrendingDown size={10} className="text-rose-500" />}
              <span className={`text-[10px] font-bold ${kpi.trendUp ? 'text-[#10b981]' : 'text-rose-500'}`}>{kpi.trend}</span>
            </div>
          </div>
          
          <div className={`absolute -right-4 -bottom-4 w-16 h-16 rounded-full blur-xl opacity-0 group-hover:opacity-10 transition-opacity duration-300 ${kpi.bg.replace('/10', '')}`} />
        </div>
      ))}
    </div>
  );
}
