"use client";

import React from "react";
import { ChevronRight, FileText, CheckCircle2, MoreVertical, Paperclip, Wallet, AlertTriangle } from "lucide-react";

export type TxnType = "Income" | "Expense" | "Adjustment";
export type TxnStatus = "Verified" | "Pending" | "Error";

export interface TxnData {
  id: string;
  date: string;
  type: TxnType;
  content: string;
  room: string;
  building: string;
  party: string;
  category: string;
  amount: string;
  method: string;
  status: TxnStatus;
  hasDocs: boolean;
  creator: string;
}

export default function OperationsFinanceLedgerRow({ txn, onClick }: { txn: TxnData, onClick: () => void }) {
  
  const getTypeColor = (type: TxnType) => {
    switch (type) {
      case "Income": return "text-[#8b5cf6] bg-[#8b5cf6]/10 border-[#8b5cf6]/20";
      case "Expense": return "text-rose-500 bg-rose-500/10 border-rose-500/20";
      case "Adjustment": return "text-[#f97316] bg-[#f97316]/10 border-[#f97316]/20";
    }
  };

  const getStatusColor = (status: TxnStatus) => {
    switch (status) {
      case "Verified": return "text-[#0ea5e9]";
      case "Pending": return "text-[#f97316]";
      case "Error": return "text-rose-500";
    }
  };

  const amountSign = txn.type === "Income" ? "+" : txn.type === "Expense" ? "-" : "";

  return (
    <div 
      className="bg-card border border-border rounded-[14px] p-[16px] shadow-sm hover:shadow-md hover:border-[#0ea5e9]/30 hover:-translate-y-[3px] transition-all duration-150 cursor-pointer flex flex-col xl:flex-row xl:items-center gap-[16px] xl:gap-[24px] relative group"
    >
      {/* 1. Header & ID */}
      <div className="flex flex-col gap-[6px] min-w-[180px]">
        <div className="flex items-center gap-[8px]">
          <h4 className="font-black text-[14px] text-text leading-none">{txn.id}</h4>
          <span className={`text-[10px] font-black uppercase px-[6px] py-[2px] rounded-[4px] border ${getTypeColor(txn.type)}`}>
            {txn.type === "Income" ? "Thu" : txn.type === "Expense" ? "Chi" : "Đ/C"}
          </span>
        </div>
        <div className="flex items-center gap-[6px] mt-[4px]">
          <span className="font-bold text-[12px] text-muted">{txn.date}</span>
          <span className="w-[4px] h-[4px] rounded-full bg-border" />
          <span className="font-bold text-[12px] text-muted">{txn.creator}</span>
        </div>
      </div>

      {/* 2. Content Info */}
      <div className="flex flex-col gap-[4px] min-w-[220px]">
        <span className="font-bold text-[13px] text-text truncate max-w-[220px]">{txn.content}</span>
        <div className="flex items-center gap-[6px]">
          <span className="font-bold text-[12px] text-muted flex items-center gap-[4px]">
            <span className="bg-black/5 dark:bg-white/5 px-[6px] py-[2px] rounded-[4px]">{txn.room}</span> 
            · {txn.building}
          </span>
        </div>
        <div className="flex items-center gap-[6px]">
          <span className="font-bold text-[11px] text-[#6366f1] bg-[#6366f1]/10 px-[6px] py-[2px] rounded-[4px] truncate max-w-[150px]">{txn.party}</span>
        </div>
      </div>

      {/* 3. Category & Method */}
      <div className="flex flex-col gap-[6px] min-w-[160px]">
        <div className="flex items-center gap-[8px]">
          <span className="font-bold text-[12px] text-muted uppercase">Loại:</span>
          <span className="font-bold text-[13px] text-text truncate max-w-[120px]">{txn.category}</span>
        </div>
        <div className="flex items-center gap-[8px]">
          <span className="font-bold text-[12px] text-muted uppercase">PT:</span>
          <span className="font-medium text-[13px] text-text">{txn.method}</span>
        </div>
      </div>

      {/* 4. Financial Info & Status */}
      <div className="flex flex-col gap-[8px] flex-1 min-w-[180px] items-end">
        <span className={`font-black text-[18px] ${txn.type === 'Income' ? 'text-[#8b5cf6]' : txn.type === 'Expense' ? 'text-rose-500' : 'text-[#f97316]'}`}>
          {amountSign}{txn.amount}đ
        </span>
        <div className="flex items-center gap-[12px]">
          {txn.hasDocs ? (
            <div className="flex items-center gap-[4px] text-muted">
              <Paperclip size={12} />
              <span className="font-bold text-[11px]">Có chứng từ</span>
            </div>
          ) : (
            <div className="flex items-center gap-[4px] text-rose-500">
              <AlertTriangle size={12} />
              <span className="font-bold text-[11px]">Thiếu chứng từ</span>
            </div>
          )}
          <span className="w-[4px] h-[4px] rounded-full bg-border" />
          <div className={`flex items-center gap-[4px] ${getStatusColor(txn.status)}`}>
            {txn.status === "Verified" ? <CheckCircle2 size={12} /> : <Clock size={12} />}
            <span className="font-black text-[11px] uppercase tracking-wider">
              {txn.status === "Verified" ? "Đã đối soát" : txn.status === "Pending" ? "Chờ đối soát" : "Lỗi"}
            </span>
          </div>
        </div>
      </div>

      {/* Quick Actions Hover Overlay */}
      <div className="absolute inset-0 bg-card/80 backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all duration-150 flex items-center justify-center z-10 rounded-[14px]">
        <div className="flex flex-wrap items-center justify-center gap-[8px] p-[12px] w-full scale-95 group-hover:scale-100 transition-transform duration-150">
          <button onClick={(e) => { e.stopPropagation(); onClick(); }} className="w-[36px] h-[36px] rounded-[8px] bg-[#0ea5e9]/10 text-[#0ea5e9] hover:bg-[#0ea5e9]/20 flex flex-col items-center justify-center transition-colors">
            <ChevronRight size={16} />
          </button>
          
          {(txn.status === "Pending") && (
            <button onClick={(e) => { e.stopPropagation(); }} className="h-[36px] px-[12px] rounded-[8px] bg-[#8b5cf6]/10 text-[#8b5cf6] hover:bg-[#8b5cf6]/20 font-bold text-[13px] flex items-center gap-[6px] transition-colors">
              <CheckCircle2 size={14} /> Đối soát ngay
            </button>
          )}

          {(!txn.hasDocs) && (
            <button onClick={(e) => { e.stopPropagation(); }} className="h-[36px] px-[12px] rounded-[8px] bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 font-bold text-[13px] flex items-center gap-[6px] transition-colors">
              <Paperclip size={14} /> Bổ sung chứng từ
            </button>
          )}
          
          <button onClick={(e) => { e.stopPropagation(); }} className="h-[36px] px-[12px] rounded-[8px] bg-black/5 dark:bg-white/5 text-text hover:bg-black/10 dark:hover:bg-white/10 font-bold text-[13px] flex items-center gap-[6px] transition-colors">
            <FileText size={14} /> In phiếu
          </button>
        </div>
      </div>
    </div>
  );
}

// Quick hack for missing icon in this scope
const Clock = ({ size }: { size: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
);
