"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  BookOpenCheck,
  Landmark,
  PieChart,
  Receipt,
  Wallet,
} from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import BankCashFlowSummary from "@/components/finance/BankCashFlowSummary";
import BuildingProfitSummary from "@/components/finance/BuildingProfitSummary";
import FinanceAttentionCard from "@/components/finance/FinanceAttentionCard";
import FinanceDisclosureSection from "@/components/finance/FinanceDisclosureSection";
import FinanceExportDrawer from "@/components/finance/FinanceExportDrawer";
import FinancialCommandDrawer from "@/components/finance/FinancialCommandDrawer";
import FinancialCommandKpi from "@/components/finance/FinancialCommandKpi";
import FinancialCommandLedger from "@/components/finance/FinancialCommandLedger";
import OperationsFinanceChart from "@/components/finance/OperationsFinanceChart";
import OwnerProfitSummary from "@/components/finance/OwnerProfitSummary";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { useLedgerQuery } from "@/lib/queries/finance.queries";
import { useFinanceStore } from "@/lib/stores/finance.store";

export default function FinancePage() {
  const permissions = usePermissions();
  const selectedJournalId = useFinanceStore((state) => state.selectedJournalId);
  const { data: ledgerRows } = useLedgerQuery();

  const reconciliation = useMemo(() => {
    const rows = ledgerRows || [];
    return {
      draftCount: rows.filter((row: any) => row.status === "DRAFT").length,
      postedCount: rows.filter((row: any) => row.status === "POSTED").length,
      depositCount: rows.filter((row: any) => row.sourceType === "DEPOSIT").length,
      expenseCount: rows.filter((row: any) => row.sourceType === "EXPENSE").length,
    };
  }, [ledgerRows]);

  return (
    <AppShell>
      {permissions.canExportFinance && <FinanceExportDrawer />}

      <main
        data-testid="finance-root"
        className="-m-4 min-h-[calc(100dvh-87px)] w-[calc(100%+32px)] overflow-auto bg-background p-3 md:min-h-[calc(100dvh-80px)] md:p-5"
      >
        <div className="flex w-full flex-col gap-4">
          {/* Quick Sub-Navigation Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
              <span className="text-xs font-bold text-muted uppercase tracking-wider">
                Dữ liệu tài chính thời gian thực
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/finance/transactions"
                className="inline-flex items-center gap-1.5 rounded-xl border border-border/70 bg-card px-3 py-1.5 text-xs font-bold text-text shadow-2xs transition hover:border-border hover:bg-surface"
              >
                <Receipt size={13} className="text-primary" />
                <span>Sổ giao dịch</span>
              </Link>

              <Link
                href="/finance/reconciliation"
                className="inline-flex items-center gap-1.5 rounded-xl border border-border/70 bg-card px-3 py-1.5 text-xs font-bold text-text shadow-2xs transition hover:border-border hover:bg-surface"
              >
                <Landmark size={13} className="text-emerald-600" />
                <span>Đối soát SePay</span>
              </Link>

              <Link
                href="/finance/expenses"
                className="inline-flex items-center gap-1.5 rounded-xl border border-border/70 bg-card px-3 py-1.5 text-xs font-bold text-text shadow-2xs transition hover:border-border hover:bg-surface"
              >
                <Wallet size={13} className="text-rose-600" />
                <span>Chi phí</span>
              </Link>

              <Link
                href="/reports"
                className="inline-flex items-center gap-1.5 rounded-xl border border-border/70 bg-card px-3 py-1.5 text-xs font-bold text-text shadow-2xs transition hover:border-border hover:bg-surface"
              >
                <PieChart size={13} className="text-indigo-600" />
                <span>Báo cáo P&L</span>
                <ArrowUpRight size={12} className="text-muted" />
              </Link>
            </div>
          </div>

          {/* 5 Executive KPI Cards */}
          <FinancialCommandKpi />

          {/* Recharts Operations Chart & Attention Card */}
          <div className="grid items-stretch gap-4 xl:grid-cols-[minmax(0,1.8fr)_minmax(330px,0.7fr)]">
            <OperationsFinanceChart />
            <FinanceAttentionCard />
          </div>

          {/* Bank Cashflow SePay Summary with Recharts */}
          <BankCashFlowSummary />

          {/* Owner Profit Summary */}
          {permissions.canReadOwnerProfit && (
            <FinanceDisclosureSection
              testId="finance-owner-profit-disclosure"
              eyebrow="Phân tích chủ sở hữu"
              title="Quyết toán và lợi nhuận theo chủ sở hữu"
              description="Mở khi cần kiểm tra tiền thực nhận, hoàn ứng, tiền cọc và chi tiết từng tòa nhà."
            >
              <OwnerProfitSummary />
            </FinanceDisclosureSection>
          )}

          {/* Building Profit Summary */}
          <FinanceDisclosureSection
            testId="finance-building-profit-disclosure"
            eyebrow="Hiệu quả vận hành"
            title="Doanh thu và lợi nhuận theo tòa nhà"
            description="So sánh hiệu quả từng tòa, sau đó mở sâu xuống phòng khi cần điều tra chênh lệch."
          >
            <BuildingProfitSummary />
          </FinanceDisclosureSection>

          {/* General Ledger & Control */}
          <FinanceDisclosureSection
            testId="finance-ledger-disclosure"
            eyebrow="Sổ kế toán"
            title="Bút toán và kiểm soát ghi sổ"
            description="Danh sách chi tiết được đóng gọn để dashboard chính luôn dễ đọc."
          >
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
              <FinancialCommandLedger />

              <aside
                data-testid="finance-right-panel"
                className="flex flex-col overflow-hidden rounded-2xl border border-border/70 bg-card shadow-2xs"
              >
                <div className="border-b border-border/70 bg-surface/50 p-4">
                  <div className="flex items-center gap-2">
                    <BookOpenCheck size={16} className="text-primary" />
                    <h3 className="text-sm font-black text-text">Trạng thái ghi sổ</h3>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-muted">
                    Tổng hợp theo dữ liệu sổ cái (ledger) hiện tại.
                  </p>
                </div>
                <div className="grid gap-3 p-4">
                  <LedgerStatusCard
                    tone="warning"
                    value={reconciliation.draftCount}
                    title="Bút toán nháp"
                    detail="Cần kiểm tra trước khi ghi sổ chính thức."
                  />
                  <LedgerStatusCard
                    tone="success"
                    value={reconciliation.postedCount}
                    title="Đã ghi sổ chính thức"
                    detail={`${reconciliation.depositCount} nguồn cọc · ${reconciliation.expenseCount} nguồn chi phí`}
                  />
                </div>
              </aside>
            </div>
          </FinanceDisclosureSection>
        </div>
      </main>

      {selectedJournalId && <FinancialCommandDrawer />}
    </AppShell>
  );
}

function LedgerStatusCard({
  tone,
  value,
  title,
  detail,
}: {
  tone: "warning" | "success";
  value: number;
  title: string;
  detail: string;
}) {
  const toneClass =
    tone === "warning"
      ? "border-amber-500/25 bg-amber-500/5 text-amber-700 dark:text-amber-300"
      : "border-emerald-500/25 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300";

  return (
    <div className={`rounded-xl border p-4 transition shadow-2xs ${toneClass}`}>
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-2xl font-black">{value}</span>
        <span
          className={`rounded-md px-1.5 py-0.5 text-[10px] font-black uppercase ${
            tone === "warning" ? "bg-amber-500/15 text-amber-800 dark:text-amber-200" : "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200"
          }`}
        >
          {tone === "warning" ? "Chờ duyệt" : "Hoàn tất"}
        </span>
      </div>
      <div className="mt-1.5 text-sm font-black text-text">{title}</div>
      <div className="mt-1 text-xs leading-relaxed text-muted">{detail}</div>
    </div>
  );
}
