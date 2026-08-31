"use client";

import React, { useMemo } from "react";
import { AlertTriangle, CalendarClock, ChevronRight, RefreshCcw, ArrowRight } from "lucide-react";
import { useDepositsQuery } from "@/lib/queries/deposits.queries";
import { useDepositStore } from "@/lib/stores/deposit.store";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";

const money = (value: number) =>
  new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(value || 0) + " đ";

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
        let tagClass = "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
        let icon: React.ReactNode = <RefreshCcw size={11} />;

        if (isPending) {
          tag = "Chờ xử lý";
          tagClass = "bg-amber-500/10 text-amber-600 dark:text-amber-400";
          icon = <CalendarClock size={11} />;
        }

        if (isPending && dayDiff !== null && dayDiff < 0) {
          tag = `Trễ ${Math.abs(dayDiff)} ngày`;
          tagClass = "bg-rose-500/10 text-rose-600 dark:text-rose-400 font-black";
          icon = <AlertTriangle size={11} />;
        } else if (isPending && dayDiff === 0) {
          tag = "Đến hạn hôm nay";
          tagClass = "bg-sky-500/10 text-sky-600 dark:text-sky-400 font-bold";
          icon = <CalendarClock size={11} />;
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
    <div data-testid="deposits-refund-center" className="sticky top-[20px] flex flex-col gap-3 p-4 rounded-2xl bg-card/60 border border-border/60 shadow-xs backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-500/10 text-rose-500">
            <RefreshCcw size={15} />
          </div>
          <div className="flex flex-col">
            <h3 className="text-[14px] font-black text-text leading-tight">Trung tâm hoàn cọc</h3>
            <span className="text-[11px] font-medium text-muted">Xử lý hoàn tiền & phạt cọc</span>
          </div>
        </div>
        {refunds.length > 0 && (
          <button
            type="button"
            data-testid="deposits-refund-center-open-first"
            onClick={() => refunds[0] && setSelectedDeposit(refunds[0].deposit)}
            className="text-[12px] font-bold text-primary hover:underline"
          >
            Mở nhanh
          </button>
        )}
      </div>

      {/* 3 Metric Pills */}
      <div className="grid grid-cols-3 gap-1.5">
        <div className="flex flex-col items-center justify-center rounded-xl bg-black/[0.03] dark:bg-white/[0.03] border border-border/40 p-2 text-center">
          <span className="font-mono text-[16px] font-black text-text">{refunds.length}</span>
          <span className="text-[10px] font-bold uppercase text-muted">Tổng</span>
        </div>
        <div className="flex flex-col items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/20 p-2 text-center">
          <span className="font-mono text-[16px] font-black text-amber-600 dark:text-amber-400">{pendingCount}</span>
          <span className="text-[10px] font-bold uppercase text-amber-600 dark:text-amber-400">Chờ hoàn</span>
        </div>
        <div className="flex flex-col items-center justify-center rounded-xl bg-rose-500/10 border border-rose-500/20 p-2 text-center">
          <span className="font-mono text-[16px] font-black text-rose-600 dark:text-rose-400">{overdueCount}</span>
          <span className="text-[10px] font-bold uppercase text-rose-600 dark:text-rose-400">Quá hạn</span>
        </div>
      </div>

      {/* Items list */}
      <div className="flex flex-col gap-2 my-1">
        {refunds.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/60 bg-black/[0.02] dark:bg-white/[0.02] p-4 text-center text-[12px] font-medium text-muted">
            Không có phiếu hoàn cọc cần xử lý.
          </div>
        ) : (
          refunds.slice(0, 4).map((refund: any) => (
            <button
              key={refund.id}
              type="button"
              data-testid={`refund-center-item-${refund.id}`}
              onClick={() => setSelectedDeposit(refund.deposit)}
              className="group flex items-center justify-between rounded-xl border border-border/50 bg-card/80 p-2.5 text-left transition-all duration-150 hover:border-primary/40 hover:shadow-2xs"
            >
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="text-[13px] font-bold text-text truncate group-hover:text-primary transition-colors">
                  {refund.customerName}
                </span>
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted">
                  <span className="font-bold text-text">{refund.roomCode}</span>
                  <span>·</span>
                  <span className="truncate">{refund.buildingName}</span>
                </div>
                <span className="font-mono text-[12px] font-black text-primary mt-0.5">{money(refund.amount)}</span>
              </div>

              <div className="flex flex-col items-end gap-1.5 shrink-0 pl-2">
                <div className={`flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] ${refund.tagClass}`}>
                  {refund.icon}
                  <span>{refund.tag}</span>
                </div>
                <ChevronRight size={14} className="text-muted group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
              </div>
            </button>
          ))
        )}
      </div>

      {/* Action button */}
      <Button
        type="button"
        data-testid="deposits-refund-center-action"
        onClick={() => {
          const next = refunds.find((item: any) => item.isPending) || refunds[0];
          if (next) setSelectedDeposit(next.deposit);
        }}
        disabled={refunds.length === 0}
        variant="outline"
        className="w-full h-9 rounded-xl border-rose-500/20 bg-rose-500/5 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 font-bold text-[12px]"
      >
        <RefreshCcw size={13} className="mr-1.5" />
        Xử lý hoàn tiền
      </Button>
    </div>
  );
}
