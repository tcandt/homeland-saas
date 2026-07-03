import React from "react";
import { TrendingUp, AlertTriangle, User, TrendingDown, Sparkles } from "lucide-react";

export default function AIInsights() {
  return (
    <section className="bg-card border border-border rounded-2xl p-4 mb-5 shadow-sm flex flex-col md:flex-row md:items-center gap-4">
      <div className="flex items-center justify-between md:justify-start md:min-w-[200px]">
        <div className="flex items-center gap-2">
          <Sparkles className="text-[#4f46e5]" size={20} />
          <h3 className="font-black text-sm text-text m-0">AI HomeLand Insights</h3>
        </div>
        <a href="#" className="text-[#4f46e5] text-xs font-bold md:hidden">Xem tất cả {`>`}</a>
      </div>

      <div className="flex-1 flex flex-col md:flex-row gap-3">
        <InsightCard 
          icon={<TrendingUp size={16} className="text-[#ef4444]" />}
          iconColor="text-[#ef4444]" 
          title="Công nợ tăng" 
          value="18%"
          desc="So với cùng kỳ tháng trước"
        />
        <div className="hidden md:block w-px bg-border my-2"></div>
        <InsightCard 
          icon={<AlertTriangle size={16} className="text-[#f97316]" />}
          iconColor="text-[#f97316]" 
          title="LK08.25 tỷ lệ lấp đầy thấp" 
          desc="Giảm 10% so với tháng trước"
        />
        <div className="hidden md:block w-px bg-border my-2"></div>
        <InsightCard 
          icon={<User size={16} className="text-[#eab308]" />}
          iconColor="text-[#eab308]" 
          title="3 khách có nguy cơ nợ xấu" 
          desc="Tổng nợ: 25.600.000 đ"
        />
        <div className="hidden md:block w-px bg-border my-2"></div>
        <InsightCard 
          icon={<TrendingDown size={16} className="text-[#22c55e]" />}
          iconColor="text-[#22c55e]" 
          title="Doanh thu dự báo giảm" 
          desc="Tháng tới giảm 12.000.000 đ"
        />
      </div>

      <a href="#" className="hidden md:block text-[#4f46e5] text-xs font-bold whitespace-nowrap ml-4">Xem tất cả {`>`}</a>
    </section>
  );
}

function InsightCard({ icon, iconColor, title, value, desc }: any) {
  return (
    <div className="flex items-center gap-3 bg-black/5 dark:bg-white/5 md:bg-transparent p-3 md:p-0 rounded-xl flex-1">
      <div className="md:hidden">
        {icon}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-1.5 mb-0.5">
          <div className="hidden md:block">{icon}</div>
          <span className="font-bold text-xs text-text">{title}</span>
          {value && <span className={`font-bold text-xs ${iconColor}`}>{value}</span>}
        </div>
        <div className="text-[11px] font-medium text-muted">{desc}</div>
      </div>
      <div className="md:hidden text-muted">{`>`}</div>
    </div>
  );
}
