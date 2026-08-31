"use client";

import React, { useState } from "react";
import AppShell from "@/components/layout/AppShell";
import OperationsDepositKpi from "@/components/deposits/OperationsDepositKpi";
import OperationsDepositInsights from "@/components/deposits/OperationsDepositInsights";
import OperationsDepositFilters from "@/components/deposits/OperationsDepositFilters";
import OperationsDepositPipeline from "@/components/deposits/OperationsDepositPipeline";
import OperationsDepositList from "@/components/deposits/OperationsDepositList";
import OperationsRefundCenter from "@/components/deposits/OperationsRefundCenter";
import DepositsMobileFlow from "@/components/deposits/DepositsMobileFlow";
import CreateDepositModal from "@/components/deposits/CreateDepositModal";
import { Plus, Download, FileText, Filter } from "lucide-react";

export default function DepositsPage() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  return (
    <AppShell>
      <div data-testid="deposits-root" className="w-full h-full">
        {/* Mobile View */}
        <div className="block md:hidden">
          <div className="mb-3 flex items-center justify-between">
            <h1 className="font-black text-[22px] text-text">Quản lý Đặt cọc</h1>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="h-[36px] px-[14px] bg-[#6366f1] hover:bg-[#4f46e5] text-white rounded-xl font-bold text-[12px] shadow-sm flex items-center gap-1.5"
            >
              <Plus size={15} /> Tạo cọc
            </button>
          </div>
          <DepositsMobileFlow />
        </div>

        {/* Desktop View */}
        <div className="hidden md:flex relative w-full min-h-full flex-col gap-[24px]">
          {/* Decorative background blobs */}
          <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-[#6366f1]/5 rounded-full blur-[100px] -z-10 pointer-events-none" />
          <div className="absolute top-[20%] right-0 w-[400px] h-[400px] bg-[#8b5cf6]/5 rounded-full blur-[100px] -z-10 pointer-events-none" />
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/50 pb-4">
            <div>
              <h1 className="font-black text-[24px] md:text-[28px] text-text tracking-tight">Quản lý Đặt cọc</h1>
              <p className="text-[13px] font-medium text-muted mt-1">Quản lý cọc giữ chỗ, cọc bảo đảm, hoàn tiền và chuyển hợp đồng</p>
            </div>
            <div className="flex items-center gap-[12px]">
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="h-[38px] px-[16px] bg-[#6366f1] hover:bg-[#4f46e5] text-white rounded-[10px] font-bold text-[13px] shadow-sm transition-all shadow-[#6366f1]/20 flex items-center gap-[6px]"
              >
                <Plus size={16} /> Tạo phiếu cọc mới
              </button>
            </div>
          </div>
          
          <OperationsDepositKpi />
          <OperationsDepositInsights />
          
          <div className="flex gap-[24px]">
            <div className="flex-1 flex flex-col gap-[24px] min-w-[0]">
              <OperationsDepositFilters />
              <OperationsDepositPipeline />
              <OperationsDepositList />
            </div>
            <div className="hidden xl:block w-[360px] 2xl:w-[400px] shrink-0">
              <OperationsRefundCenter />
            </div>
          </div>
        </div>

        {/* Modal Tạo Phiếu Cọc */}
        {isCreateModalOpen && (
          <CreateDepositModal
            isOpen={isCreateModalOpen}
            onClose={() => setIsCreateModalOpen(false)}
          />
        )}
      </div>
    </AppShell>
  );
}
