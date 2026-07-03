"use client";

import React from "react";
import { SlidersHorizontal, ChevronDown, X } from "lucide-react";
import { Card } from "../ui/Card";
import { SearchInput } from "../ui/SearchInput";
import { Button } from "../ui/Button";

export default function OperationsBillingFilters() {
  const [hasFilters, setHasFilters] = React.useState(false);
  const [searchValue, setSearchValue] = React.useState("");

  return (
    <Card data-testid="invoices-filter-bar" className="p-[8px] flex items-center justify-between">
      <div className="flex items-center gap-[8px] flex-1 overflow-x-auto no-scrollbar">
        {/* Search */}
        <SearchInput 
          placeholder="Tìm mã hóa đơn, khách, phòng..." 
          className="w-[280px] shrink-0"
          value={searchValue}
          onChange={(e) => {
            setSearchValue(e.target.value);
            setHasFilters(e.target.value.length > 0);
          }}
        />

        {/* Filters */}
        <button aria-label="Filter by status" className="shrink-0 h-[40px] px-[16px] bg-transparent hover:bg-black/5 dark:hover:bg-white/5 rounded-[10px] border border-border flex items-center gap-[8px] transition-colors">
          <span className="text-[13px] font-bold text-text">Trạng thái</span>
          <ChevronDown size={14} className="text-muted" />
        </button>
        <button aria-label="Filter by month" className="shrink-0 h-[40px] px-[16px] bg-transparent hover:bg-black/5 dark:hover:bg-white/5 rounded-[10px] border border-border flex items-center gap-[8px] transition-colors">
          <span className="text-[13px] font-bold text-text">Tháng</span>
          <ChevronDown size={14} className="text-muted" />
        </button>
        <button aria-label="Filter by debt" className="shrink-0 h-[40px] px-[16px] bg-transparent hover:bg-black/5 dark:hover:bg-white/5 rounded-[10px] border border-border flex items-center gap-[8px] transition-colors hidden xl:flex">
          <span className="text-[13px] font-bold text-text">Công nợ</span>
          <ChevronDown size={14} className="text-muted" />
        </button>
      </div>

      <div className="flex items-center gap-[8px] pl-[8px] border-l border-border/50 shrink-0">
        {hasFilters && (
          <Button 
            variant="ghost"
            onClick={() => {
              setSearchValue("");
              setHasFilters(false);
            }}
            className="text-muted hover:text-text font-bold"
          >
            <X size={14} className="mr-2" /> Xóa lọc
          </Button>
        )}
        <button aria-label="Sắp xếp" className="h-[40px] px-[16px] bg-black/5 hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10 rounded-[10px] border border-border flex items-center gap-[8px] transition-colors">
          <SlidersHorizontal size={14} className="text-text" />
          <span className="text-[13px] font-bold text-text hidden sm:block">Sắp xếp</span>
        </button>
      </div>
    </Card>
  );
}
