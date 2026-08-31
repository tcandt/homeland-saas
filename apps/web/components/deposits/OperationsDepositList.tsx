"use client";

import React from "react";
import OperationsDepositRow from "./OperationsDepositRow";
import OperationsDepositDrawer from "./OperationsDepositDrawer";
import { useDepositStore } from "../../lib/stores/deposit.store";
import { useDepositsQuery } from "../../lib/queries/deposits.queries";
import { UI_Deposit } from "../../lib/adapters/deposit.adapter";
import { ErrorState } from "../ui/ErrorState";
import { EmptyState } from "../ui/EmptyState";
import { LoadingState } from "../ui/LoadingState";

export default function OperationsDepositList() {
  const { 
    searchQuery, statusFilter, typeFilter, buildingFilter, page, limit,
    selectedDeposit, setSelectedDeposit, setPage
  } = useDepositStore();

  const { data, isLoading, isError } = useDepositsQuery({
    page,
    limit,
    search: searchQuery || undefined,
    status: statusFilter !== 'ALL' ? statusFilter : undefined,
    type: typeFilter !== 'ALL' ? typeFilter : undefined,
    buildingId: buildingFilter !== 'ALL' ? buildingFilter : undefined,
  });

  const deposits = data?.data?.items || [];
  const total = data?.data?.total || 0;
  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <div data-testid="deposits-list" className="flex flex-col gap-[16px] pb-[40px]">
      <div className="flex items-center justify-between px-[8px]">
        <h3 className="font-black text-[18px] text-text">Danh sách Phiếu đặt cọc</h3>
        <span className="text-[13px] font-bold text-muted bg-black/5 dark:bg-white/5 px-[12px] py-[4px] rounded-[8px]">
          Hiển thị {deposits.length} / {total} phiếu
        </span>
      </div>

      <div className="flex flex-col gap-[12px]">
        {isLoading ? (
          <LoadingState message="Đang tải danh sách phiếu cọc..." />
        ) : isError ? (
          <div data-testid="deposits-error-state">
            <ErrorState message="Có lỗi xảy ra khi tải dữ liệu." />
          </div>
        ) : deposits.length === 0 ? (
          <div data-testid="empty-deposits-state">
            <EmptyState title="Không có phiếu cọc" message="Chưa có phiếu cọc nào hoặc không phù hợp bộ lọc." />
          </div>
        ) : (
          deposits.map((deposit: UI_Deposit) => (
            <OperationsDepositRow 
              key={deposit.id} 
              deposit={deposit} 
              onClick={() => setSelectedDeposit(deposit)} 
            />
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-2 pt-2">
          <span className="text-[13px] text-muted font-medium">
            Trang {page} / {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="px-3 py-1.5 rounded-lg border border-border text-[13px] font-bold disabled:opacity-40 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
              Trang trước
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              className="px-3 py-1.5 rounded-lg border border-border text-[13px] font-bold disabled:opacity-40 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
              Trang sau
            </button>
          </div>
        </div>
      )}

      <OperationsDepositDrawer 
        deposit={selectedDeposit} 
        onClose={() => setSelectedDeposit(null)} 
      />
    </div>
  );
}
