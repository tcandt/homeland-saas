"use client";

import React, { useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  Download,
  Eye,
  FileText,
  Filter,
  Mail,
  MoreHorizontal,
  Plus,
  Receipt,
  Search,
  Send,
  WalletCards,
  Zap,
} from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import AppShell from "@/components/layout/AppShell";
import OperationsBillingDrawer from "@/components/invoices/OperationsBillingDrawer";
import { Button } from "@/components/ui/Button";
import { useInvoicesQuery } from "@/lib/queries/invoices.queries";

const formatVnd = (value: number) => `${Number(value || 0).toLocaleString("vi-VN")} đ`;

const formatDate = (value?: string) => {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
};

const statusMeta: Record<string, { label: string; tone: string; dot: string }> = {
  DRAFT: { label: "Chờ thanh toán", tone: "bg-orange-50 text-orange-600", dot: "bg-orange-500" },
  ISSUED: { label: "Chờ thanh toán", tone: "bg-orange-50 text-orange-600", dot: "bg-orange-500" },
  PARTIALLY_PAID: { label: "Thanh toán một phần", tone: "bg-blue-50 text-blue-600", dot: "bg-blue-500" },
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
  return Number(invoice.total ?? invoice.totalAmount ?? invoice.amount ?? 0) || 0;
}

function invoicePaid(invoice: any) {
  return Number(invoice.paidAmount ?? invoice.paid ?? 0) || 0;
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
  return invoice.period || invoice.billingPeriod || "Tháng hiện tại";
}

