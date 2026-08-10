"use client";

import React, { useMemo, useState } from "react";
import { Filter, FileText, Plus } from "lucide-react";
import toast from "react-hot-toast";
import AppShell from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";
import BankCashFlowSummary from "@/components/finance/BankCashFlowSummary";
import BuildingProfitSummary from "@/components/finance/BuildingProfitSummary";
import ExpenseCreateModal from "@/components/finance/ExpenseCreateModal";
import ExpenseTable from "@/components/finance/ExpenseTable";
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
    link.href = url;

    const contentDisposition = response.headers["content-disposition"];
    let filename = fallbackName;
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename=\"?([^\"]+)\"?/);
      if (filenameMatch && filenameMatch.length === 2) {
        filename = filenameMatch[1];
      }
    }

    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
    toast.success(successMessage);
  } catch {
    toast.error(errorMessage, { icon: "!" });
  }
}

export default function FinancePage() {
  const permissions = usePermissions();
  const selectedJournalId = useFinanceStore((state) => state.selectedJournalId);
  const { data: ledgerRows } = useLedgerQuery();
  const [isExpenseModalOpen, setExpenseModalOpen] = useState(false);

  const reconciliation = useMemo(() => {
    const rows = ledgerRows || [];
    return {
      draftCount: rows.filter((row: any) => row.status === "DRAFT").length,
      postedCount: rows.filter((row: any) => row.status === "POSTED").length,
      depositCount: rows.filter((row: any) => row.sourceType === "DEPOSIT").length,
      expenseCount: rows.filter((row: any) => row.sourceType === "EXPENSE").length,
    };
  }, [ledgerRows]);

  const handleExportExcel = () =>
    downloadFinanceFile(
      () => financeApi.exportExcelReport(),
      "finance_report.xlsx",
      "Xuất báo cáo Excel thành công.",
      "Có lỗi xảy ra khi xuất Excel.",
    );

  const handleExportPdf = () =>
    downloadFinanceFile(
      () => financeApi.exportPdfReport(),
      "finance_report.pdf",
      "Xuất báo cáo PDF thành công.",
      "Có lỗi xảy ra khi xuất PDF.",
    );

  return (
    <AppShell>
      <div className="block md:hidden">
        <div className="mb-4">
          <h1 className="font-black text-[22px] text-text">Tài chính</h1>
        </div>
        <FinanceMobileFlow />
      </div>

      <div
        data-testid="finance-root"
        className="hidden min-h-full w-full flex-col gap-[16px] md:flex md:gap-[24px]"
      >
        <div className="flex flex-col justify-between gap-4 border-b border-border/50 pb-4 md:flex-row md:items-center">
          <div>
            <h1 className="text-[20px] font-black tracking-tight text-text md:text-[28px]">
              Financial Command Center
            </h1>
            <p className="mt-1 text-[12px] font-medium text-muted md:text-[13px]">
              Phân tích dòng tiền, kiểm soát công nợ và sổ cái kế toán.
            </p>
          </div>
          <div className="hide-scrollbar flex items-center gap-[8px] overflow-x-auto pb-2 md:gap-[12px] md:pb-0">
            <Button variant="outline" className="h-[32px] shrink-0 px-[12px] md:h-[36px] md:px-[16px]">
              <Filter size={14} className="mr-1.5 text-muted" />
              Bộ lọc
            </Button>
            {permissions.canExportFinance && (
              <Button
                data-testid="finance-export-excel-button"
                variant="outline"
                onClick={handleExportExcel}
                className="h-[32px] shrink-0 px-[12px] md:h-[36px] md:px-[16px]"
              >
                <FileText size={14} className="mr-1.5 text-muted" />
                Xuất Excel
              </Button>
            )}
            {permissions.canExportFinance && (
              <Button
                data-testid="finance-export-pdf-button"
                variant="outline"
                onClick={handleExportPdf}
                className="h-[32px] shrink-0 px-[12px] md:h-[36px] md:px-[16px]"
              >
                <FileText size={14} className="mr-1.5 text-muted" />
                Xuất PDF
              </Button>
            )}
            {permissions.canCreateExpense && (
              <Button
                onClick={() => setExpenseModalOpen(true)}
                className="h-[32px] shrink-0 bg-[#8b5cf6] px-[12px] text-white shadow-[#8b5cf6]/20 hover:bg-[#6366f1] md:h-[36px] md:px-[16px]"
              >
                <Plus size={16} className="mr-1.5" />
                Thêm chi phí
              </Button>
            )}
          </div>
        </div>

        <FinancialCommandKpi />

        {permissions.canReadOwnerProfit && <OwnerProfitSummary />}

        <BankCashFlowSummary />
        <SePayReconciliationSummary />
        <ExpenseTable />

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
                <div className="text-[13px] font-bold text-orange-500">
                  {reconciliation.draftCount} bút toán DRAFT
                </div>
                <div className="mt-1 text-[11px] text-orange-500/80">
                  Chưa ghi sổ, cần kiểm tra trước khi POST.
                </div>
              </div>
              <div className="rounded-[8px] border border-blue-500/20 bg-blue-500/10 p-3">
                <div className="text-[13px] font-bold text-blue-500">
                  {reconciliation.postedCount} bút toán POSTED
                </div>
                <div className="mt-1 text-[11px] text-blue-500/80">
                  {reconciliation.depositCount} nguồn DEPOSIT, {reconciliation.expenseCount} nguồn
                  EXPENSE.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {selectedJournalId && <FinancialCommandDrawer />}
      <ExpenseCreateModal isOpen={isExpenseModalOpen} onClose={() => setExpenseModalOpen(false)} />
    </AppShell>
  );
}
