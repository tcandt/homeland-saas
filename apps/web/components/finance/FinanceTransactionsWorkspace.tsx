"use client";

import { useState } from "react";
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
}> = [
  {
    id: "unified",
    label: "Tất cả dòng tiền",
  },
  {
    id: "bank",
    label: "Ngân hàng",
  },
  {
    id: "reconciliation",
    label: "Đối soát",
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
      <nav role="tablist" aria-label="Nhóm lịch sử giao dịch" className="flex shrink-0 gap-1 overflow-x-auto rounded-xl border border-border/70 bg-card p-1 shadow-2xs">
        {tabs.map((tab) => {
          const active = view === tab.id;

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
              className={`min-h-10 shrink-0 rounded-lg px-4 text-xs font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                active
                  ? "bg-primary text-white shadow-sm"
                  : "text-muted hover:bg-background hover:text-text"
              }`}
            >
              {tab.label}
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
