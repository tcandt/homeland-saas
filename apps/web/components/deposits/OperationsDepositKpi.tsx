import React from "react";
import { Coins, ShieldCheck, Clock, AlertTriangle, CheckCircle2, Wallet } from "lucide-react";
import { useDepositStatsQuery } from "@/lib/queries/deposits.queries";
import { useDepositStore } from "@/lib/stores/deposit.store";
import { Card } from "../ui/Card";
import { Skeleton } from "../ui/Skeleton";

export default function OperationsDepositKpi() {
  const { buildingFilter } = useDepositStore();
  const { data: statsData, isLoading } = useDepositStatsQuery(buildingFilter !== 'ALL' ? buildingFilter : undefined);
  const kpi = statsData?.kpi || {};

  if (isLoading) {
    return (
      <div data-testid="deposits-kpi-grid" className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-[16px]">
        {Array.from({ length: 6 }).map((_, idx) => (
          <Card key={idx} className="p-[16px] flex flex-col justify-center gap-[8px] h-[80px] md:h-[90px] shadow-sm">
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="w-[28px] h-[28px] rounded-full" />
            </div>
            <div className="flex items-end gap-[6px]">
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-3 w-8 mb-[2px]" />
            </div>
          </Card>
        ))}
      </div>
    );
  }

  const totalFund = Number(kpi.totalFund) || 0;
  const securityFund = Number(kpi.securityFund) || 0;
  const bookingFund = Number(kpi.bookingFund) || 0;
  const refundPendingCount = Number(kpi.refundPendingCount) || 0;
  const refundOverdueCount = Number(kpi.refundOverdueCount) || 0;
  const refundedCount = Number(kpi.refundedCount) || 0;

  const formatMillions = (val: number) => {
    if (val >= 1000000) {
      return `${(val / 1000000).toFixed(1).replace(/\.0$/, '')}M`;
    }
    return val.toLocaleString() + " đ";
  };

  const kpis = [
    { label: "Tổng quỹ cọc", value: formatMillions(totalFund), unit: "", icon: Wallet, color: "text-[#6366f1]", bg: "bg-[#6366f1]/10", border: "border-[#6366f1]/20" },
    { label: "Cọc bảo đảm", value: formatMillions(securityFund), unit: "", icon: ShieldCheck, color: "text-[#8b5cf6]", bg: "bg-[#8b5cf6]/10", border: "border-[#8b5cf6]/20" },
    { label: "Cọc giữ chỗ", value: formatMillions(bookingFund), unit: "", icon: Coins, color: "text-[#f97316]", bg: "bg-[#f97316]/10", border: "border-[#f97316]/20" },
    { label: "Sắp hoàn tiền", value: refundPendingCount.toString(), unit: "phiếu", icon: Clock, color: "text-[#0ea5e9]", bg: "bg-[#0ea5e9]/10", border: "border-[#0ea5e9]/20" },
    { label: "Hoàn quá hạn", value: refundOverdueCount.toString(), unit: "phiếu", icon: AlertTriangle, color: "text-rose-500", bg: "bg-rose-500/10", border: "border-rose-500/20" },
    { label: "Đã hoàn (Tháng)", value: refundedCount.toString(), unit: "phiếu", icon: CheckCircle2, color: "text-muted", bg: "bg-black/5 dark:bg-white/5", border: "border-border" },
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
