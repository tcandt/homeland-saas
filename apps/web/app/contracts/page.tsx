"use client";

import React, { useState } from "react";
import AppShell from "@/components/layout/AppShell";
import OperationsSidePanelShell from "@/components/layout/OperationsSidePanelShell";
import ContractsMobileFlow from "@/components/contracts/ContractsMobileFlow";
import OperationsContractFilters from "@/components/contracts/OperationsContractFilters";
import OperationsContractKpi from "@/components/contracts/OperationsContractKpi";
import OperationsContractList from "@/components/contracts/OperationsContractList";
import OperationsContractSidebar from "@/components/contracts/OperationsContractSidebar";

export default function ContractsPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  return (
    <AppShell>
      <div data-testid="contracts-root" className="-m-4 h-[calc(100dvh-87px)] w-[calc(100%+32px)] overflow-auto bg-background md:h-[calc(100dvh-80px)] xl:overflow-hidden">
        <div className="block md:hidden">
          <div className="mb-2">
            <div className="flex items-center justify-between">
              <h1 className="text-[22px] font-black text-text">Hợp đồng</h1>
            </div>
          </div>
          <ContractsMobileFlow />
        </div>

        <div className="hidden min-h-full w-full grid-cols-1 gap-2.5 p-2 md:grid md:p-3 2xl:h-full 2xl:min-h-0">
          <div className="flex min-w-0 flex-col gap-2.5 2xl:min-h-0">
            <OperationsContractKpi />
            <OperationsContractFilters />
            <OperationsContractList />
          </div>
        </div>
        <OperationsSidePanelShell
          open={sidebarOpen}
          onOpenChange={setSidebarOpen}
          label="Tổng quan hợp đồng"
          testId="contracts-side-panel"
        >
          <OperationsContractSidebar />
        </OperationsSidePanelShell>
      </div>
    </AppShell>
  );
}
