"use client";

import React, { useState } from "react";
import AppShell from "@/components/layout/AppShell";
import { Filter, FileText, Banknote, Plus } from "lucide-react";
import FinancialCommandKpi from "@/components/finance/FinancialCommandKpi";
import FinancialCommandLedger from "@/components/finance/FinancialCommandLedger";
import FinancialCommandDrawer from "@/components/finance/FinancialCommandDrawer";
import { useFinanceStore } from "@/lib/stores/finance.store";
import toast from "react-hot-toast";
import dayjs from "dayjs";
import { Button } from "@/components/ui/Button";
import { financeApi } from "@/lib/api/finance.api";

export default function FinancePage() {
  const selectedJournalId = useFinanceStore(s => s.selectedJournalId);

  const handleExport = async () => {
    try {
      const response: any = await financeApi.exportReport();
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      
      const contentDisposition = response.headers['content-disposition'];
      let filename = 'finance_report.csv';
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
        if (filenameMatch && filenameMatch.length === 2) {
          filename = filenameMatch[1];
        }
      }
      
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Xuất báo cáo thành công!');
    } catch (error) {
      toast.error('Có lỗi xảy ra khi xuất báo cáo', { icon: '❌' });
    }
  };

  return (
    <AppShell>
      <div data-testid="finance-root" className="relative w-full min-h-full flex flex-col gap-[16px] md:gap-[24px]">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/50 pb-4">
          <div>
            <h1 className="font-black text-[20px] md:text-[28px] text-text tracking-tight">Financial Command Center</h1>
            <p className="text-[12px] md:text-[13px] font-medium text-muted mt-1">Phân tích dòng tiền, kiểm soát công nợ & Sổ cái kế toán</p>
          </div>
          <div className="flex items-center gap-[8px] md:gap-[12px] overflow-x-auto pb-2 md:pb-0 hide-scrollbar">
            <Button variant="outline" className="shrink-0 h-[32px] md:h-[36px] px-[12px] md:px-[16px]">
              <Filter size={14} className="text-muted mr-1.5" /> Bộ lọc
            </Button>
            <Button data-testid="finance-export-button" variant="outline" onClick={handleExport} className="shrink-0 h-[32px] md:h-[36px] px-[12px] md:px-[16px]">
              <FileText size={14} className="text-muted mr-1.5" /> Xuất báo cáo
            </Button>
            <Button className="shrink-0 h-[32px] md:h-[36px] px-[12px] md:px-[16px] bg-[#10b981] hover:bg-[#059669] text-white shadow-[#10b981]/20">
              <Plus size={16} className="mr-1.5" /> Tạo bút toán
            </Button>
          </div>
        </div>
        
        {/* Section 1: KPI */}
        <FinancialCommandKpi />
        
        {/* Section 2 & 3: Charts & Building Performance Placeholder */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-[16px] md:gap-[24px]">
          <div data-testid="finance-chart" className="lg:col-span-2 bg-card border border-border rounded-[16px] h-[250px] md:h-[300px] flex items-center justify-center flex-col">
            <span className="text-muted font-bold text-[14px]">Biểu đồ Dòng tiền (Cash Flow)</span>
            <span className="text-muted/50 text-[12px]">Data loaded from API</span>
          </div>
          <div className="col-span-1 bg-card border border-border rounded-[16px] h-[250px] md:h-[300px] flex items-center justify-center flex-col">
            <span className="text-muted font-bold text-[14px]">Hiệu quả tòa nhà (Building P&L)</span>
            <span className="text-muted/50 text-[12px]">Data loaded from API</span>
          </div>
        </div>
        
        {/* Section 4 & 5: Ledger Explorer & Reconciliation */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-[16px] md:gap-[24px]">
          <FinancialCommandLedger />
          
          <div data-testid="finance-right-panel" className="bg-card border border-border rounded-[16px] flex flex-col h-auto md:h-[600px] overflow-hidden hidden lg:flex">
            <div className="p-[16px] border-b border-border">
              <h3 className="font-bold text-text">Đối soát (Reconciliation)</h3>
              <p className="text-[12px] text-muted mt-1">Các giao dịch cần xử lý</p>
            </div>
            <div className="p-[16px] flex flex-col gap-4">
              <div className="bg-orange-500/10 border border-orange-500/20 rounded-[8px] p-3">
                <div className="font-bold text-[13px] text-orange-500">1 Bút toán DRAFT</div>
                <div className="text-[11px] text-orange-500/80 mt-1">Chưa cân bằng Nợ/Có. Cần điều chỉnh để POST.</div>
              </div>
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-[8px] p-3">
                <div className="font-bold text-[13px] text-blue-500">3 Giao dịch ngân hàng</div>
                <div className="text-[11px] text-blue-500/80 mt-1">Chưa được map với bút toán.</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {selectedJournalId && <FinancialCommandDrawer />}
    </AppShell>
  );
}
