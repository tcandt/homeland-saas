"use client";

import AppShell from "@/components/layout/AppShell";
import OperationsBillingKpi from "@/components/invoices/OperationsBillingKpi";
import OperationsBillingInsights from "@/components/invoices/OperationsBillingInsights";
import OperationsBillingFilters from "@/components/invoices/OperationsBillingFilters";
import OperationsBillingPipeline from "@/components/invoices/OperationsBillingPipeline";
import OperationsBillingList from "@/components/invoices/OperationsBillingList";
import OperationsBillingRightPanel from "@/components/invoices/OperationsBillingRightPanel";
import { Plus, Download, Filter, Send, Receipt } from "lucide-react";

export default function InvoicesPage() {
  return (
    <AppShell>
      <div data-testid="invoices-root" className="w-full h-full">
      {/* Responsive Operations View */}
      <div className="flex relative w-full min-h-full flex-col gap-[24px]">
        {/* Decorative background blobs */}
        <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-[100px] -z-10 pointer-events-none" />
        <div className="absolute top-[20%] right-0 w-[400px] h-[400px] bg-rose-500/5 rounded-full blur-[100px] -z-10 pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/50 pb-4">
          <div>
            <h1 className="font-black text-[24px] md:text-[28px] text-text tracking-tight">Quản lý Hóa đơn</h1>
            <p className="text-[13px] font-medium text-muted mt-1">Theo dõi phải thu, thanh toán, công nợ và nhắc nợ khách thuê</p>
          </div>
          <div className="flex items-center gap-[12px]">
            <button className="h-[36px] px-[16px] bg-black/5 hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10 rounded-[10px] text-text font-bold text-[13px] transition-colors flex items-center gap-[6px]">
              <Filter size={14} className="text-muted" /> Bộ lọc
            </button>
            <button className="h-[36px] px-[16px] bg-black/5 hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10 rounded-[10px] text-text font-bold text-[13px] transition-colors flex items-center gap-[6px]">
              <Download size={14} className="text-muted" /> Xuất Excel
            </button>
            <button className="h-[36px] px-[16px] bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 rounded-[10px] font-bold text-[13px] transition-colors flex items-center gap-[6px]">
              <Send size={14} /> Gửi nhắc nợ
            </button>
            <button className="h-[36px] px-[16px] bg-[#8b5cf6]/10 hover:bg-[#8b5cf6]/20 text-[#8b5cf6] rounded-[10px] font-bold text-[13px] transition-colors flex items-center gap-[6px]">
              <Receipt size={14} /> Thu tiền
            </button>
            <button className="h-[36px] px-[16px] bg-[#6366f1] hover:bg-[#4f46e5] text-white rounded-[10px] font-bold text-[13px] shadow-sm transition-all shadow-[#6366f1]/20 flex items-center gap-[6px]">
              <Plus size={16} /> Tạo hóa đơn
            </button>
          </div>
        </div>
        
        <OperationsBillingKpi />
        <OperationsBillingInsights />
        
        <div className="flex gap-[24px]">
          <div className="flex-1 flex flex-col gap-[24px] min-w-[0]">
            <OperationsBillingFilters />
            <OperationsBillingPipeline />
            <OperationsBillingList />
          </div>
          <div className="hidden xl:block w-[360px] 2xl:w-[420px] shrink-0">
            <OperationsBillingRightPanel />
          </div>
        </div>
      </div>
      </div>
    </AppShell>
  );
}
