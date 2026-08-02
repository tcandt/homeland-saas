import React from "react";
import { Wallet, ShieldCheck, Clock, UserPlus } from "lucide-react";
import { Card } from "../ui/Card";
import { useDepositsQuery } from "@/lib/queries/deposits.queries";

export default function DepositsKpi() {
  const { data } = useDepositsQuery({});
  const items = data?.data?.items || [];

  const totalFund = items
    .filter((d: any) => d.status === "PAID" || d.status === "CONVERTED_TO_CONTRACT")
    .reduce((sum: number, d: any) => sum + (Number(d.amount) || 0), 0);

  const securityFund = items
    .filter((d: any) => d.type === "SECURITY" && (d.status === "PAID" || d.status === "CONVERTED_TO_CONTRACT"))
    .reduce((sum: number, d: any) => sum + (Number(d.amount) || 0), 0);

  const bookingFund = items
    .filter((d: any) => (d.type === "BOOKING" || d.type === "RESERVATION") && (d.status === "PAID" || d.status === "CONVERTED_TO_CONTRACT"))
    .reduce((sum: number, d: any) => sum + (Number(d.amount) || 0), 0);

  const refundPending = items
    .filter((d: any) => d.status === "REFUNDED")
    .reduce((sum: number, d: any) => sum + (Number(d.amount) || 0), 0);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-[12px] md:gap-[20px]">
      <KpiCard 
        title="Tổng quỹ cọc" 
        value={totalFund.toLocaleString() + " đ"} 
        icon={<Wallet size={16} className="text-[#3b82f6]" />}
        iconBg="bg-[#3b82f6]/10"
        highlight={totalFund > 0}
        blobColor="bg-[#3b82f6]/10"
      />
      <KpiCard 
        title="Cọc bảo đảm (HĐ)" 
        value={securityFund.toLocaleString() + " đ"} 
        icon={<ShieldCheck size={16} className="text-[#22c55e]" />}
        iconBg="bg-[#22c55e]/10"
        blobColor="bg-[#22c55e]/10"
      />
      <KpiCard 
        title="Cọc giữ chỗ" 
        value={bookingFund.toLocaleString() + " đ"} 
        icon={<UserPlus size={16} className="text-[#8b5cf6]" />}
        iconBg="bg-[#8b5cf6]/10"
        blobColor="bg-[#8b5cf6]/10"
      />
      <KpiCard 
        title="Sắp hoàn trả" 
        value={refundPending.toLocaleString() + " đ"} 
        icon={<Clock size={16} className="text-[#f97316]" />}
        iconBg="bg-[#f97316]/10"
        blobColor="bg-[#f97316]/10"
      />
    </div>
  );
}

function KpiCard({ title, value, trend, trendUp, trendColor, icon, iconBg, highlight, blobColor }: any) {
  return (
    <Card className={`p-[16px] md:p-[20px] flex flex-col justify-between relative overflow-hidden transition-all hover:shadow-md z-0 ${highlight ? 'border-[#3b82f6]/30 shadow-md ring-1 ring-[#3b82f6]/10' : ''}`}>
      {blobColor && <div className={`hidden md:block absolute top-0 right-0 w-[80px] h-[80px] ${blobColor} rounded-full blur-[24px] -z-10`} />}
      <div className="flex items-center gap-[10px] mb-[12px]">
        <div className={`w-[32px] h-[32px] rounded-[10px] flex items-center justify-center shrink-0 ${iconBg}`}>
          {icon}
        </div>
        <div className={`text-[11px] md:text-[12px] font-bold ${highlight ? 'text-[#3b82f6]' : 'text-muted'} uppercase tracking-wide`}>{title}</div>
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
        <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-gradient-to-br from-[#3b82f6]/20 to-transparent rounded-full blur-2xl pointer-events-none -z-10"></div>
      )}
    </Card>
  );
}
