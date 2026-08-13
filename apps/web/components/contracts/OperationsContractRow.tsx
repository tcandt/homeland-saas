"use client";

import React from "react";
import { CheckCircle2, Clock3, Eye } from "lucide-react";
import { getContractStatusConfig } from "../../lib/contracts/contract-status";
import { Badge } from "../ui/Badge";
import { Card } from "../ui/Card";

function formatDate(value?: string) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleDateString("vi-VN");
}

function roomCode(contract: any) {
  return contract.room?.code || contract.room?.number || contract.room?.name || "Chưa xếp phòng";
}

function buildingName(contract: any) {
  return contract.room?.building?.code || contract.room?.building?.name || "Chưa có tòa nhà";
}

export default function OperationsContractRow({
  contract,
  rowNumber,
  onClick,
}: {
  contract: any;
  rowNumber: number;
  onClick: () => void;
}) {
  const statusConfig = getContractStatusConfig(contract.status);
  const startDate = contract.startDate ? new Date(contract.startDate) : null;
  const endDate = contract.endDate ? new Date(contract.endDate) : null;
  const today = new Date();

  const hasValidRange = Boolean(startDate && endDate && !Number.isNaN(startDate.getTime()) && !Number.isNaN(endDate.getTime()));
  const totalDays = hasValidRange ? Math.max(1, Math.floor((endDate!.getTime() - startDate!.getTime()) / 86400000)) : 1;
  const daysRemaining = hasValidRange ? Math.ceil((endDate!.getTime() - today.getTime()) / 86400000) : null;
  const passedDays = daysRemaining === null ? 0 : Math.max(0, totalDays - daysRemaining);
  const progressPercent = hasValidRange ? Math.min(100, Math.max(0, (passedDays / totalDays) * 100)) : 0;
  const customerName = contract.customer?.fullName || contract.customer?.name || "Chưa rõ khách hàng";
  const isSigned = !["DRAFT", "PENDING_APPROVAL"].includes(contract.status);

  return (
    <Card
      data-testid="contract-card"
      onClick={onClick}
      className="relative grid min-w-[1120px] cursor-pointer grid-cols-[42px_minmax(150px,0.9fr)_minmax(190px,1fr)_minmax(180px,0.9fr)_minmax(260px,1.5fr)_130px_86px] items-center gap-3 !rounded-none !border-0 !border-b !border-border !p-4 !shadow-none transition-all duration-200 last:!border-b-0 hover:bg-surface/70"
    >
      <div className="flex items-center">
        <span className="text-[12px] font-black text-muted">{rowNumber}</span>
      </div>

      <div className="min-w-0">
        <div className="truncate text-[14px] font-black text-[#5b35f5]">{contract.code || contract.id?.slice(0, 8)}</div>
        <div className="mt-1 truncate text-[12px] font-semibold text-muted">{contract.type || "Hợp đồng thuê"}</div>
      </div>

      <div className="min-w-0">
        <div className="truncate text-[13px] font-black text-text">{customerName}</div>
        <div className="mt-1 flex items-center gap-1 text-[12px] font-bold text-muted">
          {isSigned ? <CheckCircle2 size={14} className="text-emerald-500" /> : <Clock3 size={14} className="text-amber-500" />}
          {isSigned ? "Đã duyệt hồ sơ" : "Chờ duyệt hồ sơ"}
        </div>
      </div>

      <div className="min-w-0">
        <div className="truncate text-[13px] font-black text-text">{buildingName(contract)}</div>
        <div className="mt-1 inline-flex max-w-full rounded-[6px] bg-black/5 px-2 py-0.5 text-[12px] font-bold text-muted dark:bg-white/5">
          <span className="truncate">{roomCode(contract)}</span>
        </div>
      </div>

      <div className="min-w-0">
        <div className="flex items-center justify-between gap-3 text-[12px] font-bold">
          <span className="text-text">{formatDate(contract.startDate)}</span>
          <span className="text-muted">→</span>
          <span className="text-text">{formatDate(contract.endDate)}</span>
        </div>
        <div className="mt-2 flex h-[6px] overflow-hidden rounded-full bg-black/5 dark:bg-white/5">
          <div
            className={`h-full rounded-full ${daysRemaining !== null && daysRemaining < 30 ? "bg-rose-500" : daysRemaining !== null && daysRemaining < 60 ? "bg-[#f97316]" : "bg-[#8b5cf6]"}`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="mt-1 flex items-center justify-center">
          <span className={`text-[11px] font-black uppercase tracking-wide ${daysRemaining !== null && daysRemaining >= 0 && daysRemaining < 30 ? "text-rose-500" : "text-muted"}`}>
            {daysRemaining === null ? "Chưa có thời hạn" : daysRemaining < 0 ? `Quá hạn ${Math.abs(daysRemaining)} ngày` : `Còn ${daysRemaining} ngày`}
          </span>
        </div>
      </div>

      <div className="flex min-w-0 flex-col items-start gap-1">
        <Badge data-testid="contract-status-badge" variant={statusConfig.color}>
          {statusConfig.label}
        </Badge>
      </div>

      <div className="relative flex justify-end">
        <button
          type="button"
          aria-label="Xem chi tiết hợp đồng"
          onClick={(event) => {
            event.stopPropagation();
            onClick();
          }}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted transition-colors hover:border-[#6d3df8]/30 hover:bg-[#f6f2ff] hover:text-[#6d3df8]"
        >
          <Eye size={16} />
        </button>
      </div>
    </Card>
  );
}
