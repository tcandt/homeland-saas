"use client";

import React, { useState } from "react";
import AppShell from "@/components/layout/AppShell";
import OperationsDepositKpi from "@/components/deposits/OperationsDepositKpi";
import OperationsDepositPipeline from "@/components/deposits/OperationsDepositPipeline";
import OperationsDepositFilters from "@/components/deposits/OperationsDepositFilters";
import OperationsDepositList from "@/components/deposits/OperationsDepositList";
import OperationsRefundCenter from "@/components/deposits/OperationsRefundCenter";
import DepositsMobileFlow from "@/components/deposits/DepositsMobileFlow";
import OperationsDepositDrawer from "@/components/deposits/OperationsDepositDrawer";
import { useDepositStore } from "@/lib/stores/deposit.store";

export default function DepositsPage() {
  const { selectedDeposit, setSelectedDeposit } = useDepositStore();
  const [refundCenterCollapsed, setRefundCenterCollapsed] = useState(true);

  return (
    <AppShell>
      <div data-testid="deposits-root" className="-m-4 h-[calc(100dvh-87px)] w-[calc(100%+32px)] overflow-auto bg-background md:h-[calc(100dvh-80px)] xl:overflow-hidden">
        {/* Mobile View */}
        <div className="block md:hidden p-3">
          <div className="mb-3 flex items-center justify-between">
            <h1 className="font-black text-[20px] text-text">Phiếu đặt cọc</h1>
          </div>
          <DepositsMobileFlow />
        </div>

        {/* Desktop View */}
        <div className="relative hidden min-h-full w-full grid-cols-1 gap-2.5 p-2 md:grid md:p-3 xl:h-full xl:min-h-0">
          {/* Main Left Workspace */}
          <div className="flex min-w-0 flex-col gap-2.5 xl:min-h-0">
            {/* 1. Compact 4-Card KPI Grid */}
            <OperationsDepositKpi />

            {/* 2. Operations Deposit Pipeline */}
            <OperationsDepositPipeline />

            {/* 3. Unified Filter Bar with Search, Dropdowns & Status Tabs */}
            <OperationsDepositFilters />

            {/* 4. High-Density Table List */}
            <OperationsDepositList />
          </div>

          {/* Right Sidebar: Refund & Cancellation Center */}
          <div className="pointer-events-none fixed inset-0 z-[100] hidden xl:block">
            <OperationsRefundCenter
              collapsed={refundCenterCollapsed}
              onCollapsedChange={setRefundCenterCollapsed}
            />
          </div>
        </div>
      </div>

      <OperationsDepositDrawer
        deposit={selectedDeposit}
        onClose={() => setSelectedDeposit(null)}
      />
    </AppShell>
  );
}
