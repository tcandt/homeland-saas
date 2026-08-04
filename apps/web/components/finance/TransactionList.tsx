"use client";

import React from "react";
import { ArrowDownRight, ArrowUpRight, Loader2, Search } from "lucide-react";
import dayjs from "dayjs";
import { useLedgerQuery } from "@/lib/queries/finance.queries";

function formatMoney(amount: number) {
  return amount.toLocaleString("vi-VN");
}

function getAmount(row: any) {
  return Number(row.debit || 0) - Number(row.credit || 0);
}

export default function TransactionList() {
  const { data: transactions, isLoading, isError } = useLedgerQuery();
  const rows = transactions || [];

  return (
    <div className="flex flex-col">
      <div className="md:bg-card md:border md:border-border/50 md:rounded-2xl md:shadow-sm md:overflow-hidden flex flex-col md:p-6 mb-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-[16px] font-black text-text">Giao dịch gần đây</h3>
            <p className="text-[12px] font-medium text-muted mt-1">Lịch sử thu chi từ ledger trong DB</p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex flex-1 md:flex-none items-center gap-2 px-3 py-1.5 bg-black/5 dark:bg-white/5 border border-border rounded-[10px]">
              <Search size={14} className="text-muted" />
              <input
                type="text"
                placeholder="Tìm giao dịch..."
                className="bg-transparent border-0 outline-none text-[12px] font-medium text-text w-full md:w-[150px] placeholder:text-muted"
              />
            </div>
            <button className="flex items-center justify-center w-[34px] h-[34px] border border-border rounded-[10px] bg-card hover:bg-black/5 transition-colors">
              <FilterIcon />
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex h-[180px] items-center justify-center text-muted">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : isError ? (
          <div className="rounded-[12px] border border-rose-500/20 bg-rose-500/10 p-4 text-[13px] font-bold text-rose-500">
            Không tải được dữ liệu giao dịch.
          </div>
        ) : rows.length === 0 ? (
          <div data-testid="empty-transaction-state" className="rounded-[12px] border border-border bg-black/5 p-5 text-center text-[13px] font-medium text-muted dark:bg-white/5">
            Chưa có giao dịch nào trong DB.
          </div>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto mt-4 -mx-6 mb-[-24px]">
              <table className="w-full text-left border-collapse">
                <thead className="bg-muted/30">
                  <tr>
                    <th className="py-4 px-5 pl-6 text-[11px] font-bold text-muted uppercase tracking-wider w-[120px]">Mã GD</th>
                    <th className="py-4 px-5 text-[11px] font-bold text-muted uppercase tracking-wider w-[120px]">Ngày</th>
                    <th className="py-4 px-5 text-[11px] font-bold text-muted uppercase tracking-wider">Nội dung</th>
                    <th className="py-4 px-5 text-[11px] font-bold text-muted uppercase tracking-wider w-[120px]">Tài khoản</th>
                    <th className="py-4 px-5 text-[11px] font-bold text-muted uppercase tracking-wider text-right w-[140px]">Số tiền</th>
                    <th className="py-4 px-5 pr-6 text-[11px] font-bold text-muted uppercase tracking-wider text-right w-[120px]">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50 bg-card">
                  {rows.map((txn: any) => {
                    const amount = getAmount(txn);
                    const isIncome = amount >= 0;
                    return (
                      <tr key={txn.id} className="group hover:bg-muted/10 transition-colors cursor-pointer">
                        <td className="py-4 px-5 pl-6 text-[13px] font-bold text-text">{txn.journalCode || txn.id}</td>
                        <td className="py-4 px-5 text-[13px] font-medium text-muted">{dayjs(txn.date).format("DD/MM/YYYY")}</td>
                        <td className="py-4 px-5 text-[13px] font-bold text-text group-hover:text-[#4f46e5] transition-colors">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border ${isIncome ? "bg-[#22c55e]/10 border-[#22c55e]/20 text-[#22c55e]" : "bg-[#ef4444]/10 border-[#ef4444]/20 text-[#ef4444]"}`}>
                              {isIncome ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                            </div>
                            <span>{txn.description || txn.journalCode}</span>
                          </div>
                        </td>
                        <td className="py-4 px-5">
                          <span className="px-2.5 py-1 bg-muted/10 text-text rounded-[6px] text-[11px] font-bold">{txn.accountCode || "N/A"}</span>
                        </td>
                        <td className="py-4 px-5 text-right">
                          <div className={`flex items-center justify-end gap-1 text-[14px] font-black ${isIncome ? "text-[#22c55e]" : "text-[#ef4444]"}`}>
                            {isIncome ? "+" : "-"}{formatMoney(Math.abs(amount))}
                          </div>
                        </td>
                        <td className="py-4 px-5 pr-6 text-right">
                          <StatusBadge status={txn.status || "DRAFT"} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex md:hidden flex-col gap-3">
              {rows.slice(0, 20).map((txn: any) => {
                const amount = getAmount(txn);
                const isIncome = amount >= 0;
                return (
                  <div key={txn.id} className="flex flex-col gap-3 p-4 bg-black/5 dark:bg-white/5 rounded-[14px] border border-border">
                    <div className="flex items-center justify-between">
                      <div className="flex min-w-0 items-center gap-2">
                        <div className={`w-8 h-8 rounded-[8px] flex items-center justify-center shrink-0 ${isIncome ? "bg-[#22c55e]/10 text-[#22c55e]" : "bg-[#ef4444]/10 text-[#ef4444]"}`}>
                          {isIncome ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-[13px] font-bold text-text">{txn.description || txn.journalCode}</div>
                          <div className="text-[11px] font-medium text-muted mt-0.5">{dayjs(txn.date).format("DD/MM/YYYY")} - {txn.journalCode || txn.id}</div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className={`text-[14px] font-black ${isIncome ? "text-[#22c55e]" : "text-[#ef4444]"}`}>
                          {isIncome ? "+" : "-"}{formatMoney(Math.abs(amount))}
                        </div>
                        <div className="mt-1 flex justify-end">
                          <StatusBadge status={txn.status || "DRAFT"} />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const isPosted = status === "POSTED";
  return (
    <span className={`inline-block px-2 py-1 border rounded-[6px] text-[10px] font-bold whitespace-nowrap ${isPosted ? "bg-[#22c55e]/10 text-[#22c55e] border-[#22c55e]/20" : "bg-[#f97316]/10 text-[#f97316] border-[#f97316]/20"}`}>
      {status}
    </span>
  );
}

function FilterIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text">
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
    </svg>
  );
}
