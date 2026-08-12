import React from "react";
import { Receipt, AlertTriangle, CheckCircle2, TrendingUp, Clock, FileText } from "lucide-react";
import { Card } from "../ui/Card";
import { Skeleton } from "../ui/Skeleton";
import { getInvoicesFinancialSummary } from "@/lib/invoices/invoice-financials";
import { useInvoicesQuery } from "@/lib/queries/invoices.queries";

export default function OperationsBillingKpi() {
  const { data, isLoading } = useInvoicesQuery();
  const invoices: any[] = (data as any)?.data || [];

  if (isLoading) {
    return (
      <div data-testid="invoices-kpi-grid" className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-[16px]">
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

  const pendingCount = invoices.filter((inv: any) => inv.status === "ISSUED" || inv.status === "DRAFT").length;
  const overdueCount = invoices.filter((inv: any) => inv.status === "OVERDUE").length;
  const paidCount = invoices.filter((inv: any) => inv.status === "PAID").length;
  const partialCount = invoices.filter((inv: any) => inv.status === "PARTIALLY_PAID").length;

  const invoiceSummary = getInvoicesFinancialSummary(invoices);
  const totalReceivable = invoiceSummary.remaining;
  const recoveryRate = invoiceSummary.total > 0 ? Math.round((invoiceSummary.settled / invoiceSummary.total) * 100) : 0;

  const formatMillions = (val: number) => {
    if (val >= 1000000) {
      return `${(val / 1000000).toFixed(1).replace(/\.0$/, '')}M`;
    }
    return val.toLocaleString();
  };

  const kpis = [
    { label: "Chờ thanh toán", value: pendingCount.toString(), unit: "hóa đơn", icon: Clock, color: "text-[#f97316]", bg: "bg-[#f97316]/10", border: "border-[#f97316]/20" },
    { label: "Quá hạn", value: overdueCount.toString(), unit: "hóa đơn", icon: AlertTriangle, color: "text-rose-500", bg: "bg-rose-500/10", border: "border-rose-500/20" },
    { label: "Đã thanh toán", value: paidCount.toString(), unit: "hóa đơn", icon: CheckCircle2, color: "text-[#8b5cf6]", bg: "bg-[#8b5cf6]/10", border: "border-[#8b5cf6]/20" },
    { label: "Thanh toán 1 phần", value: partialCount.toString(), unit: "hóa đơn", icon: FileText, color: "text-[#0ea5e9]", bg: "bg-[#0ea5e9]/10", border: "border-[#0ea5e9]/20" },
    { label: "Tổng phải thu", value: formatMillions(totalReceivable), unit: "VNĐ", icon: Receipt, color: "text-[#6366f1]", bg: "bg-[#6366f1]/10", border: "border-[#6366f1]/20" },
    { label: "Tỷ lệ thu hồi", value: `${recoveryRate}%`, unit: "", icon: TrendingUp, color: "text-[#8b5cf6]", bg: "bg-[#8b5cf6]/10", border: "border-[#8b5cf6]/20" },
  ];

  return (
    <div data-testid="invoices-kpi-grid" className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-[16px]">
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
          
          <div className={`absolute -right-4 -bottom-4 w-16 h-16 rounded-full blur-xl opacity-0 group-hover:opacity-20 transition-opacity duration-300 ${kpi.bg.replace('/10', '')}`} />
        </Card>
      ))}
    </div>
  );
}
