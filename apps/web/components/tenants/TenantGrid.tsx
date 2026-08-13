"use client";

import React, { useMemo, useState } from "react";
import { Eye } from "lucide-react";
import { useTenantsStore } from "@/lib/hooks/useTenantsStore";
import { useContractsQuery } from "@/lib/queries/contracts.queries";
import { useCustomersQuery } from "@/lib/queries/customers.queries";
import { Badge } from "../ui/Badge";
import { EmptyState } from "../ui/EmptyState";
import { ErrorState } from "../ui/ErrorState";
import { LoadingState } from "../ui/LoadingState";
import TenantDetailDrawer from "./TenantDetailDrawer";

type TenantRow = {
  id: string;
  source: any;
  fullName: string;
  avatar: string;
  type: string;
  roomLabel: string;
  buildingName: string;
  phone: string;
  email: string;
  startDate?: string;
  endDate?: string;
  debt: number;
  status: string;
};

function formatDate(value?: string) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleDateString("vi-VN");
}

function formatMoney(value: number) {
  return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(value || 0)} đ`;
}

function contractDays(endDate?: string) {
  if (!endDate) return 0;
  return Math.max(0, Math.ceil((new Date(endDate).getTime() - Date.now()) / 86400000));
}

export default function TenantGrid() {
  const [selectedTenant, setSelectedTenant] = useState<any | null>(null);
  const [page, setPage] = useState(1);
  const { search, status } = useTenantsStore();
  const { data: customersData, isLoading: customersLoading, isError: customersError } = useCustomersQuery({
    search: search || undefined,
    status: status !== "Tất cả" && status ? status : undefined,
    limit: 100,
  });
  const { data: contractsData, isLoading: contractsLoading } = useContractsQuery({ limit: 100 });

  const customers: any[] = (customersData as any)?.data || [];
  const contracts: any[] = (contractsData as any)?.data || [];

  const rows: TenantRow[] = useMemo(() => {
    return customers.map((customer: any) => {
      const relatedContract = contracts.find((contract: any) => contract.customerId === customer.id || contract.customer?.id === customer.id);
      const debt = Number(customer.kpis?.totalDebt || relatedContract?.debt || 0);
      return {
        id: customer.id,
        source: customer,
        fullName: customer.fullName || customer.name || "Khách thuê",
        avatar: customer.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(customer.fullName || customer.name || "Khách")}`,
        type: customer.type || customer.customerType || "Cá nhân",
        roomLabel: customer.rooms?.[0]?.name || relatedContract?.room?.number || relatedContract?.room?.code || "N/A",
        buildingName: customer.rooms?.[0]?.building?.name || relatedContract?.room?.building?.name || "Chưa có tòa",
        phone: customer.phone || "N/A",
        email: customer.email || "N/A",
        startDate: relatedContract?.startDate,
        endDate: relatedContract?.endDate,
        debt,
        status: customer.status || relatedContract?.status || "ACTIVE",
      };
    });
  }, [customers, contracts]);

  React.useEffect(() => {
    setPage(1);
  }, [search, status]);

  if (customersLoading || contractsLoading) {
    return <LoadingState message="Đang tải danh sách khách thuê..." />;
  }

  if (customersError) {
    return (
      <div data-testid="tenants-error-state">
        <ErrorState message="Có lỗi xảy ra khi tải danh sách khách hàng." onRetry={() => window.location.reload()} />
      </div>
    );
  }

  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const displayedRows = rows.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div data-testid="tenants-list" className="flex min-h-[520px] flex-1 flex-col overflow-hidden rounded-[16px] border border-border/40 bg-card shadow-[0_1px_2px_rgba(16,24,40,0.03)] xl:min-h-0">
      <div className="flex flex-col gap-[12px] border-b border-border px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-[10px]">
          <h3 className="text-[18px] font-black text-text">Danh sách khách thuê</h3>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-x-auto">
        <div className="grid min-w-[1060px] grid-cols-[minmax(220px,1.2fr)_minmax(160px,0.8fr)_minmax(190px,1fr)_minmax(160px,0.8fr)_120px_120px_86px] gap-3 border-b border-border bg-surface/70 px-4 py-3 text-[11px] font-black uppercase text-muted">
          <span>Khách thuê</span>
          <span>Phòng / Tòa</span>
          <span>Liên hệ</span>
          <span>Hợp đồng</span>
          <span>Công nợ</span>
          <span>Trạng thái</span>
          <span className="text-right">Thao tác</span>
        </div>

        <div className="flex min-w-[1060px] flex-col">
          {rows.length === 0 ? (
            <div data-testid="empty-tenants-state" className="p-6">
              <EmptyState title="Không có dữ liệu" message="Không tìm thấy khách hàng nào phù hợp với bộ lọc." />
            </div>
          ) : (
            displayedRows.map((row) => (
              <TenantTableRow
                key={row.id}
                row={row}
                onOpen={() => setSelectedTenant(row.source)}
              />
            ))
          )}
        </div>
      </div>

      <div className="mt-auto flex flex-col gap-3 border-t border-border px-4 py-3 text-[12px] font-semibold text-muted sm:flex-row sm:items-center sm:justify-between">
        <span>
          Hiển thị {rows.length === 0 ? 0 : (page - 1) * pageSize + 1} - {Math.min(page * pageSize, rows.length)} của {rows.length} khách thuê
        </span>
        <div className="flex items-center gap-2">
          <button type="button" className="h-8 rounded-xl border border-border bg-card px-3 text-[12px] font-black text-text">10 / trang</button>
          <PageButton disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>‹</PageButton>
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
          <PageButton disabled={page >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>›</PageButton>
        </div>
      </div>

      <TenantDetailDrawer tenant={selectedTenant} onClose={() => setSelectedTenant(null)} />
    </div>
  );
}

