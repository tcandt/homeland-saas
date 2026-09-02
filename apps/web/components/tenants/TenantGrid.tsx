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
import { getTenantAvatar, default as TenantDetailDrawer } from "./TenantDetailDrawer";

type TenantRow = {
  id: string;
  source: any;
  fullName: string;
  avatar: string;
  gender: string;
  type: string;
  roomLabel: string;
  buildingName: string;
  phone: string;
  email: string;
  startDate?: string;
  endDate?: string;
  contractDays: number;
  debt: number;
  status: string;
  statusLabel: string;
  statusVariant: "success" | "warning" | "error" | "neutral" | "primary";
  activeContract: any;
  contracts: any[];
  identityNo?: string;
  birthDate?: string;
  address?: string;
  zaloChatId?: string;
  zaloUserId?: string;
  emergencyPhone?: string;
  idImages?: string[];
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
      // Find all contracts belonging to this customer
      const customerContracts: any[] = contracts.filter(
        (contract: any) =>
          contract.customerId === customer.id ||
          contract.customer?.id === customer.id,
      );

      // Prioritize active contracts first, then pending/draft
      const activeContract =
        customerContracts.find(
          (c: any) =>
            c.status === "ACTIVE" ||
            c.status === "APPROVED" ||
            c.status === "EXPIRING",
        ) ||
        customerContracts.find(
          (c: any) => c.status === "PENDING_APPROVAL" || c.status === "DRAFT",
        );

      const latestTerminatedContract = !activeContract
        ? customerContracts.find(
            (c: any) => c.status === "TERMINATED" || c.status === "CANCELLED" || c.status === "EXPIRED"
          )
        : null;

      const debt = Number(customer.kpis?.totalDebt || activeContract?.debt || 0);
      const endDate = activeContract?.endDate;
      const days = contractDays(endDate);

      // Compute precise rental status based on contract reality
      let rentalStatus = "NO_CONTRACT";
      let statusLabel = "Chưa thuê";
      let statusVariant: "success" | "warning" | "error" | "neutral" | "primary" = "neutral";

      if (activeContract) {
        if (activeContract.status === "ACTIVE" || activeContract.status === "APPROVED") {
          if (days > 0 && days <= 30) {
            rentalStatus = "EXPIRING";
            statusLabel = "Sắp hết HĐ";
            statusVariant = "warning";
          } else if (days === 0 && endDate && new Date(endDate).getTime() < Date.now()) {
            rentalStatus = "EXPIRED";
            statusLabel = "Hết hạn HĐ";
            statusVariant = "error";
          } else {
            rentalStatus = "ACTIVE";
            statusLabel = "Đang thuê";
            statusVariant = "success";
          }
        } else if (activeContract.status === "EXPIRING") {
          rentalStatus = "EXPIRING";
          statusLabel = "Sắp hết HĐ";
          statusVariant = "warning";
        } else if (activeContract.status === "DRAFT" || activeContract.status === "PENDING_APPROVAL") {
          rentalStatus = "DRAFT";
          statusLabel = "Chờ ký HĐ";
          statusVariant = "primary";
        }
      } else if (customer.room || (customer.rooms && customer.rooms.length > 0)) {
        rentalStatus = "ACTIVE";
        statusLabel = "Ở ghép";
        statusVariant = "success";
      } else if (latestTerminatedContract) {
        rentalStatus = "TERMINATED";
        statusLabel = "Đã trả phòng";
        statusVariant = "neutral";
      }

      const gender = customer.gender || "Nam";
      const fullName = customer.fullName || customer.name || "Khách thuê";

      const roomLabel = activeContract
        ? (activeContract.room?.name || activeContract.room?.code || activeContract.room?.number || "N/A")
        : (customer.room?.name || customer.room?.code || customer.rooms?.[0]?.name || customer.rooms?.[0]?.code || "N/A");

      const buildingName = activeContract
        ? (activeContract.room?.building?.name || "Chưa có tòa")
        : (customer.room?.building?.name || customer.rooms?.[0]?.building?.name || "Chưa có tòa");

      return {
        id: customer.id,
        source: customer,
        fullName,
        gender,
        avatar: getTenantAvatar(customer.avatar, fullName, gender),
        type: customer.type || customer.customerType || "Cá nhân",
        roomLabel,
        buildingName,
        phone: customer.phone || "N/A",
        email: customer.email || "N/A",
        startDate: activeContract?.startDate,
        endDate: activeContract?.endDate,
        contractDays: days,
        debt,
        status: rentalStatus,
        statusLabel,
        statusVariant,
        activeContract,
        contracts: customerContracts,
        identityNo: customer.identityNo || customer.citizenId,
        birthDate: customer.birthDate,
        address: customer.address,
        zaloChatId: customer.zaloChatId,
        zaloUserId: customer.zaloUserId,
        emergencyPhone: customer.emergencyPhone,
        idImages: customer.idImages || [],
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
        <div className="grid min-w-[1140px] grid-cols-[minmax(200px,1.2fr)_minmax(140px,0.8fr)_minmax(150px,0.9fr)_minmax(170px,1fr)_minmax(140px,0.8fr)_100px_110px_60px] gap-3 border-b border-border bg-surface/70 px-4 py-3 text-[11px] font-black uppercase text-muted">
          <span>Khách thuê</span>
          <span>Phòng / Tòa</span>
          <span>Liên hệ</span>
          <span>Kênh thông báo</span>
          <span>Hợp đồng</span>
          <span>Công nợ</span>
          <span>Trạng thái</span>
          <span className="text-right">Thao tác</span>
        </div>

        <div className="flex min-w-[1140px] flex-col">
          {rows.length === 0 ? (
            <div data-testid="empty-tenants-state" className="p-6">
              <EmptyState title="Không có dữ liệu" message="Không tìm thấy khách hàng nào phù hợp với bộ lọc." />
            </div>
          ) : (
            displayedRows.map((row) => (
              <TenantTableRow
                key={row.id}
                row={row}
                onOpen={() => setSelectedTenant(row)}
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
  const cleanGender = (row.gender || "").trim().toLowerCase();
  const isFemale = cleanGender === "female" || cleanGender === "nu" || cleanGender === "nữ" || cleanGender === "gái";

  const hasPhone = row.phone && row.phone !== "N/A" && row.phone.trim() !== "";
  const hasEmail = !!(row.email && row.email !== "N/A" && row.email.includes("@"));
  const hasZalo = !!(row.zaloChatId || row.zaloUserId || (row.source as any)?.zaloUserId || (row.source as any)?.zaloChatId);
  const hasTelegram = !!((row.source as any)?.telegramChatId || (row.source as any)?.telegramId || (row.source as any)?.telegramUsername);

  return (
    <div data-testid="tenant-card" onClick={onOpen} className="relative grid min-w-[1140px] cursor-pointer grid-cols-[minmax(200px,1.2fr)_minmax(140px,0.8fr)_minmax(150px,0.9fr)_minmax(170px,1fr)_minmax(140px,0.8fr)_100px_110px_60px] items-center gap-3 border-b border-border px-4 py-3 last:border-b-0 hover:bg-surface/70">
      <div className="flex min-w-0 items-center gap-3 self-center">
        <div className="relative shrink-0">
          <img
            src={row.avatar}
            alt=""
            className={`h-10 w-10 shrink-0 rounded-full border-2 object-cover ${
              isFemale ? "border-rose-400/80 bg-rose-50" : "border-sky-400/80 bg-sky-50"
            }`}
          />
          <span
            className={`absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-black text-white shadow-sm ${
              isFemale ? "bg-rose-500" : "bg-sky-500"
            }`}
            title={isFemale ? "Nữ" : "Nam"}
          >
            {isFemale ? "♀" : "♂"}
          </span>
        </div>
        <div className="min-w-0">
          <div className="truncate text-[13px] font-black text-text">{row.fullName}</div>
          <div className="text-[11px] font-medium text-muted">{isFemale ? "Nữ" : "Nam"}</div>
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
      {/* Cột Kênh thông báo / Đăng ký */}
      <div className="flex flex-wrap items-center gap-1 min-w-0">
        {hasZalo && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-600 border border-blue-500/20" title="Đã liên kết Zalo ID">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse"></span> Zalo
          </span>
        )}
        {hasEmail && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20" title={`Email: ${row.email}`}>
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span> Email
          </span>
        )}
        {hasTelegram && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-500/10 text-sky-600 border border-sky-500/20" title="Đã liên kết Telegram">
            <span className="h-1.5 w-1.5 rounded-full bg-sky-500"></span> Telegram
          </span>
        )}
        {!hasZalo && !hasEmail && !hasTelegram && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-surface text-muted/70 border border-border/60">
            Chưa đăng ký
          </span>
        )}
      </div>
      <div className="min-w-0">
        <div className="truncate text-[12px] font-black text-text">
          {row.startDate && row.endDate ? `${formatDate(row.startDate)} - ${formatDate(row.endDate)}` : "-- --"}
        </div>
      </div>
      <div className={`text-[13px] font-black ${row.debt > 0 ? "text-rose-600" : "text-emerald-600"}`}>{formatMoney(row.debt)}</div>
      <div>
        <Badge variant={row.statusVariant as any}>{row.statusLabel}</Badge>
      </div>
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
