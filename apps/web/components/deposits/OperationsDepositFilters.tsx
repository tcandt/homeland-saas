"use client";

import React, { useState, useEffect } from "react";
import { X, Building2, SlidersHorizontal, RotateCcw } from "lucide-react";
import { useDepositStore } from "../../lib/stores/deposit.store";
import { useBuildingsQuery } from "../../lib/queries/buildings.queries";
import { SearchInput } from "../ui/SearchInput";
import { Select } from "../ui/Select";
import { Button } from "../ui/Button";

export default function OperationsDepositFilters() {
  const { 
    searchQuery, statusFilter, typeFilter, buildingFilter,
    setSearchQuery, setStatusFilter, setTypeFilter, setBuildingFilter, resetFilters
  } = useDepositStore();

  const { data: buildings = [] } = useBuildingsQuery();

  const [localSearch, setLocalSearch] = useState(searchQuery);

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setSearchQuery(localSearch);
    }, 300);
    return () => clearTimeout(handler);
  }, [localSearch, setSearchQuery]);

  const hasFilters = localSearch.length > 0 || statusFilter !== 'ALL' || typeFilter !== 'ALL' || buildingFilter !== 'ALL';

  const buildingOptions = [
    { label: "Tất cả tòa nhà", value: "ALL" },
    ...buildings.map((b: any) => ({ label: b.name, value: b.id })),
  ];

  const typeOptions = [
    { label: "Loại cọc (Tất cả)", value: "ALL" },
    { label: "Giữ phòng", value: "BOOKING" },
    { label: "Bảo đảm HĐ", value: "SECURITY" },
    { label: "Giữ chỗ", value: "RESERVATION" }
  ];

  const statusOptions = [
    { label: "Trạng thái (Tất cả)", value: "ALL" },
    { label: "Nháp", value: "DRAFT" },
    { label: "Chờ thu", value: "PENDING" },
    { label: "Đã thu", value: "PAID" },
    { label: "Đã lên HĐ", value: "CONVERTED_TO_CONTRACT" },
    { label: "Hoàn tiền", value: "REFUNDED" },
    { label: "Đã hủy", value: "CANCELLED" }
  ];

  return (
    <div data-testid="deposits-filter-bar" className="p-2 md:p-2.5 bg-card/60 border border-border/60 rounded-2xl flex items-center justify-between flex-wrap gap-2 shadow-xs backdrop-blur-sm">
      <div className="flex items-center gap-2 flex-1 flex-wrap">
        {/* Search */}
        <SearchInput 
          placeholder="Tìm mã phiếu, tên khách, số điện thoại, số phòng..." 
          className="w-full md:w-[260px] xl:w-[300px]"
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
        />

        {/* Building Filter */}
        <div className="w-[170px]">
          <Select 
            aria-label="Filter by building"
            options={buildingOptions}
            value={buildingFilter}
            onChange={(e) => setBuildingFilter(e.target.value)}
          />
        </div>

        {/* Type Filter */}
        <div className="w-[145px]">
          <Select 
            aria-label="Filter by deposit type"
            options={typeOptions}
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          />
        </div>

        {/* Status Filter */}
        <div className="w-[155px]">
          <Select 
            aria-label="Filter by deposit status"
            options={statusOptions}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          />
        </div>
      </div>

      {hasFilters && (
        <Button 
          type="button"
          onClick={() => {
            setLocalSearch('');
            resetFilters();
          }}
          variant="ghost"
          size="sm"
          className="h-9 px-3 text-muted hover:text-rose-500 hover:bg-rose-500/10 font-bold text-[12px] rounded-xl flex items-center gap-1.5 transition-colors"
        >
          <RotateCcw size={13} /> Xóa bộ lọc
        </Button>
      )}
    </div>
  );
}
