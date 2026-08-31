"use client";

import React, { useState, useEffect } from "react";
import { 
  Search, 
  X, 
  Plus, 
  Building2, 
  Bookmark, 
  Coins, 
  FileText, 
  RefreshCcw, 
  XCircle,
  Layers
} from "lucide-react";
import { useDepositStore } from "../../lib/stores/deposit.store";
import { useBuildingsQuery } from "../../lib/queries/buildings.queries";
import { useDepositStatsQuery } from "../../lib/queries/deposits.queries";
import { Card } from "../ui/Card";
import { Select } from "../ui/Select";

interface OperationsDepositFiltersProps {
  onCreateClick?: () => void;
}

export default function OperationsDepositFilters({ onCreateClick }: OperationsDepositFiltersProps) {
  const { 
    searchQuery, statusFilter, typeFilter, buildingFilter,
    setSearchQuery, setStatusFilter, setTypeFilter, setBuildingFilter, resetFilters
  } = useDepositStore();

  const { data: buildings = [] } = useBuildingsQuery();
  const { data: statsData } = useDepositStatsQuery(buildingFilter !== 'ALL' ? buildingFilter : undefined);

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
    { label: "Tất cả loại cọc", value: "ALL" },
    { label: "Giữ phòng", value: "BOOKING" },
    { label: "Bảo đảm HĐ", value: "SECURITY" },
    { label: "Giữ chỗ", value: "RESERVATION" }
  ];

  const pipelineMap: Record<string, number> = {};
  let totalCount = 0;
  if (statsData?.pipeline) {
    statsData.pipeline.forEach((p: any) => {
      pipelineMap[p.key] = Number(p.count) || 0;
      totalCount += Number(p.count) || 0;
    });
  }

  const statusTabs = [
    { value: "ALL", label: "Tất cả", icon: Layers, count: totalCount, activeClass: "bg-primary/10 text-primary border-primary/30" },
    { value: "PENDING", label: "Chờ thu / Nháp", icon: Bookmark, count: (pipelineMap["DRAFT"] || 0) + (pipelineMap["PENDING"] || 0), activeClass: "bg-sky-500/10 text-sky-600 border-sky-500/30" },
    { value: "PAID", label: "Đã thu cọc", icon: Coins, count: pipelineMap["PAID"] || 0, activeClass: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" },
    { value: "CONVERTED_TO_CONTRACT", label: "Đã lên HĐ", icon: FileText, count: pipelineMap["CONVERTED_TO_CONTRACT"] || 0, activeClass: "bg-indigo-500/10 text-indigo-600 border-indigo-500/30" },
    { value: "REFUNDED", label: "Hoàn tiền", icon: RefreshCcw, count: pipelineMap["REFUNDED"] || 0, activeClass: "bg-amber-500/10 text-amber-600 border-amber-500/30" },
    { value: "CANCELLED", label: "Đã hủy", icon: XCircle, count: pipelineMap["CANCELLED"] || 0, activeClass: "bg-rose-500/10 text-rose-600 border-rose-500/30" },
  ];

  return (
    <Card data-testid="deposits-filter-bar" className="flex flex-col gap-2.5 rounded-2xl border-border/60 p-3 shadow-2xs shrink-0">
      {/* ROW 1: Search, Dropdowns & Create Button */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          {/* Search Box */}
          <div className="min-w-[240px] flex-1 max-w-[400px]">
            <div className="flex h-9 items-center gap-2 rounded-xl border border-border bg-card px-3 text-[13px] font-semibold">
              <Search size={14} className="text-muted shrink-0" />
              <input
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                placeholder="Tìm mã phiếu, tên khách, số điện thoại, số phòng..."
                className="min-w-0 flex-1 bg-transparent text-[12px] font-semibold text-text outline-none placeholder:text-muted"
              />
              {localSearch && (
                <button type="button" onClick={() => setLocalSearch("")} className="text-muted hover:text-text">
                  <X size={13} />
                </button>
              )}
            </div>
          </div>

          {/* Building Selector */}
          <div className="w-[160px]">
            <Select 
              aria-label="Filter by building"
              options={buildingOptions}
              value={buildingFilter}
              onChange={(e) => setBuildingFilter(e.target.value)}
            />
          </div>

          {/* Type Selector */}
          <div className="w-[145px]">
            <Select 
              aria-label="Filter by deposit type"
              options={typeOptions}
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            />
          </div>
        </div>

        {/* Action Button: Create Deposit */}
        {onCreateClick && (
          <button
            type="button"
            onClick={onCreateClick}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary hover:bg-primary/90 text-white px-3.5 py-2 text-xs font-black shadow-xs transition-all active:scale-95 shrink-0"
          >
            <Plus size={14} /> Tạo phiếu cọc mới
          </button>
        )}
      </div>

      {/* ROW 2: 1-Click Status Filter Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pt-1 border-t border-border/40">
        {statusTabs.map((tab) => {
          const isSelected = statusFilter === tab.value;
          const Icon = tab.icon;
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => setStatusFilter(tab.value)}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1 text-xs font-bold transition-all shrink-0 ${
                isSelected
                  ? tab.activeClass || "bg-primary/10 text-primary border-primary/30 shadow-2xs"
                  : "border-border/60 bg-card text-muted hover:border-border hover:text-text"
              }`}
            >
              <Icon size={12} />
              <span>{tab.label}</span>
              <span className={`ml-0.5 rounded-md px-1.5 py-0.2 font-mono text-[10px] font-bold ${isSelected ? "bg-black/10 dark:bg-white/10" : "bg-black/5 dark:bg-white/5 text-muted"}`}>
                {tab.count}
              </span>
            </button>
          );
        })}

        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              setLocalSearch('');
              resetFilters();
            }}
            className="inline-flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-semibold text-rose-500 hover:bg-rose-500/10 transition-colors ml-auto shrink-0"
          >
            <X size={13} /> Xóa bộ lọc
          </button>
        )}
      </div>
    </Card>
  );
}
