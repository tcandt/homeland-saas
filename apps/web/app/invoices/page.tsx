"use client";

import React, { useMemo, useState } from "react";
import {
  ChevronRight,
  Clock3,
  Eye,
  FileText,
  Receipt,
  Search,
  WalletCards,
  Zap,
} from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import AppShell from "@/components/layout/AppShell";
import OperationsBillingDrawer from "@/components/invoices/OperationsBillingDrawer";
import { getInvoiceFinancials } from "@/lib/invoices/invoice-financials";
import { useInvoicesQuery } from "@/lib/queries/invoices.queries";

const formatVnd = (value: number) => `${Number(value || 0).toLocaleString("vi-VN")} đ`;

const formatDate = (value?: string) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
};

function formatInvoiceCode(invoice: any) {
  const raw = String(invoice?.code || invoice?.id || "").trim();
  return raw || "Chưa có mã";
}

const statusMeta: Record<string, { label: string; tone: string; dot: string }> = {
  DRAFT: { label: "Bản nháp", tone: "bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300", dot: "bg-slate-500" },
  ISSUED: { label: "Chờ thanh toán", tone: "bg-orange-50 text-orange-600", dot: "bg-orange-500" },
  PARTIALLY_PAID: { label: "Thanh toán 1 phần", tone: "bg-blue-50 text-blue-600", dot: "bg-blue-500" },
  OVERDUE: { label: "Quá hạn", tone: "bg-rose-50 text-rose-600", dot: "bg-rose-500" },
  PAID: { label: "Đã thu", tone: "bg-emerald-50 text-emerald-600", dot: "bg-emerald-500" },
  CANCELLED: { label: "Đã hủy", tone: "bg-slate-100 text-slate-500", dot: "bg-slate-400" },
};

const tabs = [
  { value: "", label: "Tất cả hóa đơn" },
  { value: "ISSUED", label: "Chờ thanh toán" },
  { value: "OVERDUE", label: "Quá hạn" },
  { value: "PAID", label: "Đã thu" },
  { value: "CANCELLED", label: "Đã hủy" },
];

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
  return buildingName ? `${roomCode} · ${buildingName}` : roomCode;
}

function invoiceCustomer(invoice: any) {
  return invoice.customer?.name || invoice.customer?.fullName || invoice.tenant?.name || invoice.tenantName || "Chưa rõ khách thuê";
}

function invoicePeriod(invoice: any) {
  return invoice.period || invoice.billingPeriod || "--";
}

