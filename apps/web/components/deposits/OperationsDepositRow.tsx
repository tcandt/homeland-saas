"use client";

import React from "react";
import {
  Bookmark,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import { UI_Deposit } from "../../lib/adapters/deposit.adapter";
import { Card } from "../ui/Card";

export default function OperationsDepositRow({
  deposit,
  onClick,
}: {
  deposit: UI_Deposit;
  onClick: () => void;
}) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "DRAFT":
      case "PENDING":
        return "text-[#0ea5e9] bg-[#0ea5e9]/10 border-[#0ea5e9]/20";
      case "PAID":
        return "text-[#f97316] bg-[#f97316]/10 border-[#f97316]/20";
      case "CONVERTED_TO_CONTRACT":
        return "text-[#6366f1] bg-[#6366f1]/10 border-[#6366f1]/20";
      case "CANCELLED":
      case "REFUNDED":
        return "text-rose-500 bg-rose-500/10 border-rose-500/20";
      default:
        return "text-muted bg-black/5 dark:bg-white/5 border-border";
    }
  };

  const getTypeIcon = () =>
    deposit.type === "SECURITY" ? (
      <ShieldCheck size={14} className="text-[#8b5cf6]" />
    ) : (
      <Bookmark size={14} className="text-[#0ea5e9]" />
    );

  const getTypeName = () => {
    switch (deposit.type) {
      case "BOOKING":
        return "Cọc giữ phòng";
      case "SECURITY":
        return "Cọc bảo đảm";
      case "RESERVATION":
        return "Phí giữ chỗ";
      default:
        return deposit.type;
    }
  };

  const amountStr = new Intl.NumberFormat("vi-VN").format(deposit.amount);

  return (
    <Card
      data-testid="deposit-card"
      onClick={onClick}
      className="group relative flex cursor-pointer flex-col gap-[16px] p-[16px] transition-all duration-150 hover:-translate-y-[3px] hover:border-primary/30 hover:shadow-md xl:flex-row xl:items-center xl:gap-[24px]"
    >
      <div className="flex min-w-[220px] flex-col gap-[6px]">
        <div className="flex items-center gap-[8px]">
          <h4 className="text-[15px] font-black leading-none text-primary">{deposit.code || deposit.id}</h4>
          <span
            data-testid="deposit-status-badge"
            className={`rounded-[4px] border px-[6px] py-[2px] text-[10px] font-black uppercase ${getStatusColor(deposit.status)}`}
          >
            {deposit.status}
          </span>
        </div>

        <div className="flex items-center gap-[6px]">
          {getTypeIcon()}
          <span className="text-[12px] font-bold uppercase text-muted">{getTypeName()}</span>
        </div>

        <span className="mt-[4px] flex items-center gap-[4px] text-[11px] font-bold text-muted">
          Ngày tạo:
          <span className="text-text">{new Date(deposit.createdAt).toLocaleDateString("vi-VN")}</span>
        </span>
      </div>

      <div className="flex min-w-[200px] flex-1 flex-col gap-[4px]">
        <span className="text-[14px] font-bold text-text">{deposit.customerName}</span>
        <span className="text-[12px] font-medium text-muted">{deposit.customerPhone}</span>
        <span className="flex items-center gap-[4px] text-[12px] font-medium text-muted">
          <span className="rounded-[4px] bg-black/5 px-[6px] py-[2px] font-bold dark:bg-white/5">{deposit.roomCode}</span>
          · {deposit.buildingName}
        </span>
      </div>

      <div className="flex min-w-[200px] flex-col gap-[4px]">
        <div className="flex items-center justify-between text-[13px]">
          <span className="font-medium text-muted">Số tiền cọc:</span>
          <span className="font-black text-text">{amountStr}đ</span>
        </div>
        <div className="flex items-center justify-between text-[13px]">
          <span className="font-medium text-muted">Trạng thái:</span>
          <span className={`font-black ${deposit.status === "PAID" ? "text-[#8b5cf6]" : "text-muted"}`}>{deposit.status}</span>
        </div>
      </div>

      <div className="absolute inset-0 z-10 flex items-center justify-center rounded-[14px] bg-card/80 opacity-0 backdrop-blur-md transition-all duration-150 group-hover:opacity-100">
        <div className="flex w-full scale-95 flex-wrap items-center justify-center gap-[8px] p-[12px] transition-transform duration-150 group-hover:scale-100">
          <button
            type="button"
            aria-label="Xem chi tiết"
            onClick={(event) => {
              event.stopPropagation();
              onClick();
            }}
            className="flex h-[36px] w-[36px] items-center justify-center rounded-[8px] bg-primary/10 text-primary transition-colors hover:bg-primary/20"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </Card>
  );
}
