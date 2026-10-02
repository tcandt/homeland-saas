"use client";

import React, { useEffect, useRef, useState, useTransition } from "react";
import { useContractsStore } from "../../lib/hooks/useContractsStore";
import { useContractsQuery } from "../../lib/queries/contracts.queries";
import { EmptyState } from "../ui/EmptyState";
import { ErrorState } from "../ui/ErrorState";
import { LoadingState } from "../ui/LoadingState";
import OperationsContractRow from "./OperationsContractRow";
import { groupContractRows } from "../../lib/contracts/group-contract-rows";
import { ChevronLeft, ChevronRight, FileText, ChevronDown } from "lucide-react";

function formatNumber(value: number): string {
  return value.toLocaleString("vi-VN");
}

export default function OperationsContractList() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const { search, status, sort, selectedContract, setSelectedContract } = useContractsStore();
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [, startTransition] = useTransition();
  const hasInitializedRef = useRef(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      startTransition(() => {
        setDebouncedSearch(search);
      });
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, status, sort, pageSize]);

  const { data, isLoading, isError, isFetching } = useContractsQuery({
    page,
    limit: pageSize,
    search: debouncedSearch || undefined,
    status: status || undefined,
  });

  const contracts = data?.data || [];
  const groups = groupContractRows(contracts);

  useEffect(() => {
    if (!hasInitializedRef.current && contracts.length > 0) {
      hasInitializedRef.current = true;
    }
  }, [contracts, groups]);

  if (isLoading) return <LoadingState message="Đang tải danh sách hợp đồng..." />;
  if (isError) return (
    <div data-testid="contracts-error-state">
      <ErrorState message="Có lỗi xảy ra khi tải danh sách hợp đồng." />
    </div>
  );

  const totalContracts = data?.meta?.total ?? contracts.length;
  const totalPages = Math.max(1, Math.ceil(totalContracts / pageSize));
  const rangeStart = totalContracts === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, totalContracts);
  const firstPageButton = Math.min(Math.max(1, page - 2), Math.max(1, totalPages - 4));
  const pageButtons = Array.from({ length: Math.min(totalPages, 5) }, (_, index) => firstPageButton + index);

  return (
    <section
      data-testid="contracts-list"
      className="flex min-h-[520px] flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200/80 dark:border-white/[0.08] bg-white dark:bg-card shadow-xs min-w-0 w-full xl:min-h-0"
    >
        {/* Header bar */}
        <div className="flex items-center gap-2.5 border-b border-slate-200/80 dark:border-white/[0.08] px-4 py-3 bg-white dark:bg-card">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 border border-purple-200/50">
            <FileText size={15} />
          </span>
          <h2 className="text-sm md:text-base font-black text-slate-800 dark:text-white">
            Danh sách Hợp đồng
          </h2>
          <span className="rounded-full bg-slate-100 dark:bg-white/[0.06] px-2.5 py-0.5 text-[11px] font-bold text-slate-600 dark:text-slate-300">
            {formatNumber(totalContracts)} hợp đồng
          </span>
          {isFetching && (
            <span className="ml-auto text-[11px] font-semibold text-slate-400 animate-pulse" aria-live="polite">
              Đang cập nhật…
            </span>
          )}
        </div>

        {/* Table Content */}
        <div className="min-h-0 flex-1 overflow-x-auto">
          <div className="w-full">
            {/* Column Headers (NO STT!) */}
            <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1.1fr)_minmax(116px,124px)_32px] gap-2 border-b border-slate-200/80 dark:border-white/[0.08] bg-slate-50/70 dark:bg-white/[0.02] px-3.5 py-2 text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 select-none">
              <span>Hợp đồng / Liên kết</span>
              <span>Khách thuê</span>
              <span>Tòa nhà / Phòng</span>
              <span>Thời hạn</span>
              <span className="text-center">Trạng thái</span>
              <span></span>
            </div>

            {/* Rows */}
            <div className="flex flex-col gap-2 p-1.5">
              {groups.length === 0 ? (
                <div data-testid="empty-contracts-state" className="p-8">
                  <EmptyState
                    title="Không tìm thấy hợp đồng"
                    message="Chưa có hợp đồng nào hoặc không có hợp đồng phù hợp với tiêu chí tìm kiếm."
                  />
                </div>
              ) : (
                groups.map((group) => {
                  return (
                    <div
                      key={group.key}
                      data-testid="contract-group"
                      className="flex flex-col gap-1.5"
                    >
                      <OperationsContractRow
                        contract={group.rental}
                        isSelected={selectedContract?.id === group.rental?.id}
                        onClick={() => setSelectedContract(group.rental)}
                      />

                      {group.booking && (
                        <div className="relative ml-8">
                          {/* Upward lineage connector from booking contract to long-term rental contract */}
                          <div
                            role="img"
                            aria-label="Hợp đồng cọc chuyển lên hợp đồng thuê dài hạn"
                            className="pointer-events-none absolute -top-[6px] h-[39px] -left-6 w-6 z-10"
                          >
                            <svg className="w-6 h-[39px] overflow-visible" viewBox="0 0 24 39" fill="none">
                              <defs>
                                <linearGradient id={`connector-grad-${group.key}`} x1="0%" y1="100%" x2="0%" y2="0%">
                                  <stop offset="0%" stopColor="#f59e0b" />
                                  <stop offset="100%" stopColor="#6366f1" />
                                </linearGradient>
                              </defs>
                              <path
                                d="M 24 38 L 18 38 Q 12 38 12 32 L 12 7.5"
                                stroke={`url(#connector-grad-${group.key})`}
                                strokeWidth="2"
                                strokeLinecap="round"
                              />
                              <polygon
                                points="12,1 8.5,7.5 15.5,7.5"
                                fill="#6366f1"
                              />
                            </svg>
                          </div>

                          <OperationsContractRow
                            contract={group.booking}
                            isChildBranch={true}
                            isSelected={selectedContract?.id === group.booking?.id}
                            onClick={() => setSelectedContract(group.booking)}
                          />
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Pagination Footer */}
        <footer className="mt-auto flex flex-col gap-3 border-t border-slate-200/80 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.01] px-4 py-3 text-[12px] font-semibold text-slate-500 dark:text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <span>
            Hiển thị {formatNumber(rangeStart)} – {formatNumber(rangeEnd)} trên {formatNumber(totalContracts)} hợp đồng
          </span>

          <div className="flex items-center gap-2">
            {/* Page size dropdown */}
            <div className="relative inline-flex items-center">
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                aria-label="Số bản ghi mỗi trang"
                className="h-8 appearance-none rounded-xl border border-slate-200/80 dark:border-white/[0.1] bg-white dark:bg-card pl-2.5 pr-7 text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:border-primary/50 cursor-pointer"
              >
                <option value={10}>10 / trang</option>
                <option value={20}>20 / trang</option>
                <option value={50}>50 / trang</option>
                <option value={100}>100 / trang</option>
              </select>
              <ChevronDown size={13} className="pointer-events-none absolute right-2 text-slate-400" />
            </div>

            <PaginationButton
              label="Trang trước"
              disabled={page <= 1}
              onClick={() => setPage((value) => value - 1)}
            >
              <ChevronLeft size={15} />
            </PaginationButton>

            <div className="flex items-center gap-1">
              {pageButtons.map((item) => (
                <button
                  key={item}
                  type="button"
                  aria-current={page === item ? "page" : undefined}
                  onClick={() => setPage(item)}
                  className={`flex h-8 min-w-[30px] items-center justify-center rounded-xl px-2 text-xs font-bold transition-all duration-200 ${
                    page === item
                      ? "bg-primary text-white shadow-xs"
                      : "border border-slate-200/80 dark:border-white/[0.1] bg-white dark:bg-card text-slate-600 dark:text-slate-300 hover:border-primary/40 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>

            <PaginationButton
              label="Trang sau"
              disabled={page >= totalPages}
              onClick={() => setPage((value) => value + 1)}
            >
              <ChevronRight size={15} />
            </PaginationButton>
          </div>
        </footer>
      </section>
  );
}

function PaginationButton({
  label,
  disabled,
  onClick,
  children,
}: React.PropsWithChildren<{ label: string; disabled: boolean; onClick: () => void }>) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200/80 dark:border-white/[0.1] bg-white dark:bg-card text-slate-600 dark:text-slate-400 transition-all duration-200 hover:border-primary/50 hover:text-primary disabled:opacity-40 disabled:pointer-events-none"
    >
      {children}
    </button>
  );
}
