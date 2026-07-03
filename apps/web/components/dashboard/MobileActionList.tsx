import React from "react";
import { AlertTriangle, Calendar, Sparkles, ChevronRight } from "lucide-react";

export default function MobileActionList() {
  return (
    <div className="bg-card border border-border rounded-[16px] p-[16px] shadow-sm flex flex-col gap-[14px]">
      <div className="flex items-center justify-between">
        <h3 className="font-black text-[13px] text-text m-0">Việc cần xử lý ngay</h3>
        <a href="#" className="text-[#4f46e5] text-[11px] font-bold hover:underline flex items-center gap-1">
          Xem tất cả <ChevronRight size={12} />
        </a>
      </div>

      <div className="flex flex-col gap-[12px]">
        <ActionItem 
          icon={<AlertTriangle size={14} className="text-[#ef4444]" />}
          iconColor="bg-[#ef4444]/10"
          title="Hóa đơn INV-00121 đã quá hạn"
          time="Hôm qua"
          timeColor="text-[#ef4444]"
        />
        <div className="h-px bg-border/50 w-full"></div>
        <ActionItem 
          icon={<Calendar size={14} className="text-[#f97316]" />}
          iconColor="bg-[#f97316]/10"
          title="Hợp đồng HD-202 sắp hết hạn"
          time="5 ngày nữa"
          timeColor="text-[#f97316]"
        />
        <div className="h-px bg-border/50 w-full"></div>
        <ActionItem 
          icon={<Sparkles size={14} className="text-[#eab308]" />}
          iconColor="bg-[#eab308]/10"
          title="Phòng 301 cần dọn dẹp"
          time="Hôm nay"
          timeColor="text-[#eab308]"
        />
      </div>
    </div>
  );
}

function ActionItem({ icon, iconColor, title, time, timeColor }: any) {
  return (
    <div className="flex items-center justify-between cursor-pointer group">
      <div className="flex items-center gap-[10px]">
        <div className={`w-[28px] h-[28px] rounded-[8px] flex items-center justify-center shrink-0 ${iconColor}`}>
          {icon}
        </div>
        <div className="font-bold text-[12px] text-text">{title}</div>
      </div>
      <div className="flex items-center gap-1">
        <span className={`text-[10px] font-bold ${timeColor}`}>{time}</span>
        <ChevronRight size={14} className="text-muted" />
      </div>
    </div>
  );
}
