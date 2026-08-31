"use client";

import React from "react";
import AppShell from "@/components/layout/AppShell";
import BankTransactionHistory from "@/components/finance/BankTransactionHistory";

export default function FinanceTransactionsPage() {
  return (
    <AppShell>
      <div className="-m-4 h-[calc(100dvh-87px)] w-[calc(100%+32px)] overflow-auto bg-background md:h-[calc(100dvh-80px)] p-2.5 md:p-3 flex flex-col gap-2.5">
        <BankTransactionHistory />
      </div>
    </AppShell>
  );
}
