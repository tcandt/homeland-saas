"use client";

import React, { useState } from "react";
import { Search, SlidersHorizontal, ArrowUpDown, ChevronDown } from "lucide-react";
import { SearchInput } from "../ui/SearchInput";
import { Button } from "../ui/Button";

export default function TenantFilters() {
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  return (
    <div data-testid="tenants-filter-bar" className={`flex items-center gap-3 w-full relative ${isFilterOpen ? 'z-[150]' : 'z-20'}`}>
      
      {/* Search */}
      <div className="flex-1">
        <SearchInput placeholder="Tìm tên khách, SĐT, mã hợp đồng..." />
      </div>

      {/* Desktop Actions */}
      <div className="hidden md:flex items-center gap-2 shrink-0">
        <Button variant="secondary">
          <ArrowUpDown size={16} className="mr-2" />
          Sắp xếp
        </Button>
        <Button onClick={() => setIsFilterOpen(true)} variant="primary">
          <SlidersHorizontal size={16} className="mr-2" />
          Bộ lọc
        </Button>
      </div>

    </div>
  );
}
