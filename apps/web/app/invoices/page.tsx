"use client";

import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Building2,
  CheckCircle2,
  Clock,
  Clock3,
  CreditCard,
  DoorClosed,
  FileText,
  Filter,
  Plus,
  Receipt,
  RotateCcw,
  Search,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Wallet,
  WalletCards,
  X,
  Zap,
  Trash2,
  Eye,
  Printer,
} from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import AppShell from "@/components/layout/AppShell";
import OperationsBillingDrawer from "@/components/invoices/OperationsBillingDrawer";
import InvoiceCreateModal, { InvoiceModalTab } from "@/components/invoices/InvoiceCreateModal";
import OperationsBillingPipeline from "@/components/invoices/OperationsBillingPipeline";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { getInvoiceFinancials } from "@/lib/invoices/invoice-financials";
import { useInvoicesQuery } from "@/lib/queries/invoices.queries";
import { invoicesApi } from "@/lib/api/invoices.api";
import toast from "react-hot-toast";
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

export function getInvoiceTypeAndDirection(invoice: any): {
  direction: "INCOME" | "EXPENSE";
  category: "RENT" | "HOLDING_DEPOSIT" | "CONTRACT_DEPOSIT" | "HOLDING_REFUND" | "SETTLEMENT_REFUND";
  label: string;
  badgeTone: string;
} {
  const notes = (invoice.notes || "").toLowerCase();
  const period = (invoice.period || "").toLowerCase();
  const rawTotal = Number(invoice.total || invoice.totalAmount || 0);
  const items = Array.isArray(invoice.items) ? invoice.items : [];

  const isRefundNote =
    notes.includes("hoàn cọc") ||
    notes.includes("refund") ||
    notes.includes("phiếu chi") ||
    period.includes("hoàn cọc");
  const isSettlementNote = notes.includes("settlement") || notes.includes("tất toán") || notes.includes("thanh lý");
  const hasNegativeItem = items.some((it: any) => Number(it.amount || 0) < 0 || it.type === "DISCOUNT");

  if (isSettlementNote && (isRefundNote || hasNegativeItem || rawTotal < 0)) {
    return {
      direction: "EXPENSE",
      category: "SETTLEMENT_REFUND",
      label: "Tất toán HĐ",
      badgeTone: "bg-rose-500/10 text-rose-600 border border-rose-500/30",
    };
  }

  if (isRefundNote || notes.includes("[phiếu chi hoàn cọc giữ phòng]")) {
    return {
      direction: "EXPENSE",
      category: "HOLDING_REFUND",
      label: "Hoàn cọc giữ phòng",
      badgeTone: "bg-amber-500/10 text-amber-600 border border-amber-500/30",
    };
  }

  if (
    notes.includes("cọc giữ phòng") ||
    notes.includes("[cọc giữ phòng]") ||
    period.includes("cọc giữ phòng") ||
    items.some((it: any) => (it.name || "").toLowerCase().includes("giữ chỗ") || (it.name || "").toLowerCase().includes("giữ phòng"))
  ) {
    return {
      direction: "INCOME",
      category: "HOLDING_DEPOSIT",
      label: "Cọc giữ chỗ",
      badgeTone: "bg-amber-500/10 text-amber-600 border border-amber-500/30",
    };
  }

  if (
    notes.includes("cọc hợp đồng") ||
    notes.includes("[cọc hợp đồng]") ||
    period.includes("cọc hợp đồng") ||
    items.some((it: any) => (it.name || "").toLowerCase().includes("hợp đồng") && (it.name || "").toLowerCase().includes("cọc"))
  ) {
    return {
      direction: "INCOME",
      category: "CONTRACT_DEPOSIT",
      label: "Cọc hợp đồng",
      badgeTone: "bg-indigo-500/10 text-indigo-600 border border-indigo-500/30",
    };
  }

  return {
    direction: "INCOME",
    category: "RENT",
    label: "Tiền kỳ hạn",
    badgeTone: "bg-emerald-500/10 text-emerald-600 border border-emerald-500/30",
  };
}

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
  const [directionFilter, setDirectionFilter] = useState<"ALL" | "INCOME" | "EXPENSE">("ALL");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [page, setPage] = useState(1);
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createModalTab, setCreateModalTab] = useState<InvoiceModalTab>("RENT");
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; invoice: any } | null>(null);

  React.useEffect(() => {
    const handleClose = () => setContextMenu(null);
    window.addEventListener("click", handleClose);
    window.addEventListener("scroll", handleClose);
    return () => {
      window.removeEventListener("click", handleClose);
      window.removeEventListener("scroll", handleClose);
    };
  }, []);

  const [invoiceToDelete, setInvoiceToDelete] = useState<any | null>(null);
  const [isDeletingInvoice, setIsDeletingInvoice] = useState(false);

  const { data, isLoading, isError, refetch } = useInvoicesQuery({ limit: 100 });
  const invoices = (data as any)?.data || [];

  const handleConfirmDeleteInvoice = async () => {
    if (!invoiceToDelete) return;
    setIsDeletingInvoice(true);
    try {
      await invoicesApi.delete(invoiceToDelete.id);
      refetch();
      toast.success("Đã xóa hóa đơn thành công!");
      setInvoiceToDelete(null);
    } catch (err: any) {
      toast.error(err?.message || "Lỗi khi xóa hóa đơn");
    } finally {
      setIsDeletingInvoice(false);
    }
  };

  const handleDeleteInvoice = (inv: any) => {
    setContextMenu(null);
    setInvoiceToDelete(inv);
  };

  const summary = useMemo(() => {
    const totalInvoices = invoices.length;
    const pending = invoices.filter((invoice: any) => ["DRAFT", "ISSUED", "PARTIALLY_PAID"].includes(invoice.status));
    const overdue = invoices.filter((invoice: any) => invoice.status === "OVERDUE");
    const paid = invoices.filter((invoice: any) => invoice.status === "PAID");

    let totalIncome = 0;
    let totalExpense = 0;
    let paidIncome = 0;
    let paidExpense = 0;

    invoices.forEach((inv: any) => {
      const { direction } = getInvoiceTypeAndDirection(inv);
      const amt = invoiceAmount(inv);
      const pAmt = invoicePaid(inv);
      if (direction === "EXPENSE") {
        totalExpense += amt;
        paidExpense += pAmt;
      } else {
        totalIncome += amt;
        paidIncome += pAmt;
      }
    });

    const netCashflow = paidIncome - paidExpense;
    const pendingAmount = pending.reduce((sum: number, invoice: any) => sum + invoiceRemaining(invoice), 0);
    const overdueAmount = overdue.reduce((sum: number, invoice: any) => sum + invoiceRemaining(invoice), 0);
    const recoveryRate = totalIncome > 0 ? (paidIncome / totalIncome) * 100 : 0;

    return {
      totalInvoices,
      pendingCount: pending.length,
      overdueCount: overdue.length,
      paidCount: paid.length,
      totalIncome,
      totalExpense,
      paidIncome,
      paidExpense,
      netCashflow,
      pendingAmount,
      overdueAmount,
      recoveryRate,
    };
  }, [invoices]);

  const visibleInvoices = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return invoices.filter((invoice: any) => {
      const typeInfo = getInvoiceTypeAndDirection(invoice);

      if (directionFilter !== "ALL" && typeInfo.direction !== directionFilter) {
        return false;
      }
      if (categoryFilter !== "ALL" && typeInfo.category !== categoryFilter) {
        return false;
      }
      if (status) {
        if (status === "ISSUED" && !["DRAFT", "ISSUED", "PARTIALLY_PAID"].includes(invoice.status)) return false;
        else if (status !== "ISSUED" && invoice.status !== status) return false;
      }
      if (!needle) return true;
      const code = formatInvoiceCode(invoice);
      const { roomCode, buildingName } = invoiceRoom(invoice);
      return [code, invoice.code, invoiceCustomer(invoice), roomCode, buildingName, invoicePeriod(invoice), typeInfo.label]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [invoices, search, status, directionFilter, categoryFilter]);

  const tabs = [
    { value: "", label: "Tất cả", count: invoices.length, icon: Receipt },
    { value: "ISSUED", label: "Chờ thanh toán", count: summary.pendingCount, icon: Clock3, activeClass: "bg-amber-500/10 text-amber-600 border-amber-500/30" },
    { value: "OVERDUE", label: "Quá hạn", count: summary.overdueCount, icon: AlertTriangle, activeClass: "bg-rose-500/10 text-rose-600 border-rose-500/30" },
    { value: "PAID", label: "Đã thu đủ", count: summary.paidCount, icon: CheckCircle2, activeClass: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" },
    { value: "CANCELLED", label: "Đã hủy", count: invoices.filter((i: any) => i.status === "CANCELLED").length, icon: FileText, activeClass: "bg-slate-500/10 text-slate-600 border-slate-500/30" },
  ];

  const recoveryData = [
    { label: "Đã thu (+)", amount: summary.paidIncome, color: "#10b981" },
    { label: "Đã hoàn (-)", amount: summary.paidExpense, color: "#f43f5e" },
    { label: "Chờ thu", amount: summary.pendingAmount, color: "#f59e0b" },
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
  }, [search, status, directionFilter, categoryFilter]);

  return (
    <AppShell>
      <div data-testid="invoices-root" className="-m-4 h-[calc(100dvh-87px)] w-[calc(100%+32px)] overflow-auto bg-background md:h-[calc(100dvh-80px)] xl:overflow-hidden">
        <div className="grid min-h-full w-full max-w-none grid-cols-1 gap-2.5 p-2 md:p-3 2xl:h-full 2xl:min-h-0 2xl:grid-cols-[minmax(0,1fr)_minmax(310px,14vw)]">
          {/* LEFT MAIN COLUMN */}
          <div className="flex min-w-0 flex-col gap-2.5 2xl:h-full 2xl:min-h-0">
            {/* 4 COMPACT INLINE KPI CARDS */}
            <div data-testid="invoices-kpi-grid" className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-2.5 shrink-0">
              <KpiCard
                icon={<ArrowDownLeft size={16} className="text-emerald-600 dark:text-emerald-400" />}
                iconBg="bg-emerald-500/10 border border-emerald-500/20"
                label="Tổng thu vào (+)"
                value={formatVnd(summary.totalIncome)}
                trend={`Đã thu: ${formatVnd(summary.paidIncome)}`}
                trendPositive={true}
              />
              <KpiCard
                icon={<ArrowUpRight size={16} className="text-rose-600 dark:text-rose-400" />}
                iconBg="bg-rose-500/10 border border-rose-500/20"
                label="Tổng hoàn cọc / Chi (-)"
                value={formatVnd(summary.totalExpense)}
                trend={summary.paidExpense > 0 ? `Đã hoàn: ${formatVnd(summary.paidExpense)}` : "Chưa phát sinh"}
                highlight={summary.totalExpense > 0}
                highlightColor="text-rose-600 dark:text-rose-400"
              />
              <KpiCard
                icon={<Wallet size={16} className="text-indigo-600 dark:text-indigo-400" />}
                iconBg="bg-indigo-500/10 border border-indigo-500/20"
                label="Dòng tiền ròng (Net)"
                value={formatVnd(summary.netCashflow)}
                trend={summary.netCashflow >= 0 ? "Dương dòng tiền" : "Âm dòng tiền"}
                trendPositive={summary.netCashflow >= 0}
              />
              <KpiCard
                icon={<Clock3 size={16} className="text-amber-600 dark:text-amber-400" />}
                iconBg="bg-amber-500/10 border border-amber-500/20"
                label="Chờ thu / Quá hạn"
                value={`${summary.pendingCount} phiếu`}
                trend={summary.pendingAmount > 0 ? `${formatVnd(summary.pendingAmount)} chờ thu` : "Đã thu hết"}
                highlight={summary.overdueCount > 0}
                highlightColor="text-rose-600 dark:text-rose-400"
              />
            </div>

            {/* BILLING PIPELINE */}
            <OperationsBillingPipeline />

            {/* FILTER BAR WITH 2-WAY TOGGLE & STATUS TABS */}
            <Card data-testid="invoices-filter-bar" className="flex flex-col gap-2.5 rounded-2xl border-border/60 p-3 shadow-xs shrink-0">
              <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
                {/* Search & 2-Way Direction Filter */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 min-w-0 flex-1">
                  <div className="flex h-9.5 items-center gap-2 rounded-xl border border-border bg-card px-3 text-[13px] font-semibold min-w-0 flex-1 max-w-[340px]">
                    <Search size={15} className="text-muted shrink-0" />
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Tìm hóa đơn, cọc, khách, phòng..."
                      className="min-w-0 flex-1 bg-transparent text-[13px] font-semibold text-text outline-none placeholder:text-muted"
                    />
                    {search && (
                      <button type="button" onClick={() => setSearch("")} className="text-muted hover:text-text">
                        <X size={13} />
                      </button>
                    )}
                  </div>

                  {/* 2-Way Direction Switch */}
                  <div className="inline-flex rounded-xl p-0.5 bg-surface border border-border shrink-0">
                    <button
                      type="button"
                      onClick={() => setDirectionFilter("ALL")}
                      className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        directionFilter === "ALL" ? "bg-card text-primary shadow-xs font-black" : "text-muted hover:text-text"
                      }`}
                    >
                      Tất cả chiều
                    </button>
                    <button
                      type="button"
                      onClick={() => setDirectionFilter("INCOME")}
                      className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                        directionFilter === "INCOME" ? "bg-card text-emerald-600 shadow-xs font-black" : "text-muted hover:text-text"
                      }`}
                    >
                      <ArrowDownLeft size={13} className="text-emerald-500" /> Thu vào (+)
                    </button>
                    <button
                      type="button"
                      onClick={() => setDirectionFilter("EXPENSE")}
                      className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                        directionFilter === "EXPENSE" ? "bg-card text-rose-600 shadow-xs font-black" : "text-muted hover:text-text"
                      }`}
                    >
                      <ArrowUpRight size={13} className="text-rose-500" /> Chi hoàn (-)
                    </button>
                  </div>

                  {/* Category Filter */}
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="h-9 px-2.5 rounded-xl border border-border bg-card text-xs font-bold text-text outline-none shrink-0"
                  >
                    <option value="ALL">Tất cả loại cọc & tiền</option>
                    <option value="RENT">Tiền kỳ hạn</option>
                    <option value="HOLDING_DEPOSIT">Cọc giữ chỗ</option>
                    <option value="CONTRACT_DEPOSIT">Cọc hợp đồng</option>
                    <option value="HOLDING_REFUND">Hoàn cọc giữ chỗ</option>
                    <option value="SETTLEMENT_REFUND">Tất toán hoàn cọc HĐ</option>
                  </select>
                </div>

                {/* Status Tabs & Action Buttons */}
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

                  {(search || status || directionFilter !== "ALL" || categoryFilter !== "ALL") && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearch("");
                        setStatus("");
                        setDirectionFilter("ALL");
                        setCategoryFilter("ALL");
                      }}
                      className="inline-flex items-center gap-1 rounded-xl px-2 py-1.5 text-xs font-semibold text-muted hover:text-text"
                    >
                      <X size={13} /> Xóa lọc
                    </button>
                  )}

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setCreateModalTab("INVOICE");
                        setIsCreateModalOpen(true);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-primary hover:bg-primary/90 text-white px-3.5 py-1.5 text-xs font-black shadow-xs transition-colors shrink-0"
                    >
                      <Plus size={14} /> Lập hóa đơn / Cọc
                    </button>
                  </div>
                </div>
              </div>
            </Card>

            {/* TABLE CONTAINER CARD */}
            <section data-testid="invoices-list" className="flex min-h-[480px] flex-1 flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm xl:h-full xl:min-h-0">
              <div className="min-h-0 flex-1 overflow-x-auto overflow-y-auto">
                <table className="w-full min-w-[1200px] text-left border-collapse">
                  <thead className="sticky top-0 z-10 bg-surface/90 backdrop-blur-sm text-[11px] uppercase tracking-wider text-muted shadow-[0_1px_0_var(--border)] select-none">
                    <tr>
                      <th className="w-[120px] px-3.5 py-2.5 font-black whitespace-nowrap">Mã Hóa đơn</th>
                      <th className="w-[140px] px-3.5 py-2.5 font-black whitespace-nowrap">Chiều / Loại</th>
                      <th className="w-[200px] px-3.5 py-2.5 font-black whitespace-nowrap">Khách thuê / Phòng</th>
                      <th className="w-[120px] px-3.5 py-2.5 font-black whitespace-nowrap">Kỳ hóa đơn</th>
                      <th className="w-[110px] px-3.5 py-2.5 font-black whitespace-nowrap">Hạn thanh toán</th>
                      <th className="w-[130px] px-3.5 py-2.5 text-right font-black whitespace-nowrap">Tổng tiền</th>
                      <th className="w-[110px] px-3.5 py-2.5 text-right font-black whitespace-nowrap">Đã thu/chi</th>
                      <th className="w-[110px] px-3.5 py-2.5 text-right font-black whitespace-nowrap">Còn lại</th>
                      <th className="w-[130px] px-3.5 py-2.5 font-black whitespace-nowrap">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {isLoading && (
                      <tr>
                        <td colSpan={9} className="px-4 py-12 text-center text-[13px] font-bold text-muted">
                          Đang tải danh sách hóa đơn...
                        </td>
                      </tr>
                    )}
                    {isError && (
                      <tr>
                        <td data-testid="invoices-error-state" colSpan={9} className="px-4 py-12 text-center text-[13px] font-bold text-rose-500">
                          Không tải được danh sách hóa đơn.
                        </td>
                      </tr>
                    )}
                    {!isLoading && !isError && visibleInvoices.length === 0 && (
                      <tr>
                        <td colSpan={9} className="px-4 py-12 text-center">
                          <div data-testid="empty-invoices-state" className="mx-auto flex max-w-sm flex-col items-center gap-2 rounded-2xl border border-dashed border-border bg-surface/40 px-6 py-8">
                            <Receipt size={32} className="text-muted/60" />
                            <div className="text-[14px] font-black text-text">Chưa có hóa đơn hoặc phiếu cọc phù hợp</div>
                            <div className="text-[12px] font-semibold text-muted">Thử đổi bộ lọc hoặc tạo phiếu mới.</div>
                          </div>
                        </td>
                      </tr>
                    )}
                    {!isLoading && !isError && displayedInvoices.map((invoice: any) => (
                      <InvoiceRow
                        key={invoice.id}
                        invoice={invoice}
                        onOpen={() => setSelectedInvoice(invoice)}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setContextMenu({
                            x: e.clientX,
                            y: e.clientY,
                            invoice,
                          });
                        }}
                      />
                    ))}
                  </tbody>
                </table>
              </div>

              {/* PAGINATION FOOTER */}
              <div className="mt-auto flex flex-col gap-3 border-t border-border/60 bg-surface/30 px-4 py-2.5 text-[12px] font-semibold text-muted shrink-0 sm:flex-row sm:items-center sm:justify-between">
                <span>
                  Hiển thị {visibleInvoices.length === 0 ? 0 : (page - 1) * pageSize + 1} -{" "}
                  {Math.min(page * pageSize, visibleInvoices.length)} trên {visibleInvoices.length} hóa đơn & phiếu cọc
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
                <h2 className="text-[15px] font-black text-text">Tổng quan thu chi</h2>
                <span className="rounded-xl border border-border bg-surface/60 px-2.5 py-1 text-[11px] font-bold text-muted">2 Chiều</span>
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
                    <div className="text-[18px] font-black font-mono leading-none text-text">{summary.recoveryRate.toFixed(1)}%</div>
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
                {invoices.filter((invoice: any) => invoicePaid(invoice) > 0).slice(0, 8).map((invoice: any) => {
                  const { direction } = getInvoiceTypeAndDirection(invoice);
                  return (
                    <div key={invoice.id} className="grid grid-cols-[3px_1fr_auto] gap-2.5 rounded-xl border border-border/60 bg-surface/30 p-2.5 mb-2 last:mb-0">
                      <span className={`rounded-full ${direction === "EXPENSE" ? "bg-rose-500" : "bg-emerald-500"}`} />
                      <div className="min-w-0">
                        <div className="text-[12px] font-black text-text truncate">{formatInvoiceCode(invoice)}</div>
                        <div className={`text-[11px] font-bold ${direction === "EXPENSE" ? "text-rose-600" : "text-emerald-600"}`}>
                          {direction === "EXPENSE" ? `- Hoàn ${formatVnd(invoicePaid(invoice))}` : `+ Thu ${formatVnd(invoicePaid(invoice))}`}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {invoices.filter((invoice: any) => invoicePaid(invoice) > 0).length === 0 && (
                  <div className="text-xs text-muted font-medium py-3 text-center">Chưa có giao dịch gần đây</div>
                )}
              </div>
            </section>
          </aside>
        </div>

        {/* MODAL LẬP HÓA ĐƠN & CỌC */}
        {isCreateModalOpen && (
          <InvoiceCreateModal
            isOpen={isCreateModalOpen}
            onClose={() => setIsCreateModalOpen(false)}
            defaultTab={createModalTab}
          />
        )}

        {/* DRAWER CHI TIẾT */}
        <OperationsBillingDrawer
          invoice={selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
        />

        {/* Floating Context Menu on Right Click */}
        {contextMenu && (
          <div
            style={{
              top: Math.min(contextMenu.y, (typeof window !== "undefined" ? window.innerHeight : 800) - 160),
              left: Math.min(contextMenu.x, (typeof window !== "undefined" ? window.innerWidth : 1200) - 220),
            }}
            className="fixed z-50 min-w-[200px] rounded-2xl border border-border/80 bg-card/95 p-1.5 shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-muted border-b border-border/40 font-mono">
              {formatInvoiceCode(contextMenu.invoice)}
            </div>
            <div className="flex flex-col gap-0.5 pt-1">
              <button
                type="button"
                onClick={() => {
                  const inv = contextMenu.invoice;
                  setContextMenu(null);
                  setSelectedInvoice(inv);
                }}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-[12px] font-bold text-text hover:bg-primary/10 hover:text-primary transition-colors text-left"
              >
                <Eye size={14} />
                <span>Xem chi tiết hóa đơn</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const inv = contextMenu.invoice;
                  setContextMenu(null);
                  setSelectedInvoice(inv);
                }}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-[12px] font-bold text-text hover:bg-primary/10 hover:text-primary transition-colors text-left"
              >
                <Printer size={14} />
                <span>In hóa đơn</span>
              </button>
              <div className="my-1 border-t border-border/40" />
              <button
                type="button"
                onClick={() => handleDeleteInvoice(contextMenu.invoice)}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-[12px] font-bold text-rose-600 hover:bg-rose-500/15 transition-colors text-left"
              >
                <Trash2 size={14} />
                <span>Xóa hóa đơn này</span>
              </button>
            </div>
          </div>
        )}

        {/* Delete Invoice Confirm Modal */}
        <ConfirmDialog
          isOpen={Boolean(invoiceToDelete)}
          onClose={() => setInvoiceToDelete(null)}
          onConfirm={handleConfirmDeleteInvoice}
          title="Xóa hóa đơn"
          description={`Bạn có chắc chắn muốn xóa hóa đơn "${invoiceToDelete ? formatInvoiceCode(invoiceToDelete) : ""}"? Hành động này không thể hoàn tác.`}
          confirmText="Xóa hóa đơn"
          cancelText="Hủy bỏ"
          variant="danger"
          isLoading={isDeletingInvoice}
        />
      </div>
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
}: {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  value: string;
  trend?: string;
  trendPositive?: boolean;
  highlight?: boolean;
  highlightColor?: string;
}) {
  return (
    <Card className="flex flex-col justify-between p-3 rounded-2xl border-border/60 shadow-xs bg-card">
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-[11px] font-bold text-muted uppercase tracking-wider truncate">{label}</span>
        <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xl ${iconBg}`}>{icon}</div>
      </div>
      <div>
        <div className="flex items-baseline gap-2">
          <span className="font-mono font-black text-base md:text-lg text-text leading-none truncate">
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
  onContextMenu,
}: {
  invoice: any;
  onOpen: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
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
  const customerGender = invoice.customer?.gender || (invoice.contract as any)?.customer?.gender || "";
  const cleanGender = (customerGender || "").trim().toLowerCase();
  const isFemale = cleanGender === "female" || cleanGender === "nu" || cleanGender === "nữ" || cleanGender === "gái";
  const avatarUrl = getTenantAvatar(invoice.customer?.avatar, customerName, customerGender);
  const { roomCode, buildingName } = invoiceRoom(invoice);
  const typeInfo = getInvoiceTypeAndDirection(invoice);

  return (
    <tr
      data-testid="invoice-card"
      className="group border-b border-border/40 last:border-b-0 hover:bg-surface/70 cursor-pointer transition-colors"
      onClick={onOpen}
      onContextMenu={onContextMenu}
    >
      {/* 1. MÃ HÓA ĐƠN */}
      <td className="px-3.5 py-3">
        <div className="font-mono text-[13px] font-black text-primary group-hover:underline whitespace-nowrap">{code}</div>
        <div className="text-[11px] font-medium text-muted whitespace-nowrap">{invoice.title || "Hóa đơn dịch vụ"}</div>
      </td>

      {/* 2. CHIỀU & LOẠI KHOẢN MỤC */}
      <td className="px-3.5 py-3 whitespace-nowrap">
        <div className="flex flex-col gap-1 items-start">
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
              typeInfo.direction === "EXPENSE"
                ? "bg-rose-500/10 text-rose-600 border border-rose-500/20"
                : "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
            }`}
          >
            {typeInfo.direction === "EXPENSE" ? (
              <>
                <ArrowUpRight size={11} className="text-rose-500" /> Chi hoàn (-)
              </>
            ) : (
              <>
                <ArrowDownLeft size={11} className="text-emerald-500" /> Thu vào (+)
              </>
            )}
          </span>
          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${typeInfo.badgeTone}`}>
            {typeInfo.label}
          </span>
        </div>
      </td>

      {/* 3. KHÁCH THUÊ / PHÒNG */}
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
              <span className="truncate">{buildingName || "Tòa nhà"}</span>
              <span className="text-muted/40">•</span>
              <span className="font-mono text-text truncate">{roomCode}</span>
            </div>
          </div>
        </div>
      </td>

      {/* 4. KỲ HÓA ĐƠN */}
      <td className="px-3.5 py-3 whitespace-nowrap">
        <div className="text-[13px] font-black font-mono text-text">{invoicePeriod(invoice)}</div>
        <div className="text-[11px] font-semibold text-muted">{invoice.month || "Tháng này"}</div>
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
      <td className="px-3.5 py-3 text-right text-[13px] font-black font-mono tabular-nums whitespace-nowrap">
        <span className={typeInfo.direction === "EXPENSE" ? "text-rose-600 dark:text-rose-400" : "text-text"}>
          {typeInfo.direction === "EXPENSE" ? `- ${formatVnd(total)}` : `+ ${formatVnd(total)}`}
        </span>
      </td>

      {/* 7. ĐÃ THU/CHI */}
      <td className="px-3.5 py-3 text-right text-[13px] font-bold font-mono tabular-nums whitespace-nowrap">
        <span className={typeInfo.direction === "EXPENSE" ? "text-rose-600" : "text-emerald-600 dark:text-emerald-400"}>
          {formatVnd(paid)}
        </span>
      </td>

      {/* 8. CÒN LẠI */}
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
    </tr>
  );
}

function ActionMetric({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-surface/60 px-3 py-2">
      <span className="text-[12px] font-bold text-muted">{label}</span>
      <span className={`rounded-xl px-2.5 py-1 text-[11px] font-black font-mono ${tone}`}>{value}</span>
    </div>
  );
}

function InvoiceChartTooltip({ active, payload, empty }: any) {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0];
  return (
    <div className="rounded-xl border border-border bg-card p-2 shadow-md">
      <div className="text-[11px] font-bold text-muted">{data.name}</div>
      <div className="font-mono text-[13px] font-black text-text">{empty ? "0 đ" : formatVnd(data.value)}</div>
    </div>
  );
}
