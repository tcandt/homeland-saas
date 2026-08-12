"use client";

import React from "react";
import { ChevronRight, FileText, Send, Receipt, Wallet, Bell } from "lucide-react";
import { getInvoiceFinancials } from "@/lib/invoices/invoice-financials";
import { Card } from "../ui/Card";

export type BillingStatus = "Created" | "Sent" | "Partially Paid" | "Paid" | "Overdue";

export default function OperationsBillingRow({ invoice, onClick }: { invoice: any, onClick: () => void }) {
  
  const getStatusColor = (status: BillingStatus) => {
    switch (status) {
      case "Created": return "text-[#6366f1] bg-[#6366f1]/10 border-[#6366f1]/20";
      case "Sent": return "text-[#0ea5e9] bg-[#0ea5e9]/10 border-[#0ea5e9]/20";
      case "Partially Paid": return "text-[#f97316] bg-[#f97316]/10 border-[#f97316]/20";
      case "Paid": return "text-[#8b5cf6] bg-[#8b5cf6]/10 border-[#8b5cf6]/20";
      case "Overdue": return "text-rose-500 bg-rose-500/10 border-rose-500/20";
      default: return "text-muted bg-black/5 dark:bg-white/5 border-border";
    }
  };

  const status = invoice.status || 'Created';
  const financials = getInvoiceFinancials(invoice);
  const totalAmount = financials.total;
  const paidAmount = financials.paid;
  const debtAmount = financials.remaining;
  const paidPercent = financials.settledPercent;

  const getProgressColor = () => {
    if (status === "Overdue") return "bg-rose-500";
    if (paidPercent === 100) return "bg-[#8b5cf6]";
    if (paidPercent > 0) return "bg-[#6366f1]";
    return "bg-border";
  };

  return (
    <Card 
      data-testid="invoice-card"
      onClick={onClick}
      className="p-[16px] hover:shadow-md hover:border-[#6366f1]/30 hover:-translate-y-[3px] transition-all duration-150 cursor-pointer flex flex-col xl:flex-row xl:items-center gap-[16px] xl:gap-[24px] relative group"
    >
      {/* 1. Header & ID */}
      <div className="flex flex-col gap-[6px] min-w-[200px]">
        <div className="flex items-center gap-[8px]">
          <h4 className="font-black text-[15px] text-[#6366f1] leading-none">{invoice.code || invoice.id.slice(0,8)}</h4>
          <span data-testid="invoice-status-badge" className={`text-[10px] font-black uppercase px-[6px] py-[2px] rounded-[4px] border ${getStatusColor(status as any)}`}>
            {status}
          </span>
        </div>
        <div className="flex flex-col gap-[4px] mt-[4px]">
          <span className="font-bold text-[14px] text-text">{invoice.customer?.name || 'Chưa rõ khách thuê'}</span>
          <span className="font-bold text-[12px] text-muted flex items-center gap-[4px]">
            <span className="bg-black/5 dark:bg-white/5 px-[6px] py-[2px] rounded-[4px]">{invoice.contract?.room?.number || 'Chưa phòng'}</span> 
            · {invoice.contract?.room?.building?.name || 'Chưa tòa nhà'}
          </span>
        </div>
      </div>

      {/* 2. Dates Info */}
      <div className="flex flex-col gap-[6px] min-w-[160px]">
        <div className="flex items-center gap-[8px]">
          <span className="font-bold text-[12px] text-muted uppercase">Kỳ:</span>
          <span className="font-bold text-[13px] text-text">{invoice.period || '---'}</span>
        </div>
        <div className="flex items-center gap-[8px]">
          <span className="font-bold text-[12px] text-muted uppercase">Lập:</span>
          <span className="font-medium text-[13px] text-text">{new Date(invoice.createdAt || invoice.dueDate).toLocaleDateString('vi-VN')}</span>
        </div>
        <div className="flex items-center gap-[8px]">
          <span className="font-bold text-[12px] text-muted uppercase">Hạn:</span>
          <span className={`font-black text-[13px] ${status === 'Overdue' ? 'text-rose-500' : 'text-text'}`}>{new Date(invoice.dueDate).toLocaleDateString('vi-VN')}</span>
        </div>
      </div>

      {/* 3. Financial Info & Progress */}
      <div className="flex flex-col gap-[8px] flex-1 min-w-[240px]">
        <div className="flex items-center justify-between text-[13px]">
          <div className="flex flex-col gap-[2px]">
            <span className="font-bold text-[11px] text-muted uppercase">Tổng tiền</span>
            <span className="font-black text-text">{totalAmount.toLocaleString()}đ</span>
          </div>
          <div className="flex flex-col gap-[2px] items-center">
            <span className="font-bold text-[11px] text-muted uppercase">Đã thu</span>
            <span className={`font-black ${paidPercent > 0 ? 'text-[#8b5cf6]' : 'text-text'}`}>{paidAmount.toLocaleString()}đ</span>
          </div>
          <div className="flex flex-col gap-[2px] items-end">
            <span className="font-bold text-[11px] text-muted uppercase">Còn nợ</span>
            <span className={`font-black ${status === 'Overdue' ? 'text-rose-500' : paidPercent === 100 ? 'text-muted' : 'text-text'}`}>{debtAmount.toLocaleString()}đ</span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-[6px] bg-black/5 dark:bg-white/5 rounded-full overflow-hidden flex relative mt-[4px]">
          <div 
            className={`h-full rounded-full transition-all duration-500 ${getProgressColor()}`} 
            style={{ width: `${paidPercent}%` }} 
          />
        </div>
        <div className="flex items-center justify-between mt-[2px]">
          <span className={`font-black text-[12px] ${getProgressColor().replace('bg-', 'text-')}`}>{paidPercent}%</span>
          <span className="font-bold text-[11px] text-muted">Nhắc: {invoice.lastReminder || 'Chưa nhắc'}</span>
        </div>
      </div>

      {/* Quick Actions Hover Overlay */}
      <div className="absolute inset-0 bg-card/80 backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all duration-150 flex items-center justify-center z-10 rounded-[14px]">
        <div className="flex flex-wrap items-center justify-center gap-[8px] p-[12px] w-full scale-95 group-hover:scale-100 transition-transform duration-150">
          <button aria-label="Xem chi tiết" onClick={(e) => { e.stopPropagation(); onClick(); }} className="w-[36px] h-[36px] rounded-[8px] bg-[#6366f1]/10 text-[#6366f1] hover:bg-[#6366f1]/20 flex flex-col items-center justify-center transition-colors">
            <ChevronRight size={16} />
          </button>
          
          {(status !== "Paid") && (
            <button onClick={(e) => { e.stopPropagation(); }} className="h-[36px] px-[12px] rounded-[8px] bg-[#8b5cf6]/10 text-[#8b5cf6] hover:bg-[#8b5cf6]/20 font-bold text-[13px] flex items-center gap-[6px] transition-colors">
              <Wallet size={14} /> Thu tiền
            </button>
          )}

          {(status === "Overdue" || status === "Sent" || status === "Partially Paid") && (
            <button onClick={(e) => { e.stopPropagation(); }} className="h-[36px] px-[12px] rounded-[8px] bg-[#f97316]/10 text-[#f97316] hover:bg-[#f97316]/20 font-bold text-[13px] flex items-center gap-[6px] transition-colors">
              <Bell size={14} /> Nhắc nợ
            </button>
          )}
          
          <button onClick={(e) => { e.stopPropagation(); }} className="h-[36px] px-[12px] rounded-[8px] bg-black/5 dark:bg-white/5 text-text hover:bg-black/10 dark:hover:bg-white/10 font-bold text-[13px] flex items-center gap-[6px] transition-colors">
            <FileText size={14} /> Xem PDF
          </button>
        </div>
      </div>
    </Card>
  );
}
