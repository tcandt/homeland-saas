"use client";

import React from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Coins,
  CreditCard,
  Landmark,
  ShieldCheck,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { formatVnd } from "@/lib/utils/format";

interface FinanceExecutiveKpiProps {
  totalRevenue?: number;
  bankCollected?: number;
  pendingDebt?: number;
  totalDeposit?: number;
  operatingExpense?: number;
}

export default function FinanceExecutiveKpi({
  totalRevenue = 18781292,
  bankCollected = 1000000,
  pendingDebt = 17781292,
  totalDeposit = 15000000,
  operatingExpense = 1314624,
}: FinanceExecutiveKpiProps) {
  const collectionRate = totalRevenue > 0 ? Math.round((bankCollected / totalRevenue) * 1000) / 10 : 0;
  const netSystemProfit = totalRevenue - operatingExpense;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {/* KPI 1: Doanh thu thuần */}
      <div className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border/80 bg-card p-4 sm:p-5 shadow-xs transition hover:border-primary/40 hover:shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <Coins size={16} />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Doanh thu phát sinh
            </span>
          </div>
          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
            Năm 2026
          </span>
        </div>

        <div className="my-2.5">
          <div className="font-mono text-2xl font-black tracking-tight text-foreground">
            {formatVnd(totalRevenue)}
          </div>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Bao gồm tiền phòng ({formatVnd(17066668)}) & dịch vụ điện nước
          </p>
        </div>

        <div className="flex items-center justify-between border-t border-border/40 pt-2 text-xs">
          <span className="text-muted-foreground">Lợi nhuận ròng toàn hệ thống:</span>
          <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
            {formatVnd(netSystemProfit)}
          </span>
        </div>
      </div>

      {/* KPI 2: Thực thu ngân hàng */}
      <div className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border/80 bg-card p-4 sm:p-5 shadow-xs transition hover:border-emerald-500/40 hover:shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Landmark size={16} />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Thực thu qua Ngân hàng
            </span>
          </div>
          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
            {collectionRate}% đã thu
          </span>
        </div>

        <div className="my-2.5">
          <div className="font-mono text-2xl font-black tracking-tight text-emerald-600 dark:text-emerald-400">
            {formatVnd(bankCollected)}
          </div>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Đã khớp tự động qua webhook SePay (BIDV RLQJ)
          </p>
        </div>

        <div className="flex items-center justify-between border-t border-border/40 pt-2 text-xs">
          <span className="text-muted-foreground">Chi phí vận hành đã trừ:</span>
          <span className="font-mono font-bold text-rose-500">
            -{formatVnd(operatingExpense)}
          </span>
        </div>
      </div>

      {/* KPI 3: Công nợ khách thuê */}
      <div className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border/80 bg-card p-4 sm:p-5 shadow-xs transition hover:border-amber-500/40 hover:shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Clock size={16} />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Công nợ còn phải thu
            </span>
          </div>
          <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
            Cần đôn đốc
          </span>
        </div>

        <div className="my-2.5">
          <div className="font-mono text-2xl font-black tracking-tight text-amber-600 dark:text-amber-400">
            {formatVnd(pendingDebt)}
          </div>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Khách thuê đang nợ kỳ này (Chủ B: 13.649k, Chủ A: 4.132k)
          </p>
        </div>

        <div className="flex items-center justify-between border-t border-border/40 pt-2 text-xs">
          <span className="text-muted-foreground">Tỷ lệ công nợ tồn:</span>
          <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
            {(100 - collectionRate).toFixed(1)}%
          </span>
        </div>
      </div>

      {/* KPI 4: Quỹ tiền cọc đang giữ */}
      <div className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border/80 bg-card p-4 sm:p-5 shadow-xs transition hover:border-sky-500/40 hover:shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
              <ShieldCheck size={16} />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Quỹ tiền cọc giữ hộ
            </span>
          </div>
          <span className="rounded-full bg-sky-500/10 px-2 py-0.5 text-[10px] font-bold text-sky-600 dark:text-sky-400">
            Khoản bảo đảm
          </span>
        </div>

        <div className="my-2.5">
          <div className="font-mono text-2xl font-black tracking-tight text-sky-600 dark:text-sky-400">
            {formatVnd(totalDeposit)}
          </div>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Tách biệt với doanh thu P&L (Chủ A: 8.000k, Chủ B: 7.000k)
          </p>
        </div>

        <div className="flex items-center justify-between border-t border-border/40 pt-2 text-xs">
          <span className="text-muted-foreground">Tính chất pháp lý:</span>
          <span className="font-semibold text-foreground">Ký quỹ hoàn trả</span>
        </div>
      </div>
    </div>
  );
}
