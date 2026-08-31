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
import { Plus, Download, FileText } from "lucide-react";

export default function DepositsPage() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  return (
    <AppShell>
      <div data-testid="deposits-root" className="w-full h-full">
        {/* Mobile View */}
        <div className="block md:hidden">
          <div className="mb-3 flex items-center justify-between">
            <h1 className="font-black text-[20px] text-text">Phiếu đặt cọc</h1>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="h-[36px] px-3.5 bg-primary hover:bg-primary/90 text-white rounded-xl font-bold text-[12px] shadow-sm flex items-center gap-1.5 active:scale-95 transition-all"
            >
              <Plus size={15} /> Tạo cọc
            </button>
          </div>
          <DepositsMobileFlow />
        </div>

        {/* Desktop View */}
        <div className="hidden md:flex relative w-full min-h-full flex-col gap-3.5">
          {/* Top Quick Actions Header */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-bold text-muted">
                Tổng quan & Quản lý vòng đời phiếu đặt cọc
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(true)}
                className="h-9 px-4 bg-primary hover:bg-primary/90 text-white rounded-xl font-bold text-[13px] shadow-sm shadow-primary/25 transition-all flex items-center gap-1.5 active:scale-95"
              >
                <Plus size={16} /> Tạo phiếu cọc mới
              </button>
            </div>
          </div>
          
          {/* 1. Top KPI Summary Cards */}
          <OperationsDepositKpi />

          {/* 2. AI Operations Insight Ticker */}
          <OperationsDepositInsights />
          
          {/* 3. Main Workspace: Pipeline, Filters, Table & Refund Center */}
          <div className="flex gap-3.5 xl:gap-4 mt-1">
            {/* Left Area (Pipeline + Filters + List) */}
            <div className="flex-1 flex flex-col gap-3 min-w-0">
              <OperationsDepositFilters />
              <OperationsDepositPipeline />
              <OperationsDepositList />
            </div>

            {/* Right Sidebar (Refund Center) */}
            <div className="hidden xl:block w-[320px] 2xl:w-[350px] shrink-0">
              <OperationsRefundCenter />
            </div>
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
