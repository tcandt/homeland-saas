"use client";

import React, { useMemo } from "react";
import {
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Building2,
  ClipboardList,
  FileBarChart,
  FileText,
  Home,
  Percent,
  Receipt,
  RefreshCw,
  Users,
  WalletCards,
} from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import { getInvoiceFinancials } from "@/lib/invoices/invoice-financials";
import { useContractsQuery } from "@/lib/queries/contracts.queries";
import { useInvoicesQuery } from "@/lib/queries/invoices.queries";
import { useRoomsQuery } from "@/lib/queries/rooms.queries";

function getList(response: any): any[] {
  if (Array.isArray(response)) return response;
  const data = response?.data;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

function formatVnd(value: number) {
  return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(value || 0)} đ`;
}

function buildingLabel(item: any) {
  return item?.room?.building?.code || item?.room?.building?.name || item?.building?.code || item?.building?.name || "Chưa rõ";
}

const reportableInvoiceStatuses = new Set(["ISSUED", "PARTIALLY_PAID", "OVERDUE", "PAID"]);

export default function ReportsPage() {
  const invoicesQuery = useInvoicesQuery({ limit: 100 });
  const contractsQuery = useContractsQuery({ limit: 100 });
  const roomsQuery = useRoomsQuery({ limit: 100 });

  const invoices = getList(invoicesQuery.data).filter((invoice) => reportableInvoiceStatuses.has(invoice.status));
  const contracts = getList(contractsQuery.data);
  const rooms = getList(roomsQuery.data);
  const isLoading = invoicesQuery.isLoading || contractsQuery.isLoading || roomsQuery.isLoading;
  const isError = invoicesQuery.isError || contractsQuery.isError || roomsQuery.isError;

  const summary = useMemo(() => {
    const totals = invoices.reduce(
      (result, invoice) => {
        const financials = getInvoiceFinancials(invoice);
        result.totalRevenue += financials.total;
        result.collected += financials.paid;
        result.settled += financials.settled;
        result.debt += financials.remaining;
        return result;
      },
      { totalRevenue: 0, collected: 0, settled: 0, debt: 0 },
    );
    const activeContracts = contracts.filter((contract) => contract.status === "ACTIVE").length;
    const occupiedRooms = rooms.filter((room) => ["occupied", "rented", "active", "expiring_soon"].includes(String(room.status || "").toLowerCase())).length;
    const occupancyRate = rooms.length ? (occupiedRooms / rooms.length) * 100 : 0;
    const recoveryRate = totals.totalRevenue ? (totals.settled / totals.totalRevenue) * 100 : 0;

    return { ...totals, activeContracts, occupancyRate, recoveryRate };
  }, [contracts, invoices, rooms]);

  const revenueTrend = useMemo(() => {
    const current = new Date();
    const months = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(current.getFullYear(), current.getMonth() - (5 - index), 1);
      return {
        key: `${date.getFullYear()}-${date.getMonth()}`,
        label: `T${date.getMonth() + 1}/${date.getFullYear()}`,
        revenue: 0,
        collected: 0,
      };
    });
    const byMonth = new Map(months.map((month) => [month.key, month]));

    invoices.forEach((invoice) => {
      const date = new Date(invoice.createdAt);
      if (Number.isNaN(date.getTime())) return;
      const month = byMonth.get(`${date.getFullYear()}-${date.getMonth()}`);
      if (!month) return;
      const financials = getInvoiceFinancials(invoice);
      month.revenue += financials.total;
      month.collected += financials.paid;
    });

    return months;
  }, [invoices]);

  const revenueStructure = useMemo(() => {
    if (summary.totalRevenue <= 0) {
      return [{ label: "Chưa có dữ liệu", value: 1, displayValue: 0, color: "#e2e8f0", placeholder: true }];
    }
    return [{ label: "Chưa phân loại", value: summary.totalRevenue, displayValue: summary.totalRevenue, color: "#94a3b8", placeholder: false }];
  }, [summary.totalRevenue]);

  const buildingRows = useMemo(() => {
    const grouped = new Map<string, { revenue: number; collected: number; debt: number }>();
    invoices.forEach((invoice) => {
      const key = buildingLabel(invoice);
      const current = grouped.get(key) || { revenue: 0, collected: 0, debt: 0 };
      const financials = getInvoiceFinancials(invoice);
      current.revenue += financials.total;
      current.collected += financials.paid;
      current.debt += financials.remaining;
      grouped.set(key, current);
    });
    const rows = Array.from(grouped.entries()).map(([name, value]) => ({ name, ...value }));
    return rows.slice(0, 4);
  }, [invoices]);

  const debtRows = useMemo(() => {
    const rows = invoices
      .map((invoice) => ({
        name: invoice.customer?.fullName || invoice.customer?.name || invoice.tenant?.name || invoice.tenantName || "Khách thuê",
        room: invoice.room?.code || invoice.contract?.room?.number || invoice.contract?.room?.code || "--",
        debt: getInvoiceFinancials(invoice).remaining,
        daysOverdue: invoice.dueDate
          ? Math.max(0, Math.floor((Date.now() - new Date(invoice.dueDate).getTime()) / 86400000))
          : 0,
      }))
      .filter((row) => row.debt > 0)
      .sort((a, b) => b.debt - a.debt)
      .slice(0, 5);
    return rows;
  }, [invoices]);

  return (
    <AppShell>
      <div data-testid="reports-root" className="-m-4 h-[calc(100dvh-87px)] w-[calc(100%+32px)] overflow-auto bg-background md:h-[calc(100dvh-80px)]">
        <div className="flex min-h-full w-full flex-col gap-3 p-3">
          {isError && (
            <div className="rounded-[12px] border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] font-bold text-rose-700">
              Không tải được đầy đủ dữ liệu báo cáo. Vui lòng thử lại.
            </div>
          )}
          <div className="grid shrink-0 grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
            <KpiCard icon={<Receipt size={18} />} label="Tổng doanh thu" value={isLoading ? "--" : formatVnd(summary.totalRevenue)} change="Theo hóa đơn đã phát hành" tone="bg-[#ede9fe] text-[#6d3df8]" />
            <KpiCard icon={<WalletCards size={18} />} label="Đã thu" value={isLoading ? "--" : formatVnd(summary.collected)} change="Tiền thực nhận" tone="bg-emerald-50 text-emerald-600" />
            <KpiCard icon={<Home size={18} />} label="Công nợ" value={isLoading ? "--" : formatVnd(summary.debt)} change="Sau thanh toán và cấn trừ" tone="bg-orange-50 text-orange-500" />
            <KpiCard icon={<RefreshCw size={18} />} label="Tỷ lệ thu hồi" value={isLoading ? "--" : `${summary.recoveryRate.toFixed(1)}%`} change="Tiền thu và credit / tổng" tone="bg-sky-50 text-sky-500" />
            <KpiCard icon={<FileText size={18} />} label="Hợp đồng hiệu lực" value={isLoading ? "--" : `${summary.activeContracts}`} change="Theo dữ liệu hợp đồng" tone="bg-[#ede9fe] text-[#6d3df8]" />
            <KpiCard icon={<Percent size={18} />} label="Phòng lấp đầy" value={isLoading ? "--" : `${summary.occupancyRate.toFixed(1)}%`} change={`${rooms.length} phòng đang theo dõi`} tone="bg-pink-50 text-pink-500" />
          </div>

          <div className="flex shrink-0 items-center justify-between rounded-[16px] border border-border bg-card px-4 py-3 shadow-[0_1px_2px_rgba(16,24,40,0.03)]">
            <div>
              <h1 className="text-[16px] font-black text-text">Tổng quan báo cáo</h1>
              <p className="mt-1 text-[12px] font-semibold text-muted">Toàn bộ dữ liệu hiện có từ hóa đơn, hợp đồng và phòng.</p>
            </div>
          </div>

          <div className="grid min-h-[680px] flex-1 grid-cols-1 gap-3 xl:min-h-0 xl:grid-cols-[minmax(0,1fr)_330px]">
            <div className="grid min-w-0 grid-cols-1 gap-3 xl:grid-cols-2">
              <section className="rounded-[16px] border border-border/70 dark:border-white/[0.06] bg-card p-5 shadow-[0_1px_2px_rgba(16,24,40,0.03)]">
                <SectionHeader title="Doanh thu theo thời gian" action="Theo tháng" />
                <div className="mt-4 h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={revenueTrend}>
                      <CartesianGrid stroke="#eef2f7" vertical={false} />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#64748b", fontWeight: 700 }} />
                      <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#64748b" }} tickFormatter={(value) => `${Math.round(Number(value) / 1000000)}M`} />
                      <Tooltip content={<MoneyTooltip />} />
                      <Line type="monotone" dataKey="revenue" stroke="#5b35f5" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: "#fff" }} />
                      <Line type="monotone" dataKey="collected" stroke="#22c55e" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: "#fff" }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </section>

              <section className="rounded-[16px] border border-border/70 dark:border-white/[0.06] bg-card p-5 shadow-[0_1px_2px_rgba(16,24,40,0.03)]">
                <SectionHeader title="Cơ cấu doanh thu" action="Theo nguồn thu" />
                <div className="mt-4 grid min-h-[260px] grid-cols-1 items-center gap-4 lg:grid-cols-[220px_1fr]">
                  <div className="relative mx-auto h-[220px] w-[220px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={revenueStructure} dataKey="value" nameKey="label" innerRadius={70} outerRadius={98} paddingAngle={2} stroke="var(--card)" strokeWidth={5}>
                          {revenueStructure.map((item) => <Cell key={item.label} fill={item.color} />)}
                        </Pie>
                        <Tooltip content={<MoneyTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                      <div className="text-[18px] font-black text-text">{formatVnd(summary.totalRevenue)}</div>
                      <div className="mt-1 text-[11px] font-bold text-muted">Tổng doanh thu</div>
                    </div>
                  </div>
                  <div className="grid gap-3">
                    {revenueStructure.map((item) => (
                      <div key={item.label} className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                          <span className="truncate text-[12px] font-black text-text">{item.label}</span>
                        </div>
                        <div className="text-right">
                          <div className="text-[12px] font-black text-text">{item.placeholder ? "0.0" : ((item.displayValue / Math.max(summary.totalRevenue, 1)) * 100).toFixed(1)}%</div>
                          <div className="text-[11px] font-bold text-muted">{formatVnd(item.displayValue)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              <section className="rounded-[16px] border border-border/70 dark:border-white/[0.06] bg-card p-5 shadow-[0_1px_2px_rgba(16,24,40,0.03)]">
                <SectionHeader title="Doanh thu theo tòa nhà" action="Xem chi tiết" />
                <div className="mt-4 overflow-hidden rounded-[12px] border border-border">
                  <ReportTableHeader cols={["Tòa nhà", "Doanh thu", "Đã thu", "Công nợ", "Tỷ lệ thu hồi"]} />
                  {buildingRows.map((row) => {
                    const rate = row.revenue ? Math.round((row.collected / row.revenue) * 100) : 0;
                    return (
                      <div key={row.name} className="grid grid-cols-[1fr_120px_120px_120px_120px] items-center gap-3 border-t border-border px-4 py-3 text-[12px]">
                        <div className="font-black text-text">{row.name}</div>
                        <div className="font-bold text-text">{formatVnd(row.revenue)}</div>
                        <div className="font-bold text-text">{formatVnd(row.collected)}</div>
                        <div className="font-bold text-text">{formatVnd(row.debt)}</div>
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 flex-1 rounded-full bg-surface"><div className="h-full rounded-full bg-[#6d3df8]" style={{ width: `${rate}%` }} /></div>
                          <span className="w-8 text-right font-black text-muted">{rate}%</span>
                        </div>
                      </div>
                    );
                  })}
                  {buildingRows.length === 0 && <ReportEmptyState text="Chưa có doanh thu theo tòa nhà." />}
                </div>
              </section>

              <section className="rounded-[16px] border border-border/70 dark:border-white/[0.06] bg-card p-5 shadow-[0_1px_2px_rgba(16,24,40,0.03)]">
                <SectionHeader title="Top khách thuê nợ nhiều nhất" action="Xem tất cả" />
                <div className="mt-4 overflow-hidden rounded-[12px] border border-border">
                  <ReportTableHeader cols={["Khách thuê / Phòng", "Công nợ", "Hạn quá hạn"]} />
                  {debtRows.map((row, index) => (
                    <div key={`${row.name}-${index}`} className="grid grid-cols-[1fr_120px_90px] items-center gap-3 border-t border-border px-4 py-3 text-[12px]">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#ede9fe] text-[12px] font-black text-[#6d3df8]">{row.name.charAt(0)}</span>
                        <div className="min-w-0">
                          <div className="truncate font-black text-text">{row.name}</div>
                          <div className="truncate font-semibold text-muted">{row.room}</div>
                        </div>
                      </div>
                      <div className="font-black text-text">{formatVnd(row.debt)}</div>
                      <div className="font-black text-rose-500">{row.daysOverdue > 0 ? `${row.daysOverdue} ngày` : "Chưa quá hạn"}</div>
                    </div>
                  ))}
                  {debtRows.length === 0 && <ReportEmptyState text="Không có công nợ khách thuê cần hiển thị." />}
                </div>
              </section>
            </div>

            <aside className="flex min-w-0 flex-col gap-3">
              <ReportQuickLinks />
              <ContractStats activeContracts={summary.activeContracts} contracts={contracts} />
            </aside>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function KpiCard({ icon, label, value, change, tone, negative }: { icon: React.ReactNode; label: string; value: string; change: string; tone: string; negative?: boolean }) {
  return (
    <div className="flex h-[104px] items-center gap-4 rounded-[16px] border border-border/70 dark:border-white/[0.06] bg-card p-4 shadow-[0_1px_2px_rgba(16,24,40,0.03)]">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] ${tone}`}>{icon}</div>
      <div className="min-w-0">
        <div className="text-[11px] font-black uppercase text-muted">{label}</div>
        <div className="mt-2 truncate text-[22px] font-black leading-none text-text">{value}</div>
        <div className={`mt-2 text-[12px] font-bold ${negative ? "text-rose-500" : "text-emerald-600"}`}>{change}</div>
      </div>
    </div>
  );
}