export default function InvoicesPage() {
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
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
      return [invoice.code, invoiceCustomer(invoice), invoiceRoom(invoice), invoicePeriod(invoice)]
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
    const pendingAmount = pending.reduce((sum: number, invoice: any) => sum + Math.max(0, invoiceAmount(invoice) - invoicePaid(invoice)), 0);
    const overdueAmount = overdue.reduce((sum: number, invoice: any) => sum + Math.max(0, invoiceAmount(invoice) - invoicePaid(invoice)), 0);
    const recoveryRate = totalAmount > 0 ? (paidAmount / totalAmount) * 100 : 0;

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
  const selectedCount = selectedIds.length;
  const allDisplayedSelected = displayedInvoices.length > 0 && displayedInvoices.every((invoice: any) => selectedIds.includes(invoice.id));
  const soonDueCount = invoices.filter((invoice: any) => {
    if (!["DRAFT", "ISSUED", "PARTIALLY_PAID"].includes(invoice.status) || !invoice.dueDate) return false;
    const dueTime = new Date(invoice.dueDate).getTime();
    const diffDays = Math.ceil((dueTime - Date.now()) / 86400000);
    return diffDays >= 0 && diffDays <= 3;
  }).length;

  const toggleInvoice = (id: string) => {
    setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  };

  const toggleDisplayed = () => {
    const displayedIds = displayedInvoices.map((invoice: any) => invoice.id);
    setSelectedIds((current) =>
      allDisplayedSelected ? current.filter((id) => !displayedIds.includes(id)) : Array.from(new Set([...current, ...displayedIds])),
    );
  };

  React.useEffect(() => {
    setPage(1);
  }, [search, status]);

  return (
    <AppShell>
      <>
        <div data-testid="invoices-root" className="-m-4 h-[calc(100dvh-87px)] w-[calc(100%+32px)] overflow-auto bg-[#f6f8fc] md:h-[calc(100dvh-80px)] xl:overflow-hidden">
        <div className="grid min-h-full w-full max-w-none grid-cols-1 gap-2 p-2 md:p-3 xl:h-full xl:min-h-0 xl:grid-cols-[minmax(0,1fr)_minmax(280px,15vw)] 2xl:grid-cols-[minmax(0,1fr)_minmax(310px,14vw)]">
            <div className="flex min-w-0 flex-col gap-2 xl:min-h-0">
              <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-5">
                <KpiCard icon={Receipt} label="Tổng phải thu" value={formatVnd(summary.totalAmount)} hint="Tổng giá trị hóa đơn" tone="bg-[#ede9fe] text-[#6d3df8]" />
                <KpiCard icon={FileText} label="Chờ thanh toán" value={`${summary.pendingCount} hóa đơn`} hint={formatVnd(summary.pendingAmount)} tone="bg-orange-50 text-orange-500" />
                <KpiCard icon={Clock3} label="Quá hạn" value={`${summary.overdueCount} hóa đơn`} hint={formatVnd(summary.overdueAmount)} tone="bg-rose-50 text-rose-500" />
                <KpiCard icon={WalletCards} label="Đã thu" value={`${summary.paidCount} hóa đơn`} hint={formatVnd(summary.paidAmount)} tone="bg-emerald-50 text-emerald-600" />
                <KpiCard icon={Zap} label="Tỷ lệ thu hồi" value={`${summary.recoveryRate.toFixed(1)}%`} hint="Theo tổng giá trị hóa đơn" tone="bg-sky-50 text-sky-500" />
              </div>

              <section className="flex min-h-[520px] flex-1 flex-col overflow-hidden rounded-[14px] border border-[#e6eaf0] bg-card shadow-[0_1px_2px_rgba(16,24,40,0.03)] xl:min-h-0">
                <div className="flex flex-col gap-3 border-b border-border px-4 py-3">
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
                    <div className="flex items-center gap-2">
                      <Button variant="outline" className="h-9 gap-2 bg-card px-3">
                        <Download size={15} /> Xuất Excel
                      </Button>
                      <Button onClick={() => toast.success("Tạo hóa đơn")} className="h-9 gap-2 bg-[#6d3df8] px-3 text-white hover:bg-[#5b35f5]">
                        <Plus size={16} /> Tạo hóa đơn
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-2 xl:grid-cols-[minmax(280px,1fr)_160px_132px_146px_108px_auto]">
                    <div className="flex h-9 items-center gap-2 rounded-xl border border-border bg-card px-3">
                      <Search size={15} className="text-muted" />
                      <input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Tìm mã hóa đơn, khách thuê, phòng, tòa nhà..."
                        className="min-w-0 flex-1 bg-transparent text-[12px] font-semibold text-text outline-none placeholder:text-muted"
                      />
                    </div>
                    <FilterButton icon={<CalendarDays size={14} />} label="01/05/2026 - 31/05/2026" />
                    <FilterButton label="Tất cả tòa nhà" />
                    <FilterButton label="Tất cả trạng thái" />
                    <FilterButton label="Công nợ" />
                    <Button variant="outline" className="h-9 gap-2 px-3">
                      <Filter size={15} /> Bộ lọc
                    </Button>
                  </div>
                </div>

                {selectedCount > 0 && (
                  <div className="mx-4 mt-3 flex flex-col gap-3 rounded-[12px] border border-[#6d3df8]/20 bg-[#f6f2ff] px-4 py-2.5 text-[13px] font-bold text-text sm:flex-row sm:items-center sm:justify-between">
                    <span>{selectedCount} hóa đơn đã chọn</span>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button size="sm" variant="outline" className="gap-2 bg-card" onClick={() => toast.success("Gửi nhắc nợ")}>
                        <Send size={14} /> Gửi nhắc nợ
                      </Button>
                      <Button size="sm" variant="outline" className="gap-2 bg-card" onClick={() => toast.success("Xuất PDF")}>
                        <Download size={14} /> Xuất PDF
                      </Button>
                      <Button size="sm" className="gap-2 bg-[#6d3df8] text-white hover:bg-[#5b35f5]" onClick={() => toast.success("Đánh dấu đã thu")}>
                        <CheckCircle2 size={14} /> Đánh dấu đã thu
                      </Button>
                    </div>
                  </div>
                )}

                <div className="min-h-0 flex-1 overflow-x-auto">
                  <table className="w-full min-w-[1180px] table-fixed text-left">
                    <thead className="bg-surface/70 text-[11px] uppercase text-muted">
                      <tr>
                        <th className="w-[3%] px-3 py-3 font-black">
                          <input type="checkbox" checked={allDisplayedSelected} onChange={toggleDisplayed} className="h-4 w-4 rounded border-border accent-[#6d3df8]" />
                        </th>
                        <th className="w-[17%] px-3 py-3 font-black">Hóa đơn</th>
                        <th className="w-[16%] px-3 py-3 font-black">Khách thuê / Phòng</th>
                        <th className="w-[10%] px-3 py-3 font-black">Kỳ hóa đơn</th>
                        <th className="w-[9%] px-3 py-3 font-black">Ngày lập</th>
                        <th className="w-[11%] px-3 py-3 font-black">Hạn thanh toán</th>
                        <th className="w-[8%] px-3 py-3 text-right font-black">Tổng tiền</th>
                        <th className="w-[7%] px-3 py-3 text-right font-black">Đã thu</th>
                        <th className="w-[7%] px-3 py-3 text-right font-black">Còn nợ</th>
                        <th className="w-[8%] px-3 py-3 font-black">Trạng thái</th>
                        <th className="w-[4%] px-3 py-3 text-right font-black">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {isLoading && (
                        <tr>
                          <td colSpan={11} className="px-4 py-10 text-center text-[13px] font-bold text-muted">Đang tải hóa đơn...</td>
                        </tr>
                      )}
                      {isError && (
                        <tr>
                          <td colSpan={11} className="px-4 py-10 text-center text-[13px] font-bold text-rose-500">Không tải được danh sách hóa đơn.</td>
                        </tr>
                      )}
                      {!isLoading && !isError && visibleInvoices.length === 0 && (
                        <tr>
                          <td colSpan={11} className="px-4 py-10 text-center">
                            <div className="mx-auto flex max-w-sm flex-col items-center gap-2 rounded-[16px] border border-dashed border-border bg-surface/40 px-6 py-8">
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
                          selected={selectedIds.includes(invoice.id)}
                          onToggle={() => toggleInvoice(invoice.id)}
                          onOpen={() => setSelectedInvoice(invoice)}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-auto flex flex-col gap-3 border-t border-border px-4 py-3 text-[12px] font-semibold text-muted sm:flex-row sm:items-center sm:justify-between">
                  <span>
                    Hiển thị {visibleInvoices.length === 0 ? 0 : (page - 1) * pageSize + 1} - {Math.min(page * pageSize, visibleInvoices.length)} của {visibleInvoices.length || 0} hóa đơn
                  </span>
                  <div className="flex items-center gap-2">
                    <FilterButton label="5 / trang" />
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

            <aside className="grid min-h-[680px] grid-rows-[286px_170px_minmax(260px,1fr)] gap-2 xl:h-full xl:min-h-0">
              <section className="flex min-h-0 flex-col rounded-[14px] border border-[#e6eaf0] bg-card p-4 shadow-[0_1px_2px_rgba(16,24,40,0.03)]">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h2 className="text-[15px] font-black text-text">Tổng quan thu hồi</h2>
                  <FilterButton label="Tháng 5/2026" />
                </div>
                <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3">
                  <div className="relative h-[142px] w-[142px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={chartData} dataKey="amount" nameKey="label" innerRadius={44} outerRadius={64} paddingAngle={3} stroke="var(--card)" strokeWidth={5}>
                          {chartData.map((item) => <Cell key={item.label} fill={item.color} />)}
                        </Pie>
                        <Tooltip content={<InvoiceChartTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                      <div className="text-[16px] font-black text-text">{summary.recoveryRate.toFixed(1)}%</div>
                      <div className="text-[10px] font-bold text-muted">Thu hồi</div>
                    </div>
                  </div>
                  <div className="grid w-full grid-cols-1 gap-2">
                    {chartData.map((item) => (
                      <div key={item.label} className="grid grid-cols-[8px_1fr] gap-2">
                        <span className="mt-1.5 h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                        <div>
                          <div className="truncate text-[11px] font-black text-muted">{item.label}</div>
                          <div className="truncate text-[11px] font-bold text-muted">{formatVnd(item.amount)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              <section className="flex min-h-0 flex-col rounded-[14px] border border-[#e6eaf0] bg-card p-4 shadow-[0_1px_2px_rgba(16,24,40,0.03)]">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-[15px] font-black text-text">Cần xử lý</h2>
                  <button className="text-[12px] font-black text-[#6d3df8]">Xem tất cả →</button>
                </div>
                <div className="grid flex-1 content-center gap-2">
                  <ActionMetric label="Hóa đơn quá hạn" value={`${summary.overdueCount} hóa đơn`} tone="text-rose-600 bg-rose-50" />
                  <ActionMetric label="Sắp đến hạn" value={`${soonDueCount} hóa đơn`} tone="text-orange-600 bg-orange-50" />
                  <ActionMetric label="Thanh toán chờ xác nhận" value="0 khoản" tone="text-sky-600 bg-sky-50" />
                </div>
              </section>

              <section className="flex min-h-0 flex-col rounded-[14px] border border-[#e6eaf0] bg-card p-4 shadow-[0_1px_2px_rgba(16,24,40,0.03)]">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-[15px] font-black text-text">Nhắc nhở tự động</h2>
                  <button className="text-[12px] font-black text-[#6d3df8]">Cấu hình →</button>
                </div>
                <div className="grid flex-1 content-center gap-2">
                  <ReminderItem icon={<Bell size={16} />} title="Trước hạn" body="ON" tone="bg-[#ede9fe] text-[#6d3df8]" />
                  <ReminderItem icon={<Mail size={16} />} title="Đến hạn" body="ON" tone="bg-sky-50 text-sky-500" />
                  <ReminderItem icon={<Zap size={16} />} title="Quá hạn" body="ON" tone="bg-rose-50 text-rose-500" />
                </div>
              </section>

              <section className="flex min-h-0 flex-col rounded-[14px] border border-[#e6eaf0] bg-card p-4 shadow-[0_1px_2px_rgba(16,24,40,0.03)]">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-[15px] font-black text-text">Thanh toán gần đây</h2>
                </div>
                <div className="grid flex-1 content-center gap-3">
                  {invoices.filter((invoice: any) => invoicePaid(invoice) > 0).slice(0, 3).map((invoice: any) => (
                    <div key={invoice.id} className="grid grid-cols-[3px_1fr_auto] gap-3">
                      <span className="rounded-full bg-emerald-500" />
                      <div>
                        <div className="text-[13px] font-black text-text">{invoice.code || invoice.id?.slice(0, 8)}</div>
                        <div className="mt-1 text-[11px] font-black text-emerald-600">Đã thu</div>
                      </div>
                      <div className="text-right text-[13px] font-black text-text">{formatVnd(invoicePaid(invoice))}</div>
                    </div>
                  ))}
                  {invoices.filter((invoice: any) => invoicePaid(invoice) > 0).length === 0 && (
                    <div className="flex flex-col items-center rounded-[14px] border border-dashed border-border bg-surface/40 px-4 py-6 text-center">
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
    <div className="h-[102px] rounded-[14px] border border-[#e6eaf0] bg-card p-4 shadow-[0_1px_2px_rgba(16,24,40,0.03)]">
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
  selected,
  onToggle,
  onOpen,
}: {
  invoice: any;
  selected: boolean;
  onToggle: () => void;
  onOpen: () => void;
}) {
  const meta = statusMeta[invoice.status] || { label: invoice.status || "Chưa rõ", tone: "bg-slate-100 text-slate-500", dot: "bg-slate-400" };
  const dueDate = invoice.dueDate ? new Date(invoice.dueDate) : null;
  const overdueDays = dueDate ? Math.ceil((Date.now() - dueDate.getTime()) / 86400000) : 0;
  const dueText = invoice.status === "OVERDUE" && overdueDays > 0 ? `Quá hạn ${overdueDays} ngày` : formatDate(invoice.dueDate);
  const total = invoiceAmount(invoice);
  const paid = invoicePaid(invoice);
  const remaining = Math.max(0, total - paid);

  return (
    <tr className="border-b border-border/70 last:border-b-0 hover:bg-[#fafbff]">
      <td className="px-3 py-3">
        <input type="checkbox" checked={selected} onChange={onToggle} className="h-4 w-4 rounded border-border accent-[#6d3df8]" />
      </td>
      <td className="px-3 py-3">
        <button type="button" onClick={onOpen} className="text-left">
          <div className="truncate text-[14px] font-black text-[#5b35f5]">{invoice.code || invoice.id?.slice(0, 8)}</div>
          <div className="mt-1 text-[12px] font-semibold text-muted">{invoice.title || "Hóa đơn thu tiền"}</div>
        </button>
      </td>
      <td className="px-3 py-3">
        <div className="truncate text-[13px] font-black text-text">{invoiceCustomer(invoice)}</div>
        <div className="mt-1 truncate text-[12px] font-semibold text-muted">{invoiceRoom(invoice)}</div>
      </td>
      <td className="px-3 py-3">
        <div className="truncate text-[13px] font-black text-text">{invoicePeriod(invoice)}</div>
        <div className="mt-1 text-[12px] font-semibold text-muted">{invoice.month || ""}</div>
      </td>
      <td className="px-3 py-3">
        <div className="text-[13px] font-bold text-text">{formatDate(invoice.createdAt || invoice.issueDate)}</div>
        <div className="mt-1 text-[12px] font-semibold text-muted">{invoice.createdTime || ""}</div>
      </td>
      <td className="px-3 py-3">
        <div className={`text-[13px] font-black ${invoice.status === "OVERDUE" ? "text-rose-500" : "text-text"}`}>{dueText}</div>
        {invoice.status === "OVERDUE" && overdueDays > 0 && <div className="mt-1 text-[12px] font-bold text-rose-500">Cần ưu tiên xử lý</div>}
      </td>
      <td className="px-3 py-3 text-right text-[13px] font-black tabular-nums text-text">{formatVnd(total)}</td>
      <td className="px-3 py-3 text-right text-[13px] font-bold tabular-nums text-emerald-600">{formatVnd(paid)}</td>
      <td className={`px-3 py-3 text-right text-[13px] font-black tabular-nums ${remaining > 0 ? "text-rose-600" : "text-muted"}`}>{formatVnd(remaining)}</td>
      <td className="px-3 py-3">
        <span className={`inline-flex items-center gap-1.5 rounded-[8px] px-2.5 py-1 text-[11px] font-black ${meta.tone}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
          {meta.label}
        </span>
      </td>
      <td className="px-3 py-3">
        <div className="flex justify-end gap-2">
          <IconButton onClick={onOpen} icon={<Eye size={14} />} />
          <IconButton onClick={() => toast.success("Thao tác hóa đơn")} icon={<MoreHorizontal size={14} />} />
        </div>
      </td>
    </tr>
  );
}

function FilterButton({ label, icon }: { label: string; icon?: React.ReactNode }) {
  return (
    <button type="button" className="flex h-9 items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 text-[12px] font-bold text-text">
      <span className="inline-flex min-w-0 items-center gap-2 truncate">
        {icon}
        {label}
      </span>
      <ChevronDown size={14} className="shrink-0 text-muted" />
    </button>
  );
}

function IconButton({ icon, onClick }: { icon: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card text-muted hover:text-[#6d3df8]">
      {icon}
    </button>
  );
}

function ReminderItem({ icon, title, body, tone }: { icon: React.ReactNode; title: string; body: string; tone: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-border py-2.5 first:border-t-0 first:pt-0 last:pb-0">
      <div className="flex min-w-0 items-center gap-2">
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] ${tone}`}>{icon}</div>
        <div className="text-[13px] font-black text-text">{title}</div>
      </div>
      <div className="shrink-0 text-[12px] font-black text-emerald-600">{body}</div>
    </div>
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

function InvoiceChartTooltip({ active, payload }: any) {
  if (!active || !Array.isArray(payload) || payload.length === 0) return null;
  const item = payload[0];
  return (
    <div className="rounded-[10px] border border-border bg-card px-3 py-2 text-[12px] shadow-[0_14px_35px_rgba(15,23,42,0.16)]">
      <div className="font-black text-text">{item?.name || item?.payload?.label}</div>
      <div className="mt-1 font-bold text-muted">{formatVnd(Number(item?.value || 0))}</div>
    </div>
  );
}
