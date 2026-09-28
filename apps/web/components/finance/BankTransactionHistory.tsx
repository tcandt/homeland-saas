"use client";

import React, { useMemo, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  History,
  Search,
  RefreshCw,
  XCircle,
  AlertTriangle,
  CreditCard,
  Building2,
  CheckCircle2,
  ChevronRight,
  Clock,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useBankTransactionsQuery } from "@/lib/queries/finance.queries";

const formatVnd = (value: number) => `${Number(value || 0).toLocaleString("vi-VN")} đ`;

const statusTones = {
  success: "bg-emerald-500/10 text-emerald-700 border-emerald-500/25 dark:text-emerald-400",
  warning: "bg-amber-500/10 text-amber-800 border-amber-500/25 dark:text-amber-400",
  danger: "bg-rose-500/10 text-rose-700 border-rose-500/25 dark:text-rose-400",
  pending: "bg-sky-500/10 text-sky-700 border-sky-500/25 dark:text-sky-400",
  neutral: "bg-slate-500/10 text-slate-600 border-slate-500/25 dark:text-slate-300",
};

const transactionStatuses: Record<string, { label: string; tone: keyof typeof statusTones; icon: typeof Clock }> = {
  MATCHED: { label: "Đã khớp", tone: "success", icon: CheckCircle2 },
  NEEDS_REVIEW: { label: "Cần kiểm tra", tone: "warning", icon: AlertTriangle },
  FAILED: { label: "Xử lý thất bại", tone: "danger", icon: XCircle },
  UNMATCHED: { label: "Chưa khớp", tone: "warning", icon: AlertTriangle },
  PENDING_REQUEST: { label: "Chờ xác nhận", tone: "pending", icon: Clock },
  IGNORED: { label: "Đã bỏ qua", tone: "neutral", icon: XCircle },
  RECEIVED: { label: "Đã tiếp nhận", tone: "pending", icon: Clock },
  PROCESSING: { label: "Đang xử lý", tone: "pending", icon: RefreshCw },
  PROCESSED: { label: "Đã xử lý", tone: "success", icon: CheckCircle2 },
};

const getTransactionStatus = (status?: string | null) => transactionStatuses[status || ""] || {
  label: "Chưa xác định", tone: "neutral" as const, icon: Clock,
};

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString("vi-VN");
}

function getRelativeTime(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diffSec < 60) return "Vừa xong";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} phút trước`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} giờ trước`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 30) return `${diffDay} ngày trước`;
  return date.toLocaleDateString("vi-VN");
}

function maskAccountNumber(value?: string) {
  if (!value) return "-";
  if (value.length <= 4) return value;
  return `${"*".repeat(Math.max(0, value.length - 4))}${value.slice(-4)}`;
}

