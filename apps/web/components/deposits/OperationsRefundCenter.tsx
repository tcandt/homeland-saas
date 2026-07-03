"use client";

import React from "react";
import { RefreshCcw, AlertTriangle, CalendarClock, ChevronRight } from "lucide-react";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";

export default function OperationsRefundCenter() {
  const refunds = [
    { id: "RF-001", tenantName: "Phạm Văn D", room: "P.401", amount: "5.000.000", days: "Hôm nay", status: "today" },
    { id: "RF-002", tenantName: "Lê Thị E", room: "P.205", amount: "12.000.000", days: "Trễ 2 ngày", status: "overdue" },
    { id: "RF-003", tenantName: "Nguyễn Văn F", room: "P.108", amount: "6.500.000", days: "Còn 3 ngày", status: "week" },
  ];

  return (
    <Card data-testid="deposits-refund-center" className="flex flex-col gap-[20px] h-full sticky top-[24px]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-[8px]">
          <div className="w-[36px] h-[36px] rounded-full bg-rose-500/10 flex items-center justify-center">
            <RefreshCcw size={18} className="text-rose-500" />
          </div>
          <div className="flex flex-col">
            <h3 className="font-black text-[16px] text-text leading-tight">Refund Center</h3>
            <span className="font-bold text-[12px] text-muted">Chờ hoàn tiền</span>
          </div>
        </div>
        <button className="text-[12px] font-bold text-[#6366f1] hover:underline">Xem tất cả</button>
      </div>

      <div className="flex gap-[8px]">
        <div className="flex-1 bg-black/5 dark:bg-white/5 rounded-[10px] p-[10px] flex flex-col items-center justify-center">
          <span className="font-black text-[18px] text-[#6366f1]">2</span>
          <span className="font-bold text-[11px] text-muted uppercase">Hôm nay</span>
        </div>
        <div className="flex-1 bg-black/5 dark:bg-white/5 rounded-[10px] p-[10px] flex flex-col items-center justify-center">
          <span className="font-black text-[18px] text-text">5</span>
          <span className="font-bold text-[11px] text-muted uppercase">Tuần này</span>
        </div>
        <div className="flex-1 bg-rose-500/10 border border-rose-500/20 rounded-[10px] p-[10px] flex flex-col items-center justify-center">
          <span className="font-black text-[18px] text-rose-500">1</span>
          <span className="font-bold text-[11px] text-rose-500 uppercase">Quá hạn</span>
        </div>
      </div>

      <div className="flex flex-col gap-[12px] mt-[8px]">
        {refunds.map((refund, idx) => (
          <div key={idx} className="flex items-center justify-between p-[12px] border border-border rounded-[12px] hover:border-[#6366f1]/50 cursor-pointer transition-colors group">
            <div className="flex flex-col gap-[4px]">
              <span className="font-bold text-[13px] text-text group-hover:text-[#6366f1] transition-colors">{refund.tenantName}</span>
              <div className="flex items-center gap-[6px] text-[11px] font-bold text-muted">
                <span>{refund.room}</span>
                <span>·</span>
                <span className="text-text">{refund.amount}đ</span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-[4px]">
              <div className={`flex items-center gap-[4px] text-[11px] font-black px-[6px] py-[2px] rounded-[4px] ${
                refund.status === 'today' ? 'bg-[#6366f1]/10 text-[#6366f1]' : 
                refund.status === 'overdue' ? 'bg-rose-500/10 text-rose-500' : 'bg-black/5 dark:bg-white/5 text-muted'
              }`}>
                {refund.status === 'overdue' && <AlertTriangle size={10} />}
                {refund.status === 'today' && <CalendarClock size={10} />}
                {refund.days}
              </div>
              <ChevronRight size={14} className="text-muted group-hover:text-[#6366f1] transition-colors" />
            </div>
          </div>
        ))}
      </div>
      
      <Button variant="outline" className="mt-auto w-full text-[#10b981] border-[#10b981]/20 bg-[#10b981]/10 hover:bg-[#10b981]/20">
        <RefreshCcw size={16} className="mr-2" /> Xử lý hoàn tiền ngay
      </Button>
    </Card>
  );
}
