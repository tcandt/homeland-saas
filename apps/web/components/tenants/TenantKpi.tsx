"use client";

import React, { useMemo } from "react";
import { Users, CalendarClock, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Card } from "../ui/Card";
import { useCustomersQuery } from "@/lib/queries/customers.queries";
import { useContractsQuery } from "@/lib/queries/contracts.queries";

function formatMoney(value: number) {
  if (!value) return "0 đ";
  return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(value)} đ`;
}

export default function TenantKpi() {
  const { data: customersData } = useCustomersQuery({ limit: 100 });
  const { data: contractsData } = useContractsQuery({ limit: 100 });

  const summary = useMemo(() => {
    const customers: any[] = (customersData as any)?.data || [];
    const contracts: any[] = (contractsData as any)?.data || [];

    const newCustomers = customers.filter((customer: any) => {
      if (!customer.createdAt) return false;
      const createdAt = new Date(customer.createdAt).getTime();
      return (Date.now() - createdAt) / (1000 * 60 * 60 * 24) <= 30;
    }).length;

    const activeContracts = contracts.filter((c: any) => c.status === "ACTIVE" || c.status === "APPROVED");
    const activeContractCount = activeContracts.length;

    const expiringContracts = contracts.filter((contract: any) => {
      if (contract.status === "EXPIRING") return true;
      if (!contract.endDate) return false;
      const daysLeft = (new Date(contract.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      return daysLeft >= 0 && daysLeft <= 30;
    }).length;

    const overdueDebt = contracts.reduce((sum: number, contract: any) => sum + (Number(contract.debt) || 0), 0);
    const overdueCount = contracts.filter((contract: any) => Number(contract.debt) > 0 && contract.status !== "TERMINATED").length;

    const activeCustomerIds = new Set(activeContracts.map((c: any) => c.customerId || c.customer?.id).filter(Boolean));
    const withoutContractCount = customers.filter((c: any) => !activeCustomerIds.has(c.id)).length;

    return {
      totalCustomers: customers.length,
      newCustomers,
      activeContractCount,
      withoutContractCount,
      expiringContracts,
      overdueDebt,
      overdueCount,
    };
  }, [customersData, contractsData]);

  return (
    <div data-testid="tenants-kpi-grid" className="grid grid-cols-2 lg:grid-cols-4 gap-[12px] md:gap-[16px] shrink-0">
      <KpiCard
        title="Tổng khách thuê"
        value={summary.totalCustomers.toString()}
        trend={`+${summary.newCustomers} mới`}
        trendLabel="trong 30 ngày"
        trendPositive={true}
        icon={<Users size={18} className="text-[#4f46e5]" />}
        iconBg="bg-[#4f46e5]/10"
        blobColor="bg-[#4f46e5]/15"
      />
      <KpiCard
        title="Đang thuê phòng"
        value={summary.activeContractCount.toString()}
        trend={`${summary.withoutContractCount} khách`}
        trendLabel="chưa có hợp đồng"
        icon={<CheckCircle2 size={18} className="text-[#10b981]" />}
        iconBg="bg-[#10b981]/10"
        blobColor="bg-[#10b981]/15"
      />
      <KpiCard
        title="Sắp hết hạn HĐ"
        value={summary.expiringContracts.toString()}
        trend={summary.expiringContracts > 0 ? "Cần xử lý" : "Ổn định"}
        trendLabel={summary.expiringContracts > 0 ? "trong 30 ngày tới" : "không có HĐ sắp hết"}
        highlight={summary.expiringContracts > 0}
        highlightColor="text-[#f97316]"
        icon={<CalendarClock size={18} className="text-[#f97316]" />}
        iconBg="bg-[#f97316]/10"
        blobColor="bg-[#f97316]/15"
      />
      <KpiCard
        title="Tổng công nợ"
        value={formatMoney(summary.overdueDebt)}
        trend={summary.overdueCount > 0 ? `${summary.overdueCount} HĐ nợ` : "Đã thu đủ"}
        trendLabel={summary.overdueCount > 0 ? "cần theo dõi thu" : "0 đ quá hạn"}
        highlight={summary.overdueDebt > 0}
        highlightColor="text-[#ef4444]"
        icon={<AlertTriangle size={18} className={summary.overdueDebt > 0 ? "text-[#ef4444]" : "text-[#10b981]"} />}
        iconBg={summary.overdueDebt > 0 ? "bg-[#ef4444]/10" : "bg-[#10b981]/10"}
        blobColor={summary.overdueDebt > 0 ? "bg-[#ef4444]/15" : "bg-[#10b981]/15"}
      />
    </div>
  );
}

function KpiCard({
  title,
  value,
  trend,
  trendLabel,
  trendPositive,
  icon,
  iconBg,
  highlight,
  highlightColor,
  blobColor,
}: any) {
  return (
    <Card
      className={`relative flex flex-col justify-between overflow-hidden rounded-[16px] md:rounded-[18px] border p-4 md:p-4.5 transition-all hover:shadow-md hover:-translate-y-0.5 z-0 ${
        highlight
          ? "border-amber-500/30 dark:border-amber-500/20 shadow-sm ring-1 ring-amber-500/10"
          : "border-border/60 shadow-sm"
      }`}
    >
      {blobColor && (
        <div className={`hidden md:block absolute top-0 right-0 w-[90px] h-[90px] ${blobColor} rounded-full blur-[26px] -z-10`} />
      )}

      <div className="flex items-center gap-2.5 mb-2.5">
        <div className={`w-[36px] h-[36px] rounded-[11px] flex items-center justify-center shrink-0 ${iconBg}`}>
          {icon}
        </div>
        <span className={`text-[11px] md:text-[12px] font-bold uppercase tracking-wider truncate ${highlight ? highlightColor || "text-amber-600 dark:text-amber-400" : "text-muted"}`}>
          {title}
        </span>
      </div>

      <div className="flex flex-col justify-end">
        <div className="font-mono font-black text-2xl md:text-[26px] text-text leading-tight mb-1">
          {value}
        </div>
        <div className="flex items-center gap-1.5 text-[11px] md:text-[12px] truncate">
          {trend && (
            <span
              className={`font-bold ${
                trendPositive
                  ? "text-emerald-600 dark:text-emerald-400"
                  : highlight
                  ? highlightColor || "text-amber-600 dark:text-amber-400"
                  : "text-muted"
              }`}
            >
              {trend}
            </span>
          )}
          {trendLabel && <span className="text-muted font-medium truncate">{trendLabel}</span>}
        </div>
      </div>
    </Card>
  );
}
