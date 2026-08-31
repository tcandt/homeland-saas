"use client";

import React, { useMemo, useState } from "react";
import { BarChart3, TrendingUp, TrendingDown, DollarSign, Wallet, Minus, Calendar } from "lucide-react";
import { useInvoicesQuery } from "@/lib/queries/invoices.queries";
import { useLedgerQuery, useBankTransactionsQuery } from "@/lib/queries/finance.queries";
import { useDashboardQuery } from "@/lib/queries/dashboard.queries";
import { Card } from "@/components/ui/Card";

const formatVnd = (value: number) => `${Number(value || 0).toLocaleString("vi-VN")} đ`;

function formatMillions(val: number) {
  const abs = Math.abs(val);
  if (abs >= 1_000_000_000) {
    return `${(val / 1_000_000_000).toFixed(1).replace(/\.0$/, "")}B`;
  }
  if (abs >= 1_000_000) {
    return `${(val / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (abs >= 1_000) {
    return `${(val / 1_000).toFixed(0)}K`;
  }
  return String(val);
}

export default function OperationsFinanceChart() {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const { data: invoicesData, isLoading: isInvoicesLoading } = useInvoicesQuery({ limit: 500 });
  const { data: ledgerData, isLoading: isLedgerLoading } = useLedgerQuery();
  const { data: bankData, isLoading: isBankLoading } = useBankTransactionsQuery({ limit: 500 });
  const { data: dashboard } = useDashboardQuery();

  const invoices = Array.isArray(invoicesData?.data) ? invoicesData.data : [];
  const ledgerRows = Array.isArray(ledgerData) ? ledgerData : [];
  const bankRows = Array.isArray(bankData?.rows) ? bankData.rows : [];

  // Generate 6 recent months strictly computed from REAL invoices & ledger entries
  const chartData = useMemo(() => {
    const now = new Date();

    return Array.from({ length: 6 }, (_, idx) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - idx), 1);
      const targetMonth = d.getMonth();
      const targetYear = d.getFullYear();
      const monthLabel = `T${targetMonth + 1}/${String(targetYear).slice(2)}`;
      const isCurrent = idx === 5;

      // 1. Calculate Real Revenue and Debt from Invoices for this month
      let monthRevenue = 0;
      let monthDebt = 0;

      for (const inv of invoices) {
        const invDate = new Date(inv.issueDate || inv.createdAt || inv.dueDate);
        if (!Number.isNaN(invDate.getTime())) {
          if (invDate.getMonth() === targetMonth && invDate.getFullYear() === targetYear) {
            monthRevenue += Number(inv.paidAmount || 0);
            monthDebt += Number(inv.remainingAmount || (inv.status !== "PAID" ? inv.totalAmount : 0) || 0);
          }
        }
      }

      // If current month and dashboard has revenue, use current revenue if greater
      const kpisRaw = (dashboard as any)?.kpisRaw || {};
      if (isCurrent && monthRevenue === 0 && Number(kpisRaw.totalRevenue || 0) > 0) {
        monthRevenue = Number(kpisRaw.totalRevenue || 0);
        monthDebt = Number(kpisRaw.totalDebt || 0);
      }

      // 2. Calculate Real Expenses from Ledger & Bank Outflow for this month
      let monthExpense = 0;

      for (const leg of ledgerRows) {
        const legDate = new Date(leg.date);
        if (!Number.isNaN(legDate.getTime())) {
          if (legDate.getMonth() === targetMonth && legDate.getFullYear() === targetYear) {
            if (leg.sourceType === "EXPENSE" || (leg.accountCode && String(leg.accountCode).startsWith("6"))) {
              monthExpense += Number(leg.debit || leg.credit || 0);
            }
          }
        }
      }

      // Also incorporate bank outflow if ledger is empty
      if (monthExpense === 0) {
        for (const bank of bankRows) {
          const bankDate = new Date(bank.createdAt);
          if (!Number.isNaN(bankDate.getTime())) {
            if (bankDate.getMonth() === targetMonth && bankDate.getFullYear() === targetYear) {
              if (bank.direction === "OUT") {
                monthExpense += Number(bank.amount || 0);
              }
            }
          }
        }
      }

      if (isCurrent && monthExpense === 0 && Number(kpisRaw.totalExpense || 0) > 0) {
        monthExpense = Number(kpisRaw.totalExpense || 0);
      }

      const monthProfit = monthRevenue - monthExpense;

      return {
        month: monthLabel,
        fullMonth: `Tháng ${targetMonth + 1}, ${targetYear}`,
        revenue: monthRevenue,
        expense: monthExpense,
        profit: monthProfit,
        debt: monthDebt,
        isCurrent,
      };
    });
  }, [invoices, ledgerRows, bankRows, dashboard]);

  // Compute max value for scaling based on actual numbers
  const maxVal = useMemo(() => {
    const max = Math.max(
      ...chartData.map((d) => Math.max(d.revenue, d.expense, Math.abs(d.profit), d.debt)),
      100_000,
    );
    return Math.ceil(max * 1.25);
  }, [chartData]);

  // 4 Y-axis ticks
  const yTicks = [maxVal, Math.round(maxVal * 0.66), Math.round(maxVal * 0.33), 0];

  return (
    <Card className="rounded-xl border border-border/70 bg-card p-4 shadow-2xs flex flex-col gap-4">
      {/* Header & Legend */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/50 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
              <BarChart3 size={15} />
            </div>
            <h3 className="text-sm md:text-base font-black text-text tracking-tight">
              Dòng tiền & Lợi nhuận thực tế (Cash Flow & Profit)
            </h3>
          </div>
          <p className="text-[11px] font-semibold text-muted mt-0.5">
            Tổng hợp dữ liệu thực từ hóa đơn, phiếu thu chi và sổ cái 6 tháng gần nhất (không có số liệu ảo)
          </p>
        </div>

        {/* Legend Pills */}
        <div className="flex items-center gap-2.5 flex-wrap text-xs">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-indigo-500/10 border border-indigo-500/20 text-indigo-700 dark:text-indigo-300 font-bold text-[11px]">
            <div className="w-2.5 h-2.5 rounded-sm bg-indigo-600" />
            Thu thực nhận
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 font-bold text-[11px]">
            <div className="w-2.5 h-2.5 rounded-sm bg-rose-500" />
            Tổng chi
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold text-[11px]">
            <div className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
            Lợi nhuận ròng
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 font-bold text-[11px]">
            <div className="w-2.5 h-1 rounded-full bg-amber-500" />
            Công nợ
          </div>
        </div>
      </div>

      {/* Main Interactive Combo Chart */}
      <div className="relative w-full h-[260px] md:h-[290px] pt-4 pb-8 select-none">
        {/* Y-axis Grid Lines & Labels */}
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-8">
          {yTicks.map((val, idx) => (
            <div key={idx} className="w-full border-t border-border/40 border-dashed flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold text-muted/80 bg-card pr-2">
                {formatMillions(val)}
              </span>
            </div>
          ))}
        </div>

        {/* 6 Monthly Columns Container */}
        <div className="relative z-10 w-full h-full flex items-end justify-around pl-10 pr-2">
          {chartData.map((item, idx) => {
            const hasData = item.revenue > 0 || item.expense > 0 || item.debt > 0;
            const revHeight = item.revenue > 0 ? Math.max((item.revenue / maxVal) * 100, 3) : 0;
            const expHeight = item.expense > 0 ? Math.max((item.expense / maxVal) * 100, 3) : 0;
            const profitHeight = item.profit > 0 ? Math.max((item.profit / maxVal) * 100, 3) : 0;
            const debtDotBottom = item.debt > 0 ? Math.min(Math.max((item.debt / maxVal) * 100, 5), 95) : 0;
            const isHovered = hoveredIndex === idx;

            return (
              <div
                key={idx}
                onMouseEnter={() => setHoveredIndex(idx)}
                onMouseLeave={() => setHoveredIndex(null)}
                className="relative flex flex-col items-center justify-end h-full flex-1 max-w-[120px] cursor-pointer group px-1"
              >
                {/* TOOLTIP POPUP ON HOVER */}
                {isHovered && (
                  <div className="absolute -top-14 z-30 flex flex-col gap-1 rounded-xl border border-border/80 bg-card p-2.5 shadow-modal min-w-[175px] pointer-events-none animate-in fade-in zoom-in-95 duration-150">
                    <div className="text-[11px] font-black text-text border-b border-border/50 pb-1 flex items-center justify-between">
                      <span>{item.fullMonth}</span>
                      {item.isCurrent && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-primary/10 text-primary font-bold">Tháng này</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-muted font-bold">Thu thực tế:</span>
                      <span className="font-mono font-black text-indigo-600 dark:text-indigo-400">{formatVnd(item.revenue)}</span>
                    </div>
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-muted font-bold">Tổng chi:</span>
                      <span className="font-mono font-black text-rose-500">{formatVnd(item.expense)}</span>
                    </div>
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-muted font-bold">Lợi nhuận:</span>
                      <span className="font-mono font-black text-emerald-600 dark:text-emerald-400">{formatVnd(item.profit)}</span>
                    </div>
                    {item.debt > 0 && (
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-muted font-bold">Công nợ:</span>
                        <span className="font-mono font-black text-amber-500">{formatVnd(item.debt)}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* BARS (Revenue, Expense, Profit) */}
                <div className="flex items-end justify-center gap-1 sm:gap-1.5 w-full h-full pb-1 relative">
                  {hasData ? (
                    <>
                      {/* Revenue Bar */}
                      {revHeight > 0 ? (
                        <div
                          style={{ height: `${revHeight}%` }}
                          className="w-3.5 sm:w-5 rounded-t-md bg-gradient-to-t from-indigo-700 to-indigo-500 transition-all duration-300 group-hover:brightness-110 shadow-2xs"
                        />
                      ) : (
                        <div className="w-3.5 sm:w-5 h-1 rounded-t-sm bg-indigo-500/20" />
                      )}

                      {/* Expense Bar */}
                      {expHeight > 0 ? (
                        <div
                          style={{ height: `${expHeight}%` }}
                          className="w-3.5 sm:w-5 rounded-t-md bg-gradient-to-t from-rose-700 to-rose-500 transition-all duration-300 group-hover:brightness-110 shadow-2xs"
                        />
                      ) : (
                        <div className="w-3.5 sm:w-5 h-1 rounded-t-sm bg-rose-500/20" />
                      )}

                      {/* Profit Bar */}
                      {profitHeight > 0 ? (
                        <div
                          style={{ height: `${profitHeight}%` }}
                          className="w-3.5 sm:w-5 rounded-t-md bg-gradient-to-t from-emerald-700 to-emerald-500 transition-all duration-300 group-hover:brightness-110 shadow-2xs"
                        />
                      ) : (
                        <div className="w-3.5 sm:w-5 h-1 rounded-t-sm bg-emerald-500/20" />
                      )}

                      {/* Debt Dot (Combo indicator) */}
                      {debtDotBottom > 0 && (
                        <div
                          style={{ bottom: `${debtDotBottom}%` }}
                          className="absolute left-1/2 -translate-x-1/2 w-3 h-3 rounded-full border-2 border-card bg-amber-500 shadow-xs z-20 pointer-events-none group-hover:scale-125 transition-transform"
                        />
                      )}
                    </>
                  ) : (
                    /* Clean zero baseline bar */
                    <div className="h-1 w-8 rounded-full bg-border/60 group-hover:bg-primary/40 transition-colors" />
                  )}
                </div>

                {/* X-Axis Month Label */}
                <div className="absolute -bottom-6 flex flex-col items-center">
                  <span
                    className={`text-[11px] font-bold tracking-tight transition-colors ${
                      item.isCurrent
                        ? "text-primary font-black underline underline-offset-2"
                        : "text-muted group-hover:text-text"
                    }`}
                  >
                    {item.month}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
