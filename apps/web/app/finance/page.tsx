"use client";

import React, { useMemo } from "react";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import toast from "react-hot-toast";
import AppShell from "@/components/layout/AppShell";
import BankCashFlowSummary from "@/components/finance/BankCashFlowSummary";
import BuildingProfitSummary from "@/components/finance/BuildingProfitSummary";
import FinanceMobileFlow from "@/components/finance/FinanceMobileFlow";
import FinancialCommandDrawer from "@/components/finance/FinancialCommandDrawer";
import FinancialCommandKpi from "@/components/finance/FinancialCommandKpi";
import FinancialCommandLedger from "@/components/finance/FinancialCommandLedger";
import OwnerProfitSummary from "@/components/finance/OwnerProfitSummary";
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
      <div className="block md:hidden">
        <div className="mb-4">
          <h1 className="text-[22px] font-black text-text">Tài chính</h1>
        </div>
        <FinanceMobileFlow />
      </div>

      <div data-testid="finance-root" className="hidden min-h-full w-full flex-col gap-[16px] md:flex md:gap-[24px]">
        <div className="sticky top-[80px] z-40 -mx-[16px] -mt-[16px] flex flex-col gap-4 border-b border-border/70 bg-background/95 px-[16px] pb-4 pt-[16px] shadow-[0_12px_30px_rgba(15,23,42,0.06)] backdrop-blur supports-[backdrop-filter]:bg-background/85">
          {permissions.canExportFinance && (
            <div className="flex justify-end">
              <details className="group relative">
                <summary className="flex h-9 cursor-pointer list-none items-center gap-2 rounded-xl border border-border bg-card px-3 text-[12px] font-black text-text transition hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                  <Download size={14} /> Xuất báo cáo
                </summary>
                <div className="absolute right-0 top-11 z-50 w-48 rounded-xl border border-border bg-card p-1.5 shadow-xl">
                  <button
                    type="button"
                    data-testid="finance-export-excel-button"
                    onClick={() => downloadFinanceFile(() => financeApi.exportExcelReport(), "finance_report.xlsx", "Đã xuất báo cáo Excel.", "Không thể xuất báo cáo Excel.")}
                    className="flex h-10 w-full items-center gap-2 rounded-lg px-3 text-left text-[12px] font-bold text-text hover:bg-surface"
                  >
                    <FileSpreadsheet size={15} className="text-emerald-500" /> Excel
                  </button>
                  <button
                    type="button"
                    data-testid="finance-export-pdf-button"
                    onClick={() => downloadFinanceFile(() => financeApi.exportPdfReport(), "finance_report.pdf", "Đã xuất báo cáo PDF.", "Không thể xuất báo cáo PDF.")}
                    className="flex h-10 w-full items-center gap-2 rounded-lg px-3 text-left text-[12px] font-bold text-text hover:bg-surface"
                  >
                    <FileText size={15} className="text-rose-500" /> PDF
                  </button>
                </div>
              </details>
            </div>
          )}
          <FinancialCommandKpi />
        </div>

        {permissions.canReadOwnerProfit && <OwnerProfitSummary />}

        <BankCashFlowSummary />
        <SePayReconciliationSummary />

        <div className="grid grid-cols-1 gap-[16px] md:gap-[24px]">
          <div
            data-testid="finance-chart"
            className="flex h-[250px] flex-col items-center justify-center rounded-[16px] border border-border bg-card md:h-[300px]"
          >
            <span className="text-[14px] font-bold text-muted">Biểu đồ dòng tiền (Cash Flow)</span>
            <span className="text-[12px] text-muted/50">Dữ liệu được tải từ API.</span>
          </div>
        </div>

        <BuildingProfitSummary />

        <div className="grid grid-cols-1 gap-[16px] md:gap-[24px] lg:grid-cols-[1fr_300px]">
          <FinancialCommandLedger />

          <div
            data-testid="finance-right-panel"
            className="hidden h-auto flex-col overflow-hidden rounded-[16px] border border-border bg-card lg:flex md:h-[600px]"
          >
            <div className="border-b border-border p-[16px]">
              <h3 className="font-bold text-text">Đối soát</h3>
              <p className="mt-1 text-[12px] text-muted">Tổng hợp theo dữ liệu ledger thực tế.</p>
            </div>
            <div className="flex flex-col gap-4 p-[16px]">
              <div className="rounded-[8px] border border-orange-500/20 bg-orange-500/10 p-3">
                <div className="text-[13px] font-bold text-orange-500">{reconciliation.draftCount} bút toán nháp</div>
                <div className="mt-1 text-[11px] text-orange-500/80">Chưa ghi sổ, cần kiểm tra trước khi POST.</div>
              </div>
              <div className="rounded-[8px] border border-blue-500/20 bg-blue-500/10 p-3">
                <div className="text-[13px] font-bold text-blue-500">{reconciliation.postedCount} bút toán đã ghi sổ</div>
                <div className="mt-1 text-[11px] text-blue-500/80">
                  {reconciliation.depositCount} nguồn tiền cọc, {reconciliation.expenseCount} nguồn chi phí.
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
