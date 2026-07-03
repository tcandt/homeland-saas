import React from "react";
import { ArrowUpRight, ArrowDownRight, DollarSign, Receipt, AlertCircle, Wallet } from "lucide-react";

export default function FinanceKpi() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-[12px] md:gap-[20px]">
      <KpiCard 
        title="Tổng Thu" 
        value="345.500.000 đ" 
        trend="15.2%" 
        trendUp={true}
        icon={<ArrowUpRight size={16} className="text-[#22c55e]" />}
        iconBg="bg-[#22c55e]/10"
        blobColor="bg-[#22c55e]/10"
      />
      <KpiCard 
        title="Tổng Chi" 
        value="82.400.000 đ" 
        trend="4.1%" 
        trendUp={false} // chi tăng là không tốt nhưng context này trend mũi tên lên
        trendColor="text-[#ef4444]"
        icon={<ArrowDownRight size={16} className="text-[#ef4444]" />}
        iconBg="bg-[#ef4444]/10"
        blobColor="bg-[#ef4444]/10"
      />
      <KpiCard 
        title="Lợi nhuận ròng" 
        value="263.100.000 đ" 
        trend="18.5%" 
        trendUp={true}
        icon={<Wallet size={16} className="text-[#4f46e5]" />}
        iconBg="bg-[#4f46e5]/10"
        highlight={true}
        blobColor="bg-[#4f46e5]/10"
      />
      <KpiCard 
        title="Nợ đọng (Phải thu)" 
        value="45.000.000 đ" 
        trend="2.4%" 
        trendUp={false}
        trendColor="text-[#22c55e]" // nợ giảm là tốt
        icon={<AlertCircle size={16} className="text-[#f97316]" />}
        iconBg="bg-[#f97316]/10"
        blobColor="bg-[#f97316]/10"
      />
    </div>
  );
}

function KpiCard({ title, value, trend, trendUp, trendColor, icon, iconBg, highlight, blobColor }: any) {
  return (
    <div className={`bg-card border ${highlight ? 'border-[#4f46e5]/30 shadow-md ring-1 ring-[#4f46e5]/10' : 'border-border shadow-sm'} rounded-[14px] md:rounded-[20px] p-[16px] md:p-[20px] flex flex-col justify-between relative overflow-hidden transition-all hover:shadow-md z-0`}>
      {blobColor && <div className={`hidden md:block absolute top-0 right-0 w-[80px] h-[80px] ${blobColor} rounded-full blur-[24px] -z-10`} />}
      <div className="flex items-center gap-[10px] mb-[12px]">
        <div className={`w-[32px] h-[32px] rounded-[10px] flex items-center justify-center shrink-0 ${iconBg}`}>
          {icon}
        </div>
        <div className={`text-[11px] md:text-[12px] font-bold ${highlight ? 'text-[#4f46e5]' : 'text-muted'} uppercase tracking-wide`}>{title}</div>
      </div>
      
      <div className="flex flex-col flex-1 justify-end">
        <div className="text-[18px] md:text-[24px] xl:text-[28px] font-black text-text mb-[6px] leading-none tracking-tight">{value}</div>
        <div className="flex items-center gap-[6px] text-[11px] font-bold whitespace-nowrap">
          <span className={trendColor || (trendUp ? 'text-[#22c55e]' : 'text-[#ef4444]')}>
            {trendUp ? '↑' : '↓'} {trend}
          </span>
          <span className="text-muted font-medium">so với tháng trước</span>
        </div>
      </div>
      
      {/* Background decoration for highlighted card */}
      {highlight && (
        <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-gradient-to-br from-[#4f46e5]/20 to-transparent rounded-full blur-2xl pointer-events-none -z-10"></div>
      )}
    </div>
  );
}
