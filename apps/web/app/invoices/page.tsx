"use client";

import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Clock,
  Clock3,
  CreditCard,
  DoorClosed,
  Eye,
  FileText,
  Filter,
  Plus,
  Receipt,
  Search,
  WalletCards,
  X,
  Zap,
} from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import AppShell from "@/components/layout/AppShell";
import OperationsBillingDrawer from "@/components/invoices/OperationsBillingDrawer";
import InvoiceCreateModal from "@/components/invoices/InvoiceCreateModal";
import { getInvoiceFinancials } from "@/lib/invoices/invoice-financials";
import { useInvoicesQuery } from "@/lib/queries/invoices.queries";
import { Card } from "@/components/ui/Card";
import { getTenantAvatar } from "@/components/tenants/TenantDetailDrawer";

const formatVnd = (value: number) => `${Number(value || 0).toLocaleString("vi-VN")} đ`;

const formatDate = (value?: string) => {
  if (!value) return "--/--/----";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--/--/----";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

function formatInvoiceCode(invoice: any) {
  const raw = String(invoice?.code || invoice?.id || "").trim();
  return raw || "Chưa có mã";
}

const statusMeta: Record<string, { label: string; tone: string; dot: string }> = {
  DRAFT: { label: "Bản nháp", tone: "bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300", dot: "bg-slate-500" },
  ISSUED: { label: "Chờ thanh toán", tone: "bg-amber-500/10 text-amber-600 border border-amber-500/20", dot: "bg-amber-500" },
  PARTIALLY_PAID: { label: "Đã thu một phần", tone: "bg-blue-500/10 text-blue-600 border border-blue-500/20", dot: "bg-blue-500" },
  OVERDUE: { label: "Quá hạn", tone: "bg-rose-500/10 text-rose-600 border border-rose-500/20", dot: "bg-rose-500" },
  PAID: { label: "Đã thu đủ", tone: "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20", dot: "bg-emerald-500" },
  CANCELLED: { label: "Đã hủy", tone: "bg-slate-100 text-slate-500 dark:bg-slate-800", dot: "bg-slate-400" },
};

function invoiceAmount(invoice: any) {
  return getInvoiceFinancials(invoice).total;
}

function invoicePaid(invoice: any) {
  return getInvoiceFinancials(invoice).paid;
}

function invoiceRemaining(invoice: any) {
  return getInvoiceFinancials(invoice).remaining;
}

function invoiceRoom(invoice: any) {
  const room = invoice.contract?.room || invoice.room || {};
  const building = room.building || invoice.building || {};
  const roomCode = room.code || room.number || room.name || "--";
  const buildingName = building.code || building.name || "";
  return { roomCode, buildingName };
}

function invoiceCustomer(invoice: any) {
  return invoice.customer?.fullName || invoice.customer?.name || invoice.tenant?.name || invoice.tenantName || "Chưa rõ khách thuê";
}

function invoicePeriod(invoice: any) {
  return invoice.period || invoice.billingPeriod || "--";
}

export default function InvoicesPage() {
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const { data, isLoading, isError } = useInvoicesQuery({ limit: 100 });
  const invoices = (data as any)?.data || [];

  const summary = useMemo(() => {
    const totalInvoices = invoices.length;
    const pending = invoices.filter((invoice: any) => ["DRAFT", "ISSUED", "PARTIALLY_PAID"].includes(invoice.status));
    const overdue = invoices.filter((invoice: any) => invoice.status === "OVERDUE");
    const paid = invoices.filter((invoice: any) => invoice.status === "PAID");
    const totalAmount = invoices.reduce((sum: number, invoice: any) => sum + invoiceAmount(invoice), 0);
    const paidAmount = invoices.reduce((sum: number, invoice: any) => sum + invoicePaid(invoice), 0);
    const creditedAmount = invoices.reduce((sum: number, invoice: any) => sum + getInvoiceFinancials(invoice).credit, 0);
    const pendingAmount = pending.reduce((sum: number, invoice: any) => sum + invoiceRemaining(invoice), 0);
    const overdueAmount = overdue.reduce((sum: number, invoice: any) => sum + invoiceRemaining(invoice), 0);
    const recoveryRate = totalAmount > 0 ? ((paidAmount + creditedAmount) / totalAmount) * 100 : 0;

    return {
      totalInvoices,
      pendingCount: pending.length,
      overdueCount: overdue.length,
      paidCount: paid.length,
      totalAmount,
      paidAmount,
      pendingAmount,
      overdueAmount,
      recoveryRate,
    };
  }, [invoices]);

  const visibleInvoices = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return invoices.filter((invoice: any) => {
      if (status) {
        if (status === "ISSUED" && !["DRAFT", "ISSUED", "PARTIALLY_PAID"].includes(invoice.status)) return false;
        else if (status !== "ISSUED" && invoice.status !== status) return false;
      }
      if (!needle) return true;
      const code = formatInvoiceCode(invoice);
      const { roomCode, buildingName } = invoiceRoom(invoice);
      return [code, invoice.code, invoiceCustomer(invoice), roomCode, buildingName, invoicePeriod(invoice)]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [invoices, search, status]);

  const tabs = [
    { value: "", label: "Tất cả", count: invoices.length, icon: Receipt },
    { value: "ISSUED", label: "Chờ thanh toán", count: summary.pendingCount, icon: Clock3, activeClass: "bg-amber-500/10 text-amber-600 border-amber-500/30" },
    { value: "OVERDUE", label: "Quá hạn", count: summary.overdueCount, icon: AlertTriangle, activeClass: "bg-rose-500/10 text-rose-600 border-rose-500/30" },
    { value: "PAID", label: "Đã thu", count: summary.paidCount, icon: CheckCircle2, activeClass: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" },
    { value: "CANCELLED", label: "Đã hủy", count: invoices.filter((i: any) => i.status === "CANCELLED").length, icon: FileText, activeClass: "bg-slate-500/10 text-slate-600 border-slate-500/30" },
  ];

  const recoveryData = [
    { label: "Đã thu", amount: summary.paidAmount, color: "#10b981" },
    { label: "Chờ thanh toán", amount: summary.pendingAmount, color: "#f59e0b" },
    { label: "Quá hạn", amount: summary.overdueAmount, color: "#ef4444" },
  ].filter((item) => item.amount > 0);

  const chartData = recoveryData.length ? recoveryData : [{ label: "Chưa có dữ liệu", amount: 1, color: "#e2e8f0" }];
  const pageSize = 8;
  const totalPages = Math.max(1, Math.ceil(visibleInvoices.length / pageSize));
  const displayedInvoices = visibleInvoices.slice((page - 1) * pageSize, page * pageSize);
  const soonDueCount = invoices.filter((invoice: any) => {
    if (!["DRAFT", "ISSUED", "PARTIALLY_PAID"].includes(invoice.status) || !invoice.dueDate) return false;
    const dueTime = new Date(invoice.dueDate).getTime();
    const diffDays = Math.ceil((dueTime - Date.now()) / 86400000);
    return diffDays >= 0 && diffDays <= 3;
  }).length;

  React.useEffect(() => {
    setPage(1);
  }, [search, status]);

  return (
    <AppShell>
      <div data-testid="invoices-root" className="-m-4 h-[calc(100dvh-87px)] w-[calc(100%+32px)] overflow-auto bg-background md:h-[calc(100dvh-80px)] xl:overflow-hidden">
        <div className="grid min-h-full w-full max-w-none grid-cols-1 gap-2.5 p-2 md:p-3 2xl:h-full 2xl:min-h-0 2xl:grid-cols-[minmax(0,1fr)_minmax(310px,14vw)]">
          {/* LEFT MAIN COLUMN */}
          <div className="flex min-w-0 flex-col gap-2.5 2xl:h-full 2xl:min-h-0">
            {/* 4 COMPACT INLINE KPI CARDS */}
            <div data-testid="invoices-kpi-grid" className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-2.5 shrink-0">
              <KpiCard
                icon={<Receipt size={16} className="text-indigo-600 dark:text-indigo-400" />}
                iconBg="bg-indigo-500/10 border border-indigo-500/20"
                label="Tổng phải thu"
                value={formatVnd(summary.totalAmount)}
                trend={`Thu hồi: ${summary.recoveryRate.toFixed(1)}%`}
                trendPositive={summary.recoveryRate >= 80}
              />
              <KpiCard
                icon={<Clock3 size={16} className="text-amber-600 dark:text-amber-400" />}
                iconBg="bg-amber-500/10 border border-amber-500/20"
                label="Chờ thanh toán"
                value={`${summary.pendingCount} hóa đơn`}
                trend={summary.pendingAmount > 0 ? formatVnd(summary.pendingAmount) : undefined}
                highlight={summary.pendingCount > 0}
                highlightColor="text-amber-600 dark:text-amber-400"
              />
              <KpiCard
                icon={<AlertTriangle size={16} className={summary.overdueCount > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"} />}
                iconBg={summary.overdueCount > 0 ? "bg-rose-500/10 border border-rose-500/20" : "bg-emerald-500/10 border border-emerald-500/20"}
                label="Quá hạn nợ"
                value={`${summary.overdueCount} hóa đơn`}
                trend={summary.overdueAmount > 0 ? `${formatVnd(summary.overdueAmount)} nợ` : "0 đ quá hạn"}
                highlight={summary.overdueCount > 0}
                highlightColor="text-rose-600 dark:text-rose-400"
              />
              <KpiCard
                icon={<CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400" />}
                iconBg="bg-emerald-500/10 border border-emerald-500/20"
                label="Đã thu đủ"
                value={`${summary.paidCount} hóa đơn`}
                trend={summary.paidAmount > 0 ? formatVnd(summary.paidAmount) : "Chưa có"}
                trendPositive={true}
              />
            </div>

            {/* FILTER BAR WITH 1-CLICK STATUS TABS */}
            <Card data-testid="invoices-filter-bar" className="flex flex-col gap-2.5 rounded-2xl border-border/60 p-3 shadow-xs shrink-0">
              <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
                {/* Search input */}
                <div className="min-w-0 flex-1 lg:max-w-[440px]">
                  <div className="flex h-9.5 items-center gap-2 rounded-xl border border-border bg-card px-3 text-[13px] font-semibold">
                    <Search size={15} className="text-muted shrink-0" />
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Tìm mã hóa đơn, khách thuê, phòng, tòa nhà..."
                      className="min-w-0 flex-1 bg-transparent text-[13px] font-semibold text-text outline-none placeholder:text-muted"
                    />
                    {search && (
                      <button type="button" onClick={() => setSearch("")} className="text-muted hover:text-text">
                        <X size={13} />
                      </button>
                    )}
                  </div>
                </div>

                {/* 1-Click Status Tabs */}
                <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto">
                  {tabs.map((tab) => {
                    const isSelected = status === tab.value;
                    const Icon = tab.icon;
                    return (
                      <button
                        key={tab.value || "all"}
                        type="button"
                        onClick={() => setStatus(tab.value)}
                        className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition-all shrink-0 ${
                          isSelected
                            ? tab.activeClass || "bg-primary/10 text-primary border-primary/30 shadow-2xs"
                            : "border-border bg-card text-muted hover:border-border/80 hover:text-text"
                        }`}
                      >
                        <Icon size={13} />
                        {tab.label}
                        <span className="ml-0.5 rounded-md bg-surface px-1.5 py-0.2 font-mono text-[10px] text-muted">
                          {tab.count}
                        </span>
                      </button>
                    );
                  })}

                  {(search || status) && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearch("");
                        setStatus("");
                      }}
                      className="inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-muted hover:text-text"
                    >
                      <X size={13} /> Xóa lọc
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-primary hover:bg-primary/90 text-white px-3.5 py-1.5 text-xs font-black shadow-xs transition-colors shrink-0"
                  >
                    <Plus size={14} /> Tạo hóa đơn
                  </button>
                </div>
              </div>
            </Card>

            {/* TABLE CONTAINER CARD */}
            <section data-testid="invoices-list" className="flex min-h-[480px] flex-1 flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm xl:h-full xl:min-h-0">
              <div className="min-h-0 flex-1 overflow-x-auto overflow-y-auto">
                <table className="w-full min-w-[1160px] text-left border-collapse">
                  <thead className="sticky top-0 z-10 bg-surface/90 backdrop-blur-sm text-[11px] uppercase tracking-wider text-muted shadow-[0_1px_0_var(--border)] select-none">
                    <tr>
                      <th className="w-[120px] px-3.5 py-2.5 font-black whitespace-nowrap">Mã Hóa đơn</th>
                      <th className="w-[220px] px-3.5 py-2.5 font-black whitespace-nowrap">Khách thuê / Phòng</th>
                      <th className="w-[130px] px-3.5 py-2.5 font-black whitespace-nowrap">Kỳ hóa đơn</th>
                      <th className="w-[110px] px-3.5 py-2.5 font-black whitespace-nowrap">Ngày lập</th>
                      <th className="w-[140px] px-3.5 py-2.5 font-black whitespace-nowrap">Hạn thanh toán</th>
                      <th className="w-[120px] px-3.5 py-2.5 text-right font-black whitespace-nowrap">Tổng tiền</th>
                      <th className="w-[110px] px-3.5 py-2.5 text-right font-black whitespace-nowrap">Đã thu</th>
                      <th className="w-[110px] px-3.5 py-2.5 text-right font-black whitespace-nowrap">Còn nợ</th>
                      <th className="w-[140px] px-3.5 py-2.5 font-black whitespace-nowrap">Trạng thái</th>
                      <th className="w-[70px] px-3.5 py-2.5 text-right font-black whitespace-nowrap">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {isLoading && (
                      <tr>
                        <td colSpan={10} className="px-4 py-12 text-center text-[13px] font-bold text-muted">
                          Đang tải danh sách hóa đơn...
                        </td>
                      </tr>
                    )}
                    {isError && (
                      <tr>
                        <td data-testid="invoices-error-state" colSpan={10} className="px-4 py-12 text-center text-[13px] font-bold text-rose-500">
                          Không tải được danh sách hóa đơn.
                        </td>
                      </tr>
                    )}
                    {!isLoading && !isError && visibleInvoices.length === 0 && (
                      <tr>
                        <td colSpan={10} className="px-4 py-12 text-center">
                          <div data-testid="empty-invoices-state" className="mx-auto flex max-w-sm flex-col items-center gap-2 rounded-2xl border border-dashed border-border bg-surface/40 px-6 py-8">
                            <Receipt size={32} className="text-muted/60" />
                            <div className="text-[14px] font-black text-text">Chưa có hóa đơn phù hợp</div>
                            <div className="text-[12px] font-semibold text-muted">Thử đổi bộ lọc hoặc tạo hóa đơn mới.</div>
                          </div>
                        </td>
                      </tr>
                    )}
                    {!isLoading && !isError && displayedInvoices.map((invoice: any) => (
                      <InvoiceRow
                        key={invoice.id}
                        invoice={invoice}
                        onOpen={() => setSelectedInvoice(invoice)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>

              {/* PAGINATION FOOTER */}
              <div className="mt-auto flex flex-col gap-3 border-t border-border/60 bg-surface/30 px-4 py-2.5 text-[12px] font-semibold text-muted shrink-0 sm:flex-row sm:items-center sm:justify-between">
                <span>
                  Hiển thị {visibleInvoices.length === 0 ? 0 : (page - 1) * pageSize + 1} -{" "}
                  {Math.min(page * pageSize, visibleInvoices.length)} trên {visibleInvoices.length} hóa đơn
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="rounded-xl border border-border bg-card px-2.5 py-1 text-[11px] font-bold text-text">
                    {pageSize} / trang
                  </span>
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((value) => Math.max(1, value - 1))}
                    className="flex h-7 w-7 items-center justify-center rounded-xl border border-border bg-card text-muted hover:text-text hover:border-primary/40 disabled:opacity-40 transition-colors"
                  >
                    ‹
                  </button>
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, index) => index + 1).map((pageNumber) => (
                    <button
                      key={pageNumber}
                      type="button"
                      onClick={() => setPage(pageNumber)}
                      className={`flex h-7 min-w-[28px] items-center justify-center rounded-xl px-1.5 text-xs font-bold transition-all ${
                        page === pageNumber
                          ? "bg-primary text-white shadow-xs"
                          : "border border-border bg-card text-muted hover:text-text hover:border-primary/40"
                      }`}
                    >
                      {pageNumber}
                    </button>
                  ))}
                  {totalPages > 5 && <span className="px-1 text-muted">...</span>}
                  <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                    className="flex h-7 w-7 items-center justify-center rounded-xl border border-border bg-card text-muted hover:text-text hover:border-primary/40 disabled:opacity-40 transition-colors"
                  >
                    ›
                  </button>
                </div>
              </div>
            </section>
          </div>

          {/* RIGHT SIDEBAR COLUMN */}
          <aside data-testid="billing-right-panel" className="hidden flex-col gap-3.5 2xl:flex 2xl:h-full 2xl:min-h-0">
            {/* Card 1: Tổng quan thu hồi */}
            <section className="flex shrink-0 flex-col rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h2 className="text-[15px] font-black text-text">Tổng quan thu hồi</h2>
                <span className="rounded-xl border border-border bg-surface/60 px-2.5 py-1 text-[11px] font-bold text-muted">Hiện tại</span>
              </div>
              <div className="flex min-h-0 flex-col items-center justify-center gap-3">
                <div className="relative h-[142px] w-[142px]">
                  <ResponsiveContainer width={142} height={142} minWidth={142} minHeight={142}>
                    <PieChart width={142} height={142}>
                      <Pie data={chartData} dataKey="amount" nameKey="label" innerRadius={44} outerRadius={64} paddingAngle={3} stroke="var(--card)" strokeWidth={5}>
                        {chartData.map((item) => <Cell key={item.label} fill={item.color} />)}
                      </Pie>
                      <Tooltip content={<InvoiceChartTooltip empty={recoveryData.length === 0} />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <div className="text-[20px] font-black font-mono leading-none text-text">{summary.recoveryRate.toFixed(1)}%</div>
                    <div className="mt-1 text-[10px] font-bold uppercase tracking-wider text-muted">Thu hồi</div>
                  </div>
                </div>
                <div className="grid w-full grid-cols-1 gap-1.5">
                  {chartData.map((item) => (
                    <div key={item.label} className="flex items-center justify-between gap-3 rounded-xl bg-surface/60 px-2.5 py-1.5">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="truncate text-[11px] font-bold text-muted">{item.label}</span>
                      </div>
                      <span className="shrink-0 text-[11px] font-black font-mono text-text">{formatVnd(recoveryData.length === 0 ? 0 : item.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* Card 2: Cần xử lý */}
            <section className="flex shrink-0 flex-col rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-[15px] font-black text-text">Cần xử lý</h2>
              </div>
              <div className="grid content-center gap-2">
                <ActionMetric label="Hóa đơn quá hạn" value={`${summary.overdueCount} hóa đơn`} tone="text-rose-600 bg-rose-500/10 border border-rose-500/20" />
                <ActionMetric label="Sắp đến hạn (3 ngày)" value={`${soonDueCount} hóa đơn`} tone="text-amber-600 bg-amber-500/10 border border-amber-500/20" />
              </div>
            </section>

            {/* Card 3: Thanh toán gần đây */}
            <section className="flex min-h-0 flex-1 flex-col rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
              <div className="mb-2 flex items-center justify-between shrink-0">
                <h2 className="text-[15px] font-black text-text">Thanh toán gần đây</h2>
              </div>
              <div className="flex-1 min-h-0 flex flex-col overflow-y-auto pr-1">
                {invoices.filter((invoice: any) => invoicePaid(invoice) > 0).slice(0, 8).map((invoice: any) => (
                  <div key={invoice.id} className="grid grid-cols-[3px_1fr_auto] gap-2.5 rounded-xl border border-border/60 bg-surface/30 p-2.5 mb-2 last:mb-0">
                    <span className="rounded-full bg-emerald-500" />
                    <div className="min-w-0">
                      <div className="text-[12px] font-black text-text truncate">{formatInvoiceCode(invoice)}</div>
                      <div className="text-[11px] font-bold text-emerald-600">Đã thu {formatVnd(invoicePaid(invoice))}</div>
                    </div>
                  </div>
                ))}
                {invoices.filter((invoice: any) => invoicePaid(invoice) > 0).length === 0 && (
                  <div className="text-xs text-muted font-medium py-3 text-center">Chưa có giao dịch thu tiền gần đây</div>
                )}
              </div>
            </section>
          </aside>
        </div>
      </div>

      {selectedInvoice && (
        <OperationsBillingDrawer
          invoice={selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
        />
      )}

      {isCreateModalOpen && (
        <InvoiceCreateModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
        />
      )}
    </AppShell>
  );
}

function KpiCard({
  icon,
  iconBg,
  label,
  value,
  trend,
  trendPositive,
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
          {label}
        </div>
        <div className="flex items-baseline gap-2">
          <span className="font-mono font-black text-lg md:text-xl text-text leading-none truncate">
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

function InvoiceRow({
  invoice,
  onOpen,
}: {
  invoice: any;
  onOpen: () => void;
}) {
  const meta = statusMeta[invoice.status] || { label: invoice.status || "Chưa rõ", tone: "bg-slate-100 text-slate-500", dot: "bg-slate-400" };
  const dueDate = invoice.dueDate ? new Date(invoice.dueDate) : null;
  const overdueDays = dueDate ? Math.ceil((Date.now() - dueDate.getTime()) / 86400000) : 0;
  const dueText = invoice.status === "OVERDUE" && overdueDays > 0 ? `Quá hạn ${overdueDays} ngày` : formatDate(invoice.dueDate);
  const total = invoiceAmount(invoice);
  const paid = invoicePaid(invoice);
  const remaining = invoiceRemaining(invoice);
  const code = formatInvoiceCode(invoice);
  const customerName = invoiceCustomer(invoice);
  const customerGender = invoice.customer?.gender || "";
  const isFemale = customerGender === "FEMALE" || customerGender === "Nữ" || customerGender === "nu";
  const avatarUrl = getTenantAvatar(invoice.customer?.avatar, customerName, customerGender);
  const { roomCode, buildingName } = invoiceRoom(invoice);

  return (
    <tr data-testid="invoice-card" className="group border-b border-border/40 last:border-b-0 hover:bg-surface/70 cursor-pointer transition-colors" onClick={onOpen}>
      {/* 1. MÃ HÓA ĐƠN */}
      <td className="px-3.5 py-3">
        <div className="font-mono text-[13px] font-black text-primary group-hover:underline whitespace-nowrap">{code}</div>
        <div className="text-[11px] font-medium text-muted whitespace-nowrap">{invoice.title || "Hóa đơn dịch vụ"}</div>
      </td>

      {/* 2. KHÁCH THUÊ / PHÒNG */}
      <td className="px-3.5 py-3">
        <div className="flex items-center gap-2.5">
          <div className="relative shrink-0">
            <img
              src={avatarUrl}
              alt={customerName}
              className={`h-8 w-8 rounded-xl object-cover border shadow-2xs ${
                isFemale ? "border-pink-300 bg-pink-50" : "border-sky-300 bg-sky-50"
              }`}
            />
            <span
              className={`absolute -bottom-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full text-[8px] font-black text-white ${
                isFemale ? "bg-rose-500" : "bg-sky-600"
              }`}
            >
              {isFemale ? "♀" : "♂"}
            </span>
          </div>
          <div className="min-w-0">
            <div className="truncate text-[13px] font-black text-text max-w-[160px] group-hover:text-primary transition-colors">
              {customerName}
            </div>
            <div className="flex items-center gap-1 text-[11px] font-bold text-muted">
              <Building2 size={11} className="text-indigo-500 shrink-0" />
              <span className="truncate">{buildingName || "Tòa LK01.31"}</span>
              <span className="text-muted/40">•</span>
              <span className="font-mono text-text truncate">{roomCode}</span>
            </div>
          </div>
        </div>
      </td>

      {/* 3. KỲ HÓA ĐƠN */}
      <td className="px-3.5 py-3 whitespace-nowrap">
        <div className="text-[13px] font-black font-mono text-text">{invoicePeriod(invoice)}</div>
        <div className="text-[11px] font-semibold text-muted">{invoice.month || "Tháng này"}</div>
      </td>

      {/* 4. NGÀY LẬP */}
      <td className="px-3.5 py-3 whitespace-nowrap">
        <div className="text-[12px] font-bold font-mono text-text">{formatDate(invoice.createdAt || invoice.issueDate)}</div>
      </td>

      {/* 5. HẠN THANH TOÁN */}
      <td className="px-3.5 py-3 whitespace-nowrap">
        <div className={`text-[12px] font-black font-mono ${invoice.status === "OVERDUE" ? "text-rose-600 dark:text-rose-400" : "text-text"}`}>
          {dueText}
        </div>
        {invoice.status === "OVERDUE" && overdueDays > 0 && (
          <div className="text-[10px] font-bold text-rose-500 uppercase tracking-wide">Cần nhắc phí</div>
        )}
      </td>

      {/* 6. TỔNG TIỀN */}
      <td className="px-3.5 py-3 text-right text-[13px] font-black font-mono tabular-nums text-text whitespace-nowrap">
        {formatVnd(total)}
      </td>

      {/* 7. ĐÃ THU */}
      <td className="px-3.5 py-3 text-right text-[13px] font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
        {formatVnd(paid)}
      </td>

      {/* 8. CÒN NỢ */}
      <td className={`px-3.5 py-3 text-right text-[13px] font-black font-mono tabular-nums whitespace-nowrap ${remaining > 0 ? "text-rose-600 dark:text-rose-400" : "text-muted"}`}>
        {formatVnd(remaining)}
      </td>

      {/* 9. TRẠNG THÁI */}
      <td className="px-3.5 py-3 whitespace-nowrap">
        <span className={`inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-[11px] font-bold ${meta.tone}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
          {meta.label}
        </span>
      </td>

      {/* 10. THAO TÁC */}
      <td className="px-3.5 py-3 text-right">
        <button
          type="button"
          aria-label="Xem chi tiết hóa đơn"
          onClick={(e) => {
            e.stopPropagation();
            onOpen();
          }}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-muted transition-all hover:border-primary/40 hover:bg-primary/10 hover:text-primary shadow-2xs"
        >
          <Eye size={15} />
        </button>
      </td>
    </tr>
  );
}

function ActionMetric({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-surface/60 px-3 py-2">
      <span className="min-w-0 truncate text-[12px] font-bold text-muted">{label}</span>
      <span className={`shrink-0 rounded-lg px-2 py-0.5 text-[11px] font-black ${tone}`}>{value}</span>
    </div>
  );
}

function InvoiceChartTooltip({ active, payload, empty }: any) {
  if (!active || !Array.isArray(payload) || payload.length === 0) return null;
  const item = payload[0];
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2 text-[12px] shadow-lg">
      <div className="font-black text-text">{item?.name || item?.payload?.label}</div>
      <div className="mt-1 font-bold text-muted">{formatVnd(empty ? 0 : Number(item?.value || 0))}</div>
    </div>
  );
}
