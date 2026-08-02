"use client";

import React from "react";
import { Users, UserCheck, CalendarClock, CreditCard, CheckCircle2, CircleDollarSign, Coins, TrendingUp } from "lucide-react";
import { useSalesLeadsQuery } from "@/lib/queries/sales.queries";
import { Card } from "../ui/Card";
import { Skeleton } from "../ui/Skeleton";

export default function OperationsSalesKpi() {
  const { data, isLoading } = useSalesLeadsQuery({ limit: 100 });
  const leads = Array.isArray((data as any)?.data?.data) ? (data as any).data.data : [];
  const total = leads.length;
  const newLeads = leads.filter((lead: any) => lead.status === "NEW").length;
  const contacted = leads.filter((lead: any) => lead.status === "CONTACTED").length;
  const active = leads.filter((lead: any) => ["CONTACTED", "QUALIFIED", "PROPOSAL"].includes(lead.status)).length;
  const won = leads.filter((lead: any) => lead.status === "WON").length;
  const notesCount = leads.filter((lead: any) => String(lead.notes || "").trim().length > 0).length;
  const conversion = total > 0 ? Math.round((won / total) * 100) : 0;
  const recent30Days = leads.filter((lead: any) => {
    const created = new Date(lead.createdAt);
    return !Number.isNaN(created.getTime()) && Date.now() - created.getTime() <= 1000 * 60 * 60 * 24 * 30;
  }).length;

  const kpis = [
    { label: "Tổng lead", value: String(total), icon: Users, color: "text-blue-500", bg: "bg-blue-500/10" },
    { label: "Mới nhận", value: String(newLeads), icon: UserCheck, color: "text-orange-500", bg: "bg-orange-500/10" },
    { label: "Đang xử lý", value: String(active), icon: CalendarClock, color: "text-rose-500", bg: "bg-rose-500/10" },
    { label: "Đã liên hệ", value: String(contacted), icon: CreditCard, color: "text-indigo-500", bg: "bg-indigo-500/10" },
    { label: "Đã chốt", value: String(won), icon: CheckCircle2, color: "text-indigo-500", bg: "bg-indigo-500/10" },
    { label: "Tỷ lệ chốt", value: `${conversion}%`, icon: CircleDollarSign, color: "text-indigo-600 dark:text-indigo-500", bg: "bg-indigo-500/10" },
    { label: "Có ghi chú", value: String(notesCount), icon: Coins, color: "text-yellow-600 dark:text-yellow-500", bg: "bg-yellow-500/10" },
    { label: "30 ngày", value: String(recent30Days), icon: TrendingUp, color: "text-[#6366f1]", bg: "bg-[#6366f1]/10" },
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-[12px]">
        {Array.from({ length: 8 }).map((_, index) => (
          <Card key={index} className="p-[16px] flex flex-col justify-between shadow-sm h-[80px] md:h-[90px]">
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="w-[24px] h-[24px] rounded-full" />
            </div>
            <Skeleton className="h-5 w-10" />
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-[12px]">
      {kpis.map((kpi, index) => {
        const Icon = kpi.icon;
        return (
          <div key={index} className="bg-card border border-border rounded-[16px] p-[16px] flex flex-col justify-between shadow-sm hover:shadow-md hover:border-border/80 transition-all group h-[80px] md:h-[90px]">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-muted uppercase tracking-wider truncate mr-2 group-hover:text-text transition-colors">
                {kpi.label}
              </span>
              <div className={`w-[24px] h-[24px] rounded-full flex items-center justify-center shrink-0 ${kpi.bg}`}>
                <Icon size={12} className={kpi.color} />
              </div>
            </div>
            <div className="flex items-end justify-between mt-auto">
              <span className="text-[18px] md:text-[20px] font-black text-text leading-none tracking-tight">
                {kpi.value}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
