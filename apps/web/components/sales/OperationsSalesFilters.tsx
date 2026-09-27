"use client";

import React, { useEffect, useState } from "react";
import { Search, X, ChevronDown } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { SALES_LEAD_STATUSES } from "@/lib/api/sales.api";
import { toSalesLeadListFilters } from "@/lib/sales/lead-list-filters";
import { getSalesStageLabel } from "./sales.types";

export default function OperationsSalesFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filters = toSalesLeadListFilters(searchParams);
  const [search, setSearch] = useState(filters.search || "");

  useEffect(() => {
    setSearch(filters.search || "");
  }, [filters.search]);

  const updateFilters = (next: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    params.delete("page");
    const query = params.toString();
    router.replace(query ? `/sales?${query}` : "/sales", { scroll: false });
  };

  const sortValue = `${filters.sort || "createdAt"}:${filters.order || "desc"}`;

  return (
    <form
      className="flex flex-col md:flex-row md:items-center gap-[12px] bg-card border border-border p-[8px] md:p-[10px] rounded-[16px] shadow-sm"
      onSubmit={(event) => {
        event.preventDefault();
        updateFilters({ search: search.trim() || null });
      }}
    >
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-[16px] top-1/2 -translate-y-1/2 text-muted" size={16} />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Tìm tên KH, SĐT, Email..."
          className="w-full h-[40px] pl-[40px] pr-[16px] rounded-[10px] bg-background border border-border text-[13px] text-text placeholder:text-muted focus:outline-none focus:border-[#6366f1] focus:ring-1 focus:ring-[#6366f1] transition-all"
          data-testid="sales-filter-search"
        />
      </div>

      <div className="flex items-center gap-[8px] overflow-x-auto no-scrollbar pb-1 md:pb-0">
        <FilterSelect
          ariaLabel="Lọc trạng thái lead"
          value={filters.status || ""}
          onChange={(value) => updateFilters({ status: value || null })}
        >
          <option value="">Tất cả trạng thái</option>
          {SALES_LEAD_STATUSES.map((status) => <option key={status} value={status}>{getSalesStageLabel(status)}</option>)}
        </FilterSelect>
        <FilterSelect
          ariaLabel="Sắp xếp lead"
          value={sortValue}
          onChange={(value) => {
            const [sort, order] = value.split(":");
            updateFilters({ sort, order });
          }}
        >
          <option value="createdAt:desc">Mới tạo gần đây</option>
          <option value="updatedAt:desc">Cập nhật gần đây</option>
          <option value="name:asc">Tên A-Z</option>
        </FilterSelect>
      </div>

      <button
        type="button"
        className="h-[40px] w-[40px] flex items-center justify-center rounded-[10px] hover:bg-rose-500/10 text-muted hover:text-rose-500 transition-colors"
        title="Xóa bộ lọc"
        aria-label="Xóa bộ lọc"
        onClick={() => {
          setSearch("");
          updateFilters({ search: null, status: null, sort: null, order: null });
        }}
      >
        <X size={16} />
      </button>
    </form>
  );
}

function FilterSelect({
  ariaLabel,
  value,
  onChange,
  children,
}: {
  ariaLabel: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="relative shrink-0">
      <select
        aria-label={ariaLabel}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-[40px] pl-[16px] pr-[36px] rounded-[10px] bg-background border border-border text-[13px] font-medium text-text appearance-none hover:border-muted focus:outline-none focus:border-[#6366f1] transition-all cursor-pointer"
      >
        {children}
      </select>
      <ChevronDown className="absolute right-[12px] top-1/2 -translate-y-1/2 text-muted pointer-events-none" size={14} />
    </div>
  );
}
