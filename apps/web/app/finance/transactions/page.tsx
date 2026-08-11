"use client";

import React from "react";
import AppShell from "@/components/layout/AppShell";
import BankTransactionHistory from "@/components/finance/BankTransactionHistory";

export default function FinanceTransactionsPage() {
  return (
    <AppShell>
      <div className="flex h-[calc(100dvh-87px)] min-h-0 w-full flex-col md:h-[calc(100dvh-112px)]">
        <BankTransactionHistory />
      </div>
    </AppShell>
  );
}
