"use client";

import React, { useMemo, useState } from "react";
import { Building2, ChevronDown, Clock, FileX, UserCheck } from "lucide-react";
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

function normalizeContracts(responseData: any) {
  if (Array.isArray(responseData)) return responseData;
  if (Array.isArray(responseData?.items)) return responseData.items;
  if (Array.isArray(responseData?.data)) return responseData.data;
  return [];
}

function getStatusGroup(contract: any) {
  const status = String(contract?.status || "").toUpperCase();
  if (status === "ACTIVE") return "ACTIVE";
  if (status === "EXPIRING") return "EXPIRING";
  if (status === "TERMINATED" || status === "EXPIRED" || status === "CANCELLED") return "TERMINATED";
  if (status === "DRAFT" || status === "PENDING_APPROVAL" || status === "APPROVED") return "PENDING";
  return "OTHER";
}

export default function ContractsMobileFlow() {
  const [selectedContract, setSelectedContract] = useState<any | null>(null);
  const { search, status } = useContractsStore();

  const { data, isLoading, isError } = useContractsQuery({
    search: search || undefined,
    status: status && status !== "Tất cả" ? status : undefined,
    limit: 100,
  });

  const responseData = data?.data as any;
  const contracts = useMemo(() => normalizeContracts(responseData), [responseData]);
  const total = Number(responseData?.total || contracts.length || 0);

  const stats = useMemo(() => {
    const active = contracts.filter((contract: any) => getStatusGroup(contract) === "ACTIVE").length;
    const expiring = contracts.filter((contract: any) => getStatusGroup(contract) === "EXPIRING").length;
    const pendingSign = contracts.filter((contract: any) => getStatusGroup(contract) === "PENDING").length;
    const terminated = contracts.filter((contract: any) => getStatusGroup(contract) === "TERMINATED").length;
    return { active, expiring, pendingSign, terminated };
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
          <div className="text-[9px] font-bold text-muted uppercase text-center leading-tight">Hiệu lực</div>
        </Card>
        <Card className="bg-[#f97316]/10 border-[#f97316]/20 p-2.5 flex flex-col items-center justify-center gap-1">
          <div className="text-[16px] font-black text-[#f97316]">{stats.expiring}</div>
          <div className="text-[9px] font-bold text-[#f97316] uppercase text-center leading-tight">Sắp hết hạn</div>
        </Card>
        <Card className="p-2.5 flex flex-col items-center justify-center gap-1">
          <div className="text-[16px] font-black text-muted">{stats.terminated}</div>
          <div className="text-[9px] font-bold text-muted uppercase text-center leading-tight">Đã chấm dứt</div>
        </Card>
      </section>

      <section data-testid="contracts-filter-bar" className="flex gap-2 overflow-x-auto hide-scrollbar px-1">
        <Button variant="outline" size="sm" className="bg-[#4f46e5]/10 text-[#4f46e5] border-[#4f46e5]/20 text-[11px] h-7 px-3 rounded-full shrink-0">
          Tất cả Hợp đồng ({total})
        </Button>
        <Button variant="outline" size="sm" className="text-muted text-[11px] h-7 px-3 rounded-full shrink-0">
          <Clock size={12} className="mr-1" /> Sắp hết hạn ({stats.expiring})
        </Button>
        <Button variant="outline" size="sm" className="text-muted text-[11px] h-7 px-3 rounded-full shrink-0">
          <UserCheck size={12} className="mr-1" /> Chờ ký ({stats.pendingSign})
        </Button>
        <Button variant="outline" size="sm" className="text-muted text-[11px] h-7 px-3 rounded-full shrink-0">
          <FileX size={12} className="mr-1" /> Đã thanh lý ({stats.terminated})
        </Button>
      </section>

      <section data-testid="contracts-list" className="flex flex-col gap-2 px-1">
        <div className="flex justify-between items-end px-1">
          <h3 className="text-[13px] font-black text-text">Danh sách ({total})</h3>
          <span className="text-[11px] font-bold text-[#4f46e5] flex items-center gap-1">
            Mới nhất <ChevronDown size={14} />
          </span>
        </div>

        <div className="flex flex-col gap-2">
          {contracts.length === 0 ? (
            <div data-testid="empty-contracts-state">
              <EmptyState title="Không có hợp đồng" message="Chưa có hợp đồng nào hoặc không có hợp đồng phù hợp với bộ lọc." />
            </div>
          ) : (
            contracts.map((item: any, i: number) => {
              const statusConfig = getContractStatusConfig(item.status);
              const startLabel = item.startDate ? new Date(item.startDate).toLocaleDateString("vi-VN") : "N/A";
              const endLabel = item.endDate ? new Date(item.endDate).toLocaleDateString("vi-VN") : "N/A";
              return (
                <Card
                  data-testid="contract-card"
                  onClick={() => setSelectedContract(item)}
                  key={item.id || i}
                  className="p-3 flex flex-col relative overflow-hidden group active:scale-[0.98] transition-transform"
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
      </section>

      <OperationsContractDrawer contract={selectedContract} onClose={() => setSelectedContract(null)} />
    </div>
  );
}
