"use client";

import React, { useState } from "react";
import { useContractsStore } from "@/lib/hooks/useContractsStore";
import { useContractsQuery } from "@/lib/queries/contracts.queries";
import { EmptyState } from "../ui/EmptyState";
import { ErrorState } from "../ui/ErrorState";
import { LoadingState } from "../ui/LoadingState";
import OperationsContractDrawer from "./OperationsContractDrawer";
import OperationsContractRow from "./OperationsContractRow";

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
  const pageSize = 8;
  const totalPages = Math.max(1, Math.ceil(contracts.length / pageSize));
  const displayedContracts = contracts.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div
      data-testid="contracts-list"
      className="flex min-h-[520px] flex-1 flex-col overflow-hidden rounded-[16px] border border-border/40 bg-card shadow-[0_1px_2px_rgba(16,24,40,0.03)] xl:min-h-0"
    >
      <div className="flex flex-col gap-[12px] border-b border-border px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-[10px]">
          <h3 className="text-[18px] font-black text-text">Danh sách Hợp đồng</h3>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-x-auto">
        <div className="grid min-w-[1120px] grid-cols-[42px_minmax(150px,0.9fr)_minmax(190px,1fr)_minmax(180px,0.9fr)_minmax(260px,1.5fr)_130px_86px] gap-3 border-b border-border bg-surface/70 px-4 py-3 text-[11px] font-black uppercase text-muted">
          <span>STT</span>
          <span>Mã hợp đồng</span>
          <span>Tên khách hàng</span>
          <span>Tòa + Mã phòng</span>
          <span>Thời hạn khách thuê / hợp đồng</span>
          <span>Trạng thái</span>
          <span className="text-right">Thao tác</span>
        </div>

        <div className="flex min-w-[1120px] flex-col">
          {contracts.length === 0 ? (
            <div data-testid="empty-contracts-state" className="p-6">
              <EmptyState title="Không có hợp đồng" message="Chưa có hợp đồng nào hoặc không có hợp đồng phù hợp với bộ lọc." />
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

      <div className="mt-auto flex flex-col gap-3 border-t border-border px-4 py-3 text-[12px] font-semibold text-muted sm:flex-row sm:items-center sm:justify-between">
        <span>
          Hiển thị {contracts.length === 0 ? 0 : (page - 1) * pageSize + 1} - {Math.min(page * pageSize, contracts.length)} của {total} hợp đồng
        </span>
        <div className="flex items-center gap-2">
          <button type="button" className="h-8 rounded-xl border border-border bg-card px-3 text-[12px] font-black text-text">
            8 / trang
          </button>
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((value) => Math.max(1, value - 1))}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-border text-muted disabled:opacity-40"
          >
            ‹
          </button>
          {Array.from({ length: Math.min(totalPages, 5) }, (_, index) => index + 1).map((pageNumber) => (
            <button
              key={pageNumber}
              type="button"
              onClick={() => setPage(pageNumber)}
              className={`flex h-8 w-8 items-center justify-center rounded-xl text-[12px] font-black ${
                page === pageNumber ? "bg-[#6d3df8] text-white" : "text-text hover:bg-surface"
              }`}
            >
              {pageNumber}
            </button>
          ))}
          {totalPages > 5 && <span className="px-1">...</span>}
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-border text-muted disabled:opacity-40"
          >
            ›
          </button>
        </div>
      </div>

      <OperationsContractDrawer contract={selectedContract} onClose={() => setSelectedContract(null)} />
    </div>
  );
}
