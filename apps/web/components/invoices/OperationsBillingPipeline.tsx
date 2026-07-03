"use client";

import React, { useState } from "react";
import { ChevronRight, FilePlus, Send, AlertTriangle, CheckCircle2, Receipt } from "lucide-react";
import { Card } from "../ui/Card";

export default function OperationsBillingPipeline() {
  const [activeStage, setActiveStage] = useState<number | null>(null);

  const pipeline = [
    { id: 1, label: "Created", icon: FilePlus, count: 12, amount: "45M", percent: "5%", color: "text-[#6366f1]", bg: "bg-[#6366f1]/10", border: "border-[#6366f1]" },
    { id: 2, label: "Sent", icon: Send, count: 34, amount: "120M", percent: "14%", color: "text-[#0ea5e9]", bg: "bg-[#0ea5e9]/10", border: "border-[#0ea5e9]" },
    { id: 3, label: "Partially Paid", icon: Receipt, count: 5, amount: "15M", percent: "2%", color: "text-[#f97316]", bg: "bg-[#f97316]/10", border: "border-[#f97316]" },
    { id: 4, label: "Paid", icon: CheckCircle2, count: 156, amount: "650M", percent: "77%", color: "text-[#10b981]", bg: "bg-[#10b981]/10", border: "border-[#10b981]" },
    { id: 5, label: "Overdue", icon: AlertTriangle, count: 14, amount: "20M", percent: "2%", color: "text-rose-500", bg: "bg-rose-500/10", border: "border-rose-500" },
  ];

  return (
    <Card tabIndex={0} data-testid="billing-pipeline" className="p-[16px] flex items-center justify-between gap-[8px] overflow-x-auto no-scrollbar focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
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
            <div className="flex items-center justify-between mb-[12px]">
              <div className="flex items-center gap-[8px]">
                <div className={`w-[24px] h-[24px] rounded-full flex items-center justify-center ${activeStage === stage.id ? 'bg-background' : stage.bg}`}>
                  <stage.icon size={12} className={stage.color} />
                </div>
                <span className={`font-black text-[11px] uppercase tracking-wider ${activeStage === stage.id ? stage.color : 'text-muted group-hover:text-text'} transition-colors`}>{stage.label}</span>
              </div>
              <span className={`font-bold text-[11px] px-[6px] py-[2px] rounded-[4px] ${activeStage === stage.id ? 'bg-background text-text' : 'bg-black/5 dark:bg-white/5 text-muted'}`}>
                {stage.percent}
              </span>
            </div>
            
            <div className="flex items-end justify-between">
              <div className="flex items-end gap-[4px]">
                <span className={`font-black text-[22px] leading-none ${activeStage === stage.id ? 'text-text' : 'text-text'}`}>{stage.count}</span>
                <span className="text-[11px] font-bold text-muted mb-[2px]">hóa đơn</span>
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
