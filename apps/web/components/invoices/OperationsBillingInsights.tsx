"use client";

import React from "react";
import { Sparkles, AlertTriangle, Users, MessageSquare, TrendingDown, Building2 } from "lucide-react";
import { Card } from "../ui/Card";
import { Skeleton } from "../ui/Skeleton";
import { useInvoicesQuery } from "@/lib/queries/invoices.queries";

export default function OperationsBillingInsights() {
  const { data, isLoading } = useInvoicesQuery({ limit: 100 });
  const invoices: any[] = (data as any)?.data || [];

  if (isLoading) {
    return (
      <Card className="p-[16px] md:p-[20px] flex items-center gap-[16px] overflow-x-auto no-scrollbar shadow-sm">
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

  const overdue = invoices.filter((inv: any) => inv.status === "OVERDUE").length;
  const pending = invoices.filter((inv: any) => inv.status === "DRAFT" || inv.status === "ISSUED").length;
  const partial = invoices.filter((inv: any) => inv.status === "PARTIALLY_PAID").length;
  const paid = invoices.filter((inv: any) => inv.status === "PAID").length;
  const receivable = invoices.reduce((sum: number, inv: any) => sum + Math.max(0, (Number(inv.total) || 0) - (Number(inv.paidAmount) || 0)), 0);

  const insights = [
    { text: `${overdue} hóa đơn quá hạn cần xử lý`, icon: AlertTriangle, color: "text-rose-500" },
    { text: `${pending} hóa đơn chờ thanh toán`, icon: Users, color: "text-[#0ea5e9]" },
    { text: `${partial} hóa đơn thanh toán một phần`, icon: MessageSquare, color: "text-[#f97316]" },
    { text: `${paid} hóa đơn đã thanh toán`, icon: Building2, color: "text-[#8b5cf6]" },
    { text: `${receivable.toLocaleString()} VNĐ còn phải thu`, icon: TrendingDown, color: "text-[#6366f1]" },
  ];

  return (
    <Card className="p-[16px] md:p-[20px] flex items-center gap-[16px] overflow-x-auto no-scrollbar shadow-sm">
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
