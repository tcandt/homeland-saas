"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, History, SearchCheck, ShieldCheck } from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import FinanceDisclosureSection from "@/components/finance/FinanceDisclosureSection";
import SePayReconciliationAuditPanel from "@/components/finance/SePayReconciliationAuditPanel";
import SePayReconciliationSummary from "@/components/finance/SePayReconciliationSummary";

export default function FinanceReconciliationPage() {
  return (
    <AppShell>
      <main
        data-testid="finance-reconciliation-page"
        className="-m-4 min-h-[calc(100dvh-87px)] w-[calc(100%+32px)] overflow-auto bg-background p-2 md:min-h-[calc(100dvh-80px)] md:p-3"
      >
        <div className="flex w-full flex-col gap-3">
          <header className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card px-3 py-3 shadow-2xs sm:px-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <Link
                href="/finance"
                prefetch={false}
                aria-label="Quay lại doanh thu"
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-surface text-muted transition hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <ArrowLeft size={18} aria-hidden />
              </Link>
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-white shadow-lg shadow-primary/20">
                <SearchCheck size={20} aria-hidden />
              </span>
              <div className="min-w-0">
                <div className="text-[10px] font-black uppercase tracking-[0.14em] text-primary">Finance operations</div>
                <h1 className="truncate text-xl font-black tracking-tight text-text">Đối soát giao dịch</h1>
                <p className="mt-0.5 hidden text-xs text-muted sm:block">Khớp dòng tiền, xử lý sai lệch và lưu đầy đủ dấu vết nghiệp vụ.</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pl-0 sm:pl-[100px] lg:pl-0">
              <span className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 text-xs font-black text-emerald-700 dark:text-emerald-300">
                <ShieldCheck size={15} aria-hidden />
                Có audit trail
              </span>
              <Link
                href="/finance/transactions"
                prefetch={false}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border bg-card px-3 text-xs font-black text-text transition hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <History size={15} aria-hidden />
                Lịch sử giao dịch
              </Link>
            </div>
          </header>

          <SePayReconciliationSummary />

          <FinanceDisclosureSection
            testId="finance-reconciliation-audit-disclosure"
            eyebrow="Kiểm soát nâng cao"
            title="Audit sai lệch thanh toán"
            description="Dò chéo webhook, payment request và chứng từ nguồn. Chỉ mở khi cần điều tra trạng thái bất thường."
          >
            <SePayReconciliationAuditPanel />
          </FinanceDisclosureSection>
        </div>
      </main>
    </AppShell>
  );
}
