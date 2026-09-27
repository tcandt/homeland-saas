"use client";

import React, { useState } from "react";
import AppShell from "@/components/layout/AppShell";
import BankTransactionHistory from "@/components/finance/BankTransactionHistory";
import UnifiedTransactionHistory from "@/components/finance/UnifiedTransactionHistory";

export default function FinanceTransactionsPage() {
  const [view, setView] = useState<"unified" | "bank">("unified");
  return (
    <AppShell>
      <div className="-m-4 h-[calc(100dvh-87px)] w-[calc(100%+32px)] overflow-auto bg-background md:h-[calc(100dvh-80px)] p-2.5 md:p-3 flex flex-col gap-2.5">
        <div className="flex shrink-0 gap-2 rounded-2xl border border-border bg-card p-2" role="tablist" aria-label="Loại lịch sử giao dịch">
          <button type="button" role="tab" aria-selected={view === "unified"} onClick={() => setView("unified")} className={`min-h-10 rounded-xl px-4 text-xs font-black ${view === "unified" ? "bg-primary text-white" : "text-muted hover:bg-background"}`}>Tất cả dòng tiền</button>
          <button type="button" role="tab" aria-selected={view === "bank"} onClick={() => setView("bank")} className={`min-h-10 rounded-xl px-4 text-xs font-black ${view === "bank" ? "bg-primary text-white" : "text-muted hover:bg-background"}`}>Ngân hàng / SePay</button>
        </div>
        {view === "unified" ? <UnifiedTransactionHistory /> : <BankTransactionHistory />}
      </div>
    </AppShell>
  );
}