function SectionHeader({ title, action }: { title: string; action: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-[16px] font-black text-text">{title}</h2>
      <span className="rounded-xl border border-border bg-surface/60 px-3 py-2 text-[12px] font-black text-muted">{action}</span>
    </div>
  );
}

function MoneyTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-[10px] border border-border bg-card px-3 py-2 text-[12px] shadow-[0_14px_35px_rgba(15,23,42,0.16)]">
      {label && <div className="mb-1 font-black text-text">{label}</div>}
      {payload.map((item: any) => (
        <div key={item.dataKey || item.name} className="flex items-center justify-between gap-6 py-0.5">
          <span className="font-bold text-muted">{item.name || item.payload?.label || item.dataKey}</span>
          <span className="font-black text-text">{formatVnd(Number(item.value || 0))}</span>
        </div>
      ))}
    </div>
  );
}

function ReportTableHeader({ cols }: { cols: string[] }) {
  return (
    <div className={`grid gap-3 bg-surface/70 px-4 py-3 text-[11px] font-black uppercase text-muted ${cols.length === 5 ? "grid-cols-[1fr_120px_120px_120px_120px]" : "grid-cols-[1fr_120px_90px]"}`}>
      {cols.map((col) => <span key={col}>{col}</span>)}
    </div>
  );
}

