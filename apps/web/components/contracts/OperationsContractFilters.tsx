"use client";

import React, { useRef, useMemo } from "react";
import { Search, X, Filter, ChevronDown } from "lucide-react";
import { useContractsStore } from "@/lib/hooks/useContractsStore";
import { useContractsQuery } from "@/lib/queries/contracts.queries";
import { getOperationsContractKpiSummary } from "@/lib/contracts/operations-contract-kpi";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";

export default function OperationsContractFilters() {
  const { search, setSearch, status, setStatus, sort, setSort } = useContractsStore();
  const statusTabsRef = useRef<HTMLDivElement>(null);
  const hasFilters = Boolean(search || status);

  // Fetch KPI counts for status badges
  const { data } = useContractsQuery({ page: 1, limit: 50 });
  const contracts = useMemo(
    () => (data as any)?.data || (data as any)?.items || [],
    [data],
  );
  const totalContracts = (data as any)?.meta?.total ?? contracts.length;
  const summary = useMemo(() => getOperationsContractKpiSummary(contracts), [contracts]);

  const quickStatusTabs = [
    { id: "", label: "Tất cả", count: totalContracts },
    { id: "ACTIVE", label: "Đang hiệu lực", count: summary.active },
    { id: "EXPIRING", label: "Sắp hết hạn", count: summary.expiring },
    { id: "PENDING_APPROVAL", label: "Chờ ký", count: summary.pending },
    { id: "TERMINATED", label: "Đã kết thúc", count: contracts.filter((c: any) => c.status === "TERMINATED" || c.status === "EXPIRED").length },
  ];

  const clearFilters = () => {
    setSearch("");
    setStatus("");
  };

  return (
    <Card
      data-testid="contracts-filter-bar"
      className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-card p-3 md:p-3.5 shadow-[0_2px_8px_rgba(0,0,0,0.03)]"
    >
      {/* Top search & filter bar */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative min-w-0 flex-1">
          <Search
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none"
          />
          <input
            type="text"
            value={search}
            placeholder="Tìm theo mã HĐ, tên khách, số điện thoại, tòa nhà, phòng..."
            onChange={(event) => setSearch(event.target.value)}
            className="w-full h-10 pl-10 pr-9 rounded-xl border border-slate-200/80 dark:border-white/[0.1] bg-slate-50/60 dark:bg-white/[0.03] text-[13px] font-medium text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-primary focus:bg-white dark:focus:bg-card focus:ring-2 focus:ring-primary/10 transition-all duration-200"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white"
            >
              <X size={15} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            aria-label="Bộ lọc hợp đồng"
            onClick={() => statusTabsRef.current?.querySelector<HTMLButtonElement>("button[aria-pressed='true']")?.focus()}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200/80 dark:border-white/[0.1] bg-white dark:bg-white/[0.03] px-3.5 text-xs font-bold text-slate-700 dark:text-slate-200 transition-all duration-200 hover:border-primary/50 hover:text-primary hover:shadow-xs active:scale-95"
          >
            <Filter size={14} className="text-slate-500 dark:text-slate-400" />
            <span>Bộ lọc</span>
          </button>

          <div className="relative">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              aria-label="Sắp xếp danh sách"
              className="h-10 appearance-none rounded-xl border border-slate-200/80 dark:border-white/[0.1] bg-white dark:bg-white/[0.03] pl-3.5 pr-8 text-xs font-bold text-slate-700 dark:text-slate-200 transition-all duration-200 hover:border-primary/50 focus:outline-none focus:border-primary cursor-pointer"
            >
              <option value="newest">Mới nhất</option>
              <option value="oldest">Cũ nhất</option>
              <option value="rent_desc">Giá cao nhất</option>
              <option value="rent_asc">Giá thấp nhất</option>
              <option value="expiring_soon">Sắp hết hạn</option>
            </select>
            <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          </div>
        </div>
      </div>

      {/* Quick Status Tabs / Pills */}
      <div ref={statusTabsRef} className="flex flex-wrap items-center gap-2 overflow-x-auto pt-1 hide-scrollbar">
        {quickStatusTabs.map((tab) => {
          const isSelected = status === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatus(tab.id)}
              aria-pressed={isSelected}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all duration-200 active:scale-95 ${
                isSelected
                  ? "bg-primary text-white shadow-[0_2px_8px_rgba(99,102,241,0.3)] ring-2 ring-primary/20"
                  : "border border-slate-200/80 dark:border-white/[0.08] bg-slate-50/70 dark:bg-white/[0.02] text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-white/[0.15] hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`text-[11px] font-semibold transition-opacity ${
                  isSelected ? "text-white/90" : "text-slate-400 dark:text-slate-500"
                }`}
              >
                ({tab.count})
              </span>
            </button>
          );
        })}

        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="h-8 px-2.5 text-xs font-semibold text-slate-500 hover:text-rose-600 rounded-xl transition-colors ml-auto"
          >
            <X size={13} className="mr-1" /> Xóa lọc
          </Button>
        )}
      </div>
    </Card>
  );
}
