"use client";

import React, { useState } from "react";
import { Search, SlidersHorizontal, ChevronDown, X, ArrowUpDown } from "lucide-react";
import { useRoomsStore } from "@/lib/hooks/useRoomsStore";

export default function RoomFilters() {
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const { search, setSearch, buildingId, setBuildingId, status, setStatus } = useRoomsStore();
  
  return (
    <div className={`flex items-center gap-[6px] md:gap-[12px] bg-card border border-border rounded-[12px] md:rounded-[16px] h-[50px] md:h-[56px] p-[6px] md:px-[6px] md:py-0 shadow-sm w-full relative overflow-visible ${isFilterOpen ? 'z-[150]' : 'z-20'}`}>
      
      {/* Search - integrated into the bar */}
      <div className="flex items-center gap-[6px] px-[10px] md:px-[14px] h-full flex-1 bg-black/5 dark:bg-white/5 md:bg-transparent rounded-[8px] md:rounded-none">
        <Search size={16} className="text-muted shrink-0" />
        <input 
          type="text" 
          placeholder="Tìm phòng, khách..." 
          className="bg-transparent border-none outline-none w-full text-[13px] font-medium text-text placeholder:text-muted/70"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Mobile Actions */}
      <div className="flex md:hidden items-center gap-[4px] shrink-0 h-full">
        <button className="flex items-center justify-center gap-[4px] h-full px-[10px] bg-black/5 dark:bg-white/5 rounded-[8px] text-text font-bold text-[12px]">
          <ArrowUpDown size={14} className="text-muted" />
          <span className="hidden sm:inline">Sắp xếp</span>
        </button>
        <button onClick={() => setIsFilterOpen(true)} className="flex items-center justify-center gap-[4px] h-full px-[10px] bg-black/5 dark:bg-white/5 rounded-[8px] text-text font-bold text-[12px]">
          <SlidersHorizontal size={14} className="text-muted" />
          <span>Lọc</span>
        </button>
      </div>

      {/* Desktop Actions */}
      <div className="hidden md:flex items-center gap-[6px] px-[6px] h-full shrink-0">
        <button className="flex items-center justify-center gap-[6px] h-[36px] px-[16px] bg-black/5 hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10 rounded-[10px] text-text font-bold text-[13px] transition-colors">
          <ArrowUpDown size={14} className="text-muted" />
          <span>Sắp xếp</span>
        </button>
        <button onClick={() => setIsFilterOpen(true)} className="flex items-center justify-center gap-[6px] h-[36px] px-[16px] bg-[#6366f1] hover:bg-[#4f46e5] text-white rounded-[10px] font-bold text-[13px] shadow-sm transition-all shadow-[#6366f1]/20">
          <SlidersHorizontal size={14} className="text-white/80" />
          <span>Bộ lọc</span>
        </button>
      </div>

      {/* Filter Modal / Bottom Sheet */}
      {isFilterOpen && (
        <div className="fixed inset-0 z-[200] flex items-end md:items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setIsFilterOpen(false)}>
          <div 
            className="w-full md:w-[420px] bg-card rounded-t-[24px] md:rounded-[24px] p-[20px] pb-[40px] md:pb-[20px] shadow-2xl animate-in fade-in slide-in-from-bottom-10"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-[20px]">
              <h3 className="font-black text-[20px] text-text tracking-tight">Bộ lọc phòng</h3>
              <button onClick={() => setIsFilterOpen(false)} className="w-[32px] h-[32px] flex items-center justify-center bg-black/5 dark:bg-white/5 rounded-full text-muted hover:text-text transition-colors">
                <X size={16} />
              </button>
            </div>
            
            <div className="grid grid-cols-2 gap-[10px]">
              <FilterOption label="Tòa nhà" value={buildingId || "Tất cả"} onClick={() => setBuildingId(buildingId === "Tất cả" ? "" : "b1")} />
              <FilterOption label="Trạng thái" value={status || "Tất cả"} onClick={() => setStatus(status === "Tất cả" ? "" : "occupied")} />
              <FilterOption label="Loại phòng" value="Tất cả" onClick={() => {}} />
              <FilterOption label="Tầng" value="Tất cả" onClick={() => {}} />
              <FilterOption label="Tài chính" value="Tất cả" onClick={() => {}} />
              <FilterOption label="Tạm trú" value="Tất cả" onClick={() => {}} />
            </div>

            <button 
              onClick={() => setIsFilterOpen(false)}
              className="w-full mt-[20px] h-[44px] bg-[#6366f1] hover:bg-[#4f46e5] text-white rounded-[12px] font-bold text-[14px] transition-all duration-200 shadow-lg shadow-[#6366f1]/30 hover:shadow-xl hover:-translate-y-[2px]"
            >
              Áp dụng bộ lọc
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterOption({ label, value, onClick }: { label: string, value: string, onClick?: () => void }) {
  return (
    <div onClick={onClick} className="flex flex-col items-center justify-center p-[10px] md:p-[12px] bg-black/5 dark:bg-white/5 rounded-[10px] cursor-pointer hover:bg-black/10 dark:hover:bg-white/10 transition-colors text-center">
      <span className="text-[10px] md:text-[11px] font-bold text-muted uppercase tracking-wider mb-[2px]">{label}</span>
      <div className="flex items-center gap-[4px]">
        <span className="text-[13px] md:text-[14px] font-bold text-[#6366f1] truncate max-w-[80px]">{value}</span>
        <ChevronDown size={14} className="text-[#6366f1] shrink-0" />
      </div>
    </div>
  );
}

