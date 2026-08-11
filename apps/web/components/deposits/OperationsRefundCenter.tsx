"use client";

import React, { useMemo } from "react";
import { AlertTriangle, CalendarClock, ChevronRight, RefreshCcw } from "lucide-react";
import { useDepositsQuery } from "@/lib/queries/deposits.queries";
import { useDepositStore } from "@/lib/stores/deposit.store";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";

const money = (value: number) =>
  new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(value || 0);

export default function OperationsRefundCenter() {
  const { data } = useDepositsQuery({ limit: 100 });
  const setSelectedDeposit = useDepositStore((state) => state.setSelectedDeposit);
  const deposits = data?.data?.items || [];

  const refunds = useMemo(() => {
    return deposits
      .filter((deposit: any) => {
        const pendingRefund = Boolean(deposit.refundSummary?.pending);
        return pendingRefund || deposit.status === "REFUNDED" || deposit.status === "CANCELLED";
      })
      .map((deposit: any) => {
        const expiry = deposit.expiredAt ? new Date(deposit.expiredAt) : null;
        const now = new Date();
        const dayDiff = expiry ? Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;
        const isPending = Boolean(deposit.refundSummary?.pending);

        let tag = "Đã hoàn tất";
        let tagClass = "bg-emerald-500/10 text-emerald-600";
        let icon: React.ReactNode = <RefreshCcw size={10} />;

        if (isPending) {
          tag = "Chờ xử lý";
          tagClass = "bg-amber-500/10 text-amber-600";
          icon = <CalendarClock size={10} />;
        }

        if (isPending && dayDiff !== null && dayDiff < 0) {
          tag = `Trễ ${Math.abs(dayDiff)} ngày`;
          tagClass = "bg-rose-500/10 text-rose-500";
          icon = <AlertTriangle size={10} />;
        } else if (isPending && dayDiff === 0) {
          tag = "Đến hạn hôm nay";
          tagClass = "bg-primary/10 text-primary";
          icon = <CalendarClock size={10} />;
        }

        return {
          id: deposit.id,
          deposit,
          customerName: deposit.customerName,
          roomCode: deposit.roomCode,
          buildingName: deposit.buildingName,
          amount: Number(deposit.amount) || 0,
          isPending,
          tag,
          tagClass,
          icon,
        };
      })
      .sort((a: any, b: any) => Number(b.isPending) - Number(a.isPending));
  }, [deposits]);

  const pendingCount = refunds.filter((item: any) => item.isPending).length;
  const overdueCount = refunds.filter((item: any) => item.tag.startsWith("Trễ")).length;

  return (
    <Card data-testid="deposits-refund-center" className="sticky top-[24px] flex h-full flex-col gap-[20px]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-[8px]">
          <div className="flex h-[36px] w-[36px] items-center justify-center rounded-full bg-rose-500/10">
            <RefreshCcw size={18} className="text-rose-500" />
          </div>
          <div className="flex flex-col">
            <h3 className="text-[16px] font-black leading-tight text-text">Trung tâm hoàn cọc</h3>
            <span className="text-[12px] font-bold text-muted">Theo dõi phiếu hoàn và hủy cọc có xử lý tiền</span>
          </div>
        </div>
        <button
          type="button"
          data-testid="deposits-refund-center-open-first"
          onClick={() => refunds[0] && setSelectedDeposit(refunds[0].deposit)}
          className="text-[12px] font-bold text-primary transition-colors hover:underline"
        >
          Mở nhanh
        </button>
      </div>

      <div className="flex gap-[8px]">
        <div className="flex flex-1 flex-col items-center justify-center rounded-[10px] bg-black/5 p-[10px] dark:bg-white/5">
          <span className="text-[18px] font-black text-primary">{refunds.length}</span>
          <span className="text-[11px] font-bold uppercase text-muted">Tổng phiếu</span>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center rounded-[10px] bg-amber-500/10 p-[10px]">
          <span className="text-[18px] font-black text-amber-600">{pendingCount}</span>
          <span className="text-[11px] font-bold uppercase text-amber-700">Chờ xử lý</span>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center rounded-[10px] border border-rose-500/20 bg-rose-500/10 p-[10px]">
          <span className="text-[18px] font-black text-rose-500">{overdueCount}</span>
          <span className="text-[11px] font-bold uppercase text-rose-500">Quá hạn</span>
        </div>
      </div>

      <div className="mt-[8px] flex flex-col gap-[12px]">
        {refunds.length === 0 ? (
          <div className="rounded-[12px] border border-border bg-black/5 p-[16px] text-center text-[13px] font-medium text-muted dark:bg-white/5">
            Chưa có phiếu hoàn cọc hoặc hủy cọc cần theo dõi.
          </div>
        ) : (
          refunds.slice(0, 4).map((refund: any) => (
            <button
              key={refund.id}
              type="button"
              data-testid={`refund-center-item-${refund.id}`}
              onClick={() => setSelectedDeposit(refund.deposit)}
              className="group flex items-center justify-between rounded-[12px] border border-border p-[12px] text-left transition-colors hover:border-primary/40"
            >
              <div className="flex flex-col gap-[4px]">
                <span className="text-[13px] font-bold text-text transition-colors group-hover:text-primary">
                  {refund.customerName}
                </span>
                <div className="flex items-center gap-[6px] text-[11px] font-bold text-muted">
                  <span>{refund.roomCode}</span>
                  <span>·</span>
                  <span>{refund.buildingName}</span>
                </div>
                <span className="text-[12px] font-black text-text">{money(refund.amount)}đ</span>
              </div>

              <div className="flex flex-col items-end gap-[6px]">
                <div className={`flex items-center gap-[4px] rounded-[4px] px-[6px] py-[2px] text-[11px] font-black ${refund.tagClass}`}>
                  {refund.icon}
                  {refund.tag}
                </div>
                <ChevronRight size={14} className="text-muted transition-colors group-hover:text-primary" />
              </div>
            </button>
          ))
        )}
      </div>

      <Button
        type="button"
        data-testid="deposits-refund-center-action"
        onClick={() => {
          const next = refunds.find((item: any) => item.isPending) || refunds[0];
          if (next) setSelectedDeposit(next.deposit);
        }}
        variant="outline"
        className="mt-auto w-full border-rose-500/20 bg-rose-500/10 text-rose-500 hover:bg-rose-500/20"
      >
        <RefreshCcw size={16} className="mr-2" />
        Xử lý hoàn cọc
      </Button>
    </Card>
  );
}
