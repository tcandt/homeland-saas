"use client";

import React, { useState } from "react";
import AppShell from "@/components/layout/AppShell";
import OperationsDepositKpi from "@/components/deposits/OperationsDepositKpi";
import OperationsDepositFilters from "@/components/deposits/OperationsDepositFilters";
import OperationsDepositList from "@/components/deposits/OperationsDepositList";
import OperationsRefundCenter from "@/components/deposits/OperationsRefundCenter";
import DepositsMobileFlow from "@/components/deposits/DepositsMobileFlow";
import CreateDepositModal from "@/components/deposits/CreateDepositModal";
import { Plus } from "lucide-react";

export default function DepositsPage() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  return (
    <AppShell>
      <div data-testid="deposits-root" className="-m-4 h-[calc(100dvh-87px)] w-[calc(100%+32px)] overflow-auto bg-background md:h-[calc(100dvh-80px)] xl:overflow-hidden">
        {/* Mobile View */}
        <div className="block md:hidden p-3">
          <div className="mb-3 flex items-center justify-between">
            <h1 className="font-black text-[20px] text-text">Phiếu đặt cọc</h1>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="h-9 px-3.5 bg-primary hover:bg-primary/90 text-white rounded-xl font-bold text-[12px] shadow-sm flex items-center gap-1.5 active:scale-95 transition-all"
            >
              <Plus size={15} /> Tạo cọc
            </button>
          </div>
          <DepositsMobileFlow />
        </div>

        {/* Desktop View */}
        <div className="hidden min-h-full w-full grid-cols-1 gap-2.5 p-2 md:grid md:p-3 2xl:h-full 2xl:min-h-0 2xl:grid-cols-[minmax(0,1fr)_minmax(310px,16vw)]">
          {/* Main Left Workspace */}
          <div className="flex min-w-0 flex-col gap-2.5 2xl:min-h-0">
            {/* 1. Compact 4-Card KPI Grid */}
            <OperationsDepositKpi />

            {/* 2. Unified Filter Bar with Search, Dropdowns, Status Tabs & Create Button */}
            <OperationsDepositFilters onCreateClick={() => setIsCreateModalOpen(true)} />

            {/* 3. High-Density Table List */}
            <OperationsDepositList onCreateClick={() => setIsCreateModalOpen(true)} />
          </div>

          {/* Right Sidebar: Refund & Cancellation Center */}
          <div className="hidden 2xl:block min-w-0">
            <OperationsRefundCenter />
          </div>
        </div>

        {/* Modal Tạo Phiếu Cọc Mới */}
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
