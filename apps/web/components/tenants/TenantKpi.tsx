"use client";

import React, { useMemo } from "react";
import { Users, FileSignature, CalendarClock, AlertCircle } from "lucide-react";
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
    <div data-testid="tenants-kpi-grid" className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 shrink-0">
      <KpiCard
        icon={<Users size={18} className="text-indigo-600 dark:text-indigo-400" />}
        iconBg="bg-indigo-500/10 border border-indigo-500/20"
        value={summary.totalCustomers.toString()}
        label="Tổng khách thuê"
        subText={summary.newCustomers > 0 ? `+${summary.newCustomers} khách mới (30 ngày)` : "Khách hàng hệ thống"}
        subColor="text-indigo-600 dark:text-indigo-400"
      />
      <KpiCard
        icon={<FileSignature size={18} className="text-emerald-600 dark:text-emerald-400" />}
        iconBg="bg-emerald-500/10 border border-emerald-500/20"
        value={summary.activeContractCount.toString()}
        label="Đang thuê (HĐ hiệu lực)"
        subText={`${summary.withoutContractCount} khách chưa thuê`}
        subColor="text-muted"
      />
      <KpiCard
        icon={<CalendarClock size={18} className="text-amber-600 dark:text-amber-400" />}
        iconBg="bg-amber-500/10 border border-amber-500/20"
        value={summary.expiringContracts.toString()}
        label="Sắp hết hạn HĐ"
        subText={summary.expiringContracts > 0 ? "Cần xử lý trong 30 ngày" : "Không có hợp đồng sắp hết"}
        subColor={summary.expiringContracts > 0 ? "text-amber-600 dark:text-amber-400" : "text-muted"}
      />
      <KpiCard
        icon={<AlertCircle size={18} className={summary.overdueDebt > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"} />}
        iconBg={summary.overdueDebt > 0 ? "bg-rose-500/10 border border-rose-500/20" : "bg-emerald-500/10 border border-emerald-500/20"}
        value={formatMoney(summary.overdueDebt)}
        label="Tổng công nợ"
        subText={summary.overdueCount > 0 ? `${summary.overdueCount} hợp đồng có nợ` : "Tất cả đã thanh toán đủ"}
        subColor={summary.overdueDebt > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}
      />
    </div>
  );
}

function KpiCard({ icon, iconBg, value, label, subText, subColor }: any) {
  return (
    <Card className="relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border/60 bg-card p-3.5 shadow-sm transition-all hover:border-primary/30 hover:shadow-md">
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-[11px] font-bold text-muted uppercase tracking-wider truncate">{label}</span>
        <div className={`flex h-8 w-8 items-center justify-center rounded-xl shrink-0 ${iconBg}`}>{icon}</div>
      </div>
      <div>
        <div className="font-mono font-black text-xl md:text-2xl text-text leading-tight">{value}</div>
        {subText && <div className={`text-[11px] font-semibold truncate mt-1 ${subColor || "text-muted"}`}>{subText}</div>}
      </div>
    </Card>
  );
}
