import React from "react";
import { Receipt, AlertTriangle, CheckCircle2, TrendingUp, Clock, FileText } from "lucide-react";
import { Card } from "../ui/Card";

export default function OperationsBillingKpi() {
  const kpis = [
    { label: "Chờ thanh toán", value: "34", unit: "hóa đơn", icon: Clock, color: "text-[#f97316]", bg: "bg-[#f97316]/10", border: "border-[#f97316]/20" },
    { label: "Quá hạn", value: "14", unit: "hóa đơn", icon: AlertTriangle, color: "text-rose-500", bg: "bg-rose-500/10", border: "border-rose-500/20" },
    { label: "Đã thanh toán", value: "156", unit: "hóa đơn", icon: CheckCircle2, color: "text-[#10b981]", bg: "bg-[#10b981]/10", border: "border-[#10b981]/20" },
    { label: "Thanh toán 1 phần", value: "5", unit: "hóa đơn", icon: FileText, color: "text-[#0ea5e9]", bg: "bg-[#0ea5e9]/10", border: "border-[#0ea5e9]/20" },
    { label: "Tổng phải thu", value: "850M", unit: "VNĐ", icon: Receipt, color: "text-[#6366f1]", bg: "bg-[#6366f1]/10", border: "border-[#6366f1]/20" },
    { label: "Tỷ lệ thu hồi", value: "92%", unit: "", icon: TrendingUp, color: "text-[#10b981]", bg: "bg-[#10b981]/10", border: "border-[#10b981]/20" },
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
