import React from "react";
import { Users, PhoneCall, CheckCircle2, TrendingUp } from "lucide-react";

export default function SalesKpi() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-[12px] md:gap-[20px]">
      <KpiCard 
        title="Tổng Khách (Leads)" 
        value="45" 
        trend="+12 khách" 
        trendUp={true}
        icon={<Users size={16} className="text-[#3b82f6]" />}
        iconBg="bg-[#3b82f6]/10"
        blobColor="bg-[#3b82f6]/10"
      />
      <KpiCard 
        title="Đang chăm sóc" 
        value="18" 
        trend="Hẹn xem phòng: 5" 
        trendUp={true}
        trendColor="text-[#f97316]"
        icon={<PhoneCall size={16} className="text-[#f97316]" />}
        iconBg="bg-[#f97316]/10"
        highlight={true}
        blobColor="bg-[#f97316]/10"
      />
      <KpiCard 
        title="Chốt thành công" 
        value="12" 
        trend="Tháng này" 
        trendUp={true}
        trendColor="text-muted"
        icon={<CheckCircle2 size={16} className="text-[#22c55e]" />}
        iconBg="bg-[#22c55e]/10"
        blobColor="bg-[#22c55e]/10"
      />
      <KpiCard 
        title="Tỷ lệ chuyển đổi" 
        value="26.6%" 
        trend="+2.1%" 
        trendUp={true}
        icon={<TrendingUp size={16} className="text-[#8b5cf6]" />}
        iconBg="bg-[#8b5cf6]/10"
        blobColor="bg-[#8b5cf6]/10"
      />
    </div>
  );
}

function KpiCard({ title, value, trend, trendUp, trendColor, icon, iconBg, highlight, blobColor }: any) {
  return (
    <div className={`bg-card border ${highlight ? 'border-[#f97316]/30 shadow-md ring-1 ring-[#f97316]/10' : 'border-border shadow-sm'} rounded-[14px] md:rounded-[20px] p-[16px] md:p-[20px] flex flex-col justify-between relative overflow-hidden transition-all hover:shadow-md z-0`}>
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
            {trendUp ? (trendColor ? '' : '↑ ') : (trendColor ? '' : '↓ ')}{trend}
          </span>
          <span className="text-muted font-medium">so với tháng trước</span>
        </div>
      </div>
      
      {highlight && (
        <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-gradient-to-br from-[#f97316]/20 to-transparent rounded-full blur-2xl pointer-events-none -z-10"></div>
      )}
    </div>
  );
}