function TenantTableRow({ row, onOpen }: { row: TenantRow; onOpen: () => void }) {
  const days = contractDays(row.endDate);
  const statusLabel = row.status === "ACTIVE" ? "Đang thuê" : row.status === "EXPIRING" ? "Sắp hết HĐ" : row.status;
  const statusVariant = row.status === "ACTIVE" ? "success" : row.status === "EXPIRING" ? "warning" : row.debt > 0 ? "error" : "neutral";

  return (
    <div onClick={onOpen} className="relative grid min-w-[1060px] cursor-pointer grid-cols-[minmax(220px,1.2fr)_minmax(160px,0.8fr)_minmax(190px,1fr)_minmax(160px,0.8fr)_120px_120px_86px] items-center gap-3 border-b border-border px-4 py-3 last:border-b-0 hover:bg-surface/70">
      <div className="flex min-w-0 items-center gap-3 self-center">
        <img src={row.avatar} alt="" className="h-10 w-10 shrink-0 rounded-full border border-border object-cover" />
        <div className="min-w-0">
          <div className="truncate text-[13px] font-black text-text">{row.fullName}</div>
        </div>
      </div>
      <div className="min-w-0">
        <div className="truncate text-[13px] font-black text-text">{row.roomLabel}</div>
        <div className="mt-1 truncate text-[12px] font-semibold text-muted">{row.buildingName}</div>
      </div>
      <div className="min-w-0">
        <div className="truncate text-[13px] font-bold text-text">{row.phone}</div>
        <div className="mt-1 truncate text-[12px] font-semibold text-muted">{row.email}</div>
      </div>
      <div className="min-w-0">
        <div className="truncate text-[12px] font-black text-text">{formatDate(row.startDate)} - {formatDate(row.endDate)}</div>
      </div>
      <div className={`text-[13px] font-black ${row.debt > 0 ? "text-rose-600" : "text-emerald-600"}`}>{formatMoney(row.debt)}</div>
      <Badge variant={statusVariant as any}>{statusLabel}</Badge>
      <div className="relative flex justify-end">
        <button
          type="button"
          aria-label="Xem hồ sơ khách thuê"
          onClick={(event) => {
            event.stopPropagation();
            onOpen();
          }}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card text-muted hover:border-[#6d3df8]/30 hover:bg-[#f6f2ff] hover:text-[#6d3df8]"
        >
          <Eye size={16} />
        </button>
      </div>
    </div>
  );
}

function PageButton({ children, disabled, onClick }: { children: React.ReactNode; disabled: boolean; onClick: () => void }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} className="flex h-8 w-8 items-center justify-center rounded-xl border border-border text-muted disabled:opacity-40">
      {children}
    </button>
  );
}
