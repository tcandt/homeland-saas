import React from "react";
import { Building2, LayoutGrid, Home, UserX, AlertTriangle, Wallet } from "lucide-react";
import { Card } from "@/components/ui/Card";

export default function BuildingKpi() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 md:gap-4">
      <KpiCard 
        icon={<Building2 size={22} className="text-primary drop-shadow-sm" />} 
        iconBg="bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20"
        value="4"
        label="Tổng tòa nhà"
        glowColor="hover:shadow-[0_8px_30px_rgb(99,102,241,0.15)] hover:border-primary/30"
      />
      <KpiCard 
        icon={<LayoutGrid size={22} className="text-success drop-shadow-sm" />} 
        iconBg="bg-gradient-to-br from-success/20 to-success/5 border border-success/20"
        value="37 / 40"
        label="Tổng số phòng"
        glowColor="hover:shadow-[0_8px_30px_rgb(16,185,129,0.15)] hover:border-success/30"
      />
      <KpiCard 
        icon={<Home size={22} className="text-yellow-500 drop-shadow-sm" />} 
        iconBg="bg-gradient-to-br from-yellow-500/20 to-yellow-500/5 border border-yellow-500/20"
        value="87%"
        label="Tỷ lệ lấp đầy"
        glowColor="hover:shadow-[0_8px_30px_rgb(245,158,11,0.15)] hover:border-yellow-500/30"
      />
      <KpiCard 
        icon={<UserX size={22} className="text-info drop-shadow-sm" />} 
        iconBg="bg-gradient-to-br from-info/20 to-info/5 border border-info/20"
        value="3"
        label="Phòng trống"
        glowColor="hover:shadow-[0_8px_30px_rgb(6,182,212,0.15)] hover:border-info/30"
      />
      <KpiCard 
        icon={<AlertTriangle size={22} className="text-danger drop-shadow-sm" />} 
        iconBg="bg-gradient-to-br from-danger/20 to-danger/5 border border-danger/20"
        value="6"
        label="Hóa đơn quá hạn"
        subValue="42.500.000 đ"
        subColor="text-danger"
        glowColor="hover:shadow-[0_8px_30px_rgb(244,63,94,0.15)] hover:border-danger/30"
      />
      <KpiCard 
        icon={<Wallet size={22} className="text-success drop-shadow-sm" />} 
        iconBg="bg-gradient-to-br from-success/20 to-success/5 border border-success/20"
        value="285M đ"
        label="Doanh thu tháng này"
        glowColor="hover:shadow-[0_8px_30px_rgb(34,197,94,0.15)] hover:border-success/30"
      />
    </div>
  );
}

function KpiCard({ icon, iconBg, value, label, subValue, subColor, glowColor }: any) {
  return (
    <Card className={`group relative bg-card/40 backdrop-blur-md flex items-center gap-4 hover:-translate-y-1 transition-all duration-300 cursor-pointer overflow-hidden ${glowColor}`}>
      <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-inner ${iconBg} transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3`}>
        {icon}
      </div>
      <div className="flex flex-col min-w-0 z-10 justify-center">
        <div className="flex items-baseline gap-1.5 flex-wrap">
          <span className="font-black text-2xl tracking-tight text-text leading-none">{value}</span>
        </div>
        <span className="text-xs font-medium text-muted mt-1 truncate group-hover:text-text/80 transition-colors">{label}</span>
        {subValue && (
          <span className={`text-xs font-black mt-1 ${subColor || 'text-text'}`}>{subValue}</span>
        )}
      </div>
    </Card>
  );
}
