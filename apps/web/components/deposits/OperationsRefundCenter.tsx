"use client";

import React, { useMemo } from "react";
import { RefreshCcw, AlertTriangle, CalendarClock, ChevronRight } from "lucide-react";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { useDepositsQuery } from "@/lib/queries/deposits.queries";

const money = (value: number) => new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(value);

export default function OperationsRefundCenter() {
  const { data } = useDepositsQuery({ limit: 100 });
  const deposits = data?.data?.items || [];

  const refunds = useMemo(() => {
    return deposits
      .filter((deposit: any) => deposit.status === "REFUNDED" || deposit.status === "CANCELLED")
      .map((deposit: any) => {
        const expiry = deposit.expiredAt ? new Date(deposit.expiredAt) : null;
        const now = new Date();
        const dayDiff = expiry ? Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;
        let tag = "Đang xử lý";
        let tagClass = "bg-black/5 dark:bg-white/5 text-muted";
        let icon = null as React.ReactNode;

        if (dayDiff !== null) {
          if (dayDiff < 0) {
            tag = `Trễ ${Math.abs(dayDiff)} ngày`;
            tagClass = "bg-rose-500/10 text-rose-500";
            icon = <AlertTriangle size={10} />;
          } else if (dayDiff === 0) {
            tag = "Hôm nay";
            tagClass = "bg-[#6366f1]/10 text-[#6366f1]";
            icon = <CalendarClock size={10} />;
          } else {
            tag = `Còn ${dayDiff} ngày`;
            tagClass = "bg-black/5 dark:bg-white/5 text-muted";
            icon = <CalendarClock size={10} />;
          }
        }

        return {
          id: deposit.id,
          name: deposit.customerName,
          room: deposit.roomCode,
          amount: money(Number(deposit.amount) || 0),
          tag,
          tagClass,
          icon,
        };
      });
  }, [deposits]);

  const overdueCount = refunds.filter((item: any) => item.tag.startsWith("Trễ")).length;

  return (
    <Card data-testid="deposits-refund-center" className="flex flex-col gap-[20px] h-full sticky top-[24px]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-[8px]">
          <div className="w-[36px] h-[36px] rounded-full bg-rose-500/10 flex items-center justify-center">
            <RefreshCcw size={18} className="text-rose-500" />
          </div>
          <div className="flex flex-col">
            <h3 className="font-black text-[16px] text-text leading-tight">Refund Center</h3>
            <span className="font-bold text-[12px] text-muted">Hoàn tiền từ DB</span>
          </div>
        </div>
        <button className="text-[12px] font-bold text-[#6366f1] hover:underline">Xem tất cả</button>
      </div>

      <div className="flex gap-[8px]">
        <div className="flex-1 bg-black/5 dark:bg-white/5 rounded-[10px] p-[10px] flex flex-col items-center justify-center">
          <span className="font-black text-[18px] text-[#6366f1]">{refunds.length}</span>
          <span className="font-bold text-[11px] text-muted uppercase">Tổng phiếu</span>
        </div>
        <div className="flex-1 bg-black/5 dark:bg-white/5 rounded-[10px] p-[10px] flex flex-col items-center justify-center">
          <span className="font-black text-[18px] text-text">{refunds.filter((item: any) => item.tag === "Hôm nay").length}</span>
          <span className="font-bold text-[11px] text-muted uppercase">Hôm nay</span>
        </div>
        <div className="flex-1 bg-rose-500/10 border border-rose-500/20 rounded-[10px] p-[10px] flex flex-col items-center justify-center">
          <span className="font-black text-[18px] text-rose-500">{overdueCount}</span>
          <span className="font-bold text-[11px] text-rose-500 uppercase">Quá hạn</span>
        </div>
      </div>

      <div className="flex flex-col gap-[12px] mt-[8px]">
        {refunds.length === 0 ? (
          <div className="rounded-[12px] border border-border bg-black/5 dark:bg-white/5 p-[16px] text-center text-muted font-medium">
            Chưa có phiếu hoàn tiền nào.
          </div>
        ) : (
          refunds.slice(0, 3).map((refund: any) => (
            <div key={refund.id} className="flex items-center justify-between p-[12px] border border-border rounded-[12px] hover:border-[#6366f1]/50 cursor-pointer transition-colors group">
              <div className="flex flex-col gap-[4px]">
                <span className="font-bold text-[13px] text-text group-hover:text-[#6366f1] transition-colors">{refund.name}</span>
                <div className="flex items-center gap-[6px] text-[11px] font-bold text-muted">
                  <span>{refund.room}</span>
                  <span>·</span>
                  <span className="text-text">{refund.amount}đ</span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-[4px]">
                <div className={`flex items-center gap-[4px] text-[11px] font-black px-[6px] py-[2px] rounded-[4px] ${refund.tagClass}`}>
                  {refund.icon}
                  {refund.tag}
                </div>
                <ChevronRight size={14} className="text-muted group-hover:text-[#6366f1] transition-colors" />
              </div>
            </div>
          ))
        )}
      </div>

      <Button variant="outline" className="mt-auto w-full text-[#8b5cf6] border-[#8b5cf6]/20 bg-[#8b5cf6]/10 hover:bg-[#8b5cf6]/20">
        <RefreshCcw size={16} className="mr-2" /> Xử lý hoàn tiền ngay
      </Button>
    </Card>
  );
}
