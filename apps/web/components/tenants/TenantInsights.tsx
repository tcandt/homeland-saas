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

  const activeContracts = contracts.filter((contract: any) => contract.status === "ACTIVE").length;
  const expiringContracts = contracts.filter((contract: any) => {
    if (contract.status === "EXPIRING") return true;
    if (!contract.endDate) return false;
    const daysLeft = (new Date(contract.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return daysLeft >= 0 && daysLeft <= 30;
  }).length;

  const customersWithoutContract = Math.max(0, customers.length - activeContracts);

  return (
    <Card className="p-4 md:p-5 relative overflow-hidden flex flex-col md:flex-row md:items-center gap-4 md:gap-6">
      <div className="absolute top-0 right-0 w-[150px] md:w-[300px] h-full bg-gradient-to-l from-[#6366f1]/5 to-transparent pointer-events-none" />

      <div className="flex items-center gap-[10px] md:w-[220px] shrink-0">
        <div className="w-[36px] h-[36px] md:w-[44px] md:h-[44px] rounded-[10px] md:rounded-[12px] bg-[#6366f1]/10 flex items-center justify-center shrink-0">
          <Sparkles size={20} className="text-[#6366f1]" />
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] md:text-[11px] font-bold text-muted uppercase tracking-wider">AI HomeLand</span>
          <span className="font-black text-[15px] md:text-[16px] text-text leading-tight">Tenant Insights</span>
        </div>
      </div>

      <div className="hidden md:block w-[1px] h-[40px] bg-border/50 shrink-0" />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-x-[20px] gap-y-[10px] md:gap-y-[12px] w-full">
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
