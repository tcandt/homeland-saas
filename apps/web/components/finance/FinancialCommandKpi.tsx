import React from "react";
import { Building, CheckCircle, DollarSign, Minus, PieChart, TrendingUp, Wallet } from "lucide-react";
import { useDashboardQuery } from "@/lib/queries/dashboard.queries";

export default function FinancialCommandKpi() {
  const { data: dashboard, isLoading } = useDashboardQuery();

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-[12px] md:gap-[16px]">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="bg-card/50 animate-pulse border border-border rounded-[16px] h-[80px] md:h-[90px]" />
        ))}
      </div>
    );
  }

  const kpisData = (dashboard as any)?.kpisRaw || {};
  const occupancy = (dashboard as any)?.occupancy || {};
  const collectionRate = Number(kpisData.totalRevenue || 0) + Number(kpisData.totalDebt || 0) > 0
    ? Math.round((Number(kpisData.totalRevenue || 0) / (Number(kpisData.totalRevenue || 0) + Number(kpisData.totalDebt || 0))) * 100)
    : 0;

  const kpis = [
    { label: "Tiền mặt ròng", value: Number(kpisData.netCashFlow || 0).toLocaleString("vi-VN"), unit: "VNĐ", icon: DollarSign, color: "text-[#8b5cf6]", bg: "bg-[#8b5cf6]/10", trendUp: Number(kpisData.netCashFlow || 0) >= 0 },
    { label: "Doanh thu P&L", value: Number(kpisData.totalRevenue || 0).toLocaleString("vi-VN"), unit: "VNĐ", icon: TrendingUp, color: "text-[#6366f1]", bg: "bg-[#6366f1]/10", trendUp: true },
    { label: "Chi phí P&L", value: Number(kpisData.totalExpense || 0).toLocaleString("vi-VN"), unit: "VNĐ", icon: Wallet, color: "text-rose-500", bg: "bg-rose-500/10", trendUp: false },
    { label: "Lợi nhuận ròng", value: Number(kpisData.netProfit || 0).toLocaleString("vi-VN"), unit: "VNĐ", icon: PieChart, color: Number(kpisData.netProfit || 0) >= 0 ? "text-[#8b5cf6]" : "text-rose-500", bg: Number(kpisData.netProfit || 0) >= 0 ? "bg-[#8b5cf6]/10" : "bg-rose-500/10", trendUp: Number(kpisData.netProfit || 0) >= 0 },
    { label: "Phải thu", value: Number(kpisData.totalDebt || 0).toLocaleString("vi-VN"), unit: "VNĐ", icon: Minus, color: "text-[#f97316]", bg: "bg-[#f97316]/10", trendUp: false },
    { label: "Tiền cọc giữ", value: Number(kpisData.depositHeld || 0).toLocaleString("vi-VN"), unit: "VNĐ", icon: Building, color: "text-[#0ea5e9]", bg: "bg-[#0ea5e9]/10", trendUp: true },
    { label: "Tỷ lệ thu", value: `${collectionRate}%`, unit: "", icon: CheckCircle, color: "text-[#8b5cf6]", bg: "bg-[#8b5cf6]/10", trendUp: true },
    { label: "Lấp đầy", value: String(Math.round(Number(occupancy.rate || 0))), unit: "%", icon: TrendingUp, color: "text-[#a855f7]", bg: "bg-[#a855f7]/10", trendUp: true },
  ];

  return (
    <div data-testid="finance-kpi-grid" className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-[12px] md:gap-[16px]">
      {kpis.map((kpi) => (
        <div
          key={kpi.label}
          className="bg-card border border-border rounded-[16px] p-[16px] flex flex-col justify-between h-[80px] md:h-[90px] shadow-sm hover:shadow-md transition-all cursor-pointer relative overflow-hidden group"
        >
          <div className="flex items-center justify-between z-10">
            <span className="font-bold text-[11px] md:text-[12px] text-muted uppercase tracking-wide group-hover:text-text transition-colors truncate pr-2">{kpi.label}</span>
            <div className={`w-[24px] h-[24px] rounded-full flex items-center justify-center shrink-0 ${kpi.bg}`}>
              <kpi.icon size={12} className={kpi.color} />
            </div>
          </div>

          <div className="flex items-end justify-between z-10 mt-[8px]">
            <div className="flex items-baseline gap-[4px] min-w-0">
              <span className="font-black text-[16px] md:text-[18px] text-text leading-none truncate">{kpi.value}</span>
              {kpi.unit && <span className={`text-[10px] font-bold ${kpi.color}`}>{kpi.unit}</span>}
            </div>
          </div>

          <div className={`absolute -right-4 -bottom-4 w-16 h-16 rounded-full blur-xl opacity-0 group-hover:opacity-10 transition-opacity duration-300 ${kpi.bg.replace('/10', '')}`} />
        </div>
      ))}
    </div>
  );
}
