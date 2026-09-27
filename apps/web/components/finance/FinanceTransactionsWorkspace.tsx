"use client";

import React, { useState } from "react";
import { BadgeCheck, Landmark, ListTree } from "lucide-react";
import BankTransactionHistory from "@/components/finance/BankTransactionHistory";
import FinanceDisclosureSection from "@/components/finance/FinanceDisclosureSection";
import SePayReconciliationAuditPanel from "@/components/finance/SePayReconciliationAuditPanel";
import SePayReconciliationSummary from "@/components/finance/SePayReconciliationSummary";
import UnifiedTransactionHistory from "@/components/finance/UnifiedTransactionHistory";

export type FinanceTransactionView = "unified" | "bank" | "reconciliation";

type FinanceTransactionsWorkspaceProps = {
  initialView?: FinanceTransactionView;
};

const tabs: Array<{
  id: FinanceTransactionView;
  label: string;
  description: string;
  icon: React.ElementType;
}> = [
  {
    id: "unified",
    label: "Tất cả dòng tiền",
    description: "Bút toán hợp nhất",
    icon: ListTree,
  },
  {
    id: "bank",
    label: "Ngân hàng / SePay",
    description: "Biến động tài khoản",
    icon: Landmark,
  },
  {
    id: "reconciliation",
    label: "Đối soát",
    description: "Khớp và xử lý sai lệch",
    icon: BadgeCheck,
  },
];

export default function FinanceTransactionsWorkspace({
  initialView = "unified",
}: FinanceTransactionsWorkspaceProps) {
  const [view, setView] = useState<FinanceTransactionView>(initialView);

  return (
    <main
      data-testid="finance-transactions-workspace"
      className="-m-4 flex h-[calc(100dvh-87px)] w-[calc(100%+32px)] flex-col gap-2.5 overflow-auto bg-background p-2.5 md:h-[calc(100dvh-80px)] md:p-3"
    >
      <nav
        role="tablist"
        aria-label="Nhóm lịch sử giao dịch"
        className="grid shrink-0 grid-cols-1 gap-2 rounded-2xl border border-border/70 bg-card p-2 shadow-2xs sm:grid-cols-3"
      >
        {tabs.map((tab) => {
          const active = view === tab.id;
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`finance-transactions-tab-${tab.id}`}
              aria-selected={active}
              aria-controls={`finance-transactions-panel-${tab.id}`}
              data-testid={`finance-transactions-tab-${tab.id}`}
              onClick={() => setView(tab.id)}
              className={`flex min-h-14 items-center gap-3 rounded-xl border px-3 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                active
                  ? "border-primary/30 bg-primary text-white shadow-md shadow-primary/15"
                  : "border-transparent text-muted hover:border-border hover:bg-background hover:text-text"
              }`}
            >
              <span
                className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                  active ? "bg-white/15" : "bg-primary/10 text-primary"
                }`}
              >
                <Icon size={18} aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-black">{tab.label}</span>
                <span className={`mt-0.5 block truncate text-[11px] font-semibold ${active ? "text-white/75" : "text-muted"}`}>
                  {tab.description}
                </span>
              </span>
            </button>
          );
        })}
      </nav>

      <section
        id={`finance-transactions-panel-${view}`}
        role="tabpanel"
        aria-labelledby={`finance-transactions-tab-${view}`}
        className="min-h-0 flex-1"
      >
        {view === "unified" && <UnifiedTransactionHistory />}
        {view === "bank" && <BankTransactionHistory />}
        {view === "reconciliation" && (
          <div className="flex flex-col gap-3" data-testid="finance-reconciliation-page">
            <SePayReconciliationSummary />
            <FinanceDisclosureSection
              testId="finance-reconciliation-audit-disclosure"
              eyebrow="Kiểm soát nâng cao"
              title="Audit sai lệch thanh toán"
              description="Dò chéo webhook, payment request và chứng từ nguồn. Chỉ mở khi cần điều tra trạng thái bất thường."
            >
              <SePayReconciliationAuditPanel />
            </FinanceDisclosureSection>
          </div>
        )}
      </section>
    </main>
  );
}
