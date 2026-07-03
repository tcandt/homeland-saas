"use client";

import React from "react";
import { Search, SlidersHorizontal, ChevronDown, X } from "lucide-react";

export default function OperationsFinanceFilters() {
  const [hasFilters, setHasFilters] = React.useState(false);

  return (
    <div className="bg-card border border-border rounded-[14px] p-[8px] flex items-center justify-between shadow-sm">
      <div className="flex items-center gap-[8px] flex-1 overflow-x-auto no-scrollbar">
        {/* Search */}
        <div className="relative w-[240px] shrink-0">
          <Search size={16} className="absolute left-[12px] top-1/2 -translate-y-1/2 text-muted" />
          <input 
            type="text" 
            placeholder="Tìm giao dịch, phòng, khách..." 
            className="w-full h-[40px] pl-[36px] pr-[16px] bg-black/5 dark:bg-white/5 border border-transparent rounded-[10px] text-[13px] text-text font-medium outline-none focus:bg-background focus:border-[#10b981] transition-all placeholder:text-muted/70"
            onChange={(e) => setHasFilters(e.target.value.length > 0)}
          />
        </div>

        {/* Filters */}
        <button className="shrink-0 h-[40px] px-[16px] bg-transparent hover:bg-black/5 dark:hover:bg-white/5 rounded-[10px] border border-border flex items-center gap-[8px] transition-colors">
          <span className="text-[13px] font-bold text-text">Thời gian</span>
          <ChevronDown size={14} className="text-muted" />
        </button>
        <button className="shrink-0 h-[40px] px-[16px] bg-transparent hover:bg-black/5 dark:hover:bg-white/5 rounded-[10px] border border-border flex items-center gap-[8px] transition-colors">
          <span className="text-[13px] font-bold text-text">Tòa nhà</span>
          <ChevronDown size={14} className="text-muted" />
        </button>
        <button className="shrink-0 h-[40px] px-[16px] bg-transparent hover:bg-black/5 dark:hover:bg-white/5 rounded-[10px] border border-border flex items-center gap-[8px] transition-colors hidden md:flex">
          <span className="text-[13px] font-bold text-text">Loại giao dịch</span>
          <ChevronDown size={14} className="text-muted" />
        </button>
        <button className="shrink-0 h-[40px] px-[16px] bg-transparent hover:bg-black/5 dark:hover:bg-white/5 rounded-[10px] border border-border flex items-center gap-[8px] transition-colors hidden xl:flex">
          <span className="text-[13px] font-bold text-text">Trạng thái đối soát</span>
          <ChevronDown size={14} className="text-muted" />
        </button>
      </div>

      <div className="flex items-center gap-[8px] pl-[8px] border-l border-border/50 shrink-0">
        {hasFilters && (
          <button 
            onClick={() => setHasFilters(false)}
            className="h-[40px] px-[16px] text-muted hover:text-text font-bold text-[13px] transition-colors flex items-center gap-[6px]"
          >
            <X size={14} /> Xóa lọc
          </button>
        )}
        <button className="h-[40px] px-[16px] bg-black/5 hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10 rounded-[10px] border border-border flex items-center gap-[8px] transition-colors">
          <SlidersHorizontal size={14} className="text-text" />
          <span className="text-[13px] font-bold text-text hidden sm:block">Sắp xếp</span>
        </button>
      </div>
    </div>
  );
}
