"use client";

import AppShell from "@/components/layout/AppShell";
import ContractsMobileFlow from "@/components/contracts/ContractsMobileFlow";
import OperationsContractFilters from "@/components/contracts/OperationsContractFilters";
import OperationsContractInsights from "@/components/contracts/OperationsContractInsights";
import OperationsContractKpi from "@/components/contracts/OperationsContractKpi";
import OperationsContractList from "@/components/contracts/OperationsContractList";
import OperationsContractSidebar from "@/components/contracts/OperationsContractSidebar";

export default function ContractsPage() {
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

        <div className="hidden min-h-full w-full grid-cols-1 gap-2 p-2 md:grid md:p-3 2xl:h-full 2xl:min-h-0 2xl:grid-cols-[minmax(0,1fr)_minmax(310px,14vw)]">
          <div className="flex min-w-0 flex-col gap-2 2xl:min-h-0">
            <OperationsContractKpi />
            <OperationsContractInsights />
            <OperationsContractFilters />
            <OperationsContractList />
          </div>
          <OperationsContractSidebar />
        </div>
      </div>
    </AppShell>
  );
}
