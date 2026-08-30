"use client";

import React, { useState } from "react";
import { useContractsStore } from "@/lib/hooks/useContractsStore";
import { useContractsQuery } from "@/lib/queries/contracts.queries";
import { EmptyState } from "../ui/EmptyState";
import { ErrorState } from "../ui/ErrorState";
import { LoadingState } from "../ui/LoadingState";
import OperationsContractDrawer from "./OperationsContractDrawer";
import OperationsContractRow from "./OperationsContractRow";
import { FileText } from "lucide-react";

export default function OperationsContractList() {
  const [selectedContract, setSelectedContract] = useState<any | null>(null);
  const [page, setPage] = useState(1);
  const { search, status } = useContractsStore();

  const { data, isLoading, isError } = useContractsQuery({
    search: search || undefined,
    status: status !== "Tất cả" && status ? status : undefined,
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
  const total = responseData?.total || contracts.length;
  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(contracts.length / pageSize));
  const displayedContracts = contracts.slice((page - 1) * pageSize, page * pageSize);

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
            {contracts.length} hợp đồng
          </span>
        </div>
      </div>

      {/* Main Table Scroll Area */}
      <div className="min-h-0 flex-1 overflow-x-auto">
        <div className="grid min-w-[1160px] grid-cols-[48px_minmax(160px,0.9fr)_minmax(220px,1.2fr)_minmax(180px,1fr)_minmax(260px,1.4fr)_140px_80px] gap-3 border-b border-border/60 bg-surface/60 px-4 py-2.5 text-[11px] font-black uppercase tracking-wider text-muted select-none">
          <span>STT</span>
          <span>Mã hợp đồng</span>
          <span>Khách hàng</span>
          <span>Tòa / Phòng</span>
          <span>Thời hạn & Tiến độ</span>
          <span>Trạng thái</span>
          <span className="text-right">Thao tác</span>
        </div>

        <div className="flex min-w-[1160px] flex-col divide-y divide-border/40">
          {contracts.length === 0 ? (
            <div data-testid="empty-contracts-state" className="p-8">
              <EmptyState
                title="Không tìm thấy hợp đồng"
                message="Chưa có hợp đồng nào hoặc không có hợp đồng phù hợp với tiêu chí tìm kiếm."
              />
            </div>
          ) : (
            displayedContracts.map((contract: any, index: number) => (
              <OperationsContractRow
                key={contract.id}
                contract={contract}
                rowNumber={(page - 1) * pageSize + index + 1}
                onClick={() => setSelectedContract(contract)}
              />
            ))
          )}
        </div>
      </div>

      {/* Pagination Footer */}
      <div className="mt-auto flex flex-col gap-3 border-t border-border/60 bg-surface/30 px-4 py-2.5 text-[12px] font-semibold text-muted sm:flex-row sm:items-center sm:justify-between">
        <span>
          Hiển thị {contracts.length === 0 ? 0 : (page - 1) * pageSize + 1} -{" "}
          {Math.min(page * pageSize, contracts.length)} trên {total} hợp đồng
        </span>

        <div className="flex items-center gap-1.5">
          <span className="rounded-xl border border-border bg-card px-2.5 py-1 text-[11px] font-bold text-text">
            {pageSize} / trang
          </span>

          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((v) => Math.max(1, v - 1))}
            className="flex h-7 w-7 items-center justify-center rounded-xl border border-border bg-card text-muted hover:text-text hover:border-primary/40 disabled:opacity-40 transition-colors"
          >
            ‹
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
            disabled={page >= totalPages}
            onClick={() => setPage((v) => Math.min(totalPages, v + 1))}
            className="flex h-7 w-7 items-center justify-center rounded-xl border border-border bg-card text-muted hover:text-text hover:border-primary/40 disabled:opacity-40 transition-colors"
          >
            ›
          </button>
        </div>
      </div>

      {/* Detail Drawer */}
      {selectedContract && (
        <OperationsContractDrawer
          contract={selectedContract}
          onClose={() => setSelectedContract(null)}
        />
      )}
    </div>
  );
}
