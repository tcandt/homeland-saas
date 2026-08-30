"use client";

import Link from "next/link";
import React, { useMemo } from "react";
import { AlertTriangle, Bell, CheckCircle2, Clock3, FileText, PenTool } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { useContractsQuery } from "@/lib/queries/contracts.queries";
import { Card } from "../ui/Card";

function getContracts(response: any): any[] {
  const data = response?.data;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

function isExpiring(contract: any, days = 30) {
  if (contract.status === "EXPIRING") return true;
  if (!contract.endDate || contract.status !== "ACTIVE") return false;
  const daysLeft = Math.ceil((new Date(contract.endDate).getTime() - Date.now()) / 86400000);
  return daysLeft >= 0 && daysLeft <= days;
}

function isPendingSign(contract: any) {
  return ["DRAFT", "PENDING_APPROVAL", "APPROVED"].includes(contract.status);
}

function ChartTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div className="rounded-[10px] border border-border bg-card px-3 py-2 text-[12px] shadow-[0_14px_35px_rgba(15,23,42,0.16)]">
      <div className="font-black text-text">{item?.name || item?.payload?.label}</div>
      <div className="mt-1 font-bold text-muted">{item?.value || 0} hợp đồng</div>
    </div>
  );
}

export default function OperationsContractSidebar() {
  const { data } = useContractsQuery({ limit: 100 });
  const contracts = useMemo(() => getContracts(data), [data]);

  const summary = useMemo(() => {
    const active = contracts.filter((contract) => contract.status === "ACTIVE").length;
    const expiring = contracts.filter((contract) => isExpiring(contract)).length;
    const debt = contracts.filter((contract) => Number(contract.debt || 0) > 0).length;
    const pending = contracts.filter((contract) => isPendingSign(contract)).length;
    const ended = contracts.filter((contract) => ["TERMINATED", "EXPIRED"].includes(contract.status)).length;
    const cancelled = contracts.filter((contract) => contract.status === "CANCELLED").length;
    return { total: contracts.length, active, expiring, debt, pending, ended, cancelled };
  }, [contracts]);

  const chartData = [
    { label: "Đang hiệu lực", value: Math.max(0, summary.active - summary.expiring), color: "#2fbf71" },
    { label: "Sắp hết hạn", value: summary.expiring, color: "#fb923c" },
    { label: "Chờ duyệt", value: summary.pending, color: "#8b5cf6" },
    { label: "Đã chấm dứt", value: summary.ended, color: "#94a3b8" },
    { label: "Đã hủy", value: summary.cancelled, color: "#64748b" },
  ].filter((item) => item.value > 0);
  const visibleChartData = chartData.length ? chartData : [{ label: "Chưa có dữ liệu", value: 1, color: "#e2e8f0" }];

  return (
    <aside className="hidden min-w-0 flex-col gap-3.5 2xl:flex 2xl:h-full 2xl:min-h-0">
      <Card className="flex min-h-[330px] shrink-0 flex-col rounded-[14px] border-border/40 p-4 shadow-[0_1px_2px_rgba(16,24,40,0.03)]">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[15px] font-black text-text">Tổng quan hợp đồng</h2>
          <span className="rounded-xl border border-border bg-surface/60 px-3 py-2 text-[12px] font-black text-muted">Hiện tại</span>
        </div>
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4">
          <div className="relative h-[172px] w-[172px]">
            <ResponsiveContainer width={172} height={172} minWidth={172} minHeight={172}>
              <PieChart width={172} height={172}>
                <Pie data={visibleChartData} dataKey="value" nameKey="label" innerRadius={55} outerRadius={79} paddingAngle={3} stroke="var(--card)" strokeWidth={5}>
                  {visibleChartData.map((item) => (
                    <Cell key={item.label} fill={item.color} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <div className="text-[28px] font-black leading-none text-text">{summary.total}</div>
              <div className="mt-1 text-[11px] font-bold text-muted">Tổng hợp đồng</div>
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
        <div className="grid gap-1">
          <SidebarMetric icon={<Clock3 size={14} />} label="Sắp hết hạn trong 30 ngày" value={summary.expiring} tone="text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20" />
          <SidebarMetric icon={<PenTool size={14} />} label="Hợp đồng chờ ký duyệt" value={summary.pending} tone="text-primary bg-primary/10 border border-primary/20" />
          <SidebarMetric icon={<AlertTriangle size={14} />} label="Hợp đồng có công nợ" value={summary.debt} tone="text-rose-600 dark:text-rose-400 bg-rose-500/10 border border-rose-500/20" />
        </div>
      </Card>

      <Card className="flex shrink-0 flex-col rounded-[14px] border-border/40 p-4 shadow-[0_1px_2px_rgba(16,24,40,0.03)]">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[15px] font-black text-text">Nhắc gia hạn tự động</h2>
          <Link href="/settings?section=notifications" className="text-[12px] font-black text-primary hover:underline">Cấu hình →</Link>
        </div>
        <div className="grid gap-2">
          <ReminderRow icon={<Bell size={14} />} label="Nhắc trước hạn 15 ngày" />
          <ReminderRow icon={<FileText size={14} />} label="Nhắc đến hạn" />
          <ReminderRow icon={<AlertTriangle size={14} />} label="Nhắc quá hạn 3 ngày" />
        </div>
      </Card>

      <Card className="mt-auto flex min-h-[170px] shrink-0 flex-col overflow-hidden rounded-[14px] border-border/40 p-4 shadow-[0_1px_2px_rgba(16,24,40,0.03)]">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[15px] font-black text-text">Báo cáo nhanh</h2>
          <Link href="/reports" className="text-[12px] font-black text-primary hover:underline">Xem báo cáo →</Link>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <QuickReport label="Tỷ lệ hiệu lực" value={summary.total ? `${Math.round((summary.active / summary.total) * 100)}%` : "0%"} />
          <QuickReport label="Chờ ký" value={summary.pending} />
          <QuickReport label="Có nợ" value={summary.debt} />
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

function ReminderRow({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[12px] bg-surface/60 px-3 py-2.5">
      <div className="flex min-w-0 items-center gap-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] bg-primary/10 text-primary border border-primary/20">{icon}</span>
        <span className="truncate text-[12px] font-black text-text">{label}</span>
      </div>
      <CheckCircle2 size={16} className="shrink-0 text-emerald-500" />
    </div>
  );
}

function QuickReport({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-[12px] border border-border bg-card p-3">
      <div className="text-[11px] font-bold text-muted">{label}</div>
      <div className="mt-2 text-[18px] font-black text-text">{value}</div>
    </div>
  );
}
