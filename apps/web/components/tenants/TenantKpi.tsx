import React from "react";
import { Users, CalendarClock, AlertTriangle, UserPlus, Clock, ShieldAlert } from "lucide-react";
import { Card } from "../ui/Card";

export default function TenantKpi() {
  return (
    <div data-testid="tenants-kpi-grid" className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-[12px] md:gap-[16px]">
      <KpiCard 
        icon={<Users size={16} className="text-[#4f46e5]" />} 
        iconBg="bg-[#4f46e5]/10"
        value="145"
        label="Tổng khách"
        blobColor="bg-[#4f46e5]/10"
      />
      <KpiCard 
        icon={<UserPlus size={16} className="text-[#10b981]" />} 
        iconBg="bg-[#10b981]/10"
        value="24"
        label="Khách mới"
        blobColor="bg-[#10b981]/10"
      />
      <KpiCard 
        icon={<CalendarClock size={16} className="text-[#f97316]" />} 
        iconBg="bg-[#f97316]/10"
        value="12"
        label="Sắp hết HĐ"
        blobColor="bg-[#f97316]/10"
      />
      <KpiCard 
        icon={<AlertTriangle size={16} className="text-[#ef4444]" />} 
        iconBg="bg-[#ef4444]/10"
        value="42M"
        label="Công nợ"
        blobColor="bg-[#ef4444]/10"
      />
      <KpiCard 
        icon={<Clock size={16} className="text-rose-500" />} 
        iconBg="bg-rose-500/10"
        value="5"
        label="Quá hạn"
        blobColor="bg-rose-500/10"
      />
      <KpiCard 
        icon={<ShieldAlert size={16} className="text-red-600" />} 
        iconBg="bg-red-600/10"
        value="3"
        label="Rủi ro cao"
        blobColor="bg-red-600/10"
      />
    </div>
  );
}

function KpiCard({ icon, iconBg, value, label, subValue, subColor, blobColor }: any) {
  return (
    <Card className="p-4 h-[86px] flex items-center gap-3 hover:-translate-y-0.5 transition-transform duration-200 cursor-pointer relative overflow-hidden z-0">
      {blobColor && <div className={`hidden md:block absolute top-0 right-0 w-[60px] h-[60px] ${blobColor} rounded-full blur-[20px] -z-10`} />}
      <div className={`w-[36px] h-[36px] rounded-[10px] flex items-center justify-center shrink-0 ${iconBg}`}>
        {icon}
      </div>
      <div className="flex flex-col min-w-0">
        <span className="font-black text-[18px] text-text leading-none">{value}</span>
        <span className="text-[12px] font-bold text-muted mt-1 truncate">{label}</span>
        {subValue && (
          <span className={`text-[11px] font-bold mt-0.5 ${subColor || 'text-text'}`}>{subValue}</span>
        )}
      </div>
    </Card>
  );
}
