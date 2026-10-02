"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Building2, ChevronLeft, ChevronRight, Clock, FileText, UserCheck } from "lucide-react";
import { Card } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { ErrorState } from "../ui/ErrorState";
import { LoadingState } from "../ui/LoadingState";
import OperationsContractDrawer from "./OperationsContractDrawer";
import { useContractsQuery } from "@/lib/queries/contracts.queries";
import { useContractsStore } from "@/lib/hooks/useContractsStore";
import { getContractStatusConfig } from "@/lib/contracts/contract-status";
import { getContractDisplayStatus, getLinkedRental } from "@/lib/contracts/booking-conversion";

function normalizeContracts(responseData: any) {
  if (Array.isArray(responseData)) return responseData;
  if (Array.isArray(responseData?.items)) return responseData.items;
  if (Array.isArray(responseData?.data)) return responseData.data;
  return [];
}

function getStatusGroup(contract: any) {
  if (getLinkedRental(contract)) return "CONVERTED";
  const status = String(contract?.status || "").toUpperCase();
  if (status === "ACTIVE") return "ACTIVE";
  if (status === "EXPIRING") return "EXPIRING";
  if (status === "TERMINATED" || status === "EXPIRED" || status === "CANCELLED") return "TERMINATED";
  if (status === "DRAFT" || status === "PENDING_APPROVAL" || status === "APPROVED") return "PENDING";
  return "OTHER";
}