export default function InvoicesPage() {
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
  const { data, isLoading, isError } = useInvoicesQuery({ limit: 100 });
  const invoices = (data as any)?.data || [];

  const visibleInvoices = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return invoices.filter((invoice: any) => {
      if (status) {
        if (status === "ISSUED" && !["DRAFT", "ISSUED", "PARTIALLY_PAID"].includes(invoice.status)) return false;
        else if (status !== "ISSUED" && invoice.status !== status) return false;
      }
      if (!needle) return true;
      const code = formatInvoiceCode(invoice);
      return [code, invoice.code, invoiceCustomer(invoice), invoiceRoom(invoice), invoicePeriod(invoice)]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [invoices, search, status]);

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

  const recoveryData = [
    { label: "Đã thu", amount: summary.paidAmount, color: "#2fbf71" },
    { label: "Chờ thanh toán", amount: summary.pendingAmount, color: "#fb923c" },
    { label: "Quá hạn", amount: summary.overdueAmount, color: "#f43f5e" },
  ].filter((item) => item.amount > 0);

  const chartData = recoveryData.length ? recoveryData : [{ label: "Chưa có dữ liệu", amount: 1, color: "#e2e8f0" }];
  const pageSize = 5;
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
      <>
        <div data-testid="invoices-root" className="-m-4 h-[calc(100dvh-87px)] w-[calc(100%+32px)] overflow-auto bg-background md:h-[calc(100dvh-80px)] xl:overflow-hidden">
          <div className="grid min-h-full w-full max-w-none grid-cols-1 gap-2 p-2 md:p-3 2xl:h-full 2xl:min-h-0 2xl:grid-cols-[minmax(0,1fr)_minmax(310px,14vw)]">
            {/* LEFT MAIN COLUMN */}
            <div className="flex min-w-0 flex-col gap-2 2xl:h-full 2xl:min-h-0">
              <div data-testid="invoices-kpi-grid" className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-5 shrink-0">
                <KpiCard icon={Receipt} label="Tổng phải thu" value={formatVnd(summary.totalAmount)} hint="Tổng giá trị hóa đơn" tone="bg-[#ede9fe] text-[#6d3df8]" />
                <KpiCard icon={FileText} label="Chờ thanh toán" value={`${summary.pendingCount} hóa đơn`} hint={formatVnd(summary.pendingAmount)} tone="bg-orange-50 text-orange-500" />
                <KpiCard icon={Clock3} label="Quá hạn" value={`${summary.overdueCount} hóa đơn`} hint={formatVnd(summary.overdueAmount)} tone="bg-rose-50 text-rose-500" />
                <KpiCard icon={WalletCards} label="Đã thu" value={`${summary.paidCount} hóa đơn`} hint={formatVnd(summary.paidAmount)} tone="bg-emerald-50 text-emerald-600" />
                <KpiCard icon={Zap} label="Tỷ lệ thu hồi" value={`${summary.recoveryRate.toFixed(1)}%`} hint="Theo tổng giá trị hóa đơn" tone="bg-sky-50 text-sky-500" />
              </div>

              {/* TABLE CONTAINER CARD */}
              <section data-testid="invoices-list" className="flex min-h-[520px] flex-1 flex-col overflow-hidden rounded-[14px] border border-border/70 dark:border-white/[0.06] bg-card shadow-[0_1px_2px_rgba(16,24,40,0.03)] xl:h-full xl:min-h-0">
                <div className="flex flex-col gap-3 border-b border-border px-4 py-3 shrink-0">
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                    <div className="hide-scrollbar flex items-center gap-4 overflow-x-auto">
                      {tabs.map((tab) => (
                        <button
                          key={tab.value || "all"}
                          type="button"
                          onClick={() => setStatus(tab.value)}
                          className={`h-9 shrink-0 border-b-2 px-2 text-[13px] font-black transition-colors ${
                            status === tab.value ? "border-[#6d3df8] text-[#6d3df8]" : "border-transparent text-muted hover:text-text"
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div data-testid="invoices-filter-bar" className="grid grid-cols-1 gap-2 xl:max-w-[680px]">
                    <div className="flex h-9 items-center gap-2 rounded-xl border border-border bg-card px-3">
                      <Search size={15} className="text-muted" />
                      <input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Tìm mã hóa đơn, khách thuê, phòng, tòa nhà..."
                        className="min-w-0 flex-1 bg-transparent text-[12px] font-semibold text-text outline-none placeholder:text-muted"
                      />
                    </div>
                  </div>
                </div>

                {/* SCROLLABLE TABLE AREA WITH HORIZONTAL SCROLL MIN-WIDTH */}
                <div className="min-h-0 flex-1 overflow-x-auto overflow-y-auto">
                  <table className="w-full min-w-[1240px] text-left border-collapse">
                    <thead className="sticky top-0 z-10 bg-surface/90 backdrop-blur-sm text-[11px] uppercase text-muted shadow-[0_1px_0_var(--border)]">
                      <tr>
                        <th className="w-[110px] px-3 py-3 font-black whitespace-nowrap">Hóa đơn</th>
                        <th className="w-[200px] px-3 py-3 font-black whitespace-nowrap">Khách thuê / Phòng</th>
                        <th className="w-[140px] px-3 py-3 font-black whitespace-nowrap">Kỳ hóa đơn</th>
                        <th className="w-[110px] px-3 py-3 font-black whitespace-nowrap">Ngày lập</th>
                        <th className="w-[150px] px-3 py-3 font-black whitespace-nowrap">Hạn thanh toán</th>
                        <th className="w-[120px] px-3 py-3 text-right font-black whitespace-nowrap">Tổng tiền</th>
                        <th className="w-[110px] px-3 py-3 text-right font-black whitespace-nowrap">Đã thu</th>
                        <th className="w-[110px] px-3 py-3 text-right font-black whitespace-nowrap">Còn nợ</th>
                        <th className="w-[140px] px-3 py-3 font-black whitespace-nowrap">Trạng thái</th>
                        <th className="w-[90px] px-3 py-3 text-right font-black whitespace-nowrap">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {isLoading && (
                        <tr>
                          <td colSpan={10} className="px-4 py-10 text-center text-[13px] font-bold text-muted">Đang tải hóa đơn...</td>
                        </tr>
                      )}
                      {isError && (
                        <tr>
                          <td data-testid="invoices-error-state" colSpan={10} className="px-4 py-10 text-center text-[13px] font-bold text-rose-500">Không tải được danh sách hóa đơn.</td>
                        </tr>
                      )}
                      {!isLoading && !isError && visibleInvoices.length === 0 && (
                        <tr>
                          <td colSpan={10} className="px-4 py-10 text-center">
                            <div data-testid="empty-invoices-state" className="mx-auto flex max-w-sm flex-col items-center gap-2 rounded-[16px] border border-dashed border-border bg-surface/40 px-6 py-8">
                              <Receipt size={34} className="text-muted" />
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
                <div className="mt-auto flex flex-col gap-3 border-t border-border px-4 py-3 text-[12px] font-semibold text-muted shrink-0 sm:flex-row sm:items-center sm:justify-between">
                  <span>
                    Hiển thị {visibleInvoices.length === 0 ? 0 : (page - 1) * pageSize + 1} - {Math.min(page * pageSize, visibleInvoices.length)} của {visibleInvoices.length || 0} hóa đơn
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 items-center rounded-xl border border-border bg-card px-3 text-[12px] font-black text-text">5 / trang</span>
                    <button
                      type="button"
                      disabled={page <= 1}
                      onClick={() => setPage((value) => Math.max(1, value - 1))}
                      className="flex h-8 w-8 items-center justify-center rounded-xl border border-border text-muted disabled:opacity-40"
                    >
                      ‹
                    </button>
                    {Array.from({ length: Math.min(totalPages, 5) }, (_, index) => index + 1).map((pageNumber) => (
                      <button
                        key={pageNumber}
                        type="button"
                        onClick={() => setPage(pageNumber)}
                        className={`flex h-8 w-8 items-center justify-center rounded-xl text-[12px] font-black ${
                          page === pageNumber ? "bg-[#6d3df8] text-white" : "text-text hover:bg-surface"
                        }`}
                      >
                        {pageNumber}
                      </button>
                    ))}
                    {totalPages > 5 && <span className="px-1">...</span>}
                    <button
                      type="button"
                      aria-label="Sang trang hóa đơn tiếp theo"
                      title="Trang tiếp theo"
                      disabled={page >= totalPages}
                      onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                      className="flex h-8 w-8 items-center justify-center rounded-xl border border-border text-muted disabled:opacity-40"
                    >
                      <ChevronRight size={15} />
                    </button>
                  </div>
                </div>
              </section>
            </div>

            {/* RIGHT SIDEBAR COLUMN MATCHING FULL HEIGHT OF LEFT COLUMN */}
            <aside data-testid="billing-right-panel" className="hidden flex-col gap-3.5 2xl:flex 2xl:h-full 2xl:min-h-0">
              {/* Card 1: Tổng quan thu hồi */}
              <section className="flex shrink-0 flex-col rounded-[14px] border border-border/70 dark:border-white/[0.06] bg-card p-4 shadow-[0_1px_2px_rgba(16,24,40,0.03)]">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h2 className="text-[15px] font-black text-text">Tổng quan thu hồi</h2>
                  <span className="rounded-xl border border-border bg-surface/60 px-3 py-2 text-[12px] font-black text-muted">Hiện tại</span>
                </div>
                <div className="flex min-h-0 flex-col items-center justify-center gap-3">
                  <div className="relative h-[142px] w-[142px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={chartData} dataKey="amount" nameKey="label" innerRadius={44} outerRadius={64} paddingAngle={3} stroke="var(--card)" strokeWidth={5}>
                          {chartData.map((item) => <Cell key={item.label} fill={item.color} />)}
                        </Pie>
                        <Tooltip content={<InvoiceChartTooltip empty={recoveryData.length === 0} />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                      <div className="text-[22px] font-black leading-none text-text">{summary.recoveryRate.toFixed(1)}%</div>
                      <div className="mt-1 text-[11px] font-bold text-muted">Thu hồi</div>
                    </div>
                  </div>
                  <div className="grid w-full grid-cols-1 gap-2">
                    {chartData.map((item) => (
                      <div key={item.label} className="flex items-center justify-between gap-3 rounded-[10px] bg-surface/55 px-3 py-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                          <span className="truncate text-[11px] font-black text-muted">{item.label}</span>
                        </div>
                        <span className="shrink-0 text-[11px] font-black text-text">{formatVnd(recoveryData.length === 0 ? 0 : item.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              {/* Card 2: Cần xử lý */}
              <section className="flex shrink-0 flex-col rounded-[14px] border border-border/70 dark:border-white/[0.06] bg-card p-4 shadow-[0_1px_2px_rgba(16,24,40,0.03)]">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-[15px] font-black text-text">Cần xử lý</h2>
                </div>
                <div className="grid content-center gap-2">
                  <ActionMetric label="Hóa đơn quá hạn" value={`${summary.overdueCount} hóa đơn`} tone="text-rose-600 bg-rose-50" />
                  <ActionMetric label="Sắp đến hạn" value={`${soonDueCount} hóa đơn`} tone="text-orange-600 bg-orange-50" />
                </div>
              </section>

              {/* Card 3: Thanh toán gần đây - STRETCHES FLEX-1 TO MATCH EXACT HEIGHT OF LEFT SIDE TABLE */}
              <section className="flex min-h-0 flex-1 flex-col rounded-[14px] border border-border/70 dark:border-white/[0.06] bg-card p-4 shadow-[0_1px_2px_rgba(16,24,40,0.03)]">
                <div className="mb-3 flex items-center justify-between shrink-0">
                  <h2 className="text-[15px] font-black text-text">Thanh toán gần đây</h2>
                </div>
                <div className="flex-1 min-h-0 flex flex-col overflow-y-auto pr-1">
                  {invoices.filter((invoice: any) => invoicePaid(invoice) > 0).slice(0, 8).map((invoice: any) => (
                    <div key={invoice.id} className="grid grid-cols-[3px_1fr_auto] gap-3 rounded-[12px] border border-border/70 bg-surface/30 p-3 mb-2 last:mb-0">
                      <span className="rounded-full bg-emerald-500" />
                      <div>
                        <div className="text-[13px] font-black text-text">{formatInvoiceCode(invoice)}</div>
                        <div className="mt-1 text-[11px] font-black text-emerald-600">Đã thu</div>
                      </div>
                      <div className="text-right text-[13px] font-black text-text">{formatVnd(invoicePaid(invoice))}</div>
                    </div>
                  ))}
                  {invoices.filter((invoice: any) => invoicePaid(invoice) > 0).length === 0 && (
                    <div className="flex h-full min-h-[160px] flex-1 flex-col items-center justify-center rounded-[14px] border border-dashed border-border bg-surface/40 px-4 py-6 text-center">
                      <WalletCards size={32} className="text-muted" />
                      <div className="mt-3 text-[13px] font-black text-text">Chưa có thanh toán gần đây</div>
                      <div className="mt-1 text-[12px] font-semibold text-muted">Các giao dịch mới sẽ xuất hiện tại đây.</div>
                    </div>
                  )}
                </div>
              </section>
            </aside>
          </div>
        </div>
        {selectedInvoice && <OperationsBillingDrawer invoice={selectedInvoice} onClose={() => setSelectedInvoice(null)} />}
      </>
    </AppShell>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string;
  hint: string;
  tone: string;
}) {
  return (
    <div className="h-[102px] rounded-[14px] border border-border/70 dark:border-white/[0.06] bg-card p-4 shadow-[0_1px_2px_rgba(16,24,40,0.03)]">
      <div className="flex items-start gap-3">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] ${tone}`}>
          <Icon size={18} />
        </div>
        <div className="min-w-0">
          <div className="text-[11px] font-black uppercase text-muted">{label}</div>
          <div className="mt-2 truncate text-[23px] font-black leading-none text-text">{value}</div>
          <div className="mt-2 truncate text-[12px] font-bold text-muted">{hint}</div>
        </div>
      </div>
    </div>
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

  return (
    <tr data-testid="invoice-card" className="border-b border-border/70 last:border-b-0 hover:bg-surface/70">
      <td className="px-3 py-3 font-mono">
        <button type="button" onClick={onOpen} className="text-left">
          <div className="text-[14px] font-black text-[#5b35f5] whitespace-nowrap">{code}</div>
          <div className="mt-1 text-[12px] font-semibold text-muted whitespace-nowrap">{invoice.title || "Hóa đơn thu tiền"}</div>
        </button>
      </td>
      <td className="px-3 py-3">
        <div className="truncate text-[13px] font-black text-text max-w-[190px]">{invoiceCustomer(invoice)}</div>
        <div className="mt-1 truncate text-[12px] font-semibold text-muted max-w-[190px]">{invoiceRoom(invoice)}</div>
      </td>
      <td className="px-3 py-3 whitespace-nowrap">
        <div className="text-[13px] font-black text-text">{invoicePeriod(invoice)}</div>
        <div className="mt-1 text-[12px] font-semibold text-muted">{invoice.month || ""}</div>
      </td>
      <td className="px-3 py-3 whitespace-nowrap">
        <div className="text-[13px] font-bold text-text">{formatDate(invoice.createdAt || invoice.issueDate)}</div>
        <div className="mt-1 text-[12px] font-semibold text-muted">{invoice.createdTime || ""}</div>
      </td>
      <td className="px-3 py-3 whitespace-nowrap">
        <div className={`text-[13px] font-black ${invoice.status === "OVERDUE" ? "text-rose-500" : "text-text"}`}>{dueText}</div>
        {invoice.status === "OVERDUE" && overdueDays > 0 && <div className="mt-1 text-[12px] font-bold text-rose-500">Cần ưu tiên xử lý</div>}
      </td>
      <td className="px-3 py-3 text-right text-[13px] font-black tabular-nums text-text whitespace-nowrap">{formatVnd(total)}</td>
      <td className="px-3 py-3 text-right text-[13px] font-bold tabular-nums text-emerald-600 whitespace-nowrap">{formatVnd(paid)}</td>
      <td className={`px-3 py-3 text-right text-[13px] font-black tabular-nums whitespace-nowrap ${remaining > 0 ? "text-rose-600" : "text-muted"}`}>{formatVnd(remaining)}</td>
      <td className="px-3 py-3 whitespace-nowrap">
        <span className={`inline-flex items-center gap-1.5 rounded-[8px] px-2.5 py-1 text-[11px] font-black ${meta.tone}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
          {meta.label}
        </span>
      </td>
      <td className="px-3 py-3">
        <div className="flex justify-end gap-2">
          <IconButton onClick={onOpen} icon={<Eye size={14} />} />
        </div>
      </td>
    </tr>
  );
}

function IconButton({ icon, onClick }: { icon: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card text-muted hover:text-[#6d3df8]">
      {icon}
    </button>
  );
}

function ActionMetric({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-border py-2.5 first:border-t-0 first:pt-0 last:pb-0">
      <span className="min-w-0 truncate text-[12px] font-bold text-muted">{label}</span>
      <span className={`shrink-0 rounded-[8px] px-2.5 py-1 text-[12px] font-black ${tone}`}>{value}</span>
    </div>
  );
}

function InvoiceChartTooltip({ active, payload, empty }: any) {
  if (!active || !Array.isArray(payload) || payload.length === 0) return null;
  const item = payload[0];
  return (
    <div className="rounded-[10px] border border-border bg-card px-3 py-2 text-[12px] shadow-[0_14px_35px_rgba(15,23,42,0.16)]">
      <div className="font-black text-text">{item?.name || item?.payload?.label}</div>
      <div className="mt-1 font-bold text-muted">{formatVnd(empty ? 0 : Number(item?.value || 0))}</div>
    </div>
  );
}
