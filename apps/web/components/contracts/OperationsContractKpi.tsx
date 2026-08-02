import React from "react";
import { FileText, FileCheck, Clock, PenTool, AlertTriangle, FileX } from "lucide-react";
import { Card } from "../ui/Card";
import { useContractsQuery } from "@/lib/queries/contracts.queries";

export default function OperationsContractKpi() {
  const { data } = useContractsQuery();
  const contracts = (data as any)?.data || [];

  const totalCount = contracts.length;
  const activeCount = contracts.filter((c: any) => c.status === "ACTIVE").length;
  
  const expiringCount = contracts.filter((c: any) => {
    if (c.status === "EXPIRING") return true;
    if (c.status !== "ACTIVE") return false;
    const end = new Date(c.endDate).getTime();
    const now = new Date().getTime();
    const daysLeft = (end - now) / (1000 * 3600 * 24);
    return daysLeft >= 0 && daysLeft <= 30;
  }).length;

  const pendingSignCount = contracts.filter((c: any) => c.status === "DRAFT" || c.status === "PENDING_APPROVAL" || c.status === "APPROVED").length;
  const debtCount = contracts.filter((c: any) => Number(c.debt) > 0).length;
  const terminatedCount = contracts.filter((c: any) => c.status === "TERMINATED" || c.status === "EXPIRED").length;

  const kpis = [
    { label: "Tổng hợp đồng", value: totalCount.toString(), unit: "", icon: FileText, color: "text-[#6366f1]", bg: "bg-[#6366f1]/10", border: "border-[#6366f1]/20" },
    { label: "Đang hiệu lực", value: activeCount.toString(), unit: "", icon: FileCheck, color: "text-[#8b5cf6]", bg: "bg-[#8b5cf6]/10", border: "border-[#8b5cf6]/20" },
    { label: "Sắp hết hạn", value: expiringCount.toString(), unit: "", icon: Clock, color: "text-[#f97316]", bg: "bg-[#f97316]/10", border: "border-[#f97316]/20" },
    { label: "Chờ ký", value: pendingSignCount.toString(), unit: "", icon: PenTool, color: "text-[#0ea5e9]", bg: "bg-[#0ea5e9]/10", border: "border-[#0ea5e9]/20" },
    { label: "Có công nợ", value: debtCount.toString(), unit: "", icon: AlertTriangle, color: "text-rose-500", bg: "bg-rose-500/10", border: "border-rose-500/20" },
    { label: "Đã chấm dứt", value: terminatedCount.toString(), unit: "", icon: FileX, color: "text-muted", bg: "bg-black/5 dark:bg-white/5", border: "border-border" },
  ];

  return (
    <div data-testid="contracts-kpi-grid" className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-[16px]">
      {kpis.map((kpi, idx) => (
        <Card 
          key={idx} 
          className="p-[16px] flex flex-col justify-center gap-[8px] h-[80px] md:h-[90px] shadow-sm hover:shadow-md hover:-translate-y-[2px] transition-all cursor-pointer relative overflow-hidden group"
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
        </Card>
      ))}
    </div>
  );
}
