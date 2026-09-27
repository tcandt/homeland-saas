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
        className="-m-4 min-h-[calc(100dvh-87px)] w-[calc(100%+32px)] overflow-auto bg-background p-3 md:min-h-[calc(100dvh-80px)] md:p-5"
      >
        <div className="mx-auto flex w-full max-w-[1680px] flex-col gap-4">
          <header className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-2xs">
            <div className="bg-gradient-to-br from-primary/12 via-card to-emerald-500/5 px-4 py-5 md:px-6 md:py-6">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <Link
                    href="/finance"
                    prefetch={false}
                    className="inline-flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm font-bold text-muted transition hover:bg-surface hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <ArrowLeft size={16} aria-hidden />
                    Quay lại doanh thu
                  </Link>
                  <div className="mt-3 flex items-start gap-3">
                    <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-white shadow-lg shadow-primary/20">
                      <SearchCheck size={22} aria-hidden />
                    </span>
                    <div>
                      <div className="text-[11px] font-black uppercase tracking-[0.16em] text-primary">Finance operations</div>
                      <h1 className="mt-1 text-2xl font-black tracking-tight text-text md:text-3xl">Đối soát giao dịch</h1>
                      <p className="mt-2 max-w-3xl text-sm leading-6 text-muted md:text-base">
                        Xử lý giao dịch chưa khớp, thiếu hoặc thừa tiền, gắn hóa đơn và kiểm tra sai lệch SePay tại một nơi riêng biệt.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Link
                    href="/finance/transactions"
                    prefetch={false}
                    className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm font-black text-text shadow-2xs transition hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <History size={17} aria-hidden />
                    Lịch sử giao dịch
                  </Link>
                  <span className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm font-black text-emerald-700 dark:text-emerald-300">
                    <ShieldCheck size={17} aria-hidden />
                    Có lưu dấu vết xử lý
                  </span>
                </div>
              </div>
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
