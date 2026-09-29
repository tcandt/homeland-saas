"use client";

import React, { useState } from "react";
import { useContractsStore } from "../../lib/hooks/useContractsStore";
import { useContractsQuery } from "../../lib/queries/contracts.queries";
import { EmptyState } from "../ui/EmptyState";
import { ErrorState } from "../ui/ErrorState";
import { LoadingState } from "../ui/LoadingState";
import OperationsContractDrawer from "./OperationsContractDrawer";
import OperationsContractRow from "./OperationsContractRow";
import { groupContractRows } from "../../lib/contracts/group-contract-rows";
import { ArrowRight, ChevronLeft, ChevronRight, FileText } from "lucide-react";

export default function OperationsContractList() {
  const [selectedContract, setSelectedContract] = useState<any | null>(null);
  const [page, setPage] = useState(1);
  const { search, status } = useContractsStore();

  const { data, isLoading, isError } = useContractsQuery({
    search: search || undefined,
    status: status !== "Tất cả" && status ? status : undefined,
    limit: 100,
  });

  React.useEffect(() => {
    setPage(1);
  }, [search, status]);

  if (isLoading) {
    return <LoadingState message="Đang tải danh sách hợp đồng..." />;
  }

  if (isError) {
    return (
      <div data-testid="contracts-error-state">
        <ErrorState message="Có lỗi xảy ra khi tải danh sách hợp đồng." />
      </div>
    );
  }

  const responseData = data?.data as any;
  const contracts = responseData?.items || (Array.isArray(responseData) ? responseData : []);
  const groups = groupContractRows(contracts);
  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(groups.length / pageSize));
  const displayedGroups = groups.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div
      data-testid="contracts-list"
      className="flex min-h-[520px] flex-1 flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm xl:min-h-0"
    >
      {/* Table Header Controls */}
      <div className="flex flex-col gap-3 border-b border-border/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between bg-card">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <FileText size={15} />
          </div>
          <h3 className="text-base font-black text-text">Danh sách Hợp đồng</h3>
          <span className="rounded-full bg-surface px-2.5 py-0.5 text-[11px] font-bold font-mono text-muted border border-border">
            {groups.length} hồ sơ · {contracts.length} hợp đồng
          </span>
        </div>
      </div>

      {/* Main Table Scroll Area */}
      <div className="min-h-0 flex-1 overflow-x-auto">
        <div className="grid min-w-[1160px] grid-cols-[80px_minmax(180px,0.9fr)_minmax(220px,1.2fr)_minmax(180px,1fr)_minmax(320px,1.65fr)_140px] gap-3 border-b border-border/60 bg-surface/60 px-4 py-2.5 text-[11px] font-black uppercase tracking-wider text-muted select-none">
          <span className="text-center">STT</span>
          <span>Mã hợp đồng</span>
          <span>Khách hàng</span>
          <span>Tòa / Phòng</span>
          <span className="text-center">Thời hạn & Tiến độ</span>
          <span className="text-center">Trạng thái</span>
        </div>

        <div className="flex min-w-[1160px] flex-col divide-y divide-border/60">
          {groups.length === 0 ? (
            <div data-testid="empty-contracts-state" className="p-8">
              <EmptyState
                title="Không tìm thấy hợp đồng"
                message="Chưa có hợp đồng nào hoặc không có hợp đồng phù hợp với tiêu chí tìm kiếm."
              />
            </div>
          ) : (
            displayedGroups.map((group, index) => (
              <div key={group.key} data-testid="contract-group" className="grid grid-cols-[80px_minmax(0,1fr)] gap-3 px-4">
                <div className={`relative flex items-center py-3 ${group.booking ? "justify-start pl-1" : "justify-center"}`}>
                  <span className="relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-surface font-mono text-xs font-bold text-text">
                    {(page - 1) * pageSize + index + 1}
                  </span>
                  {group.booking && (
                    <div className="absolute inset-y-0 left-10 w-10 text-primary" role="img" aria-label="Hợp đồng cọc chuyển lên hợp đồng thuê dài hạn">
                      <span className="absolute left-0 top-1/4 h-1/2 border-l-2 border-primary" aria-hidden="true" />
                      <span className="absolute left-0 top-1/4 w-6 border-t-2 border-primary" aria-hidden="true" />
                      <ArrowRight className="absolute left-4 top-[calc(25%-8px)]" size={17} strokeWidth={2.5} aria-hidden="true" />
                      <span className="absolute left-0 top-3/4 w-7 border-t-2 border-primary" aria-hidden="true" />
                      <span className="absolute left-[25px] top-[calc(75%-3px)] h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden="true" />
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <OperationsContractRow contract={group.rental} onClick={() => setSelectedContract(group.rental)} />
                  {group.booking && (
                    <div className="border-t border-dashed border-border/70">
                      <OperationsContractRow contract={group.booking} onClick={() => setSelectedContract(group.booking)} />
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Pagination Footer */}
      <div className="mt-auto flex flex-col gap-3 border-t border-border/60 bg-surface/30 px-4 py-2.5 text-[12px] font-semibold text-muted sm:flex-row sm:items-center sm:justify-between">
        <span>
          Hiển thị {groups.length === 0 ? 0 : (page - 1) * pageSize + 1} -{" "}
          {Math.min(page * pageSize, groups.length)} trên {groups.length} hồ sơ
        </span>

        <div className="flex items-center gap-1.5">
          <span className="rounded-xl border border-border bg-card px-2.5 py-1 text-[11px] font-bold text-text">
            {pageSize} / trang
          </span>

          <button
            type="button"
            aria-label="Trang trước"
            disabled={page <= 1}
            onClick={() => setPage((v) => Math.max(1, v - 1))}
            className="flex h-7 w-7 items-center justify-center rounded-xl border border-border bg-card text-muted hover:text-text hover:border-primary/40 disabled:opacity-40 transition-colors"
          >
            <ChevronLeft size={15} aria-hidden="true" />
          </button>

          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPage(p)}
              className={`flex h-7 min-w-[28px] items-center justify-center rounded-xl px-1.5 font-bold transition-all ${
                page === p
                  ? "bg-primary text-white shadow-xs"
                  : "border border-border bg-card text-muted hover:text-text hover:border-primary/40"
              }`}
            >
              {p}
            </button>
          ))}

          <button
            type="button"
            aria-label="Trang sau"
            disabled={page >= totalPages}
            onClick={() => setPage((v) => Math.min(totalPages, v + 1))}
            className="flex h-7 w-7 items-center justify-center rounded-xl border border-border bg-card text-muted hover:text-text hover:border-primary/40 disabled:opacity-40 transition-colors"
          >
            <ChevronRight size={15} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Detail Drawer */}
      {selectedContract && (
        <OperationsContractDrawer
          contract={selectedContract}
          onClose={() => setSelectedContract(null)}
          onOpenContract={(nextContract) => setSelectedContract(nextContract)}
        />
      )}
    </div>
  );
}
