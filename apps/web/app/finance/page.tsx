"use client";

import React, { useMemo } from "react";
import { Download, FileSpreadsheet, FileText, Wallet } from "lucide-react";
import toast from "react-hot-toast";
import AppShell from "@/components/layout/AppShell";
import BankCashFlowSummary from "@/components/finance/BankCashFlowSummary";
import BuildingProfitSummary from "@/components/finance/BuildingProfitSummary";
import FinanceMobileFlow from "@/components/finance/FinanceMobileFlow";
import FinancialCommandDrawer from "@/components/finance/FinancialCommandDrawer";
import FinancialCommandKpi from "@/components/finance/FinancialCommandKpi";
import FinancialCommandLedger from "@/components/finance/FinancialCommandLedger";
import OperationsFinanceChart from "@/components/finance/OperationsFinanceChart";
import OwnerProfitSummary from "@/components/finance/OwnerProfitSummary";
import SePayReconciliationAuditPanel from "@/components/finance/SePayReconciliationAuditPanel";
import SePayReconciliationSummary from "@/components/finance/SePayReconciliationSummary";
import { financeApi } from "@/lib/api/finance.api";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { useLedgerQuery } from "@/lib/queries/finance.queries";
import { useFinanceStore } from "@/lib/stores/finance.store";

async function downloadFinanceFile(
  request: () => Promise<any>,
  fallbackName: string,
  successMessage: string,
  errorMessage: string,
) {
  try {
    const response: any = await request();
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement("a");
    const contentDisposition = response.headers["content-disposition"];
    const filenameMatch = contentDisposition?.match(/filename="?([^\"]+)"?/);

    link.href = url;
    link.download = filenameMatch?.[1] || fallbackName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
    toast.success(successMessage);
  } catch {
    toast.error(errorMessage);
  }
}

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
      {/* Mobile Flow */}
      <div className="block md:hidden">
        <div className="mb-3">
          <h1 className="text-lg font-black text-text">Tài chính</h1>
        </div>
        <FinanceMobileFlow />
      </div>

      {/* Floating Vertical Side Tab - Pinned along the right screen edge */}
      {permissions.canExportFinance && (
        <div className="fixed right-0 top-1/2 -translate-y-1/2 z-50">
          <details className="group relative">
            <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-l-xl border-y border-l border-primary/40 bg-card/95 py-3 px-2 text-xs font-black text-primary shadow-xl backdrop-blur-md transition-all hover:bg-primary/10 hover:border-primary hover:pl-3 [writing-mode:vertical-rl] select-none">
              <Download size={13} className="text-primary rotate-90" />
              <span>Xuất báo cáo</span>
            </summary>
            <div className="absolute right-full mr-2 top-1/2 -translate-y-1/2 z-50 w-52 rounded-xl border border-border/80 bg-card p-1.5 shadow-modal">
              <div className="px-2.5 py-1 text-[10px] font-black uppercase text-muted border-b border-border/50 mb-1">
                Tải báo cáo tài chính
              </div>
              <button
                type="button"
                data-testid="finance-export-excel-button"
                onClick={() =>
                  downloadFinanceFile(
                    () => financeApi.exportExcelReport(),
                    "finance_report.xlsx",
                    "Đã xuất báo cáo Excel.",
                    "Không thể xuất báo cáo Excel.",
                  )
                }
                className="flex h-9 w-full items-center gap-2 rounded-lg px-2.5 text-left text-xs font-bold text-text hover:bg-muted/10 transition-colors"
              >
                <FileSpreadsheet size={14} className="text-emerald-500" /> Xuất file Excel (.xlsx)
              </button>
              <button
                type="button"
                data-testid="finance-export-pdf-button"
                onClick={() =>
                  downloadFinanceFile(
                    () => financeApi.exportPdfReport(),
                    "finance_report.pdf",
                    "Đã xuất báo cáo PDF.",
                    "Không thể xuất báo cáo PDF.",
                  )
                }
                className="flex h-9 w-full items-center gap-2 rounded-lg px-2.5 text-left text-xs font-bold text-text hover:bg-muted/10 transition-colors"
              >
                <FileText size={14} className="text-rose-500" /> Xuất file PDF (.pdf)
              </button>
            </div>
          </details>
        </div>
      )}

      {/* Desktop Main Flow */}
      <div
        data-testid="finance-root"
        className="hidden md:flex -m-4 min-h-[calc(100dvh-87px)] w-[calc(100%+32px)] overflow-auto bg-background md:min-h-[calc(100dvh-80px)] p-2.5 md:p-3 flex-col gap-3"
      >
        {/* 1. 8-CARD COMPACT KPI GRID */}
        <FinancialCommandKpi />

        {/* 2. REAL CASH FLOW & PROFIT ANALYSIS COMBO CHART */}
        <OperationsFinanceChart />

        {/* 3. OWNER PROFIT SUMMARY (if permitted) */}
        {permissions.canReadOwnerProfit && <OwnerProfitSummary />}

        {/* 4. BANK CASH FLOW & SEPAY RECONCILIATION */}
        <BankCashFlowSummary />
        <SePayReconciliationSummary />
        <SePayReconciliationAuditPanel />

        {/* 5. BUILDING PROFIT SUMMARY */}
        <BuildingProfitSummary />

        {/* 6. GENERAL LEDGER & RECONCILIATION DRAFT STATUS */}
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_320px]">
          <FinancialCommandLedger />

          <div
            data-testid="finance-right-panel"
            className="flex flex-col overflow-hidden rounded-xl border border-border/70 bg-card shadow-2xs h-auto lg:h-[600px]"
          >
            <div className="border-b border-border/70 p-3.5 bg-muted/5">
              <h3 className="font-black text-xs uppercase tracking-wider text-muted">Kiểm soát đối soát Ledger</h3>
              <p className="mt-0.5 text-[11px] text-muted">Tổng hợp theo trạng thái ghi sổ thực tế.</p>
            </div>
            <div className="flex flex-col gap-3 p-3.5">
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
                <div className="text-xs font-black text-amber-700 dark:text-amber-400">
                  {reconciliation.draftCount} bút toán nháp (Draft)
                </div>
                <div className="mt-1 text-[11px] text-muted leading-relaxed">
                  Chưa ghi sổ kế toán chính thức, cần kiểm tra đối chiếu trước khi Post.
                </div>
              </div>
              <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-3">
                <div className="text-xs font-black text-indigo-700 dark:text-indigo-400">
                  {reconciliation.postedCount} bút toán đã ghi sổ (Posted)
                </div>
                <div className="mt-1 text-[11px] text-muted leading-relaxed">
                  Bao gồm {reconciliation.depositCount} nguồn tiền cọc và {reconciliation.expenseCount} nguồn chi phí vận hành.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {selectedJournalId && <FinancialCommandDrawer />}
    </AppShell>
  );
}
