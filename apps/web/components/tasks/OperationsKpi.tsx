import React from "react";
import { ClipboardList, Clock, Loader2, CheckCircle2, ShieldCheck, MessageSquareWarning } from "lucide-react";

export default function OperationsKpi() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-[12px] md:gap-[16px]">
      <KpiCard 
        icon={<ClipboardList size={16} className="text-[#6366f1]" />} 
        iconBg="bg-[#6366f1]/10"
        value="42"
        label="Cần xử lý"
        trend="+5"
        blobColor="bg-[#6366f1]/10"
      />
      <KpiCard 
        icon={<Clock size={16} className="text-rose-500" />} 
        iconBg="bg-rose-500/10"
        value="8"
        label="Quá hạn"
        trend="+2"
        trendUp={true}
        blobColor="bg-rose-500/10"
      />
      <KpiCard 
        icon={<Loader2 size={16} className="text-[#f97316] animate-spin-slow" />} 
        iconBg="bg-[#f97316]/10"
        value="15"
        label="Đang xử lý"
        blobColor="bg-[#f97316]/10"
      />
      <KpiCard 
        icon={<CheckCircle2 size={16} className="text-[#a855f7]" />} 
        iconBg="bg-[#a855f7]/10"
        value="6"
        label="Chờ duyệt"
        blobColor="bg-[#a855f7]/10"
      />
      <KpiCard 
        icon={<ShieldCheck size={16} className="text-[#10b981]" />} 
        iconBg="bg-[#10b981]/10"
        value="12"
        label="Hoàn thành"
        trend="+4"
        blobColor="bg-[#10b981]/10"
      />
      <KpiCard 
        icon={<MessageSquareWarning size={16} className="text-amber-500" />} 
        iconBg="bg-amber-500/10"
        value="5"
        label="Tin chưa đọc"
        blobColor="bg-amber-500/10"
      />
    </div>
  );
}

function KpiCard({ icon, iconBg, value, label, trend, trendUp, blobColor }: any) {
  return (
    <div className="bg-card border border-border rounded-[16px] p-[16px] flex flex-col justify-between shadow-sm relative overflow-hidden group hover:border-[#6366f1]/50 hover:shadow-md transition-all duration-300 min-h-[80px] md:min-h-[90px]">
      <div className={`absolute -right-6 -top-6 w-[80px] h-[80px] ${blobColor} rounded-full blur-[20px] opacity-50 group-hover:opacity-100 transition-opacity duration-300`} />
      <div className="flex items-center justify-between relative z-10">
        <span className="text-[12px] font-bold text-muted uppercase tracking-wider">{label}</span>
        <div className={`w-[28px] h-[28px] rounded-[8px] flex items-center justify-center ${iconBg}`}>
          {icon}
        </div>
      </div>
      <div className="flex items-end gap-[8px] mt-[4px] relative z-10">
        <span className="font-black text-[22px] md:text-[26px] text-text leading-none">{value}</span>
        {trend && (
          <span className={`text-[12px] font-bold mb-[2px] ${trendUp ? 'text-rose-500' : 'text-[#10b981]'}`}>
            {trend}
          </span>
        )}
      </div>
    </div>
  );
}
