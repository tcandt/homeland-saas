"use client";

import React, { useState } from "react";
import { ChevronRight, Bookmark, Coins, FileText, RefreshCcw, CheckCircle2 } from "lucide-react";
import { Card } from "../ui/Card";

export default function OperationsDepositPipeline() {
  const [activeStage, setActiveStage] = useState<number | null>(null);

  const pipeline = [
    { id: 1, label: "Reservation", icon: Bookmark, count: 12, amount: "15M", color: "text-[#0ea5e9]", bg: "bg-[#0ea5e9]/10", border: "border-[#0ea5e9]" },
    { id: 2, label: "Deposit Collected", icon: Coins, count: 45, amount: "120M", color: "text-[#f97316]", bg: "bg-[#f97316]/10", border: "border-[#f97316]" },
    { id: 3, label: "Contract Created", icon: FileText, count: 32, amount: "95M", color: "text-[#6366f1]", bg: "bg-[#6366f1]/10", border: "border-[#6366f1]" },
    { id: 4, label: "Refund Pending", icon: RefreshCcw, count: 8, amount: "24M", color: "text-rose-500", bg: "bg-rose-500/10", border: "border-rose-500" },
    { id: 5, label: "Completed", icon: CheckCircle2, count: 156, amount: "450M", color: "text-[#10b981]", bg: "bg-[#10b981]/10", border: "border-[#10b981]" },
  ];

  return (
    <Card tabIndex={0} data-testid="deposits-pipeline" className="p-[16px] flex items-center justify-between gap-[8px] overflow-x-auto no-scrollbar focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
      {pipeline.map((stage, idx) => (
        <React.Fragment key={stage.id}>
          <div 
            onClick={() => setActiveStage(activeStage === stage.id ? null : stage.id)}
            className={`flex-1 min-w-[160px] p-[12px] rounded-[12px] border cursor-pointer transition-all duration-200 group relative overflow-hidden ${
              activeStage === stage.id 
                ? `${stage.border} shadow-sm ${stage.bg}` 
                : 'border-transparent hover:border-border hover:bg-black/5 dark:hover:bg-white/5'
            }`}
          >
            <div className="flex items-center gap-[8px] mb-[12px]">
              <div className={`w-[24px] h-[24px] rounded-full flex items-center justify-center ${activeStage === stage.id ? 'bg-background' : stage.bg}`}>
                <stage.icon size={12} className={stage.color} />
              </div>
              <span className={`font-black text-[11px] uppercase tracking-wider ${activeStage === stage.id ? stage.color : 'text-muted group-hover:text-text'} transition-colors`}>{stage.label}</span>
            </div>
            
            <div className="flex items-end justify-between">
              <div className="flex items-end gap-[4px]">
                <span className={`font-black text-[22px] leading-none ${activeStage === stage.id ? 'text-text' : 'text-text'}`}>{stage.count}</span>
                <span className="text-[11px] font-bold text-muted mb-[2px]">phiếu</span>
              </div>
              <span className={`font-black text-[14px] ${activeStage === stage.id ? stage.color : 'text-text'}`}>{stage.amount}</span>
            </div>
          </div>

          {idx < pipeline.length - 1 && (
            <div className="flex items-center justify-center text-muted px-[4px]">
              <ChevronRight size={16} className="opacity-30" />
            </div>
          )}
        </React.Fragment>
      ))}
    </Card>
  );
}
