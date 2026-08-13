"use client";

import React, { useMemo } from "react";
import { Users, CalendarClock, AlertTriangle, UserPlus, Clock, ShieldAlert } from "lucide-react";
import { Card } from "../ui/Card";
import { useCustomersQuery } from "@/lib/queries/customers.queries";
import { useContractsQuery } from "@/lib/queries/contracts.queries";

function formatMoney(value: number) {
  if (!value) return "0";
  return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(value)}đ`;
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

    const expiringContracts = contracts.filter((contract: any) => {
      if (contract.status === "EXPIRING") return true;
      if (!contract.endDate) return false;
      const daysLeft = (new Date(contract.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      return daysLeft >= 0 && daysLeft <= 30;
    }).length;

    const overdueDebt = contracts.reduce((sum: number, contract: any) => sum + (Number(contract.debt) || 0), 0);
    const overdueContracts = contracts.filter((contract: any) => Number(contract.debt) > 0 && contract.status !== "TERMINATED").length;
    const highRisk = contracts.filter((contract: any) => Number(contract.debt) > 5000000 || contract.status === "OVERDUE").length;

    return {
      totalCustomers: customers.length,
      newCustomers,
      expiringContracts,
      overdueDebt,
      overdueContracts,
      highRisk,
    };
  }, [customersData, contractsData]);

  return (
    <div data-testid="tenants-kpi-grid" className="grid shrink-0 grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
      <KpiCard
        icon={<Users size={16} className="text-[#4f46e5]" />}
        iconBg="bg-[#4f46e5]/10"
        value={summary.totalCustomers.toString()}
        label="Tổng khách"
        blobColor="bg-[#4f46e5]/10"
      />
      <KpiCard
        icon={<UserPlus size={16} className="text-[#8b5cf6]" />}
        iconBg="bg-[#8b5cf6]/10"
        value={summary.newCustomers.toString()}
        label="Khách mới"
        blobColor="bg-[#8b5cf6]/10"
      />
      <KpiCard
        icon={<CalendarClock size={16} className="text-[#f97316]" />}
        iconBg="bg-[#f97316]/10"
        value={summary.expiringContracts.toString()}
        label="Sắp hết HĐ"
        blobColor="bg-[#f97316]/10"
      />
      <KpiCard
        icon={<AlertTriangle size={16} className="text-[#ef4444]" />}
        iconBg="bg-[#ef4444]/10"
        value={formatMoney(summary.overdueDebt)}
        label="Công nợ"
        blobColor="bg-[#ef4444]/10"
      />
      <KpiCard
        icon={<Clock size={16} className="text-rose-500" />}
        iconBg="bg-rose-500/10"
        value={summary.overdueContracts.toString()}
        label="Quá hạn"
        blobColor="bg-rose-500/10"
      />
      <KpiCard
        icon={<ShieldAlert size={16} className="text-red-600" />}
        iconBg="bg-red-600/10"
        value={summary.highRisk.toString()}
        label="Rủi ro cao"
        blobColor="bg-red-600/10"
      />
    </div>
  );
}

function KpiCard({ icon, iconBg, value, label, subValue, subColor, blobColor }: any) {
  return (
    <Card className="relative z-0 flex h-[76px] cursor-pointer items-center gap-3 overflow-hidden rounded-[14px] border-border/40 p-4 shadow-[0_1px_2px_rgba(16,24,40,0.03)] transition-transform duration-200 hover:-translate-y-0.5">
      <div className={`w-[36px] h-[36px] rounded-[10px] flex items-center justify-center shrink-0 ${iconBg}`}>{icon}</div>
      <div className="flex flex-col min-w-0">
        <span className="font-black text-[18px] text-text leading-none">{value}</span>
        <span className="text-[12px] font-bold text-muted mt-1 truncate">{label}</span>
        {subValue && <span className={`text-[11px] font-bold mt-0.5 ${subColor || "text-text"}`}>{subValue}</span>}
      </div>
    </Card>
  );
}