export default function ContractsMobileFlow() {
  const [selectedContract, setSelectedContract] = useState<any | null>(null);
  const [page, setPage] = useState(1);
  const { search, status, setStatus } = useContractsStore();
  const pageSize = 20;

  useEffect(() => setPage(1), [search, status]);

  const { data, isLoading, isError } = useContractsQuery({
    search: search || undefined,
    status: status || undefined,
    page,
    limit: pageSize,
  });

  const responseData = data?.data as any;
  const contracts = useMemo(() => normalizeContracts(responseData), [responseData]);
  const total = Number((data as any)?.meta?.total ?? contracts.length);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const stats = useMemo(() => {
    const active = contracts.filter((contract: any) => getStatusGroup(contract) === "ACTIVE").length;
    const expiring = contracts.filter((contract: any) => getStatusGroup(contract) === "EXPIRING").length;
    const pendingApproval = contracts.filter((contract: any) => String(contract.status).toUpperCase() === "PENDING_APPROVAL").length;
    const terminated = contracts.filter((contract: any) => String(contract.status).toUpperCase() === "TERMINATED").length;
    return { active, expiring, pendingApproval, terminated };
  }, [contracts]);

  if (isLoading) {
    return <LoadingState message="Đang tải hợp đồng..." />;
  }

  if (isError) {
    return (
      <div data-testid="contracts-error-state">
        <ErrorState message="Lỗi tải dữ liệu hợp đồng" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[16px] w-full box-border pb-[100px] bg-background pt-2">
      <section data-testid="contracts-kpi-grid" className="grid grid-cols-4 gap-2 px-1">
        <Card className="p-2.5 flex flex-col items-center justify-center gap-1">
          <div className="text-[16px] font-black text-[#3b82f6]">{total}</div>
          <div className="text-[9px] font-bold text-muted uppercase text-center leading-tight">Tổng HĐ</div>
        </Card>
        <Card className="p-2.5 flex flex-col items-center justify-center gap-1">
          <div className="text-[16px] font-black text-[#22c55e]">{stats.active}</div>
          <div className="text-[9px] font-bold text-muted uppercase text-center leading-tight">Hiệu lực · trang</div>
        </Card>
        <Card className="bg-[#f97316]/10 border-[#f97316]/20 p-2.5 flex flex-col items-center justify-center gap-1">
          <div className="text-[16px] font-black text-[#f97316]">{stats.expiring}</div>
          <div className="text-[9px] font-bold text-[#f97316] uppercase text-center leading-tight">Sắp hết hạn · trang</div>
        </Card>
        <Card className="p-2.5 flex flex-col items-center justify-center gap-1">
          <div className="text-[16px] font-black text-muted">{stats.terminated}</div>
          <div className="text-[9px] font-bold text-muted uppercase text-center leading-tight">Chấm dứt · trang</div>
        </Card>
      </section>

      <section data-testid="contracts-filter-bar" className="flex gap-2 overflow-x-auto hide-scrollbar px-1">
        <Button variant="outline" size="sm" onClick={() => setStatus("")} aria-pressed={!status} className={`text-[11px] h-7 px-3 rounded-full shrink-0 motion-reduce:transition-none ${!status ? "bg-[#4f46e5]/10 text-[#4f46e5] border-[#4f46e5]/20" : "text-muted"}`}>
          Tất cả Hợp đồng ({total})
        </Button>
        <Button variant="outline" size="sm" onClick={() => setStatus("EXPIRING")} aria-pressed={status === "EXPIRING"} className={`text-[11px] h-7 px-3 rounded-full shrink-0 motion-reduce:transition-none ${status === "EXPIRING" ? "bg-[#f97316]/10 text-[#f97316] border-[#f97316]/20" : "text-muted"}`}>
          <Clock size={12} className="mr-1" /> Sắp hết hạn ({stats.expiring})
        </Button>
        <Button variant="outline" size="sm" onClick={() => setStatus("PENDING_APPROVAL")} aria-pressed={status === "PENDING_APPROVAL"} className={`text-[11px] h-7 px-3 rounded-full shrink-0 motion-reduce:transition-none ${status === "PENDING_APPROVAL" ? "bg-[#4f46e5]/10 text-[#4f46e5] border-[#4f46e5]/20" : "text-muted"}`}>
          <UserCheck size={12} className="mr-1" /> Chờ duyệt ({stats.pendingApproval})
        </Button>
        <Button variant="outline" size="sm" onClick={() => setStatus("TERMINATED")} aria-pressed={status === "TERMINATED"} className={`text-[11px] h-7 px-3 rounded-full shrink-0 motion-reduce:transition-none ${status === "TERMINATED" ? "bg-slate-500/10 text-slate-700 border-slate-500/20" : "text-muted"}`}>
          <FileText size={12} className="mr-1" /> Đã chấm dứt ({stats.terminated})
        </Button>
      </section>

      <section data-testid="contracts-list" className="flex flex-col gap-2 px-1">
        <div className="flex justify-between items-end px-1">
          <h3 className="text-[13px] font-black text-text">Danh sách ({total})</h3>
          <span className="text-[11px] font-bold text-muted">Trang {page}/{totalPages}</span>
        </div>

        <div className="flex flex-col gap-2">
          {contracts.length === 0 ? (
            <div data-testid="empty-contracts-state">
              <EmptyState title="Không có hợp đồng" message="Chưa có hợp đồng nào hoặc không có hợp đồng phù hợp với bộ lọc." />
            </div>
          ) : (
            contracts.map((item: any, i: number) => {
              const statusConfig = getContractDisplayStatus(item);
              const startLabel = item.startDate ? new Date(item.startDate).toLocaleDateString("vi-VN") : "N/A";
              const endLabel = item.endDate ? new Date(item.endDate).toLocaleDateString("vi-VN") : "N/A";
              return (
                <Card
                  data-testid="contract-card"
                  onClick={() => setSelectedContract(item)}
                  key={item.id || i}
                  role="button"
                  tabIndex={0}
                  aria-label={`Mở hợp đồng ${item.code || item.id || ""}`}
                  onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedContract(item); } }}
                  className="p-3 flex flex-col relative overflow-hidden group active:scale-[0.98] transition-transform motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                >
                  <div
                    className="absolute top-0 left-0 w-1 h-full"
                    style={{
                      backgroundColor:
                        statusConfig.color === "success"
                          ? "#22c55e"
                          : statusConfig.color === "warning"
                            ? "#f97316"
                            : statusConfig.color === "error"
                              ? "#ef4444"
                              : "#9ca3af",
                    }}
                  />

                  <div className="flex justify-between items-start pl-2">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[13px] font-black text-text">{item.code || item.id?.slice?.(0, 8) || "Chưa rõ"}</span>
                        <Badge variant="neutral">{item.id?.slice?.(0, 8) || "N/A"}</Badge>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted mt-0.5">
                        <Building2 size={12} />
                        <span className="truncate">
                          {item.customer?.fullName || item.customer?.name || "Chưa rõ"} · {item.room?.number || item.room?.code || "Chưa xếp phòng"}
                        </span>
                      </div>
                    </div>

                    <Badge data-testid="contract-status-badge" variant={statusConfig.color}>
                      {statusConfig.label}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between pl-2 mt-2 pt-2 border-t border-border/50">
                    <div className="flex flex-col">
                      <span className="text-[9px] font-bold text-muted uppercase">Thời hạn</span>
                      <span className="text-[11px] font-bold text-text">
                        {startLabel} - {endLabel}
                      </span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-[9px] font-bold text-muted uppercase">Giá thuê</span>
                      <span className="text-[12px] font-black text-text">{Number(item.monthlyRent || 0).toLocaleString("vi-VN")}đ</span>
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>
        {total > pageSize && <nav aria-label="Phân trang hợp đồng" className="flex items-center justify-center gap-3 pt-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}><ChevronLeft size={15} className="mr-1" />Trước</Button>
          <span className="text-xs font-semibold text-muted">{Math.min((page - 1) * pageSize + 1, total)}–{Math.min(page * pageSize, total)} / {total}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)}>Sau<ChevronRight size={15} className="ml-1" /></Button>
        </nav>}
      </section>

      <OperationsContractDrawer
        contract={selectedContract}
        onClose={() => setSelectedContract(null)}
        onOpenContract={(nextContract) => setSelectedContract(nextContract)}
      />
    </div>
  );
}
