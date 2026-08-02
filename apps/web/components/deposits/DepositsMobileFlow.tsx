"use client";

import React, { useMemo, useState } from "react";
import { Building2, ChevronDown, Coins, ShieldCheck, UserPlus, Clock } from "lucide-react";
import { useDepositsQuery } from "../../lib/queries/deposits.queries";
import { UI_Deposit } from "../../lib/adapters/deposit.adapter";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { ErrorState } from "../ui/ErrorState";
import { EmptyState } from "../ui/EmptyState";
import OperationsDepositDrawer from "./OperationsDepositDrawer";

function formatMoney(amount: number) {
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(amount);
}

function normalizeDeposits(responseData: any): UI_Deposit[] {
  if (Array.isArray(responseData)) return responseData;
  if (Array.isArray(responseData?.items)) return responseData.items;
  if (Array.isArray(responseData?.data)) return responseData.data;
  return [];
}

export default function DepositsMobileFlow() {
  const [selectedDeposit, setSelectedDeposit] = useState<any | null>(null);
  const { data, isLoading, isError } = useDepositsQuery({ page: 1, limit: 50 });
  const responseData = data?.data as any;
  const deposits = useMemo(() => normalizeDeposits(responseData), [responseData]);

  const stats = useMemo(() => {
    const totalFund = deposits.reduce((sum, deposit: any) => sum + (Number(deposit.amount) || 0), 0);
    const securityFund = deposits
      .filter((deposit: any) => deposit.type === "SECURITY")
      .reduce((sum, deposit: any) => sum + (Number(deposit.amount) || 0), 0);
    const bookingFund = deposits
      .filter((deposit: any) => deposit.type === "BOOKING" || deposit.type === "RESERVATION")
      .reduce((sum, deposit: any) => sum + (Number(deposit.amount) || 0), 0);
    const refundedFund = deposits
      .filter((deposit: any) => deposit.status === "REFUNDED")
      .reduce((sum, deposit: any) => sum + (Number(deposit.amount) || 0), 0);

    const refundedCount = deposits.filter((deposit: any) => deposit.status === "REFUNDED").length;
    return { totalFund, securityFund, bookingFund, refundedFund, refundedCount };
  }, [deposits]);

  if (isLoading) {
    return <div className="p-4 text-center text-muted text-[13px]">Đang tải...</div>;
  }

  if (isError) {
    return (
      <div data-testid="deposits-error-state">
        <ErrorState message="Lỗi tải dữ liệu" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[16px] w-full box-border pb-[100px] bg-background pt-2">
      <section data-testid="deposits-kpi-grid" className="grid grid-cols-4 gap-2 px-1">
        <Card className="p-2.5 flex flex-col items-center justify-center gap-1 bg-[#3b82f6]/10 border-[#3b82f6]/20">
          <div className="text-[14px] font-black text-[#3b82f6]">{formatMoney(stats.totalFund)}</div>
          <div className="text-[9px] font-bold text-[#3b82f6] uppercase text-center leading-tight">Tổng quỹ</div>
        </Card>
        <Card className="p-2.5 flex flex-col items-center justify-center gap-1">
          <div className="text-[14px] font-black text-[#22c55e]">{formatMoney(stats.securityFund)}</div>
          <div className="text-[9px] font-bold text-muted uppercase text-center leading-tight">Bảo đảm</div>
        </Card>
        <Card className="p-2.5 flex flex-col items-center justify-center gap-1">
          <div className="text-[14px] font-black text-[#8b5cf6]">{formatMoney(stats.bookingFund)}</div>
          <div className="text-[9px] font-bold text-muted uppercase text-center leading-tight">Giữ chỗ</div>
        </Card>
        <Card className="p-2.5 flex flex-col items-center justify-center gap-1">
          <div className="text-[14px] font-black text-[#f97316]">{formatMoney(stats.refundedFund)}</div>
          <div className="text-[9px] font-bold text-muted uppercase text-center leading-tight">Đã hoàn</div>
        </Card>
      </section>

      <section className="flex gap-2 overflow-x-auto hide-scrollbar px-1">
        <Button variant="outline" size="sm" className="bg-[#4f46e5]/10 text-[#4f46e5] border-[#4f46e5]/20 rounded-full whitespace-nowrap">
          Tất cả Phiếu ({deposits.length})
        </Button>
        <Button variant="outline" size="sm" className="rounded-full whitespace-nowrap">
          <ShieldCheck size={12} className="mr-1" /> Cọc bảo đảm
        </Button>
        <Button variant="outline" size="sm" className="rounded-full whitespace-nowrap">
          <UserPlus size={12} className="mr-1" /> Cọc giữ chỗ
        </Button>
        <Button variant="outline" size="sm" className="rounded-full whitespace-nowrap">
          <Clock size={12} className="mr-1" /> Đã hoàn ({stats.refundedCount})
        </Button>
      </section>

      <section data-testid="deposits-list" className="flex flex-col gap-2 px-1">
        <div className="flex justify-between items-end px-1">
          <h3 className="text-[13px] font-black text-text">Danh sách ({deposits.length})</h3>
          <span className="text-[11px] font-bold text-[#4f46e5] flex items-center gap-1">
            Mới nhất <ChevronDown size={14} />
          </span>
        </div>

        <div className="flex flex-col gap-2">
          {deposits.length === 0 ? (
            <div data-testid="empty-deposits-state" className="p-4">
              <EmptyState title="Không có phiếu cọc" message="Chưa có phiếu cọc nào trong hệ thống hoặc không có phiếu phù hợp với bộ lọc." />
            </div>
          ) : (
            deposits.map((item: UI_Deposit, i: number) => {
              const isPaid = item.status === "PAID" || item.status === "CONVERTED_TO_CONTRACT";
              const isRefunded = item.status === "REFUNDED";
              const isCancelled = item.status === "CANCELLED";
              const amountStr = formatMoney(Number(item.amount) || 0) + "đ";
              const typeName = item.type === "BOOKING" ? "Giữ phòng" : item.type === "SECURITY" ? "Bảo đảm" : "Giữ chỗ";
              const createdLabel = item.createdAt ? new Date(item.createdAt).toLocaleDateString("vi-VN") : "N/A";

              return (
                <Card onClick={() => setSelectedDeposit(item)} data-testid="deposit-card" key={item.id || i} className="p-3 flex flex-col relative overflow-hidden group active:scale-[0.98] transition-transform">
                  <div
                    className={`absolute top-0 left-0 w-1 h-full ${
                      isPaid ? "bg-[#3b82f6]" : isRefunded ? "bg-[#22c55e]" : isCancelled ? "bg-muted" : "bg-[#8b5cf6]"
                    }`}
                  />

                  <div className="flex justify-between items-start pl-2">
                    <div className="flex flex-col">
                        <div className="flex items-center gap-1.5">
                        <span className="text-[13px] font-black text-text truncate max-w-[140px]">{item.customerName || (item as any)?.customer?.fullName || "Chưa rõ"}</span>
                        <span className="text-[10px] font-bold text-muted bg-black/5 px-1.5 py-0.5 rounded-[4px]">{item.code || item.id}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted mt-0.5">
                        <Building2 size={12} /> <span className="truncate">{item.roomCode || (item as any)?.room?.code || "N/A"} - {item.buildingName || (item as any)?.room?.building?.name || "N/A"}</span>
                      </div>
                    </div>

                    {isPaid && <span data-testid="deposit-status-badge" className="px-2 py-0.5 bg-[#3b82f6]/10 text-[#3b82f6] text-[9px] font-bold rounded-[4px]">Đã thu</span>}
                    {isRefunded && <span data-testid="deposit-status-badge" className="px-2 py-0.5 bg-[#22c55e]/10 text-[#22c55e] text-[9px] font-bold rounded-[4px]">Đã hoàn</span>}
                    {isCancelled && <span data-testid="deposit-status-badge" className="px-2 py-0.5 bg-black/5 text-muted text-[9px] font-bold rounded-[4px]">Đã hủy</span>}
                    {!isPaid && !isRefunded && !isCancelled && <span data-testid="deposit-status-badge" className="px-2 py-0.5 bg-black/5 text-muted text-[9px] font-bold rounded-[4px]">{item.status}</span>}
                  </div>

                  <div className="flex items-center justify-between pl-2 mt-2 pt-2 border-t border-border/50">
                    <div className="flex flex-col">
                      <span className="text-[9px] font-bold text-muted uppercase">Loại cọc • Ngày lập</span>
                      <div className="flex items-center gap-1 text-[11px] font-bold text-text">
                        {item.type === "SECURITY" ? <ShieldCheck size={12} className="text-[#22c55e]" /> : item.type === "BOOKING" ? <UserPlus size={12} className="text-[#8b5cf6]" /> : <Coins size={12} className="text-[#f97316]" />}
                        {typeName} <span className="text-muted font-medium ml-1">• {createdLabel}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-[9px] font-bold text-muted uppercase">Số tiền</span>
                      <span className="text-[13px] font-black text-text">{amountStr}</span>
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      </section>

      <OperationsDepositDrawer deposit={selectedDeposit} onClose={() => setSelectedDeposit(null)} />
    </div>
  );
}
