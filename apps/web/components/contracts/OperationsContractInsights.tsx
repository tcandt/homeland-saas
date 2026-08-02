"use client";

import React from "react";
import { Sparkles, Clock, AlertTriangle, PenTool, UserMinus, FileWarning } from "lucide-react";
import { Card } from "../ui/Card";
import { useContractsQuery } from "@/lib/queries/contracts.queries";

export default function OperationsContractInsights() {
  const { data } = useContractsQuery({ limit: 100 });
  const contracts: any[] = (data as any)?.data || [];

  const expiring = contracts.filter((c: any) => {
    if (c.status === "EXPIRING") return true;
    if (!c.endDate) return false;
    const daysLeft = (new Date(c.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return daysLeft >= 0 && daysLeft <= 30;
  }).length;
  const pendingSign = contracts.filter((c: any) => c.status === "DRAFT" || c.status === "PENDING_APPROVAL" || c.status === "APPROVED").length;
  const active = contracts.filter((c: any) => c.status === "ACTIVE").length;
  const terminated = contracts.filter((c: any) => c.status === "TERMINATED" || c.status === "EXPIRED").length;

  const insights = [
    { text: `${expiring} hợp đồng sắp hết hạn trong 30 ngày`, icon: Clock, color: "text-[#f97316]" },
    { text: `${pendingSign} hợp đồng đang chờ ký/duyệt`, icon: FileWarning, color: "text-rose-500" },
    { text: `${active} hợp đồng đang hiệu lực`, icon: Sparkles, color: "text-[#8b5cf6]" },
    { text: `${terminated} hợp đồng đã kết thúc`, icon: PenTool, color: "text-[#6366f1]" },
    { text: "Dữ liệu lấy trực tiếp từ DB", icon: UserMinus, color: "text-[#a855f7]" },
  ];

  return (
    <Card className="p-[16px] md:p-[20px] flex items-center gap-[16px] overflow-x-auto no-scrollbar">
      <div className="flex items-center gap-[8px] pr-[16px] border-r border-border/50 shrink-0">
        <div className="w-[36px] h-[36px] rounded-full bg-[#6366f1]/10 flex items-center justify-center">
          <Sparkles size={18} className="text-[#6366f1]" />
        </div>
        <div className="flex flex-col">
          <span className="font-black text-[12px] text-text uppercase tracking-wider">AI Operations</span>
          <span className="font-bold text-[14px] text-text leading-tight">Insight Center</span>
        </div>
      </div>

      <div className="flex items-center gap-[24px] pl-[8px]">
        {insights.map((item, idx) => (
          <div key={idx} className="flex items-center gap-[6px] shrink-0">
            <item.icon size={14} className={item.color} />
            <span className="font-semibold text-[13px] text-text truncate">{item.text}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
