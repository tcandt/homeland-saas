"use client";

import React, { useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, History, Search } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useBankTransactionsQuery } from "@/lib/queries/finance.queries";

const formatVnd = (value: number) => `${Number(value || 0).toLocaleString("vi-VN")} Ä‘`;
const formatDateTime = (value?: string | null) => (value ? new Date(value).toLocaleString("vi-VN") : "-");

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
  const [content, setContent] = useState("");
  const [search, setSearch] = useState("");

  const params = useMemo(
    () => ({
      year,
      ...(month ? { month } : {}),
      ...(bankAccountId ? { bankAccountId } : {}),
      ...(direction ? { direction } : {}),
      ...(content.trim() ? { content: content.trim() } : {}),
      ...(search.trim() ? { search: search.trim() } : {}),
      limit: 300,
    }),
    [bankAccountId, content, direction, month, search, year],
  );

  const { data, isLoading, isError } = useBankTransactionsQuery(params);
  const rows = Array.isArray(data?.rows) ? data.rows : [];
  const bankAccounts = Array.isArray(data?.filters?.bankAccounts) ? data.filters.bankAccounts : [];

  const yearOptions = useMemo(
    () => Array.from({ length: 5 }, (_, index) => ({ value: String(currentYear - index), label: String(currentYear - index) })),
    [currentYear],
  );
  const monthOptions = [
    { value: "", label: "Cáº£ nÄƒm" },
    ...Array.from({ length: 12 }, (_, index) => ({ value: String(index + 1), label: `ThÃ¡ng ${index + 1}` })),
  ];
  const bankOptions = [
    { value: "", label: "Táº¥t cáº£ tÃ i khoáº£n" },
    ...bankAccounts.map((bank: any) => ({
      value: bank.id,
      label: `${bank.bankName} - ${maskAccountNumber(bank.accountNumber)}`,
    })),
  ];
  const directionOptions = [
    { value: "", label: "Tiá»n vÃ o/ra" },
    { value: "IN", label: "Tiá»n vÃ o" },
    { value: "OUT", label: "Tiá»n ra" },
  ];

  return (
    <section data-testid="bank-transactions-root" className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[16px] border border-border bg-card shadow-sm">
      <div className="shrink-0 border-b border-border bg-card p-[16px] md:p-[20px]">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
            <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.14em] text-[#0f766e]">
              <History size={14} />
              DÃ²ng tiá»n ngÃ¢n hÃ ng
            </div>
            <h2 className="mt-2 text-[16px] font-black text-text md:text-[18px]">Lịch sử giao dịch</h2>
            <p className="mt-1 text-[12px] font-medium text-muted md:text-[13px]">
              Theo dõi giao dịch vào/ra, mã đối soát và trạng thái match theo từng tài khoản.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:min-w-[960px] xl:grid-cols-[minmax(170px,1.2fr)_minmax(170px,1.2fr)_90px_120px_160px_120px] 2xl:min-w-[1180px] 2xl:grid-cols-[minmax(220px,1.2fr)_minmax(220px,1.2fr)_100px_140px_190px_140px]">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <Input data-testid="bank-transactions-content-filter" value={content} onChange={(event) => setContent(event.target.value)} placeholder="Lọc theo nội dung..." className="pl-9" />
            </div>
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <Input data-testid="bank-transactions-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm mã giao dịch, tài khoản..." className="pl-9" />
            </div>
            <Select data-testid="bank-transactions-year" value={year} onChange={(event) => setYear(event.target.value)} options={yearOptions} />
            <Select data-testid="bank-transactions-month" value={month} onChange={(event) => setMonth(event.target.value)} options={monthOptions} />
            <Select data-testid="bank-transactions-account" value={bankAccountId} onChange={(event) => setBankAccountId(event.target.value)} options={bankOptions} />
            <Select data-testid="bank-transactions-direction" value={direction} onChange={(event) => setDirection(event.target.value)} options={directionOptions} />
          </div>
        </div>
      </div>

      <div data-testid="bank-transactions-kpis" className="grid shrink-0 grid-cols-2 gap-3 border-b border-border bg-card p-[16px] md:grid-cols-4 md:p-[20px]">
        <Metric label="Giao dá»‹ch" value={data?.summary?.total || 0} />
        <Metric label="Tiá»n vÃ o" value={formatVnd(data?.summary?.inflow || 0)} tone="income" />
        <Metric label="Tiá»n ra" value={formatVnd(data?.summary?.outflow || 0)} tone="expense" />
        <Metric label="ChÃªnh lá»‡ch" value={formatVnd(data?.summary?.net || 0)} tone={Number(data?.summary?.net || 0) >= 0 ? "income" : "expense"} />
      </div>

      {isLoading && <div data-testid="bank-transactions-loading" className="flex min-h-0 flex-1 items-center justify-center p-8 text-center text-[13px] font-semibold text-muted">Đang tải lịch sử giao dịch...</div>}
      {isError && <div data-testid="bank-transactions-error" className="flex min-h-0 flex-1 items-center justify-center p-8 text-center text-[13px] font-semibold text-rose-500">Không tải được lịch sử giao dịch ngân hàng.</div>}

      {!isLoading && !isError && (
        <div data-testid="bank-transactions-table-wrap" className="min-h-0 flex-1 overflow-auto">
          <table data-testid="bank-transactions-table" className="w-full min-w-[1180px] text-left text-sm">
            <thead className="sticky top-0 z-10 bg-surface text-[11px] uppercase text-muted shadow-[0_1px_0_var(--border)]">
              <tr>
                <th className="px-4 py-3 font-black">Thá»i Ä‘iá»ƒm</th>
                <th className="px-4 py-3 font-black">Loáº¡i</th>
                <th className="px-4 py-3 font-black">TÃ i khoáº£n</th>
                <th className="px-4 py-3 font-black">Ná»™i dung</th>
                <th className="px-4 py-3 font-black">MÃ£ Ä‘á»‘i soÃ¡t</th>
                <th className="px-4 py-3 text-right font-black">Sá»‘ tiá»n</th>
                <th className="px-4 py-3 font-black">Tráº¡ng thÃ¡i</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td data-testid="bank-transactions-empty" colSpan={7} className="px-4 py-8 text-center text-[13px] font-semibold text-muted">
                    Chưa có giao dịch ngân hàng phù hợp bộ lọc.
                  </td>
                </tr>
              )}
              {rows.map((row: any) => {
                const isInflow = row.direction === "IN";
                return (
                  <tr key={row.id} data-testid={`bank-transaction-row-${row.id}`} className="border-t border-border">
                    <td className="px-4 py-3 text-[12px] font-semibold text-muted">{formatDateTime(row.createdAt)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-black ${isInflow ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                        {isInflow ? <ArrowDownLeft size={12} /> : <ArrowUpRight size={12} />}
                        {isInflow ? "Tiá»n vÃ o" : "Tiá»n ra"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-black text-text">{row.bankAccount?.bankName || "-"}</div>
                      <div className="mt-1 text-[12px] font-semibold text-muted">
                        {row.bankAccount?.accountName || "-"} Â· {maskAccountNumber(row.bankAccount?.accountNumber)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="line-clamp-2 max-w-[420px] font-bold text-text">{row.content || "-"}</div>
                      <div className="mt-1 text-[11px] text-muted">{row.owner?.name || "ChÆ°a xÃ¡c Ä‘á»‹nh owner"}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-black text-text">{row.paymentCode || "-"}</div>
                      <div className="mt-1 text-[11px] text-muted">{row.providerTransactionId || row.reference || "-"}</div>
                    </td>
                    <td className={`px-4 py-3 text-right font-black ${isInflow ? "text-[#059669]" : "text-[#dc2626]"}`}>
                      {isInflow ? "+" : "-"}{formatVnd(row.amount)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-1 text-[11px] font-black ${row.match ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-600"}`}>
                        {row.match ? row.match.status : "ChÆ°a match"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Metric({ label, value, tone }: { label: string; value: React.ReactNode; tone?: "income" | "expense" }) {
  const valueClass = tone === "income" ? "text-[#059669]" : tone === "expense" ? "text-[#dc2626]" : "text-text";
  return (
    <div className="rounded-[14px] border border-border bg-surface p-3">
      <div className="text-[10px] font-black uppercase tracking-wide text-muted">{label}</div>
      <div className={`mt-2 text-[16px] font-black ${valueClass}`}>{value}</div>
    </div>
  );
}
