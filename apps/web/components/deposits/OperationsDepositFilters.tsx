"use client";

import React, { useState, useEffect } from "react";
import { X, Building2 } from "lucide-react";
import { useDepositStore } from "../../lib/stores/deposit.store";
import { useBuildingsQuery } from "../../lib/queries/buildings.queries";
import { Card } from "../ui/Card";
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
    { label: "Bảo đảm", value: "SECURITY" },
    { label: "Giữ chỗ", value: "RESERVATION" }
  ];

  const statusOptions = [
    { label: "Trạng thái (Tất cả)", value: "ALL" },
    { label: "Nháp", value: "DRAFT" },
    { label: "Chờ thu", value: "PENDING" },
    { label: "Đã thu", value: "PAID" },
    { label: "Lên hợp đồng", value: "CONVERTED_TO_CONTRACT" },
    { label: "Hoàn tiền", value: "REFUNDED" },
    { label: "Hủy", value: "CANCELLED" }
  ];

  return (
    <Card data-testid="deposits-filter-bar" className="p-[8px] flex items-center justify-between flex-wrap gap-[8px]">
      <div className="flex items-center gap-[8px] flex-1 flex-wrap">
        {/* Search */}
        <SearchInput 
          placeholder="Tìm mã phiếu, khách, sđt..." 
          className="w-full md:w-[260px] xl:w-[280px]"
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
        />

        {/* Building Filter */}
        <div className="w-[180px]">
          <Select 
            aria-label="Filter by building"
            options={buildingOptions}
            value={buildingFilter}
            onChange={(e) => setBuildingFilter(e.target.value)}
          />
        </div>

        {/* Type Filter */}
        <div className="w-[150px]">
          <Select 
            aria-label="Filter by deposit type"
            options={typeOptions}
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          />
        </div>

        {/* Status Filter */}
        <div className="w-[160px]">
          <Select 
            aria-label="Filter by deposit status"
            options={statusOptions}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          />
        </div>
      </div>

      <div className="flex items-center gap-[8px]">
        {hasFilters && (
          <Button 
            onClick={() => {
              setLocalSearch('');
              resetFilters();
            }}
            variant="ghost"
            className="text-muted hover:text-text font-bold"
          >
            <X size={14} className="mr-2" /> Xóa lọc
          </Button>
        )}
      </div>
    </Card>
  );
}
