import React from "react";
import { Receipt, AlertTriangle, CheckCircle2, Percent } from "lucide-react";
import { Card } from "../ui/Card";

export default function InvoicesKpi() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-[12px] md:gap-[20px]">
      <KpiCard 
        title="Chờ thanh toán" 
        value="0" 
        trend="0" 
        trendUp={true}
        trendColor="text-muted"
        icon={<Receipt size={16} className="text-[#3b82f6]" />}
        iconBg="bg-[#3b82f6]/10"
        blobColor="bg-[#3b82f6]/10"
      />
      <KpiCard 
        title="Quá hạn" 
        value="0" 
        trend="0" 
        trendUp={true}
        trendColor="text-[#ef4444]"
        icon={<AlertTriangle size={16} className="text-[#ef4444]" />}
        iconBg="bg-[#ef4444]/10"
        highlight={true}
        blobColor="bg-[#ef4444]/10"
      />
      <KpiCard 
        title="Đã thanh toán" 
        value="0" 
        trend="0" 
        trendUp={true}
        trendColor="text-muted"
        icon={<CheckCircle2 size={16} className="text-[#22c55e]" />}
        iconBg="bg-[#22c55e]/10"
        blobColor="bg-[#22c55e]/10"
      />
      <KpiCard 
        title="Tỷ lệ thu hồi" 
        value="0%" 
        trend="0%" 
        trendUp={true}
        icon={<Percent size={16} className="text-[#8b5cf6]" />}
        iconBg="bg-[#8b5cf6]/10"
        blobColor="bg-[#8b5cf6]/10"
      />
    </div>
  );
}

function KpiCard({ title, value, trend, trendUp, trendColor, icon, iconBg, highlight, blobColor }: any) {
  return (
    <Card className={`p-[16px] md:p-[20px] flex flex-col justify-between relative overflow-hidden transition-all hover:shadow-md z-0 ${highlight ? 'border-[#ef4444]/30 shadow-md ring-1 ring-[#ef4444]/10' : ''}`}>
      {blobColor && <div className={`hidden md:block absolute top-0 right-0 w-[80px] h-[80px] ${blobColor} rounded-full blur-[24px] -z-10`} />}
      <div className="flex items-center gap-[10px] mb-[12px]">
        <div className={`w-[32px] h-[32px] rounded-[10px] flex items-center justify-center shrink-0 ${iconBg}`}>
          {icon}
        </div>
        <div className={`text-[11px] md:text-[12px] font-bold ${highlight ? 'text-[#ef4444]' : 'text-muted'} uppercase tracking-wide`}>{title}</div>
      </div>
      
      <div className="flex flex-col flex-1 justify-end">
        <div className="text-[18px] md:text-[24px] xl:text-[28px] font-black text-text mb-[6px] leading-none tracking-tight">{value}</div>
        <div className="flex items-center gap-[6px] text-[11px] font-bold whitespace-nowrap">
          <span className={trendColor || (trendUp ? 'text-[#22c55e]' : 'text-[#ef4444]')}>
            {trendUp ? (trendColor ? '' : '↑ ') : (trendColor ? '' : '↓ ')}{trend}
          </span>
          <span className="text-muted font-medium">so với tháng trước</span>
        </div>
      </div>
      
      {highlight && (
        <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-gradient-to-br from-[#ef4444]/20 to-transparent rounded-full blur-2xl pointer-events-none -z-10"></div>
      )}
    </Card>
  );
}
