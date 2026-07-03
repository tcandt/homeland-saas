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
          {[
            { name: "Nguyễn Văn A", room: "P.101", amount: "6.500.000đ", overdue: 12 },
            { name: "Trần Thị B", room: "P.205", amount: "4.200.000đ", overdue: 5 },
            { name: "Lê Hoàng C", room: "P.302", amount: "1.800.000đ", overdue: 2 },
          ].map((item, idx) => (
            <div key={idx} className="flex items-center justify-between p-[10px] rounded-[10px] border border-border bg-black/5 dark:bg-white/5">
              <div className="flex flex-col gap-[2px]">
                <span className="font-bold text-[13px] text-text">{item.name}</span>
                <span className="font-bold text-[11px] text-muted">{item.room}</span>
              </div>
              <div className="flex flex-col items-end gap-[2px]">
                <span className="font-black text-[13px] text-rose-500">{item.amount}</span>
                <span className="font-bold text-[11px] text-rose-500/70">Quá hạn {item.overdue} ngày</span>
              </div>
            </div>
          ))}
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
          <div className="flex items-center justify-between p-[12px] border border-border rounded-[10px] hover:border-[#0ea5e9]/50 transition-colors cursor-pointer group">
            <div className="flex items-center gap-[12px]">
              <div className="w-[28px] h-[28px] rounded-full bg-[#0ea5e9]/10 flex items-center justify-center">
                <MessageCircle size={14} className="text-[#0ea5e9]" />
              </div>
              <div className="flex flex-col gap-[2px]">
                <span className="font-bold text-[13px] text-text group-hover:text-[#0ea5e9] transition-colors">Gửi Zalo</span>
                <span className="font-bold text-[11px] text-muted">Phạm Văn D · P.401</span>
              </div>
            </div>
            <span className="font-black text-[11px] text-muted px-[6px] py-[2px] bg-black/5 dark:bg-white/5 rounded-[4px]">10:00</span>
          </div>
          <div className="flex items-center justify-between p-[12px] border border-border rounded-[10px] hover:border-[#10b981]/50 transition-colors cursor-pointer group">
            <div className="flex items-center gap-[12px]">
              <div className="w-[28px] h-[28px] rounded-full bg-[#10b981]/10 flex items-center justify-center">
                <Phone size={14} className="text-[#10b981]" />
              </div>
              <div className="flex flex-col gap-[2px]">
                <span className="font-bold text-[13px] text-text group-hover:text-[#10b981] transition-colors">Gọi điện</span>
                <span className="font-bold text-[11px] text-muted">Lê Thị E · P.502</span>
              </div>
            </div>
            <span className="font-black text-[11px] text-muted px-[6px] py-[2px] bg-black/5 dark:bg-white/5 rounded-[4px]">14:30</span>
          </div>
        </div>
      </Card>

      {/* Recent Payments */}
      <Card className="p-[20px] flex flex-col gap-[16px]">
        <div className="flex items-center gap-[8px]">
          <div className="w-[32px] h-[32px] rounded-full bg-[#10b981]/10 flex items-center justify-center">
            <Wallet size={14} className="text-[#10b981]" />
          </div>
          <div className="flex flex-col">
            <h3 className="font-black text-[15px] text-text leading-tight">Recent Payments</h3>
            <span className="font-bold text-[11px] text-muted uppercase tracking-wider">Vừa thanh toán</span>
          </div>
        </div>

        <div className="flex flex-col gap-[16px] mt-[4px]">
          {[
            { amount: "+5.800.000đ", name: "Trần Thị B", method: "Momo", time: "10:30" },
            { amount: "+2.000.000đ", name: "Nguyễn Văn F", method: "Tiền mặt", time: "09:15" },
          ].map((item, idx) => (
            <div key={idx} className="flex items-start justify-between relative pl-[20px]">
              <div className="absolute left-0 top-[6px] w-[8px] h-[8px] rounded-full bg-[#10b981]" />
              {idx === 0 && <div className="absolute left-[3px] top-[14px] bottom-[-24px] w-[2px] bg-border" />}
              
              <div className="flex flex-col gap-[4px]">
                <span className="font-black text-[14px] text-[#10b981]">{item.amount}</span>
                <span className="font-bold text-[12px] text-text">{item.name}</span>
                <span className="font-bold text-[11px] text-muted">{item.method}</span>
              </div>
              <span className="font-black text-[11px] text-muted">{item.time}</span>
            </div>
          ))}
        </div>
      </Card>

    </div>
  );
}
