"use client";

import React from "react";
import { UserPlus, FileText, PiggyBank, Receipt, CreditCard, ShieldCheck, Clock } from "lucide-react";

export default function RecentActivityTimeline() {
  const activities = [
    { id: 1, type: "payment", icon: <CreditCard size={14} />, color: "text-emerald-500 bg-emerald-500/10", title: "Thanh toán thành công", desc: "Phòng LK01.31 - P.101 thanh toán 5.400.000đ", time: "10 phút trước" },
    { id: 2, type: "tenant", icon: <UserPlus size={14} />, color: "text-[#6366f1] bg-[#6366f1]/10", title: "Khách mới nhận phòng", desc: "Nguyễn Văn A nhận phòng LK01.32 - P.202", time: "1 giờ trước" },
    { id: 3, type: "temp_res", icon: <ShieldCheck size={14} />, color: "text-blue-500 bg-blue-500/10", title: "Cập nhật tạm trú", desc: "Trần Thị B (P.303) đã khai báo tạm trú", time: "2 giờ trước" },
    { id: 4, type: "contract", icon: <FileText size={14} />, color: "text-purple-500 bg-purple-500/10", title: "Hợp đồng mới", desc: "Ký hợp đồng 12 tháng phòng P.401", time: "Hôm qua" },
    { id: 5, type: "invoice", icon: <Receipt size={14} />, color: "text-orange-500 bg-orange-500/10", title: "Lập hóa đơn", desc: "Tự động lập 24 hóa đơn kỳ 06/2026", time: "Hôm qua" },
    { id: 6, type: "deposit", icon: <PiggyBank size={14} />, color: "text-pink-500 bg-pink-500/10", title: "Nhận tiền cọc", desc: "Nhận 10.000.000đ cọc phòng P.505", time: "2 ngày trước" },
    { id: 7, type: "expired", icon: <Clock size={14} />, color: "text-rose-500 bg-rose-500/10", title: "Hợp đồng hết hạn", desc: "Hợp đồng phòng P.102 đã kết thúc", time: "3 ngày trước" },
  ];

  return (
    <div className="bg-card border border-border rounded-[16px] p-5 shadow-sm flex flex-col gap-4 h-full min-h-[300px]">
      <div className="flex flex-col gap-4 relative">
        <div className="absolute left-[15px] top-4 bottom-4 w-[2px] bg-border/50 rounded-full" />
        
        {activities.map((act) => (
          <div key={act.id} className="flex gap-4 relative group">
            <div className={`w-[32px] h-[32px] rounded-full shrink-0 flex items-center justify-center relative z-10 ${act.color} ring-4 ring-card`}>
              {act.icon}
            </div>
            <div className="flex flex-col pb-4">
              <span className="font-bold text-[13px] text-text group-hover:text-[#6366f1] transition-colors">{act.title}</span>
              <span className="text-[12px] text-muted mt-0.5 leading-relaxed">{act.desc}</span>
              <span className="text-[11px] font-medium text-muted/70 mt-1">{act.time}</span>
            </div>
          </div>
        ))}
      </div>
      <button className="w-full py-2.5 mt-auto rounded-[8px] bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-[12px] font-bold text-text transition-colors">
        Xem toàn bộ lịch sử
      </button>
    </div>
  );
}
