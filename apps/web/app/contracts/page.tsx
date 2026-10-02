"use client";

import React from "react";
import AppShell from "@/components/layout/AppShell";
import ContractsMobileFlow from "@/components/contracts/ContractsMobileFlow";
import OperationsContractFilters from "@/components/contracts/OperationsContractFilters";
import OperationsContractKpi from "@/components/contracts/OperationsContractKpi";
import OperationsContractList from "@/components/contracts/OperationsContractList";
import OperationsContractDrawer from "@/components/contracts/OperationsContractDrawer";
import { useContractsStore } from "@/lib/hooks/useContractsStore";

export default function ContractsPage() {
  const { selectedContract, setSelectedContract } = useContractsStore();
  const [mountedContract, setMountedContract] = React.useState<any>(null);

  React.useEffect(() => {
    if (selectedContract) {
      setMountedContract(selectedContract);
    }
  }, [selectedContract]);

  // Press ESC to close right drawer
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Esc") {
        setSelectedContract(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [setSelectedContract]);

  return (
    <AppShell>
      <div data-testid="contracts-root" className="-m-4 h-[calc(100dvh-87px)] w-[calc(100%+32px)] overflow-auto bg-slate-50/60 dark:bg-background md:h-[calc(100dvh-80px)] xl:overflow-hidden">
        <div className="block md:hidden">
          <div className="mb-2 p-3">
            <div className="flex items-center justify-between">
              <h1 className="text-[22px] font-black text-text">Hợp đồng</h1>
            </div>
          </div>
          <ContractsMobileFlow />
        </div>

        {/* Desktop View: Full-width Table with KPI and Filters */}
        <div className="hidden min-h-full w-full p-2 md:p-3 md:flex md:flex-col gap-2.5 2xl:min-h-0">
          <OperationsContractKpi />
          <OperationsContractFilters />
          <OperationsContractList />
        </div>

        {/* Subtle backdrop scrim to close drawer when clicking outside */}
        <div
          onClick={() => setSelectedContract(null)}
          aria-hidden={!selectedContract}
          className={`fixed inset-0 top-[70px] bg-slate-900/15 dark:bg-black/40 backdrop-blur-[1px] z-30 transition-opacity duration-300 ease-out ${
            selectedContract ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
          }`}
        />

        {/* Right Drawer Panel: Ultra-smooth 60-120 FPS GPU-accelerated slide-out panel */}
        <div
          className={`fixed right-3 top-[74px] bottom-3 w-[500px] 2xl:w-[580px] z-40 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] transform-gpu ${
            selectedContract
              ? "translate-x-0 opacity-100 pointer-events-auto shadow-[-12px_0_40px_rgba(0,0,0,0.18)] dark:shadow-[-16px_0_50px_rgba(0,0,0,0.7)]"
              : "translate-x-[calc(100%+32px)] opacity-0 pointer-events-none shadow-none"
          }`}
        >
          {mountedContract && (
            <div className="w-full h-full rounded-2xl border border-slate-200/90 dark:border-white/[0.08] bg-white dark:bg-card overflow-hidden">
              <OperationsContractDrawer
                isEmbedded={true}
                contract={selectedContract || mountedContract}
                onClose={() => setSelectedContract(null)}
                onOpenContract={setSelectedContract}
              />
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
