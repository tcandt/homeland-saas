"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { ArrowRight, BarChart3, History, ReceiptText, Wallet } from "lucide-react";
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

  const updatedAtLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(new Date()),
    [],
  );

  return (
    <AppShell>
      {permissions.canExportFinance && <FinanceExportDrawer />}

      <main
        data-testid="finance-root"
        className="-m-4 min-h-[calc(100dvh-87px)] w-[calc(100%+32px)] overflow-auto bg-background p-3 md:min-h-[calc(100dvh-80px)] md:p-5"
      >
        <div className="mx-auto flex w-full max-w-[1680px] flex-col gap-4">
          <header className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-2xs">
            <div className="bg-gradient-to-br from-primary/12 via-card to-emerald-500/5 px-4 py-5 md:px-6 md:py-6">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-white shadow-lg shadow-primary/20">
                    <BarChart3 size={22} aria-hidden />
                  </span>
                  <div>
                    <div className="text-[11px] font-black uppercase tracking-[0.16em] text-primary">Financial overview</div>
                    <h1 className="mt-1 text-2xl font-black tracking-tight text-text md:text-3xl">Doanh thu & Tài chính</h1>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-muted md:text-base">
                      Theo dõi tiền thực thu, công nợ, chi phí và lợi nhuận. Các giao dịch bất thường được chuyển sang trung tâm đối soát riêng.
                    </p>
                    <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/80 px-3 py-1.5 text-xs font-semibold text-muted">
                      Dữ liệu hiển thị lúc {updatedAtLabel}
                    </div>
                  </div>
                </div>

                <nav aria-label="Lối tắt tài chính" className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <FinanceShortcut href="/finance/reconciliation" icon={ReceiptText} label="Đối soát" detail="Xử lý ngoại lệ" primary />
                  <FinanceShortcut href="/finance/transactions" icon={History} label="Giao dịch" detail="Tra cứu dòng tiền" />
                  <FinanceShortcut href="/finance/expenses" icon={Wallet} label="Chi phí" detail="Quản lý khoản chi" />
                </nav>
              </div>
            </div>
          </header>

          <FinancialCommandKpi />

          <div className="grid items-stretch gap-4 xl:grid-cols-[minmax(0,1.75fr)_minmax(320px,0.75fr)]">
            <OperationsFinanceChart />
            <FinanceAttentionCard />
          </div>

          <BankCashFlowSummary />

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

          <FinanceDisclosureSection
            testId="finance-building-profit-disclosure"
            eyebrow="Hiệu quả vận hành"
            title="Doanh thu và lợi nhuận theo tòa nhà"
            description="So sánh hiệu quả từng tòa, sau đó mở sâu xuống phòng khi cần điều tra chênh lệch."
          >
            <BuildingProfitSummary />
          </FinanceDisclosureSection>

          <FinanceDisclosureSection
            testId="finance-ledger-disclosure"
            eyebrow="Sổ kế toán"
            title="Bút toán và kiểm soát ghi sổ"
            description="Danh sách chi tiết được đóng gọn để dashboard chính luôn dễ đọc."
          >
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
              <FinancialCommandLedger />

              <aside data-testid="finance-right-panel" className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-2xs">
                <div className="border-b border-border/70 bg-surface/60 p-4">
                  <h3 className="text-sm font-black text-text">Trạng thái ghi sổ</h3>
                  <p className="mt-1 text-xs leading-5 text-muted">Tổng hợp theo dữ liệu ledger hiện tại.</p>
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
                    title="Đã ghi sổ"
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

function FinanceShortcut({
  href,
  icon: Icon,
  label,
  detail,
  primary = false,
}: {
  href: string;
  icon: React.ComponentType<{ size?: number; className?: string; "aria-hidden"?: boolean }>;
  label: string;
  detail: string;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      prefetch={false}
      className={`group flex min-h-[64px] items-center gap-3 rounded-xl border px-3.5 py-3 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
        primary
          ? "border-primary/25 bg-primary text-white shadow-lg shadow-primary/20 hover:brightness-105"
          : "border-border/70 bg-card/85 text-text shadow-2xs hover:border-primary/35 hover:bg-primary/5"
      }`}
    >
      <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${primary ? "bg-white/15" : "bg-primary/10 text-primary"}`}>
        <Icon size={17} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-black">{label}</span>
        <span className={`mt-0.5 block text-xs ${primary ? "text-white/75" : "text-muted"}`}>{detail}</span>
      </span>
      <ArrowRight size={15} className="shrink-0 transition-transform group-hover:translate-x-0.5" aria-hidden />
    </Link>
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
      ? "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300"
      : "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  return (
    <div className={`rounded-xl border p-4 ${toneClass}`}>
      <div className="font-mono text-2xl font-black">{value}</div>
      <div className="mt-1 text-sm font-black">{title}</div>
      <div className="mt-1 text-xs leading-5 text-muted">{detail}</div>
    </div>
  );
}
