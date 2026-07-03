"use client";

import React, { useState } from "react";
import { Search, SlidersHorizontal, ArrowUpDown } from "lucide-react";
import { SearchInput } from "@/components/ui/SearchInput";
import { Button } from "@/components/ui/Button";

export default function OperationsFilters() {
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  return (
    <div className={`flex items-center gap-[12px] bg-card border border-border rounded-[16px] h-[56px] p-[6px] px-[6px] py-0 shadow-sm w-full relative overflow-visible ${isFilterOpen ? 'z-[150]' : 'z-20'}`}>
      
      {/* Search - integrated into the bar */}
      <SearchInput 
        placeholder="Tìm tiêu đề, mã phòng, người phụ trách..." 
        className="flex-1 h-full border-0 shadow-none bg-transparent"
      />

      {/* Desktop Actions */}
      <div className="hidden md:flex items-center gap-2 px-2 h-full shrink-0 border-l border-border/50">
        <Button variant="ghost" className="h-9 gap-2">
          <ArrowUpDown size={14} className="text-muted" />
          <span>Sắp xếp</span>
        </Button>
        <Button onClick={() => setIsFilterOpen(true)} className="h-9 gap-2 bg-success text-white hover:bg-success/90 shadow-success/20">
          <SlidersHorizontal size={14} />
          <span>Bộ lọc</span>
        </Button>
      </div>
    </div>
  );
}
