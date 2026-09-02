"use client";

import React, { useState } from "react";
import { 
  Receipt, 
  QrCode, 
  ChevronRight, 
  User, 
  DoorClosed, 
  Calendar, 
  Clock, 
  ShieldCheck, 
  Bookmark,
  Plus
} from "lucide-react";
import { useDepositStore } from "../../lib/stores/deposit.store";
import { useDepositsQuery } from "../../lib/queries/deposits.queries";
import { UI_Deposit } from "../../lib/adapters/deposit.adapter";
import { Card } from "../ui/Card";
import { ErrorState } from "../ui/ErrorState";
import { EmptyState } from "../ui/EmptyState";
import { LoadingState } from "../ui/LoadingState";
import OperationsDepositDrawer from "./OperationsDepositDrawer";
import DepositQrModal from "./DepositQrModal";

const formatVnd = (value: number) => `${Number(value || 0).toLocaleString("vi-VN")} đ`;

const formatDate = (value?: string | null) => {
  if (!value) return "--/--/----";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--/--/----";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

const getStatusMeta = (status: string, type?: string) => {
  const isSecurity = type === "SECURITY";
  switch (status) {
    case "DRAFT":
      return { label: "Bản nháp", tone: "bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300 border-slate-200 dark:border-slate-700", dot: "bg-slate-400" };
    case "PENDING":
      return {
        label: isSecurity ? "Chờ thu cọc hợp đồng" : "Chờ thu cọc giữ phòng",
        tone: isSecurity ? "bg-purple-500/10 text-purple-600 border-purple-500/20" : "bg-sky-500/10 text-sky-600 border-sky-500/20",
        dot: isSecurity ? "bg-purple-500" : "bg-sky-500"
      };
    case "PAID":
      return {
        label: isSecurity ? "Đã thu cọc hợp đồng" : "Đã thu cọc giữ phòng",
        tone: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
        dot: "bg-emerald-500"
      };
    case "CONVERTED_TO_CONTRACT":
      return { label: "Đã lên Hợp đồng", tone: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20", dot: "bg-indigo-500" };
    case "REFUNDED":
      return { label: "Đã hoàn cọc", tone: "bg-amber-500/10 text-amber-600 border-amber-500/20", dot: "bg-amber-500" };
    case "CANCELLED":
      return { label: "Đã hủy / Phạt", tone: "bg-rose-500/10 text-rose-600 border-rose-500/20", dot: "bg-rose-500" };
    default:
      return { label: status, tone: "bg-black/5 text-muted border-border", dot: "bg-muted" };
  }
};

export const canShowVietQr = (status?: string | null) => {
  if (!status) return false;
  const s = status.toUpperCase();
  return !["PAID", "CONVERTED_TO_CONTRACT", "REFUNDED", "CANCELLED"].includes(s);
};

const getTypeMeta = (type: string) => {
  switch (type) {
    case "BOOKING":
      return { label: "Cọc giữ phòng", icon: Bookmark, tone: "text-amber-600 bg-amber-500/10 border-amber-500/20" };
    case "SECURITY":
      return { label: "Cọc bảo đảm", icon: ShieldCheck, tone: "text-purple-600 bg-purple-500/10 border-purple-500/20" };
    case "RESERVATION":
      return { label: "Phí giữ chỗ", icon: Bookmark, tone: "text-sky-600 bg-sky-500/10 border-sky-500/20" };
    default:
      return { label: type, icon: Bookmark, tone: "text-muted bg-black/5 border-border" };
  }
};

interface OperationsDepositListProps {
  onCreateClick?: () => void;
}

export default function OperationsDepositList({ onCreateClick }: OperationsDepositListProps) {
  const { 
    searchQuery, statusFilter, typeFilter, buildingFilter, page, limit,
    selectedDeposit, setSelectedDeposit, setPage
  } = useDepositStore();

  const [qrModalDeposit, setQrModalDeposit] = useState<UI_Deposit | null>(null);

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
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <>
      <section data-testid="deposits-list" className="flex min-h-[440px] flex-1 flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-xs">
        {/* Table Header Bar */}
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-2.5 bg-card">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Receipt size={15} />
            </div>
            <h3 className="text-[14px] font-black text-text">Danh sách Phiếu đặt cọc</h3>
            <span className="rounded-full bg-surface px-2 py-0.5 text-[11px] font-bold font-mono text-muted border border-border">
              {total} phiếu
            </span>
          </div>

          <span className="text-[12px] font-semibold text-muted">
            Trang {page} / {totalPages}
          </span>
        </div>

        {/* Table Scroll Area */}
        <div className="min-h-0 flex-1 overflow-x-auto">
          <table className="w-full min-w-[960px] text-left border-collapse">
            <thead className="sticky top-0 z-10 bg-surface/90 backdrop-blur-sm text-[11px] uppercase tracking-wider text-muted shadow-[0_1px_0_var(--border)] select-none">
              <tr>
                <th className="w-[130px] px-3.5 py-2.5 font-black whitespace-nowrap">Mã Phiếu</th>
                <th className="w-[200px] px-3.5 py-2.5 font-black whitespace-nowrap">Khách thuê / SĐT</th>
                <th className="w-[180px] px-3.5 py-2.5 font-black whitespace-nowrap">Phòng & Tòa nhà</th>
                <th className="w-[130px] px-3.5 py-2.5 font-black whitespace-nowrap">Loại cọc</th>
                <th className="w-[130px] px-3.5 py-2.5 font-black whitespace-nowrap">Ngày lập / Hạn</th>
                <th className="w-[130px] px-3.5 py-2.5 text-right font-black whitespace-nowrap">Số tiền cọc</th>
                <th className="w-[140px] px-3.5 py-2.5 font-black whitespace-nowrap">Trạng thái</th>
                <th className="w-[110px] px-3.5 py-2.5 text-right font-black whitespace-nowrap">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {isLoading && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-[13px] font-bold text-muted">
                    Đang tải danh sách phiếu cọc...
                  </td>
                </tr>
              )}
              {isError && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-[13px] font-bold text-rose-500">
                    Không tải được danh sách phiếu cọc.
                  </td>
                </tr>
              )}
              {!isLoading && !isError && deposits.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <div data-testid="empty-deposits-state" className="mx-auto flex max-w-sm flex-col items-center gap-2 rounded-2xl border border-dashed border-border bg-surface/40 px-6 py-8">
                      <Receipt size={32} className="text-muted/60" />
                      <div className="text-[14px] font-black text-text">Chưa có phiếu cọc phù hợp</div>
                      <div className="text-[12px] font-semibold text-muted">Thử thay đổi bộ lọc hoặc tạo phiếu cọc mới.</div>
                      {onCreateClick && (
                        <button
                          type="button"
                          onClick={onCreateClick}
                          className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-primary text-white px-3 py-1.5 text-xs font-bold shadow-xs hover:bg-primary/90 transition-colors"
                        >
                          <Plus size={13} /> Tạo phiếu cọc mới
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
              {!isLoading && !isError && deposits.map((deposit: UI_Deposit) => {
                const statusInfo = getStatusMeta(deposit.status, deposit.type);
                const typeInfo = getTypeMeta(deposit.type);
                const isOverdue = deposit.expiredAt && deposit.status === "PENDING" && new Date(deposit.expiredAt).getTime() < Date.now();

                return (
                  <tr
                    key={deposit.id}
                    onClick={() => setSelectedDeposit(deposit)}
                    className="cursor-pointer transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
                  >
                    {/* Mã Phiếu */}
                    <td className="px-3.5 py-2.5 font-mono font-black text-xs text-primary whitespace-nowrap">
                      {deposit.code || deposit.id}
                    </td>

                    {/* Khách thuê */}
                    <td className="px-3.5 py-2.5 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="text-[13px] font-bold text-text truncate">{deposit.customerName}</span>
                        <span className="text-[11px] font-medium text-muted font-mono">{deposit.customerPhone || "Chưa có SĐT"}</span>
                      </div>
                    </td>

                    {/* Phòng & Tòa */}
                    <td className="px-3.5 py-2.5 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className="rounded-md bg-surface px-1.5 py-0.5 text-[11px] font-mono font-bold text-text border border-border/60">
                          {deposit.roomCode}
                        </span>
                        <span className="text-[12px] font-medium text-muted truncate max-w-[110px]">
                          {deposit.buildingName}
                        </span>
                      </div>
                    </td>

                    {/* Loại cọc */}
                    <td className="px-3.5 py-2.5 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-bold ${typeInfo.tone}`}>
                        <typeInfo.icon size={11} />
                        {typeInfo.label}
                      </span>
                    </td>

                    {/* Ngày tạo & Hạn */}
                    <td className="px-3.5 py-2.5 whitespace-nowrap">
                      <div className="flex flex-col text-[11px]">
                        <span className="font-medium text-text">{formatDate(deposit.createdAt)}</span>
                        {deposit.expiredAt && (
                          <span className={`font-bold ${isOverdue ? "text-rose-500" : "text-amber-500"}`}>
                            Hạn: {formatDate(deposit.expiredAt)}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Số tiền cọc */}
                    <td className="px-3.5 py-2.5 text-right whitespace-nowrap">
                      <span className="font-mono font-black text-[13px] text-text">
                        {formatVnd(deposit.amount)}
                      </span>
                    </td>

                    {/* Trạng thái */}
                    <td className="px-3.5 py-2.5 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[11px] font-bold ${statusInfo.tone}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${statusInfo.dot}`} />
                        {statusInfo.label}
                      </span>
                    </td>

                    {/* Thao tác */}
                    <td className="px-3.5 py-2.5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        {canShowVietQr(deposit.status) && (
                          <button
                            type="button"
                            title="Xem VietQR & Gửi Zalo"
                            onClick={() => setQrModalDeposit(deposit)}
                            className="flex h-7 px-2 items-center gap-1 rounded-lg border border-primary/20 bg-primary/5 text-primary text-[11px] font-bold hover:bg-primary/15 transition-colors"
                          >
                            <QrCode size={13} /> VietQR
                          </button>
                        )}
                        <button
                          type="button"
                          title="Xem chi tiết"
                          onClick={() => setSelectedDeposit(deposit)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-border text-muted hover:text-text hover:border-primary/40 transition-colors"
                        >
                          <ChevronRight size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="mt-auto flex flex-col gap-3 border-t border-border/60 bg-surface/30 px-4 py-2.5 text-[12px] font-semibold text-muted shrink-0 sm:flex-row sm:items-center sm:justify-between">
          <span>
            Hiển thị {deposits.length === 0 ? 0 : (page - 1) * limit + 1} - {Math.min(page * limit, total)} trên {total} phiếu
          </span>
          <div className="flex items-center gap-1.5">
            <span className="rounded-xl border border-border bg-card px-2.5 py-1 text-[11px] font-bold text-text">
              {limit} / trang
            </span>
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage(Math.max(1, page - 1))}
              className="flex h-7 w-7 items-center justify-center rounded-xl border border-border bg-card text-muted hover:text-text hover:border-primary/40 disabled:opacity-40 transition-colors"
            >
              ‹
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, index) => index + 1).map((pageNumber) => (
              <button
                key={pageNumber}
                type="button"
                onClick={() => setPage(pageNumber)}
                className={`flex h-7 min-w-[28px] items-center justify-center rounded-xl px-1.5 text-xs font-bold transition-all ${
                  page === pageNumber
                    ? "bg-primary text-white shadow-xs"
                    : "border border-border bg-card text-muted hover:text-text"
                }`}
              >
                {pageNumber}
              </button>
            ))}
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              className="flex h-7 w-7 items-center justify-center rounded-xl border border-border bg-card text-muted hover:text-text hover:border-primary/40 disabled:opacity-40 transition-colors"
            >
              ›
            </button>
          </div>
        </div>
      </section>

      {/* Detail Drawer */}
      <OperationsDepositDrawer 
        deposit={selectedDeposit} 
        onClose={() => setSelectedDeposit(null)} 
      />

      {/* QR Modal */}
      {qrModalDeposit && (
        <DepositQrModal
          isOpen={!!qrModalDeposit}
          onClose={() => setQrModalDeposit(null)}
          deposit={qrModalDeposit}
        />
      )}
    </>
  );
}
