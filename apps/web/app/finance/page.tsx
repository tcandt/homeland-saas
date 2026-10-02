"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  BookOpen,
  Building2,
  Calendar,
  CheckCircle2,
  Coins,
  CreditCard,
  Download,
  Landmark,
  PieChart,
  Receipt,
  Sparkles,
  TrendingUp,
  Wallet,
} from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import FinanceExecutiveKpi from "@/components/finance/FinanceExecutiveKpi";
import OwnerProfitSplitHero from "@/components/finance/OwnerProfitSplitHero";
import BuildingRoomsBreakdownTable from "@/components/finance/BuildingRoomsBreakdownTable";
import BankCashFlowSummary from "@/components/finance/BankCashFlowSummary";
import FinanceAttentionCard from "@/components/finance/FinanceAttentionCard";
import OperationsFinanceChart from "@/components/finance/OperationsFinanceChart";
import FinancialCommandLedger from "@/components/finance/FinancialCommandLedger";
import FinanceExportDrawer from "@/components/finance/FinanceExportDrawer";
import FinancialCommandDrawer from "@/components/finance/FinancialCommandDrawer";
import BankCashflowReconciliationModal from "@/components/finance/BankCashflowReconciliationModal";
import OwnerFinancialDetailModal from "@/components/finance/OwnerFinancialDetailModal";
import BuildingPerformanceDetailModal from "@/components/finance/BuildingPerformanceDetailModal";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { useFinanceStore } from "@/lib/stores/finance.store";

