"use client";

import React from "react";
import { ChevronRight, ShieldCheck, Bookmark, FileText, CheckCircle2, RefreshCcw, Banknote, PenTool } from "lucide-react";
import { UI_Deposit } from "../../lib/adapters/deposit.adapter";
import { Card } from "../ui/Card";

export default function OperationsDepositRow({ deposit, onClick }: { deposit: UI_Deposit, onClick: () => void }) {
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case "DRAFT":
      case "PENDING": return "text-[#0ea5e9] bg-[#0ea5e9]/10 border-[#0ea5e9]/20";
      case "PAID": return "text-[#f97316] bg-[#f97316]/10 border-[#f97316]/20";
      case "CONVERTED_TO_CONTRACT": return "text-[#6366f1] bg-[#6366f1]/10 border-[#6366f1]/20";
      case "CANCELLED":
      case "REFUNDED": return "text-rose-500 bg-rose-500/10 border-rose-500/20";
      default: return "text-muted bg-black/5 dark:bg-white/5 border-border";
    }
  };

  const getTypeIcon = () => {
    return deposit.type === "SECURITY" ? <ShieldCheck size={14} className="text-[#8b5cf6]" /> : <Bookmark size={14} className="text-[#0ea5e9]" />;
  };

  const getTypeName = () => {
    switch (deposit.type) {
      case 'BOOKING': return 'Cọc giữ phòng';
      case 'SECURITY': return 'Cọc bảo đảm';
      case 'RESERVATION': return 'Phí giữ chỗ';
      default: return deposit.type;
    }
  };

  const amountStr = new Intl.NumberFormat('vi-VN').format(deposit.amount);

  return (
    <Card 
      data-testid="deposit-card"
      onClick={onClick}
      className="p-[16px] hover:shadow-md hover:border-[#6366f1]/30 hover:-translate-y-[3px] transition-all duration-150 cursor-pointer flex flex-col xl:flex-row xl:items-center gap-[16px] xl:gap-[24px] relative group"
    >
      {/* 1. Header & ID */}
      <div className="flex flex-col gap-[6px] min-w-[220px]">
        <div className="flex items-center gap-[8px]">
          <h4 className="font-black text-[15px] text-[#6366f1] leading-none">{deposit.code || deposit.id}</h4>
          <span data-testid="deposit-status-badge" className={`text-[10px] font-black uppercase px-[6px] py-[2px] rounded-[4px] border ${getStatusColor(deposit.status)}`}>
            {deposit.status}
          </span>
        </div>
        <div className="flex items-center gap-[6px]">
          {getTypeIcon()}
          <span className="font-bold text-[12px] text-muted uppercase">{getTypeName()}</span>
        </div>
        <span className="font-bold text-[11px] text-muted flex items-center gap-[4px] mt-[4px]">
          Ngày tạo: <span className="text-text">{new Date(deposit.createdAt).toLocaleDateString('vi-VN')}</span>
        </span>
      </div>

      {/* 2. Tenant Info */}
      <div className="flex flex-col gap-[4px] flex-1 min-w-[200px]">
        <span className="font-bold text-[14px] text-text">{deposit.customerName}</span>
        <span className="font-medium text-[12px] text-muted">{deposit.customerPhone}</span>
        <span className="font-medium text-[12px] text-muted flex items-center gap-[4px]">
          <span className="font-bold bg-black/5 dark:bg-white/5 px-[6px] py-[2px] rounded-[4px]">{deposit.roomCode}</span> 
          · {deposit.buildingName}
        </span>
      </div>

      {/* 3. Financial Info */}
      <div className="flex flex-col gap-[4px] min-w-[200px]">
        <div className="flex items-center justify-between text-[13px]">
          <span className="font-medium text-muted">Số tiền cọc:</span>
          <span className="font-black text-text">{amountStr}đ</span>
        </div>
        <div className="flex items-center justify-between text-[13px]">
          <span className="font-medium text-muted">Trạng thái:</span>
          <span className={`font-black ${deposit.status === 'PAID' ? 'text-[#8b5cf6]' : 'text-muted'}`}>{deposit.status}</span>
        </div>
      </div>

      {/* Quick Actions Hover Overlay */}
      <div className="absolute inset-0 bg-card/80 backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all duration-150 flex items-center justify-center z-10 rounded-[14px]">
        <div className="flex flex-wrap items-center justify-center gap-[8px] p-[12px] w-full scale-95 group-hover:scale-100 transition-transform duration-150">
          <button aria-label="Xem chi tiết" onClick={(e) => { e.stopPropagation(); onClick(); }} className="w-[36px] h-[36px] rounded-[8px] bg-[#6366f1]/10 text-[#6366f1] hover:bg-[#6366f1]/20 flex flex-col items-center justify-center transition-colors">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </Card>
  );
}
