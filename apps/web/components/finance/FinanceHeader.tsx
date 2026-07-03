import React from "react";
import { Download, Calendar, Filter } from "lucide-react";

export default function FinanceHeader() {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-end gap-4">

      <div className="flex items-center gap-2">
        <div className="flex items-center bg-card border border-border rounded-[10px] p-1 shadow-sm overflow-hidden">
          <button className="px-3 py-1.5 text-[12px] font-bold text-muted hover:text-text transition-colors">Tháng trước</button>
          <div className="w-px h-[14px] bg-border mx-1"></div>
          <button className="px-3 py-1.5 text-[12px] font-bold bg-[#4f46e5]/10 text-[#4f46e5] rounded-[6px] transition-colors">Tháng này</button>
          <div className="w-px h-[14px] bg-border mx-1"></div>
          <button className="px-3 py-1.5 text-[12px] font-bold text-muted hover:text-text transition-colors flex items-center gap-1.5">
            <Calendar size={14} /> Tùy chỉnh
          </button>
        </div>

        <button className="hidden md:flex items-center gap-2 px-4 py-[10px] bg-card hover:bg-black/5 dark:hover:bg-white/5 border border-border rounded-[10px] text-[13px] font-bold text-text transition-colors shadow-sm">
          <Download size={16} /> Xuất báo cáo
        </button>
        
        {/* Mobile Filter */}
        <button className="md:hidden w-[38px] h-[38px] flex items-center justify-center bg-card border border-border rounded-[10px] text-text shadow-sm">
          <Filter size={16} />
        </button>
      </div>
    </div>
  );
}