export default function FinancePage() {
  const permissions = usePermissions();
  const selectedJournalId = useFinanceStore((state) => state.selectedJournalId);

  const [selectedYear, setSelectedYear] = useState("2026");
  const [activeTab, setActiveTab] = useState<"buildings" | "banking" | "trends" | "ledger">("buildings");
  const [isReconciliationModalOpen, setIsReconciliationModalOpen] = useState(false);
  const [selectedOwnerForModal, setSelectedOwnerForModal] = useState<{
    id: string;
    name: string;
    code: string;
  } | null>(null);
  const [selectedBuildingForModal, setSelectedBuildingForModal] = useState<string | null>(null);

  return (
    <AppShell>
      {permissions.canExportFinance && <FinanceExportDrawer />}

      <main
        data-testid="finance-root"
        className="-m-4 min-h-[calc(100dvh-87px)] w-[calc(100%+32px)] overflow-auto bg-background p-3.5 md:min-h-[calc(100dvh-80px)] md:p-5"
      >
        <div className="flex w-full flex-col gap-4">
          {/* Top Control Bar: Realtime System Status + Period Selector + Quick Nav Links */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 pb-3">
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-foreground">
                  Hệ Thống Tài Chính Doanh Thu Hợp Nhất
                </span>
                <span className="rounded-md bg-muted/60 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  Đồng bộ webhook SePay tự động
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Year Selector */}
              <div className="flex items-center gap-1.5 rounded-xl border border-border/80 bg-card px-3 py-1.5 shadow-2xs">
                <Calendar size={13} className="text-muted-foreground" />
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  aria-label="Chọn năm tài chính"
                  className="bg-transparent text-xs font-bold text-foreground outline-none cursor-pointer"
                >
                  <option value="2026">Kỳ tài chính: Năm 2026</option>
                  <option value="2025">Kỳ tài chính: Năm 2025</option>
                </select>
              </div>

              {/* Sub-Navigation Links */}
              <Link
                href="/finance/transactions"
                className="inline-flex items-center gap-1.5 rounded-xl border border-border/80 bg-card px-3 py-1.5 text-xs font-semibold text-foreground shadow-2xs transition hover:border-primary hover:bg-surface hover:text-primary"
              >
                <Receipt size={13} className="text-primary" />
                <span>Sổ giao dịch</span>
              </Link>

              <button
                onClick={() => setIsReconciliationModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border/80 bg-card px-3 py-1.5 text-xs font-semibold text-foreground shadow-2xs transition hover:border-emerald-500 hover:bg-surface hover:text-emerald-600 cursor-pointer"
              >
                <Landmark size={13} className="text-emerald-600" />
                <span>Đối soát SePay</span>
              </button>

              <Link
                href="/finance/expenses"
                className="inline-flex items-center gap-1.5 rounded-xl border border-border/80 bg-card px-3 py-1.5 text-xs font-semibold text-foreground shadow-2xs transition hover:border-rose-500 hover:bg-surface hover:text-rose-600"
              >
                <Wallet size={13} className="text-rose-600" />
                <span>Chi phí</span>
              </Link>

              <Link
                href="/reports"
                className="inline-flex items-center gap-1.5 rounded-xl border border-border/80 bg-card px-3 py-1.5 text-xs font-semibold text-foreground shadow-2xs transition hover:border-indigo-500 hover:bg-surface hover:text-indigo-600"
              >
                <PieChart size={13} className="text-indigo-600" />
                <span>Báo cáo P&L</span>
                <ArrowUpRight size={11} className="text-muted-foreground" />
              </Link>
            </div>
          </div>

          {/* Section 1: 4 Macro Financial KPIs */}
          <FinanceExecutiveKpi />

          {/* Section 2: HERO COMPONENT - Bảng Phân Chia Lợi Nhuận Quyết Toán 2 Chủ Sở Hữu */}
          <OwnerProfitSplitHero
            onOpenOwnerDetail={(id, name, code) =>
              setSelectedOwnerForModal({ id, name, code })
            }
          />

          {/* Section 3: Pragmatic Tabbed Workbench */}
          <div className="space-y-3 pt-2">
            {/* Tab Navigation Strip */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-2">
              <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-border/70 bg-card/60 p-1 shadow-2xs">
                <button
                  onClick={() => setActiveTab("buildings")}
                  className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer ${activeTab === "buildings"
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:bg-surface hover:text-foreground"
                    }`}
                >
                  <Building2 size={14} />
                  <span>Hiệu quả Tòa nhà & Phòng</span>
                  <span
                    className={`ml-1 rounded-full px-1.5 py-0.2 text-[10px] ${activeTab === "buildings"
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                      }`}
                  >
                    4
                  </span>
                </button>

                <button
                  onClick={() => setActiveTab("banking")}
                  className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer ${activeTab === "banking"
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:bg-surface hover:text-foreground"
                    }`}
                >
                  <Landmark size={14} />
                  <span>Dòng tiền Ngân hàng & Cảnh báo</span>
                </button>

                <button
                  onClick={() => setActiveTab("trends")}
                  className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer ${activeTab === "trends"
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:bg-surface hover:text-foreground"
                    }`}
                >
                  <TrendingUp size={14} />
                  <span>Biểu đồ Xu hướng 12 Tháng</span>
                </button>

                <button
                  onClick={() => setActiveTab("ledger")}
                  className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer ${activeTab === "ledger"
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:bg-surface hover:text-foreground"
                    }`}
                >
                  <BookOpen size={14} />
                  <span>Sổ Kế toán & Ghi sổ</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsReconciliationModalOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border/80 bg-card px-2.5 py-1 text-xs font-semibold text-foreground shadow-2xs transition hover:border-primary hover:text-primary cursor-pointer"
                >
                  <Sparkles size={12} className="text-amber-500" />
                  <span>Kiểm tra sai lệch đối soát</span>
                </button>
              </div>
            </div>

            {/* Tab 1 Content: Bảng hiệu quả theo Tòa nhà & Phòng */}
            {activeTab === "buildings" && (
              <BuildingRoomsBreakdownTable
                onSelectBuilding={(code) => setSelectedBuildingForModal(code)}
              />
            )}

            {/* Tab 2 Content: Dòng tiền Ngân hàng & Cảnh báo */}
            {activeTab === "banking" && (
              <div className="grid grid-cols-1 items-stretch gap-3.5 lg:grid-cols-12">
                <div className="lg:col-span-7">
                  <BankCashFlowSummary
                    onOpenDetail={() => setIsReconciliationModalOpen(true)}
                  />
                </div>
                <div className="lg:col-span-5">
                  <FinanceAttentionCard />
                </div>
              </div>
            )}

            {/* Tab 3 Content: Biểu đồ xu hướng tài chính */}
            {activeTab === "trends" && (
              <div className="overflow-hidden rounded-2xl border border-border/80 bg-card p-5 shadow-xs">
                <div className="mb-4 flex items-center justify-between border-b border-border/40 pb-3">
                  <div>
                    <h3 className="text-base font-black text-foreground">
                      Biểu Đồ Xu Hướng Doanh Thu, Chi Phí & Lợi Nhuận
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Theo dõi biến động dòng tiền hợp nhất hệ thống năm 2026
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-600">
                    <CheckCircle2 size={13} />
                    Biên độ dương 93%
                  </span>
                </div>
                <OperationsFinanceChart />
              </div>
            )}

            {/* Tab 4 Content: Sổ lệnh kế toán & Ghi sổ */}
            {activeTab === "ledger" && (
              <FinancialCommandLedger
                onOpenReconciliation={() => setIsReconciliationModalOpen(true)}
              />
            )}
          </div>
        </div>
      </main>

      {/* Modal 1: Chi tiết tài chính & phòng của Chủ sở hữu */}
      {selectedOwnerForModal && (
        <OwnerFinancialDetailModal
          isOpen={true}
          onClose={() => setSelectedOwnerForModal(null)}
          ownerId={selectedOwnerForModal.id}
          initialOwnerName={selectedOwnerForModal.name}
          initialOwnerCode={selectedOwnerForModal.code}
        />
      )}

      {/* Modal 2: Đối soát dòng tiền ngân hàng SePay */}
      {isReconciliationModalOpen && (
        <BankCashflowReconciliationModal
          isOpen={true}
          onClose={() => setIsReconciliationModalOpen(false)}
        />
      )}

      {/* Modal 3: Chi tiết hiệu quả tòa nhà */}
      {selectedBuildingForModal && (
        <BuildingPerformanceDetailModal
          isOpen={true}
          onClose={() => setSelectedBuildingForModal(null)}
          buildingCode={selectedBuildingForModal}
        />
      )}

      {/* Financial Drawer for Journal Entries */}
      {selectedJournalId && <FinancialCommandDrawer />}
    </AppShell>
  );
}
