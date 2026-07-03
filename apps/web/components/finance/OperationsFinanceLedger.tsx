"use client";

import React, { useState } from "react";
import OperationsFinanceLedgerRow, { TxnData } from "./OperationsFinanceLedgerRow";
import OperationsFinanceDrawer from "./OperationsFinanceDrawer";
import { useLedgerQuery } from "@/lib/queries/finance.queries";
import { Loader2 } from "lucide-react";

export default function OperationsFinanceLedger() {
  const [selectedTxn, setSelectedTxn] = useState<TxnData | null>(null);
  const { data: ledgerRows, isLoading, isError } = useLedgerQuery();

  const mappedTxns: any[] = ledgerRows?.map(r => ({
    id: r.journalCode,
    date: new Date(r.date).toLocaleDateString('vi-VN'),
    type: r.debit > 0 ? "Expense" : "Income",
    content: r.description || "N/A",
    room: "N/A", // API needs to return room metadata if applicable
    building: "N/A",
    party: r.accountName,
    category: "General",
    amount: (r.debit > 0 ? r.debit : r.credit).toLocaleString() + " đ",
    method: r.sourceType,
    status: r.status,
    hasDocs: false,
    creator: "System"
  })) || [];

  return (
    <div className="flex flex-col gap-[16px] pb-[40px]">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-[12px] px-[8px]">
        <div className="flex flex-col">
          <h3 className="font-black text-[18px] text-text">Sổ Giao dịch (Ledger)</h3>
          <span className="text-[13px] text-muted font-medium">Chi tiết {mappedTxns.length} giao dịch phát sinh trong kỳ</span>
        </div>
        <div className="flex items-center gap-[12px]">
          <span className="text-[13px] font-bold text-muted bg-black/5 dark:bg-white/5 px-[12px] py-[4px] rounded-[8px]">Trang 1 / 1</span>
        </div>
      </div>

      <div className="flex flex-col gap-[12px]">
        {isLoading && (
          <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-[#4f46e5]" /></div>
        )}
        {isError && (
          <div className="p-8 text-rose-500 text-center font-bold">Không thể tải dữ liệu giao dịch</div>
        )}
        {!isLoading && !isError && mappedTxns.length === 0 && (
          <div className="p-8 text-muted text-center font-bold">Không có giao dịch nào</div>
        )}
        {!isLoading && mappedTxns.map(txn => (
          <OperationsFinanceLedgerRow 
            key={txn.id + Math.random()} 
            txn={txn} 
            onClick={() => setSelectedTxn(txn)} 
          />
        ))}
      </div>

      {selectedTxn && (
        <OperationsFinanceDrawer 
          txn={selectedTxn} 
          onClose={() => setSelectedTxn(null)} 
        />
      )}
    </div>
  );
}
