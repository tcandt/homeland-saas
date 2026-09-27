"use client";

import React from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, BadgeCheck, Clock3 } from "lucide-react";
import { useSePayReconciliationQuery } from "@/lib/queries/finance.queries";

export default function FinanceAttentionCard() {
  const year = String(new Date().getFullYear());
  const { data, isLoading, isError } = useSePayReconciliationQuery({ year });
  const summary = data?.summary || {};
  const actionRequired =
    Number(summary.unmatched || 0) +
    Number(summary.wrongBank || 0) +
    Number(summary.failed || 0) +
    Number(summary.needsReview || 0) +
    Number(summary.shortAmount || 0) +
    Number(summary.overAmount || 0);
  const inFlight = Number(summary.processing || 0) + Number(summary.pendingProcessing || 0);

  return (
    <section data-testid="finance-attention-card" className="flex h-full min-h-[300px] flex-col overflow-hidden rounded-2xl border border-border/70 bg-card shadow-2xs">
      <div className="border-b border-border/70 bg-gradient-to-br from-primary/10 via-card to-card px-5 py-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.14em] text-primary">Trung tâm kiểm soát</div>
            <h2 className="mt-2 text-lg font-black tracking-tight text-text">Giao dịch cần chú ý</h2>
            <p className="mt-1 text-sm leading-6 text-muted">Các khoản cần kế toán kiểm tra trước khi ghi nhận hoặc hoàn tất đối soát.</p>
          </div>
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-white shadow-lg shadow-primary/20">
            <AlertTriangle size={20} aria-hidden />
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-5">
        {isLoading ? (
          <div className="grid gap-3" aria-label="Đang tải dữ liệu đối soát">
            <div className="h-16 animate-pulse rounded-xl bg-surface" />
            <div className="h-16 animate-pulse rounded-xl bg-surface" />
          </div>
        ) : isError ? (
          <div role="alert" className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4 text-sm leading-6 text-rose-700 dark:text-rose-300">
            Chưa tải được trạng thái đối soát. Mở trung tâm đối soát để thử lại.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div className={`rounded-xl border p-3.5 ${actionRequired > 0 ? "border-amber-500/30 bg-amber-500/10" : "border-emerald-500/25 bg-emerald-500/10"}`}>
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-muted">
                {actionRequired > 0 ? <AlertTriangle size={14} className="text-amber-600" /> : <BadgeCheck size={14} className="text-emerald-600" />}
                Cần xử lý
              </div>
              <div className={`mt-2 font-mono text-2xl font-black ${actionRequired > 0 ? "text-amber-700 dark:text-amber-300" : "text-emerald-700 dark:text-emerald-300"}`}>
                {actionRequired}
              </div>
            </div>
            <div className="rounded-xl border border-sky-500/25 bg-sky-500/10 p-3.5">
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-muted">
                <Clock3 size={14} className="text-sky-600" />
                Đang chạy
              </div>
              <div className="mt-2 font-mono text-2xl font-black text-sky-700 dark:text-sky-300">{inFlight}</div>
            </div>
          </div>
        )}

        <div className="mt-4 rounded-xl border border-border/70 bg-surface/50 px-4 py-3 text-sm leading-6 text-muted">
          Gắn hóa đơn, xử lý thiếu/thừa tiền và xem nhật ký sai lệch tại một màn hình nghiệp vụ riêng.
        </div>

        <Link
          href="/finance/reconciliation"
          prefetch={false}
          data-testid="finance-reconciliation-link"
          className="mt-auto inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-black text-white shadow-lg shadow-primary/20 transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          Mở trung tâm đối soát
          <ArrowRight size={16} aria-hidden />
        </Link>
      </div>
    </section>
  );
}
