"use client";

import React from "react";
import { ChevronRight, FileText, PenTool, CheckCircle2, AlertTriangle, FileSignature, Coins, Trash2, CalendarClock } from "lucide-react";
import { Badge } from "../ui/Badge";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";

import { getContractStatusConfig } from "../../lib/contracts/contract-status";
export default function OperationsContractRow({ contract, onClick }: { contract: any, onClick: () => void }) {
  
  const statusConfig = getContractStatusConfig(contract.status);

  const hasDebt = false; // Placeholder for debt
  const rentAmount = contract.monthlyRent || 0;
  const depositAmount = contract.depositMoney || 0;
  
  // Calculate progress for the mini timeline
  const startDate = new Date(contract.startDate);
  const endDate = new Date(contract.endDate);
  const today = new Date();
  
  const totalDays = Math.max(1, Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
  const daysRemaining = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const passedDays = Math.max(0, totalDays - daysRemaining);
  const progressPercent = Math.min(100, Math.max(0, (passedDays / totalDays) * 100));

  return (
    <Card 
      data-testid="contract-card"
      onClick={onClick}
      className="p-4 hover:shadow-md hover:border-[#6366f1]/30 hover:-translate-y-[2px] transition-all duration-200 cursor-pointer flex flex-col xl:flex-row xl:items-center gap-4 xl:gap-6 relative group"
    >
      {/* 1. ID & Main Info */}
      <div className="flex flex-col gap-[4px] min-w-[200px]">
        <h4 className="font-black text-[15px] text-[#6366f1] leading-none">{contract.code || contract.id.slice(0,8)}</h4>
        <span className="font-bold text-[14px] text-text">{contract.customer?.fullName || contract.customer?.name || 'Chưa rõ'}</span>
        <span className="font-medium text-[12px] text-muted flex items-center gap-[4px]">
          <span className="font-bold bg-black/5 dark:bg-white/5 px-[6px] py-[2px] rounded-[4px]">{contract.room?.number || 'Chưa xếp phòng'}</span> 
          · {contract.room?.building?.name || 'Chưa có tòa nhà'}
        </span>
      </div>

      {/* 2. Timeline & Duration */}
      <div className="flex flex-col gap-[6px] flex-1 min-w-[220px]">
        <div className="flex items-center justify-between text-[12px] font-bold">
          <span className="text-text">{new Date(contract.startDate).toLocaleDateString('vi-VN')}</span>
          <span className="text-muted">→</span>
          <span className="text-text">{new Date(contract.endDate).toLocaleDateString('vi-VN')}</span>
        </div>
        
        {/* Progress Bar */}
        <div className="h-[6px] bg-black/5 dark:bg-white/5 rounded-full overflow-hidden flex">
          <div 
            className={`h-full rounded-full ${daysRemaining < 30 ? 'bg-rose-500' : daysRemaining < 60 ? 'bg-[#f97316]' : 'bg-[#10b981]'}`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        
        <div className="flex items-center justify-center">
          <span className={`text-[11px] font-black uppercase tracking-wide ${daysRemaining < 30 ? 'text-rose-500' : 'text-muted'}`}>
            Còn {daysRemaining} ngày
          </span>
        </div>
      </div>

      {/* 3. Financial Info */}
      <div className="flex flex-col gap-[4px] min-w-[180px]">
        <div className="flex items-center justify-between text-[13px]">
          <span className="font-medium text-muted">Thuê:</span>
          <span className="font-bold text-text">{rentAmount.toLocaleString()}đ</span>
        </div>
        <div className="flex items-center justify-between text-[13px]">
          <span className="font-medium text-muted">Cọc:</span>
          <span className="font-bold text-text">{depositAmount.toLocaleString()}đ</span>
        </div>
        <div className="flex items-center justify-between text-[13px]">
          <span className="font-medium text-muted">Nợ:</span>
          <span className={`font-black ${hasDebt ? 'text-rose-500' : 'text-[#10b981]'}`}>0đ</span>
        </div>
      </div>

      {/* 4. Status Badges */}
      <div className="flex flex-col items-end gap-[6px] min-w-[120px]">
        <Badge data-testid="contract-status-badge" variant={statusConfig.color}>
          {statusConfig.label}
        </Badge>
        <div className="flex items-center gap-[4px] text-[12px] font-bold text-muted">
          <CheckCircle2 size={14} className="text-[#10b981]" /> Đã ký
        </div>
      </div>

      {/* Quick Actions Hover Overlay */}
      <div className="absolute inset-0 bg-card/80 backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center z-10 rounded-[14px]">
        <div className="flex flex-wrap items-center justify-center gap-[8px] p-[12px] w-full scale-95 group-hover:scale-100 transition-transform duration-300">
          <Button aria-label="Xem chi tiết" variant="ghost" onClick={(e) => { e.stopPropagation(); onClick(); }} className="w-9 h-9 p-0 text-[#6366f1] hover:bg-[#6366f1]/10">
            <ChevronRight size={16} />
          </Button>
          {!statusConfig.isTerminal && (
            <>
              <Button variant="ghost" onClick={(e) => { e.stopPropagation(); }} className="h-9 px-3 text-blue-500 hover:bg-blue-500/10">
                <PenTool size={14} className="mr-1.5" /> Gửi ký
              </Button>
              <Button variant="ghost" onClick={(e) => { e.stopPropagation(); }} className="h-9 px-3 text-[#10b981] hover:bg-[#10b981]/10">
                <Coins size={14} className="mr-1.5" /> Thu tiền
              </Button>
              <Button variant="ghost" onClick={(e) => { e.stopPropagation(); }} className="h-9 px-3 text-[#f97316] hover:bg-[#f97316]/10">
                <CalendarClock size={14} className="mr-1.5" /> Gia hạn
              </Button>
              <Button variant="ghost" onClick={(e) => { e.stopPropagation(); }} className="h-9 px-3 text-emerald-500 hover:bg-emerald-500/10">
                <FileText size={14} className="mr-1.5" /> Xuất HĐ
              </Button>
              <Button variant="ghost" onClick={(e) => { e.stopPropagation(); }} className="h-9 px-3 text-rose-500 hover:bg-rose-500/10">
                <Trash2 size={14} className="mr-1.5" /> Chấm dứt
              </Button>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}
