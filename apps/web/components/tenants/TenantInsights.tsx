"use client";

import React from "react";
import { Sparkles, FileWarning, Clock, FileSignature, UserPlus, Users } from "lucide-react";
import { Card } from "../ui/Card";
import { useCustomersQuery } from "@/lib/queries/customers.queries";
import { useContractsQuery } from "@/lib/queries/contracts.queries";

export default function TenantInsights() {
  const { data: customersData } = useCustomersQuery({ limit: 100 });
  const { data: contractsData } = useContractsQuery({ limit: 100 });

  const customers: any[] = (customersData as any)?.data || [];
  const contracts: any[] = (contractsData as any)?.data || [];

  const newCustomers = customers.filter((customer: any) => {
    if (!customer.createdAt) return false;
    const createdAt = new Date(customer.createdAt).getTime();
    return (Date.now() - createdAt) / (1000 * 60 * 60 * 24) <= 30;
  }).length;

  const activeContractRows = contracts.filter((contract: any) => contract.status === "ACTIVE");
  const activeContracts = activeContractRows.length;
  const expiringContracts = contracts.filter((contract: any) => {
    if (contract.status === "EXPIRING") return true;
    if (!contract.endDate) return false;
    const daysLeft = (new Date(contract.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return daysLeft >= 0 && daysLeft <= 30;
  }).length;

  const activeCustomerIds = new Set(activeContractRows.map((contract: any) => contract.customerId || contract.customer?.id).filter(Boolean));
  const customersWithoutContract = customers.filter((customer: any) => !activeCustomerIds.has(customer.id)).length;

  return (
    <Card className="hide-scrollbar flex shrink-0 items-center gap-4 overflow-x-auto rounded-[16px] border-border/40 p-4 shadow-[0_1px_2px_rgba(16,24,40,0.03)]">
      <div className="flex shrink-0 items-center gap-[10px] border-r border-border/60 pr-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-[#ede9fe]">
          <Sparkles size={18} className="text-[#6d3df8]" />
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted">AI HomeLand</span>
          <span className="text-[14px] font-black leading-tight text-text">Tenant Insights</span>
        </div>
      </div>
      <div className="flex min-w-0 items-center gap-5">
        <InsightLink icon={<Users size={14} />} text={`${customers.length} khách thuê`} color="text-[#f97316]" />
        <InsightLink icon={<UserPlus size={14} />} text={`${newCustomers} khách mới 30 ngày`} color="text-indigo-500" />
        <InsightLink icon={<FileSignature size={14} />} text={`${activeContracts} hợp đồng đang hiệu lực`} color="text-[#6366f1]" />
        <InsightLink icon={<Clock size={14} />} text={`${expiringContracts} hợp đồng sắp hết hạn`} color="text-[#ef4444]" />
        <InsightLink icon={<FileWarning size={14} />} text={`${customersWithoutContract} khách chưa có hợp đồng`} color="text-[#a855f7]" />
      </div>
    </Card>
  );
}

function InsightLink({ icon, text, color }: any) {
  return (
    <div className="flex items-center gap-[8px] py-[4px] w-full rounded-[6px] px-[4px]">
      <div className={`flex items-center justify-center shrink-0 ${color}`}>
        {icon}
      </div>
      <span className="font-medium text-[13px] text-text truncate flex-1">{text}</span>
    </div>
  );
}
