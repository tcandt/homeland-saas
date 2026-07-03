"use client";

import React from "react";
import { Search, SlidersHorizontal, ChevronDown, X } from "lucide-react";
import { SearchInput } from "../ui/SearchInput";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";

export default function OperationsContractFilters() {
  const [hasFilters, setHasFilters] = React.useState(false);

  return (
    <Card data-testid="contracts-filter-bar" className="p-2 flex items-center justify-between">
      <div className="flex items-center gap-2 flex-1">
        {/* Search */}
        <div className="w-[320px]">
          <SearchInput 
            placeholder="Tìm theo mã HĐ, tên khách, số phòng..." 
            onChange={(e) => setHasFilters(e.target.value.length > 0)}
          />
        </div>

        {/* Filters */}
        <Button variant="ghost" className="h-10">
          Trạng thái
          <ChevronDown size={14} className="ml-2 text-muted" />
        </Button>
        <Button variant="ghost" className="h-10">
          Tòa nhà / Phòng
          <ChevronDown size={14} className="ml-2 text-muted" />
        </Button>
        <Button variant="ghost" className="h-10">
          Thời hạn
          <ChevronDown size={14} className="ml-2 text-muted" />
        </Button>
        <Button variant="ghost" className="h-10">
          Công nợ
          <ChevronDown size={14} className="ml-2 text-muted" />
        </Button>
      </div>

      <div className="flex items-center gap-2">
        {hasFilters && (
          <Button 
            variant="ghost"
            onClick={() => setHasFilters(false)}
            className="text-muted hover:text-text h-10"
          >
            <X size={14} className="mr-1.5" /> Xóa lọc
          </Button>
        )}
        <Button variant="secondary" className="h-10">
          <SlidersHorizontal size={14} className="mr-2" />
          Sắp xếp
        </Button>
      </div>
    </Card>
  );
}
