"use client";

import React from "react";
import { AlertTriangle, Clock, Wallet, Phone, MessageCircle } from "lucide-react";
import { Card } from "../ui/Card";

export default function OperationsBillingRightPanel() {
  return (
    <div data-testid="billing-right-panel" className="flex flex-col gap-[20px] sticky top-[24px]">
      
      {/* Debt Hotlist */}
      <Card className="p-[20px] flex flex-col gap-[16px]">
        <div className="flex items-center gap-[8px]">
          <div className="w-[32px] h-[32px] rounded-full bg-rose-500/10 flex items-center justify-center">
            <AlertTriangle size={14} className="text-rose-500" />
          </div>
          <div className="flex flex-col">
            <h3 className="font-black text-[15px] text-text leading-tight">Debt Hotlist</h3>
            <span className="font-bold text-[11px] text-muted uppercase tracking-wider">Top khách nợ</span>
          </div>
        </div>

        <div className="flex flex-col gap-[12px]">
          <div className="p-4 text-center border border-dashed rounded-lg text-muted text-[13px] font-medium">
            Chưa có khách nợ
          </div>
        </div>
      </Card>

      {/* Reminder Queue */}
      <Card className="p-[20px] flex flex-col gap-[16px]">
        <div className="flex items-center gap-[8px]">
          <div className="w-[32px] h-[32px] rounded-full bg-[#f97316]/10 flex items-center justify-center">
            <Clock size={14} className="text-[#f97316]" />
          </div>
          <div className="flex flex-col">
            <h3 className="font-black text-[15px] text-text leading-tight">Reminder Queue</h3>
            <span className="font-bold text-[11px] text-muted uppercase tracking-wider">Cần nhắc hôm nay</span>
          </div>
        </div>

        <div className="flex flex-col gap-[12px]">
          <div className="p-4 text-center border border-dashed rounded-lg text-muted text-[13px] font-medium">
            Không có lịch nhắc hôm nay
          </div>
        </div>
      </Card>

      {/* Recent Payments */}
      <Card className="p-[20px] flex flex-col gap-[16px]">
        <div className="flex items-center gap-[8px]">
          <div className="w-[32px] h-[32px] rounded-full bg-[#8b5cf6]/10 flex items-center justify-center">
            <Wallet size={14} className="text-[#8b5cf6]" />
          </div>
          <div className="flex flex-col">
            <h3 className="font-black text-[15px] text-text leading-tight">Recent Payments</h3>
            <span className="font-bold text-[11px] text-muted uppercase tracking-wider">Vừa thanh toán</span>
          </div>
        </div>

        <div className="flex flex-col gap-[16px] mt-[4px]">
          <div className="p-4 text-center border border-dashed rounded-lg text-muted text-[13px] font-medium">
            Chưa có thanh toán mới
          </div>
        </div>
      </Card>

    </div>
  );
}
