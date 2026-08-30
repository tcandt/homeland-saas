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
    <div data-testid="tenants-kpi-grid" className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-2.5 shrink-0">
      <KpiCard
        title="Tổng khách thuê"
        value={summary.totalCustomers.toString()}
        trend={summary.newCustomers > 0 ? `+${summary.newCustomers} mới` : undefined}
        trendPositive={true}
        icon={<Users size={16} className="text-indigo-600 dark:text-indigo-400" />}
        iconBg="bg-indigo-500/10 border border-indigo-500/20"
      />
      <KpiCard
        title="Đang thuê phòng"
        value={summary.activeContractCount.toString()}
        trend={summary.withoutContractCount > 0 ? `${summary.withoutContractCount} chưa HĐ` : "Đầy đủ HĐ"}
        icon={<CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400" />}
        iconBg="bg-emerald-500/10 border border-emerald-500/20"
      />
      <KpiCard
        title="Sắp hết hạn HĐ"
        value={summary.expiringContracts.toString()}
        trend={summary.expiringContracts > 0 ? "Cần xử lý" : "Ổn định"}
        highlight={summary.expiringContracts > 0}
        highlightColor="text-amber-600 dark:text-amber-400"
        icon={<CalendarClock size={16} className="text-amber-600 dark:text-amber-400" />}
        iconBg="bg-amber-500/10 border border-amber-500/20"
      />
      <KpiCard
        title="Tổng công nợ"
        value={formatMoney(summary.overdueDebt)}
        trend={summary.overdueCount > 0 ? `${summary.overdueCount} HĐ nợ` : "Đã thu đủ"}
        highlight={summary.overdueDebt > 0}
        highlightColor="text-rose-600 dark:text-rose-400"
        icon={<AlertTriangle size={16} className={summary.overdueDebt > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"} />}
        iconBg={summary.overdueDebt > 0 ? "bg-rose-500/10 border border-rose-500/20" : "bg-emerald-500/10 border border-emerald-500/20"}
      />
    </div>
  );
}

function KpiCard({
  title,
  value,
  trend,
  trendPositive,
  icon,
  iconBg,
  highlight,
  highlightColor,
}: any) {
  return (
    <Card
      className={`flex items-center gap-3 rounded-xl border px-3 py-2 md:px-3.5 md:py-2.5 shadow-sm transition-all hover:border-primary/30 ${
        highlight
          ? "border-amber-500/30 dark:border-amber-500/20 bg-amber-500/[0.02]"
          : "border-border/60 bg-card"
      }`}
    >
      <div className={`w-8 h-8 md:w-9 md:h-9 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
        {icon}
      </div>

      <div className="min-w-0 flex-1">
        <div className="text-[10px] md:text-[11px] font-bold text-muted uppercase tracking-wider truncate leading-tight mb-0.5">
          {title}
        </div>
        <div className="flex items-baseline gap-2">
          <span className="font-mono font-black text-lg md:text-xl text-text leading-none">
            {value}
          </span>
          {trend && (
            <span
              className={`text-[10px] md:text-[11px] font-semibold truncate ${
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
        </div>
      </div>
    </Card>
  );
}
