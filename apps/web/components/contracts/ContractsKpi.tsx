import React from "react";
import { FileText, Clock, FileWarning, CheckCircle2 } from "lucide-react";
import { Card } from "../ui/Card";
import { useContractsQuery } from "@/lib/queries/contracts.queries";

export default function ContractsKpi() {
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
  
  const terminatedCount = contracts.filter((c: any) => c.status === "TERMINATED" || c.status === "EXPIRED" || c.status === "EXPIRED").length;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-[12px] md:gap-[20px]">
      <KpiCard 
        title="Tổng hợp đồng" 
        value={totalCount.toString()} 
        icon={<FileText size={16} className="text-[#3b82f6]" />}
        iconBg="bg-[#3b82f6]/10"
        blobColor="bg-[#3b82f6]/10"
      />
      <KpiCard 
        title="Đang hiệu lực" 
        value={activeCount.toString()} 
        icon={<CheckCircle2 size={16} className="text-[#22c55e]" />}
        iconBg="bg-[#22c55e]/10"
        blobColor="bg-[#22c55e]/10"
      />
      <KpiCard 
        title="Sắp hết hạn" 
        value={expiringCount.toString()} 
        icon={<Clock size={16} className="text-[#f97316]" />}
        iconBg="bg-[#f97316]/10"
        highlight={expiringCount > 0}
        blobColor="bg-[#f97316]/10"
      />
      <KpiCard 
        title="Đã chấm dứt" 
        value={terminatedCount.toString()} 
        icon={<FileWarning size={16} className="text-muted" />}
        iconBg="bg-black/5 dark:bg-white/5"
        blobColor="bg-black/5 dark:bg-white/5"
      />
    </div>
  );
}

function KpiCard({ title, value, trend, trendUp, trendColor, icon, iconBg, highlight, blobColor }: any) {
  return (
    <Card className={`p-[16px] md:p-[20px] flex flex-col justify-between relative overflow-hidden transition-all hover:shadow-md z-0 ${highlight ? 'border-[#f97316]/30 shadow-md ring-1 ring-[#f97316]/10' : ''}`}>
      {blobColor && <div className={`hidden md:block absolute top-0 right-0 w-[80px] h-[80px] ${blobColor} rounded-full blur-[24px] -z-10`} />}
      <div className="flex items-center gap-[10px] mb-[12px]">
        <div className={`w-[32px] h-[32px] rounded-[10px] flex items-center justify-center shrink-0 ${iconBg}`}>
          {icon}
        </div>
        <div className={`text-[11px] md:text-[12px] font-bold ${highlight ? 'text-[#f97316]' : 'text-muted'} uppercase tracking-wide`}>{title}</div>
      </div>
      
      <div className="flex flex-col flex-1 justify-end">
        <div className="text-[18px] md:text-[24px] xl:text-[28px] font-black text-text mb-[6px] leading-none tracking-tight">{value}</div>
        <div className="flex items-center gap-[6px] text-[11px] font-bold whitespace-nowrap">
          <span className={trendColor || (trendUp ? 'text-[#22c55e]' : 'text-[#ef4444]')}>
            {trend}
          </span>
          <span className="text-muted font-medium">so với tháng trước</span>
        </div>
      </div>
      
      {highlight && (
        <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-gradient-to-br from-[#f97316]/20 to-transparent rounded-full blur-2xl pointer-events-none -z-10"></div>
      )}
    </Card>
  );
}
