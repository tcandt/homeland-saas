"use client";

import React from "react";
import { Search, SlidersHorizontal, ListFilter, X, ChevronDown } from "lucide-react";

export default function OperationsSalesFilters() {
  return (
    <div className="flex flex-col md:flex-row md:items-center gap-[12px] bg-card border border-border p-[8px] md:p-[10px] rounded-[16px] shadow-sm">
      
      {/* Search Input */}
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-[16px] top-1/2 -translate-y-1/2 text-muted" size={16} />
        <input 
          type="text" 
          placeholder="Tìm tên KH, SĐT, Email..." 
          className="w-full h-[40px] pl-[40px] pr-[16px] rounded-[10px] bg-background border border-border text-[13px] text-text placeholder:text-muted focus:outline-none focus:border-[#6366f1] focus:ring-1 focus:ring-[#6366f1] transition-all"
        />
      </div>

      {/* Filter Selects */}
      <div className="flex items-center gap-[8px] overflow-x-auto no-scrollbar pb-1 md:pb-0">
        <FilterSelect placeholder="Nguồn Lead" />
        <FilterSelect placeholder="Sales Phụ Trách" />
        <FilterSelect placeholder="Tòa Nhà" />
        <FilterSelect placeholder="Mức Độ Nóng" />
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-[8px] shrink-0 border-t md:border-t-0 md:border-l border-border pt-2 md:pt-0 md:pl-2">
        <button className="h-[40px] px-[16px] rounded-[10px] bg-background border border-border hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-[6px] text-[13px] font-bold text-text transition-colors">
          <SlidersHorizontal size={14} className="text-muted" /> Nâng cao
        </button>
        <button className="h-[40px] px-[16px] rounded-[10px] bg-background border border-border hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-[6px] text-[13px] font-bold text-text transition-colors">
          <ListFilter size={14} className="text-muted" /> Sắp xếp
        </button>
        <button className="h-[40px] w-[40px] flex items-center justify-center rounded-[10px] hover:bg-rose-500/10 text-muted hover:text-rose-500 transition-colors" title="Xóa bộ lọc">
          <X size={16} />
        </button>
      </div>

    </div>
  );
}

function FilterSelect({ placeholder }: { placeholder: string }) {
  return (
    <div className="relative shrink-0">
      <select className="h-[40px] pl-[16px] pr-[36px] rounded-[10px] bg-background border border-border text-[13px] font-medium text-text appearance-none hover:border-muted focus:outline-none focus:border-[#6366f1] transition-all cursor-pointer">
        <option value="" disabled hidden>{placeholder}</option>
        <option value="1">Option 1</option>
        <option value="2">Option 2</option>
      </select>
      <ChevronDown className="absolute right-[12px] top-1/2 -translate-y-1/2 text-muted pointer-events-none" size={14} />
    </div>
  );
}
