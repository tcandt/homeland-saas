"use client";

import React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BadgeAlert,
  CheckCircle2,
  Clock3,
  Layers,
  RefreshCw,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { useSePayReconciliationQuery } from "@/lib/queries/finance.queries";

export default function FinanceAttentionCard() {
  const year = String(new Date().getFullYear());
  const { data, isLoading, isError } = useSePayReconciliationQuery({ year });
  const summary = data?.summary || {};

  const unmatched = Number(summary.unmatched || 0);
  const wrongBank = Number(summary.wrongBank || 0);
  const failed = Number(summary.failed || 0);
  const needsReview = Number(summary.needsReview || 0);
  const shortAmount = Number(summary.shortAmount || 0);
  const overAmount = Number(summary.overAmount || 0);

  const actionRequired = unmatched + wrongBank + failed + needsReview + shortAmount + overAmount;
  const inFlight = Number(summary.processing || 0) + Number(summary.pendingProcessing || 0);

  const isHealthy = actionRequired === 0;

  return (
    <section
      data-testid="finance-attention-card"
      className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border/70 bg-card p-5 shadow-2xs transition-all duration-200 hover:border-border hover:shadow-card md:p-6"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 border-b border-border/50 pb-4">
        <div>
          <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-muted">
            <span className={`inline-block h-2 w-2 rounded-full ${isHealthy ? "bg-emerald-500" : "bg-amber-500 animate-pulse"}`} />
            Kiểm soát giao dịch SePay
          </div>
          <h2 className="mt-1 text-base font-black tracking-tight text-text md:text-lg">
            Giao dịch cần chú ý
          </h2>
          <p className="mt-0.5 text-xs text-muted">
            Trạng thái xử lý và tính toàn vẹn của webhook ngân hàng.
          </p>
        </div>

        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${
            isHealthy
              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400"
          }`}
        >
          {isHealthy ? <ShieldCheck size={18} /> : <AlertTriangle size={18} />}
        </span>
      </div>

      {/* Center Body */}
      <div className="my-auto py-4">
        {isLoading ? (
          <div className="grid gap-2" aria-label="Đang tải dữ liệu đối soát">
            <div className="h-12 animate-pulse rounded-xl bg-surface/60" />
            <div className="h-12 animate-pulse rounded-xl bg-surface/60" />
          </div>
        ) : isError ? (
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4 text-xs font-semibold text-rose-700 dark:text-rose-300">
            Không thể tải trạng thái đối soát SePay.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {/* Status Hero Card */}
            <div
              className={`rounded-xl border p-4 transition ${
                isHealthy
                  ? "border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-500/10"
                  : "border-amber-500/25 bg-amber-500/5 dark:bg-amber-500/10"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-text">
                  {isHealthy ? "Hệ thống khớp lệnh an toàn" : "Phát sinh khoản cần xử lý"}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                    isHealthy
                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                      : "bg-amber-500/20 text-amber-800 dark:text-amber-200"
                  }`}
                >
                  {isHealthy ? "100% Khớp" : `${actionRequired} mục`}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted leading-relaxed">
                {isHealthy
                  ? "Toàn bộ tiền chuyển khoản SePay đã khớp đúng hóa đơn, phòng và tài khoản chủ sở hữu."
                  : "Có khoản thanh toán bị lệch số tiền hoặc chưa tự động nhận diện được khách thuê."}
              </p>
            </div>

            {/* Micro Breakdown Metrics */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-xl border border-border/60 bg-surface/40 p-3">
                <span className="text-[10px] font-bold text-muted uppercase">Cần kế toán duyệt</span>
                <div className={`mt-1 font-mono text-lg font-black ${actionRequired > 0 ? "text-amber-600" : "text-text"}`}>
                  {actionRequired}
                </div>
              </div>

              <div className="rounded-xl border border-border/60 bg-surface/40 p-3">
                <span className="text-[10px] font-bold text-muted uppercase">Đang đồng bộ</span>
                <div className="mt-1 font-mono text-lg font-black text-sky-600">
                  {inFlight}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer CTA */}
      <div className="border-t border-border/50 pt-4">
        <Link
          href="/finance/reconciliation"
          prefetch={false}
          data-testid="finance-reconciliation-link"
          className="group/link flex w-full items-center justify-between rounded-xl border border-border/80 bg-surface/50 px-4 py-3 text-xs font-bold text-text transition-all hover:border-primary/40 hover:bg-card hover:shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <span className="flex items-center gap-2">
            <Zap size={14} className="text-primary" />
            Mở trung tâm đối soát SePay
          </span>
          <ArrowRight
            size={14}
            className="text-muted transition-transform duration-200 group-hover/link:translate-x-1 group-hover/link:text-primary"
          />
        </Link>
      </div>
    </section>
  );
}
