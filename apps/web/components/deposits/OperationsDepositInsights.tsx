"use client";

import React from "react";
import { Sparkles, Clock, AlertTriangle, CalendarClock, Wallet, FileText } from "lucide-react";
import { Card } from "../ui/Card";
import { Skeleton } from "../ui/Skeleton";
import { useDepositsQuery } from "@/lib/queries/deposits.queries";

export default function OperationsDepositInsights() {
  const { data, isLoading } = useDepositsQuery({ limit: 100 });
  const items = data?.data?.items || [];

  if (isLoading) {
    return (
      <Card className="p-[16px] md:p-[20px] flex items-center gap-[16px] overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-[8px] pr-[16px] border-r border-border/50 shrink-0">
          <Skeleton className="w-[36px] h-[36px] rounded-full" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-4 w-28" />
          </div>
        </div>
        <div className="flex items-center gap-[24px] pl-[8px]">
          {Array.from({ length: 5 }).map((_, idx) => (
            <div key={idx} className="flex items-center gap-[6px] shrink-0">
              <Skeleton className="w-[14px] h-[14px] rounded-full" />
              <Skeleton className="h-3 w-36 max-w-[180px]" />
            </div>
          ))}
        </div>
      </Card>
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
    { text: `${pending} phiếu cọc đang chờ xử lý`, icon: FileText, color: "text-[#8b5cf6]" },
    { text: `${booking} phiếu giữ chỗ/booking`, icon: CalendarClock, color: "text-[#6366f1]" },
    { text: `${paid} phiếu đã thanh toán hoặc chuyển cọc`, icon: Wallet, color: "text-[#f97316]" },
    { text: `${expiring} phiếu đã quá hạn`, icon: Clock, color: "text-rose-500" },
    { text: `${refund} phiếu hoàn tiền`, icon: AlertTriangle, color: "text-[#a855f7]" },
  ];

  return (
    <Card className="p-[16px] md:p-[20px] flex items-center gap-[16px] overflow-x-auto no-scrollbar">
      <div className="flex items-center gap-[8px] pr-[16px] border-r border-border/50 shrink-0">
        <div className="w-[36px] h-[36px] rounded-full bg-[#6366f1]/10 flex items-center justify-center">
          <Sparkles size={18} className="text-[#6366f1]" />
        </div>
        <div className="flex flex-col">
          <span className="font-black text-[12px] text-text uppercase tracking-wider">AI Operations</span>
          <span className="font-bold text-[14px] text-text leading-tight">Insight Center</span>
        </div>
      </div>

      <div className="flex items-center gap-[24px] pl-[8px]">
        {insights.map((item, idx) => (
          <div key={idx} className="flex items-center gap-[6px] shrink-0">
            <item.icon size={14} className={item.color} />
            <span className="font-semibold text-[13px] text-text truncate">{item.text}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