function ReportEmptyState({ text }: { text: string }) {
  return (
    <div className="border-t border-border px-4 py-8 text-center text-[12px] font-semibold text-muted">
      {text}
    </div>
  );
}

function ReportQuickLinks() {
  const links = [
    { icon: <FileBarChart size={18} />, title: "Báo cáo doanh thu", body: "Phân tích doanh thu theo thời gian", tone: "bg-[#ede9fe] text-[#6d3df8]" },
    { icon: <WalletCards size={18} />, title: "Báo cáo công nợ", body: "Tổng hợp công nợ phải thu", tone: "bg-orange-50 text-orange-500" },
    { icon: <ClipboardList size={18} />, title: "Báo cáo hợp đồng", body: "Tình hình hợp đồng theo trạng thái", tone: "bg-sky-50 text-sky-500" },
    { icon: <Building2 size={18} />, title: "Báo cáo phòng", body: "Tỷ lệ lấp đầy và tình trạng phòng", tone: "bg-emerald-50 text-emerald-600" },
    { icon: <Users size={18} />, title: "Báo cáo khách thuê", body: "Thống kê khách thuê và hoạt động", tone: "bg-fuchsia-50 text-fuchsia-500" },
  ];
  return (
    <section className="rounded-[16px] border border-border/70 dark:border-white/[0.06] bg-card p-5 shadow-[0_1px_2px_rgba(16,24,40,0.03)]">
      <h2 className="text-[16px] font-black text-text">Báo cáo nhanh</h2>
      <div className="mt-4 grid gap-3">
        {links.map((link) => (
          <div key={link.title} className="flex items-center gap-3 rounded-[12px] p-2">
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] ${link.tone}`}>{link.icon}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-black text-text">{link.title}</span>
              <span className="mt-1 block truncate text-[12px] font-semibold text-muted">{link.body}</span>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function ContractStats({ activeContracts, contracts }: { activeContracts: number; contracts: any[] }) {
  const expiring = contracts.filter((contract) => contract.status === "EXPIRING").length;
  const ended = contracts.filter((contract) => ["TERMINATED", "EXPIRED"].includes(contract.status)).length;
  return (
    <section className="flex min-h-0 flex-1 flex-col rounded-[16px] border border-border/70 dark:border-white/[0.06] bg-card p-5 shadow-[0_1px_2px_rgba(16,24,40,0.03)]">
      <h2 className="text-[16px] font-black text-text">Thống kê hợp đồng</h2>
      <div className="mt-5 grid gap-4 text-[13px]">
        <StatLine label="Tổng hợp đồng" value={contracts.length} />
        <StatLine label="Đang hiệu lực" value={activeContracts} tone="text-emerald-600" />
        <StatLine label="Sắp hết hạn (30 ngày)" value={expiring} tone="text-orange-500" />
        <StatLine label="Hết hạn" value={ended} tone="text-rose-500" />
        <StatLine label="Đã hủy" value={contracts.filter((contract) => contract.status === "CANCELLED").length} />
      </div>
    </section>
  );
}

function StatLine({ label, value, tone = "text-text" }: { label: string; value: number; tone?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="font-bold text-muted">{label}</span>
      <span className={`font-black ${tone}`}>{value}</span>
    </div>
  );
}
