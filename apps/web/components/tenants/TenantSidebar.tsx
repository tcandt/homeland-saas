"use client";

import React, { useMemo } from "react";
import { AlertTriangle, Bell, CalendarClock, FileText, UserPlus, Users } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { useContractsQuery } from "@/lib/queries/contracts.queries";
import { useCustomersQuery } from "@/lib/queries/customers.queries";
import { Card } from "../ui/Card";

function getList(response: any): any[] {
  const data = response?.data;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

function isExpiring(contract: any) {
  if (contract.status === "EXPIRING") return true;
  if (!contract.endDate) return false;
  const daysLeft = Math.ceil((new Date(contract.endDate).getTime() - Date.now()) / 86400000);
  return daysLeft >= 0 && daysLeft <= 30;
}

function ChartTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div className="rounded-[10px] border border-border bg-card px-3 py-2 text-[12px] shadow-[0_14px_35px_rgba(15,23,42,0.16)]">
      <div className="font-black text-text">{item?.name || item?.payload?.label}</div>
      <div className="mt-1 font-bold text-muted">{item?.value || 0} khách</div>
    </div>
  );
}

export default function TenantSidebar() {
  const { data: customersData } = useCustomersQuery({ limit: 100 });
  const { data: contractsData } = useContractsQuery({ limit: 100 });
  const customers = useMemo(() => getList(customersData), [customersData]);
  const contracts = useMemo(() => getList(contractsData), [contractsData]);

  const summary = useMemo(() => {
    const activeContracts = contracts.filter((contract) => contract.status === "ACTIVE");
    const activeCustomerIds = new Set(activeContracts.map((contract) => contract.customerId || contract.customer?.id).filter(Boolean));
    const active = activeCustomerIds.size || activeContracts.length;
    const expiring = contracts.filter(isExpiring).length;
    const debt = contracts.filter((contract) => Number(contract.debt || 0) > 0).length;
    const highRisk = contracts.filter((contract) => Number(contract.debt || 0) > 5000000 || contract.status === "OVERDUE").length;
    const newCustomers = customers.filter((customer) => {
      if (!customer.createdAt) return false;
      return (Date.now() - new Date(customer.createdAt).getTime()) / 86400000 <= 30;
    });
    const inactive = Math.max(0, customers.length - active);
    return { total: customers.length, active, inactive, expiring, debt, highRisk, newCustomers };
  }, [customers, contracts]);

  const chartData = [
    { label: "Đang thuê", value: summary.active, color: "#2fbf71" },
    { label: "Chưa có HĐ hiệu lực", value: summary.inactive, color: "#94a3b8" },
  ].filter((item) => item.value > 0);
  const visibleChartData = chartData.length ? chartData : [{ label: "Chưa có dữ liệu", value: 1, color: "#e2e8f0" }];

  return (
    <aside className="hidden min-w-0 flex-col gap-3.5 2xl:flex 2xl:h-full 2xl:min-h-0">
      <Card className="flex min-h-[250px] shrink-0 flex-col rounded-[14px] border-border/40 p-4 shadow-[0_1px_2px_rgba(16,24,40,0.03)]">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[15px] font-black text-text">Tình hình khách thuê</h2>
          <span className="rounded-xl border border-border bg-surface/60 px-3 py-2 text-[12px] font-black text-muted">Hiện tại</span>
        </div>
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3">
          <div className="relative h-[142px] w-[142px]">
            <ResponsiveContainer width={142} height={142} minWidth={142} minHeight={142}>
              <PieChart>
                <Pie data={visibleChartData} dataKey="value" nameKey="label" innerRadius={44} outerRadius={64} paddingAngle={3} stroke="var(--card)" strokeWidth={5}>
                  {visibleChartData.map((item) => <Cell key={item.label} fill={item.color} />)}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <div className="text-[24px] font-black leading-none text-text">{summary.total}</div>
              <div className="mt-1 text-[11px] font-bold text-muted">Tổng khách</div>
            </div>
          </div>
          <div className="grid w-full grid-cols-1 gap-2">
            {visibleChartData.map((item) => (
              <div key={item.label} className="flex items-center justify-between gap-3 rounded-[10px] bg-surface/55 px-3 py-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="truncate text-[11px] font-black text-muted">{item.label}</span>
                </div>
                <span className="shrink-0 text-[11px] font-black text-text">{chartData.length ? item.value : 0}</span>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <Card className="flex shrink-0 flex-col rounded-[14px] border-border/40 p-4 shadow-[0_1px_2px_rgba(16,24,40,0.03)]">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[15px] font-black text-text">Cần xử lý</h2>
        </div>
        <div className="grid gap-1.5">
          <SidebarMetric icon={<CalendarClock size={14} />} label="Sắp hết hạn hợp đồng" value={summary.expiring} tone="text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20" />
          <SidebarMetric icon={<AlertTriangle size={14} />} label="Công nợ quá hạn" value={summary.debt} tone="text-rose-600 dark:text-rose-400 bg-rose-500/10 border border-rose-500/20" />
          <SidebarMetric icon={<Users size={14} />} label="Khách mới (30 ngày)" value={summary.newCustomers.length} tone="text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20" />
          <SidebarMetric icon={<FileText size={14} />} label="Chưa ký hợp đồng" value={summary.inactive} tone="text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 border border-indigo-500/20" />
        </div>
      </Card>

      <Card className="flex shrink-0 flex-col rounded-[14px] border-border/40 p-4 shadow-[0_1px_2px_rgba(16,24,40,0.03)]">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[15px] font-black text-text">Khách thuê mới</h2>
        </div>
        <div className="grid gap-3">
          {summary.newCustomers.slice(0, 3).map((customer: any) => (
            <div key={customer.id} className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <img src={customer.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(customer.fullName || customer.name || "K")}`} alt="" className="h-8 w-8 rounded-full border border-border object-cover" />
                <div className="min-w-0">
                  <div className="truncate text-[12px] font-black text-text">{customer.fullName || customer.name || "Khách thuê"}</div>
                  <div className="truncate text-[11px] font-semibold text-muted">{customer.phone || "--"}</div>
                </div>
              </div>
              <UserPlus size={15} className="shrink-0 text-primary" />
            </div>
          ))}
          {summary.newCustomers.length === 0 && <div className="text-[12px] font-bold text-muted">Chưa có khách thuê mới.</div>}
        </div>
      </Card>

    </aside>
  );
}

function SidebarMetric({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-border py-2.5 first:border-t-0 first:pt-0">
      <div className="flex min-w-0 items-center gap-2">
        <span className="text-muted">{icon}</span>
        <span className="truncate text-[12px] font-bold text-muted">{label}</span>
      </div>
      <span className={`shrink-0 rounded-[8px] px-2.5 py-1 text-[12px] font-black ${tone}`}>{value}</span>
    </div>
  );
}
