"use client";

import React from "react";
import { ArrowRight, Landmark } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { formatVnd } from "@/lib/utils/format";

interface BankCashFlowSummaryProps {
  onOpenDetail?: () => void;
}

export default function BankCashFlowSummary({ onOpenDetail }: BankCashFlowSummaryProps) {
  const bankAccounts = [
    {
      id: "b1",
      bankName: "BIDV",
      bankColor: "text-amber-700 dark:text-amber-300",
      bankBg: "bg-amber-500/10 border-amber-500/20",
      accountName: "HỘ KINH DOANH NGUYEN DUC TINH",
      code: "RLQJ",
      confirmed: 1000000,
      pending: 18132020,
    },
    {
      id: "b2",
      bankName: "Agribank",
      bankColor: "text-emerald-700 dark:text-emerald-400",
      bankBg: "bg-emerald-500/10 border-emerald-500/20",
      accountName: "DSDSD",
      code: "•• sdsd",
      confirmed: 0,
      pending: 0,
    },
    {
      id: "b3",
      bankName: "BIDV",
      bankColor: "text-amber-700 dark:text-amber-300",
      bankBg: "bg-amber-500/10 border-amber-500/20",
      accountName: "HỘ KINH DOANH PHAN VAN THE",
      code: "QGPR",
      confirmed: 0,
      pending: 28649272,
    },
  ];

  return (
    <Card
      data-testid="bank-cashflow-summary"
      className="flex h-[320px] flex-col justify-between overflow-hidden rounded-xl border border-border/70 bg-card p-4 shadow-2xs transition-all hover:border-border hover:shadow-xs"
    >
      {/* Slim Header */}
      <div className="flex items-center justify-between border-b border-border/40 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400">
            <Landmark size={13} />
          </span>
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-text">
              Dòng tiền theo tài khoản ngân hàng
            </h2>
            <p className="text-[11px] text-muted">
              Tổng hợp tiền đã nhận và đang chờ
            </p>
          </div>
        </div>

        {onOpenDetail && (
          <button
            onClick={onOpenDetail}
            className="flex items-center gap-0.5 text-xs font-semibold text-primary hover:underline cursor-pointer"
          >
            <span>Xem chi tiết</span>
            <ArrowRight size={11} />
          </button>
        )}
      </div>

      {/* 3 Bank Account Rows */}
      <div className="flex-1 flex flex-col justify-between py-2">
        {bankAccounts.map((acc) => (
          <div
            key={acc.id}
            onClick={onOpenDetail}
            className="flex cursor-pointer items-center justify-between gap-2.5 rounded-lg border border-border/50 bg-surface/30 px-3 py-2.5 transition hover:border-border hover:bg-surface/70"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span
                className={`flex h-7 px-2 items-center justify-center rounded-md font-bold text-xs border ${acc.bankBg} ${acc.bankColor}`}
              >
                {acc.bankName}
              </span>
              <div className="truncate">
                <span className="text-xs font-bold text-text block truncate max-w-[140px] sm:max-w-[170px]">
                  {acc.accountName}
                </span>
                <span className="text-[10px] font-mono text-muted block">
                  {acc.code}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 text-right shrink-0">
              <div>
                <span className="text-[9px] font-semibold text-muted block">Đã nhận</span>
                <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  {formatVnd(acc.confirmed)}
                </span>
              </div>

              <div>
                <span className="text-[9px] font-semibold text-muted block">Đang chờ</span>
                <span
                  className={`text-xs font-mono font-bold ${
                    acc.pending > 0
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-muted"
                  }`}
                >
                  {formatVnd(acc.pending)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
