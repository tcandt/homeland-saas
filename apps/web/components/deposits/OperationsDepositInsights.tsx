"use client";

import React from "react";
import { Sparkles, Clock, AlertTriangle, CalendarClock, Wallet, FileText, ArrowRight } from "lucide-react";
import { Card } from "../ui/Card";
import { Skeleton } from "../ui/Skeleton";
import { useDepositsQuery } from "@/lib/queries/deposits.queries";
import { useDepositStore } from "@/lib/stores/deposit.store";

export default function OperationsDepositInsights() {
  const { setStatusFilter } = useDepositStore();
  const { data, isLoading } = useDepositsQuery({ limit: 100 });
  const items = data?.data?.items || [];

  if (isLoading) {
    return (
      <div className="h-10 px-4 rounded-xl bg-card/40 border border-border/50 flex items-center gap-4 overflow-hidden">
        <Skeleton className="h-4 w-28 rounded-md" />
        <div className="flex items-center gap-4">
          <Skeleton className="h-3.5 w-32 rounded-md" />
          <Skeleton className="h-3.5 w-32 rounded-md" />
          <Skeleton className="h-3.5 w-32 rounded-md" />
        </div>
      </div>
    );
  }

  const pending = items.filter((d: any) => d.status === "PENDING" || d.status === "DRAFT").length;
  const paid = items.filter((d: any) => d.status === "PAID" || d.status === "CONVERTED_TO_CONTRACT").length;
  const refund = items.filter((d: any) => d.status === "REFUNDED").length;
  const expiring = items.filter((d: any) => {
    if (!d.expiredAt) return false;
    return new Date(d.expiredAt).getTime() < Date.now();
  }).length;
  const booking = items.filter((d: any) => d.type === "BOOKING" || d.type === "RESERVATION").length;

  const insights = [
    { text: `${pending} cọc chờ xử lý`, icon: FileText, color: "text-indigo-500", onClick: () => setStatusFilter("PENDING") },
    { text: `${booking} cọc giữ chỗ`, icon: CalendarClock, color: "text-amber-500", onClick: () => {} },
    { text: `${paid} đã thu / chuyển cọc`, icon: Wallet, color: "text-emerald-500", onClick: () => setStatusFilter("PAID") },
    { text: `${expiring} phiếu quá hạn`, icon: Clock, color: "text-rose-500", onClick: () => {} },
    { text: `${refund} phiếu hoàn tiền`, icon: AlertTriangle, color: "text-purple-500", onClick: () => setStatusFilter("REFUNDED") },
  ];

  return (
    <div className="flex items-center gap-3 px-3.5 py-2 rounded-xl bg-card/60 border border-border/60 shadow-2xs backdrop-blur-sm overflow-x-auto no-scrollbar">
      {/* Brand Badge */}
      <div className="flex items-center gap-2 pr-3 border-r border-border/60 shrink-0">
        <div className="w-5 h-5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
          <Sparkles size={12} />
        </div>
        <span className="text-[11px] font-black tracking-wide text-text uppercase">Insight</span>
      </div>

      {/* Insight Badges */}
      <div className="flex items-center gap-3 md:gap-4 shrink-0">
        {insights.map((item, idx) => (
          <button
            key={idx}
            type="button"
            onClick={item.onClick}
            className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer text-[12px] font-semibold text-muted hover:text-text shrink-0"
          >
            <item.icon size={13} className={item.color} />
            <span>{item.text}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