export default function BankTransactionHistory() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(String(currentYear));
  const [month, setMonth] = useState("");
  const [bankAccountId, setBankAccountId] = useState("");
  const [direction, setDirection] = useState("");
  const [matchStatus, setMatchStatus] = useState("");
  const [search, setSearch] = useState("");
  const [contentFilter, setContentFilter] = useState("");
  const [selectedTransaction, setSelectedTransaction] = useState<any | null>(null);

  const params = useMemo(
    () => ({
      year,
      ...(month ? { month } : {}),
      ...(bankAccountId ? { bankAccountId } : {}),
      ...(direction ? { direction } : {}),
      ...(matchStatus ? { matchStatus } : {}),
      ...(search.trim() ? { search: search.trim() } : {}),
      ...(contentFilter.trim() ? { content: contentFilter.trim() } : {}),
      limit: 300,
    }),
    [bankAccountId, contentFilter, direction, matchStatus, month, search, year],
  );

  const { data, isLoading, isError, refetch, isFetching } = useBankTransactionsQuery(params);
  const rows = Array.isArray(data?.rows) ? data.rows : [];
  const bankAccounts = Array.isArray(data?.filters?.bankAccounts) ? data.filters.bankAccounts : [];

  const yearOptions = useMemo(
    () =>
      Array.from({ length: 5 }, (_, index) => ({
        value: String(currentYear - index),
        label: `Năm ${currentYear - index}`,
      })),
    [currentYear],
  );

  const monthOptions = [
    { value: "", label: "Cả năm" },
    ...Array.from({ length: 12 }, (_, index) => ({
      value: String(index + 1),
      label: `Tháng ${index + 1}`,
    })),
  ];

  const bankOptions = [
    { value: "", label: "Tất cả tài khoản" },
    ...bankAccounts.map((bank: any) => ({
      value: bank.id,
      label: `${bank.bankName} - ${maskAccountNumber(bank.accountNumber)}`,
    })),
  ];

  const directionOptions = [
    { value: "", label: "Tất cả dòng tiền" },
    { value: "IN", label: "Tiền vào (Thu)" },
    { value: "OUT", label: "Tiền ra (Chi)" },
  ];

  const matchOptions = [
    { value: "", label: "Tất cả trạng thái đối soát" },
    ...((Array.isArray(data?.filters?.matchStatuses) ? data.filters.matchStatuses : []) as Array<{ value: string; label: string }>).map((option) => ({ ...option, label: getTransactionStatus(option.value).label })),
  ];

  return (
    <div data-testid="bank-transactions-root" className="flex flex-col gap-2.5 h-full w-full">
      {/* 1. 4-CARD COMPACT KPI GRID */}
      <div data-testid="bank-transactions-kpis" className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-2.5 shrink-0">
        <KpiCard
          title="Tổng giao dịch"
          tone="sky"
          value={String(data?.summary?.total || 0)}
          subtext="Lượt biến động số dư"
          icon={<History size={16} className="text-sky-700 dark:text-sky-400" />}
          iconBg="bg-sky-500/10 border border-sky-500/20"
        />
        <KpiCard
          title="Tổng tiền vào"
          tone="emerald"
          value={formatVnd(data?.summary?.inflow || 0)}
          subtext="Dòng tiền thu ngân hàng"
          icon={<ArrowDownLeft size={16} className="text-emerald-600 dark:text-emerald-400" />}
          iconBg="bg-emerald-500/10 border border-emerald-500/20"
          valueColor="text-emerald-600 dark:text-emerald-400"
        />
        <KpiCard
          title="Tổng tiền ra"
          tone="rose"
          value={formatVnd(data?.summary?.outflow || 0)}
          subtext="Dòng tiền chi ngân hàng"
          icon={<ArrowUpRight size={16} className="text-rose-600 dark:text-rose-400" />}
          iconBg="bg-rose-500/10 border border-rose-500/20"
          valueColor="text-rose-600 dark:text-rose-400"
        />
        <KpiCard
          title="Dòng tiền thuần"
          tone="amber"
          value={formatVnd(data?.summary?.net ?? ((data?.summary?.inflow || 0) - (data?.summary?.outflow || 0)))}
          subtext={
            Number(data?.summary?.needsReview || 0) > 0
              ? `${data?.summary?.needsReview} giao dịch cần kiểm tra`
              : "Tiền vào trừ tiền ra"
          }
          icon={<CreditCard size={16} className="text-amber-700 dark:text-amber-400" />}
          iconBg="bg-amber-500/10 border border-amber-500/20"
        />
      </div>

      {/* 2. UNIFIED SLIM FILTER & SEARCH BAR */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 shrink-0">
        {/* Left search */}
        <div className="flex items-center gap-2 flex-1 min-w-[320px]">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
            <input
              data-testid="bank-transactions-search"
              type="search"
              name="bank_tx_search_query"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tìm theo nội dung, mã, STK..."
              className="h-9 w-full rounded-xl border border-border/70 bg-card pl-8 pr-7 text-xs font-semibold text-text placeholder:text-muted focus:border-primary focus:outline-none transition-colors shadow-2xs"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-text p-0.5"
              >
                <XCircle size={13} />
              </button>
            )}
          </div>
          <div className="relative w-44 shrink-0">
            <input
              data-testid="bank-transactions-content-filter"
              type="search"
              name="bank_tx_content_filter"
              value={contentFilter}
              onChange={(event) => setContentFilter(event.target.value)}
              placeholder="Lọc nội dung..."
              className="h-9 w-full rounded-xl border border-border/70 bg-card px-3 text-xs font-semibold text-text placeholder:text-muted focus:border-primary focus:outline-none transition-colors shadow-2xs"
            />
          </div>
        </div>

        {/* Right dropdown filters */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            data-testid="bank-transactions-year"
            value={year}
            onChange={(event) => setYear(event.target.value)}
            className="h-9 rounded-xl border border-border/70 bg-card px-2.5 text-xs font-bold text-text outline-none cursor-pointer hover:border-primary/50 transition-colors shadow-2xs"
          >
            {yearOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <select
            data-testid="bank-transactions-month"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
            className="h-9 rounded-xl border border-border/70 bg-card px-2.5 text-xs font-bold text-text outline-none cursor-pointer hover:border-primary/50 transition-colors shadow-2xs"
          >
            {monthOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <select
            data-testid="bank-transactions-account"
            value={bankAccountId}
            onChange={(event) => setBankAccountId(event.target.value)}
            className="h-9 rounded-xl border border-border/70 bg-card px-2.5 text-xs font-bold text-text outline-none cursor-pointer hover:border-primary/50 transition-colors shadow-2xs max-w-[200px]"
          >
            {bankOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <select
            data-testid="bank-transactions-direction"
            value={direction}
            onChange={(event) => setDirection(event.target.value)}
            className="h-9 rounded-xl border border-border/70 bg-card px-2.5 text-xs font-bold text-text outline-none cursor-pointer hover:border-primary/50 transition-colors shadow-2xs"
          >
            {directionOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <select
            data-testid="bank-transactions-match-status"
            value={matchStatus}
            onChange={(event) => setMatchStatus(event.target.value)}
            className="h-9 rounded-xl border border-border/70 bg-card px-2.5 text-xs font-bold text-text outline-none cursor-pointer hover:border-primary/50 transition-colors shadow-2xs"
          >
            {matchOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="h-9 rounded-xl border-border/70 bg-card hover:bg-muted/10 text-xs font-bold shadow-2xs"
          >
            <RefreshCw size={13} className={`mr-1.5 ${isFetching ? "animate-spin text-primary" : "text-muted"}`} />
            Làm mới
          </Button>
        </div>
      </div>

      {/* 3. HIGH-DENSITY TRANSACTIONS TABLE */}
      <div className="flex-1 min-h-0 overflow-hidden rounded-xl border border-border/70 bg-card shadow-2xs flex flex-col">
        <div data-testid="bank-transactions-table-wrap" className="overflow-auto flex-1">
          <table data-testid="bank-transactions-table" className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 z-10 bg-card border-b border-border/70 text-[10px] font-black uppercase tracking-wider text-muted select-none">
              <tr>
                <th className="py-2.5 px-3.5 w-[160px]">Thời điểm</th>
                <th className="py-2.5 px-3.5 w-[110px]">Loại</th>
                <th className="py-2.5 px-3.5 w-[220px]">Tài khoản ngân hàng</th>
                <th className="py-2.5 px-3.5">Nội dung giao dịch</th>
                <th className="py-2.5 px-3.5 w-[160px]">Mã đối soát</th>
                <th className="py-2.5 px-3.5 w-[140px] text-right">Số tiền</th>
                <th className="py-2.5 px-3.5 w-[150px] text-center">Trạng thái đối soát</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {isLoading && (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-muted font-bold">
                    <RefreshCw size={20} className="animate-spin mx-auto mb-2 text-primary" />
                    Đang tải lịch sử giao dịch ngân hàng...
                  </td>
                </tr>
              )}

              {!isLoading && isError && (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-rose-500 font-bold">
                    <AlertTriangle size={20} className="mx-auto mb-2" />
                    Không tải được lịch sử giao dịch ngân hàng.
                  </td>
                </tr>
              )}

              {!isLoading && !isError && rows.length === 0 && (
                <tr>
                  <td data-testid="bank-transactions-empty" colSpan={7} className="py-16 text-center text-muted font-semibold">
                    <History size={28} className="mx-auto mb-2 text-muted/30" />
                    Chưa có giao dịch ngân hàng phù hợp bộ lọc.
                  </td>
                </tr>
              )}

              {rows.map((row: any) => {
                const isInflow = row.direction === "IN";
                const status = getTransactionStatus(row.reviewStatus || "UNMATCHED");
                const StatusIcon = status.icon;
                const processingStatus = row.webhookStatus ? getTransactionStatus(row.webhookStatus) : null;

                return (
                  <tr
                    key={row.id}
                    data-testid={`bank-transaction-row-${row.id}`}
                    role="button"
                    tabIndex={0}
                    aria-label={`Xem chi tiết giao dịch ${row.paymentCode || row.providerTransactionId || row.id}`}
                    onClick={() => setSelectedTransaction(row)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedTransaction(row);
                      }
                    }}
                    className="cursor-pointer transition-colors hover:bg-primary/[0.035] focus-visible:bg-primary/[0.06] focus-visible:outline-none"
                  >
                    {/* Thời điểm */}
                    <td className="py-2.5 px-3.5 whitespace-nowrap">
                      <div className="font-bold text-text flex items-center gap-1.5 leading-tight">
                        <Clock size={11} className="text-primary shrink-0" />
                        {formatDateTime(row.createdAt)}
                      </div>
                      <div className="text-[10px] text-muted mt-0.5 font-medium">
                        {getRelativeTime(row.createdAt)}
                      </div>
                    </td>

                    {/* Loại */}
                    <td className="py-2.5 px-3.5 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-black uppercase border ${
                          isInflow
                            ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                            : "bg-rose-500/10 text-rose-600 border-rose-500/20"
                        }`}
                      >
                        {isInflow ? <ArrowDownLeft size={11} /> : <ArrowUpRight size={11} />}
                        {isInflow ? "Tiền vào" : "Tiền ra"}
                      </span>
                    </td>

                    {/* Tài khoản */}
                    <td className="py-2.5 px-3.5">
                      <div className="font-bold text-text flex items-center gap-1.5 leading-tight">
                        <CreditCard size={12} className="text-muted shrink-0" />
                        {row.bankAccount?.bankName || "-"}
                      </div>
                      <div className="text-[11px] font-mono text-muted mt-0.5 truncate">
                        {row.bankAccount?.accountName || "-"} · {maskAccountNumber(row.bankAccount?.accountNumber)}
                      </div>
                      {row.bankAccount?.isLinked && (
                        <div className="text-[10px] text-emerald-600 font-bold flex items-center gap-1 mt-0.5">
                          <Zap size={10} /> Đồng bộ SePay
                        </div>
                      )}
                    </td>

                    {/* Nội dung */}
                    <td className="py-2.5 px-3.5 max-w-[340px]">
                      <div className="font-bold text-text line-clamp-2 leading-relaxed">
                        {row.content || "-"}
                      </div>
                      {row.owner?.name && (
                        <div className="text-[10px] text-muted mt-0.5 flex items-center gap-1">
                          <Building2 size={10} /> {row.owner.name}
                        </div>
                      )}
                    </td>

                    {/* Mã đối soát */}
                    <td className="py-2.5 px-3.5 whitespace-nowrap">
                      <div className="font-mono font-bold text-text text-xs">
                        {row.paymentCode || "-"}
                      </div>
                      <div className="text-[10px] font-mono text-muted truncate mt-0.5">
                        {row.providerTransactionId || row.reference || "-"}
                      </div>
                    </td>

                    {/* Số tiền */}
                    <td
                      className={`py-2.5 px-3.5 text-right font-mono font-black text-sm whitespace-nowrap ${
                        isInflow ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                      }`}
                    >
                      {isInflow ? "+" : "-"}
                      {formatVnd(row.amount)}
                    </td>

                    {/* Trạng thái match */}
                    <td className="py-2.5 px-3.5 text-center whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-bold border ${statusTones[status.tone]}`}
                      >
                        <StatusIcon size={12} aria-hidden="true" />
                        {status.label}
                        <ChevronRight size={12} aria-hidden="true" />
                      </span>
                      {processingStatus && processingStatus.label !== status.label && (
                        <div className="text-[10px] text-muted mt-1">
                          {processingStatus.label}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer info */}
        <div className="px-3.5 py-2 border-t border-border/60 bg-muted/5 flex items-center justify-between text-[11px] text-muted font-medium shrink-0">
          <span>Hiển thị <b>{rows.length}</b> giao dịch ngân hàng</span>
          <span className="text-[10px]">Nhấn vào một hàng để xem chi tiết</span>
        </div>
      </div>

      <Modal
        isOpen={!!selectedTransaction}
        onClose={() => setSelectedTransaction(null)}
        title="Chi tiết giao dịch ngân hàng"
        maxWidth="max-w-2xl"
        testId="bank-transaction-detail-modal"
        footer={<Button onClick={() => setSelectedTransaction(null)}>Đóng</Button>}
      >
        {selectedTransaction && (() => {
          const isInflow = selectedTransaction.direction === "IN";
          const status = getTransactionStatus(selectedTransaction.reviewStatus || "UNMATCHED");
          const StatusIcon = status.icon;

          return (
            <div className="space-y-4">
              <div className={`rounded-xl border p-4 ${isInflow ? "border-emerald-500/20 bg-emerald-500/[0.06]" : "border-rose-500/20 bg-rose-500/[0.06]"}`}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-wider text-muted">{isInflow ? "Tiền vào" : "Tiền ra"}</div>
                    <div className={`mt-1 font-mono text-2xl font-black ${isInflow ? "text-emerald-600" : "text-rose-600"}`}>
                      {isInflow ? "+" : "-"}{formatVnd(selectedTransaction.amount)}
                    </div>
                  </div>
                  <span className={`inline-flex w-fit items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-black ${statusTones[status.tone]}`}>
                    <StatusIcon size={14} aria-hidden />
                    {status.label}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <BankDetail label="Thời điểm" value={formatDateTime(selectedTransaction.createdAt)} />
                <BankDetail label="Ngân hàng" value={selectedTransaction.bankAccount?.bankName || "Chưa xác định"} />
                <BankDetail label="Chủ tài khoản" value={selectedTransaction.bankAccount?.accountName || "Chưa xác định"} />
                <BankDetail label="Số tài khoản" value={maskAccountNumber(selectedTransaction.bankAccount?.accountNumber)} mono />
                <BankDetail label="Mã thanh toán" value={selectedTransaction.paymentCode || "Chưa có"} mono />
                <BankDetail label="Mã giao dịch ngân hàng" value={selectedTransaction.providerTransactionId || selectedTransaction.reference || "Chưa có"} mono />
              </div>

              <div className="rounded-xl border border-border/70 bg-surface/60 p-4">
                <div className="text-[10px] font-black uppercase tracking-wider text-muted">Nội dung chuyển khoản</div>
                <div className="mt-2 whitespace-pre-wrap break-words text-sm font-bold leading-6 text-text">{selectedTransaction.content || "Không có nội dung"}</div>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <BankDetail label="Nguồn dữ liệu" value={selectedTransaction.bankAccount?.isLinked ? "Đồng bộ SePay" : "Ngân hàng"} />
                <BankDetail label="Trạng thái webhook" value={getTransactionStatus(selectedTransaction.webhookStatus).label} />
                {selectedTransaction.owner?.name && <BankDetail label="Chủ thể liên quan" value={selectedTransaction.owner.name} />}
                {selectedTransaction.reference && <BankDetail label="Mã tham chiếu" value={selectedTransaction.reference} mono />}
              </div>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}

function BankDetail({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-xl border border-border/70 bg-card p-3">
      <div className="text-[10px] font-black uppercase tracking-wider text-muted">{label}</div>
      <div className={`mt-1 break-words text-xs font-black text-text ${mono ? "font-mono" : ""}`}>{value}</div>
    </div>
  );
}

function KpiCard({
  tone,
  title,
  value,
  subtext,
  icon,
  iconBg,
  valueColor,
  highlight,
  highlightColor,
}: {
  tone: "sky" | "emerald" | "rose" | "amber";
  title: string;
  value: string;
  subtext?: string;
  icon: React.ReactNode;
  iconBg: string;
  valueColor?: string;
  highlight?: boolean;
  highlightColor?: string;
}) {
  const cardTones = {
    sky: "border-sky-500/25 bg-sky-500/5",
    emerald: "border-emerald-500/25 bg-emerald-500/5",
    rose: "border-rose-500/25 bg-rose-500/5",
    amber: "border-amber-500/25 bg-amber-500/5",
  };
  return (
    <div className={`flex items-center gap-3 rounded-xl border px-3.5 py-2.5 shadow-2xs ${cardTones[tone]}`}>
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
        {icon}
      </div>

      <div className="min-w-0 flex-1">
        <div className="text-[10px] md:text-[11px] font-bold text-muted uppercase tracking-wider truncate leading-tight mb-0.5">
          {title}
        </div>
        <div className="flex items-baseline gap-2">
          <span className={`font-mono font-black text-[16px] md:text-[18px] leading-none ${valueColor || "text-text"}`}>
            {value}
          </span>
        </div>
        {subtext && (
          <span className={`text-[10px] md:text-[11px] font-medium truncate block mt-0.5 ${highlight ? highlightColor || "text-rose-500" : "text-muted"}`}>
            {subtext}
          </span>
        )}
      </div>
    </div>
  );
}
