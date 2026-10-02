"use client";

import React from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookOpenCheck,
  Receipt,
  Sparkles,
} from "lucide-react";
import { formatVnd } from "@/lib/utils/format";

interface FinancialCommandLedgerProps {
  onOpenReconciliation?: () => void;
}

export default function FinancialCommandLedger({
  onOpenReconciliation,
}: FinancialCommandLedgerProps) {
  const displayRows = [
    {
      id: "1",
      code: "JE-INVOICE-1790023838120",
      time: "01/10/26 10:03",
      type: "Doanh thu hóa đơn",
      typeColor: "text-purple-600 dark:text-purple-400 bg-purple-500/10",
      content: "Doanh thu hóa đơn 4000 - Rental Revenue",
      building: "LK01.31",
      income: 0,
      expense: 4100000,
      status: "POSTED",
    },
    {
      id: "2",
      code: "JE-INVOICE-1790023838120",
      time: "01/10/26 10:03",
      type: "Thu tiền",
      typeColor: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10",
      content: "Tiền vào ngân hàng 1120 - Bank",
      building: "LK01.31",
      income: 4100000,
      expense: 0,
      status: "POSTED",
    },
    {
      id: "3",
      code: "JE-INVOICE-1790019924877",
      time: "01/10/26 08:58",
      type: "Doanh thu hóa đơn",
      typeColor: "text-purple-600 dark:text-purple-400 bg-purple-500/10",
      content: "Doanh thu hóa đơn 4000 - Rental Revenue",
      building: "LK01.31",
      income: 0,
      expense: 4865353,
      status: "POSTED",
    },
    {
      id: "4",
      code: "JE-INVOICE-1790019924877",
      time: "01/10/26 08:58",
      type: "Thu tiền",
      typeColor: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10",
      content: "Tiền vào ngân hàng 1120 - Bank",
      building: "LK01.31",
      income: 4865353,
      expense: 0,
      status: "POSTED",
    },
  ];

  return (
    <section
      data-testid="finance-ledger-section"
      className="grid grid-cols-1 gap-3 lg:grid-cols-12"
    >
      {/* Left: Sổ kế toán & kiểm soát ghi sổ (8 cols) */}
      <div className="flex flex-col justify-between overflow-hidden rounded-xl border border-border/70 bg-card p-4 shadow-2xs transition-all hover:border-border hover:shadow-xs lg:col-span-8">
        {/* Slim Header */}
        <div className="flex items-center justify-between border-b border-border/40 pb-2.5">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <Receipt size={13} />
            </span>
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-text">
                Sổ kế toán & kiểm soát ghi sổ
              </h2>
              <p className="text-[11px] text-muted">
                Danh sách giao dịch gần đây được ghi nhận vào sổ kế toán
              </p>
            </div>
          </div>

          <Link
            href="/finance/transactions"
            className="flex items-center gap-0.5 text-xs font-semibold text-primary hover:underline"
          >
            <span>Xem tất cả</span>
            <ArrowRight size={11} />
          </Link>
        </div>

        {/* Compact Table */}
        <div className="overflow-x-auto py-1">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-surface/40 text-[10px] uppercase font-bold text-muted border-b border-border/40">
              <tr>
                <th className="px-2.5 py-2">#</th>
                <th className="px-2.5 py-2">Thời gian</th>
                <th className="px-2.5 py-2">Loại giao dịch</th>
                <th className="px-2.5 py-2">Nội dung</th>
                <th className="px-2.5 py-2">Tòa nhà / Phòng</th>
                <th className="px-2.5 py-2 text-right">Thu</th>
                <th className="px-2.5 py-2 text-right">Chi</th>
                <th className="px-2.5 py-2">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {displayRows.map((row) => (
                <tr key={row.id} className="hover:bg-surface/30 transition">
                  <td className="px-2.5 py-2 font-mono text-muted text-[11px]">{row.id}</td>
                  <td className="px-2.5 py-2 text-muted font-mono text-[10px] whitespace-nowrap">
                    <div>{row.code}</div>
                    <div className="opacity-75">{row.time}</div>
                  </td>
                  <td className="px-2.5 py-2">
                    <span
                      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.2 text-[9px] font-semibold ${row.typeColor}`}
                    >
                      <span className="h-1 w-1 rounded-full bg-current" />
                      {row.type}
                    </span>
                  </td>
                  <td className="px-2.5 py-2 text-text font-medium truncate max-w-[180px] text-[11px]">
                    {row.content}
                  </td>
                  <td className="px-2.5 py-2 font-bold text-text text-[11px]">{row.building}</td>
                  <td className="px-2.5 py-2 text-right font-mono font-bold text-emerald-600 text-[11px]">
                    {row.income > 0 ? formatVnd(row.income) : "-"}
                  </td>
                  <td className="px-2.5 py-2 text-right font-mono font-bold text-rose-500 text-[11px]">
                    {row.expense > 0 ? formatVnd(row.expense) : "-"}
                  </td>
                  <td className="px-2.5 py-2">
                    <span className="inline-flex rounded bg-emerald-500/10 px-1 py-0.2 font-mono text-[9px] font-bold uppercase text-emerald-700 dark:text-emerald-400">
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Right: Trạng thái ghi sổ (4 cols) */}
      <div className="flex flex-col justify-between overflow-hidden rounded-xl border border-border/70 bg-card p-4 shadow-2xs transition-all hover:border-border hover:shadow-xs lg:col-span-4">
        {/* Slim Header */}
        <div className="border-b border-border/40 pb-2.5">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <BookOpenCheck size={13} />
            </span>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-text">
                Trạng thái ghi sổ
              </h3>
              <p className="text-[11px] text-muted">Cập nhật theo thời gian thực</p>
            </div>
          </div>
        </div>

        {/* 2 Clean Metric Blocks */}
        <div className="py-2.5 space-y-2.5">
          {/* Bút toán nháp */}
          <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-3 transition shadow-2xs">
            <div className="flex items-baseline justify-between">
              <span className="font-mono text-2xl font-bold text-purple-700 dark:text-purple-300">
                0
              </span>
              <span className="rounded bg-purple-500/15 px-1.5 py-0.2 text-[9px] font-bold text-purple-800 dark:text-purple-200">
                Bút toán nháp
              </span>
            </div>
            <div className="mt-0.5 text-[11px] text-muted">
              Cần kiểm tra trước khi ghi sổ
            </div>
          </div>

          {/* Đã ghi sổ chính thức */}
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 transition shadow-2xs">
            <div className="flex items-baseline justify-between">
              <span className="font-mono text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                24
              </span>
              <span className="rounded bg-emerald-500/15 px-1.5 py-0.2 text-[9px] font-bold text-emerald-800 dark:text-emerald-200">
                Đã ghi sổ chính thức
              </span>
            </div>
            <div className="mt-0.5 text-[11px] text-muted">
              12 nguồn cọc • 0 nguồn chi phí
            </div>
          </div>
        </div>

        {/* Action Link: Mở trung tâm đối soát SePay */}
        <div className="border-t border-border/30 pt-2.5">
          {onOpenReconciliation ? (
            <button
              onClick={onOpenReconciliation}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-primary/20 bg-primary/5 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10 transition cursor-pointer"
            >
              <Sparkles size={12} />
              <span>Mở trung tâm đối soát SePay</span>
              <ArrowRight size={11} />
            </button>
          ) : (
            <Link
              href="/finance/reconciliation"
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-primary/20 bg-primary/5 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10 transition"
            >
              <Sparkles size={12} />
              <span>Mở trung tâm đối soát SePay</span>
              <ArrowRight size={11} />
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
