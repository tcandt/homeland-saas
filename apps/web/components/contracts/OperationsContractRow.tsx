"use client";

import React from "react";
import { CheckCircle2, Clock3, Eye, Building2, DoorClosed, FileText, Phone, Sparkles } from "lucide-react";
import { getContractStatusConfig } from "../../lib/contracts/contract-status";
import { Badge } from "../ui/Badge";
import { Card } from "../ui/Card";
import { getTenantAvatar } from "../tenants/TenantDetailDrawer";

function formatDate(value?: string | Date) {
  if (!value) return "--/--/----";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--/--/----";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function roomCode(contract: any) {
  return contract.room?.code || contract.room?.number || contract.room?.name || "Chưa xếp phòng";
}

function buildingName(contract: any) {
  return contract.room?.building?.code || contract.room?.building?.name || "Tòa LK01.31";
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

  const hasValidRange = Boolean(
    startDate && endDate && !Number.isNaN(startDate.getTime()) && !Number.isNaN(endDate.getTime())
  );
  const totalDays = hasValidRange
    ? Math.max(1, Math.floor((endDate!.getTime() - startDate!.getTime()) / 86400000))
    : 1;
  const daysRemaining = hasValidRange
    ? Math.ceil((endDate!.getTime() - today.getTime()) / 86400000)
    : null;
  const passedDays = daysRemaining === null ? 0 : Math.max(0, totalDays - daysRemaining);
  const progressPercent = hasValidRange
    ? Math.min(100, Math.max(0, (passedDays / totalDays) * 100))
    : 0;

  const customerName =
    contract.customer?.fullName || contract.customer?.name || "Chưa rõ khách hàng";
  const customerPhone = contract.customer?.phone || contract.customerPhone || "";
  const customerGender = contract.customer?.gender || "";
  const isFemale =
    customerGender === "FEMALE" ||
    customerGender === "Nữ" ||
    customerGender === "nu" ||
    customerGender === "gái";
  const avatarUrl = getTenantAvatar(contract.customer?.avatar, customerName, customerGender);

  const isSigned = !["DRAFT", "PENDING_APPROVAL"].includes(contract.status);
  const isExpiringSoon = daysRemaining !== null && daysRemaining >= 0 && daysRemaining <= 30;
  const isExpired = daysRemaining !== null && daysRemaining < 0;

  return (
    <div
      data-testid="contract-card"
      onClick={onClick}
      className="group relative grid min-w-[1160px] cursor-pointer grid-cols-[48px_minmax(160px,0.9fr)_minmax(220px,1.2fr)_minmax(180px,1fr)_minmax(260px,1.4fr)_140px_80px] items-center gap-3 border-b border-border/60 bg-card px-4 py-3.5 transition-all hover:bg-surface/80"
    >
      {/* 1. STT */}
      <div className="flex items-center">
        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-surface font-mono text-[11px] font-bold text-muted group-hover:bg-primary/10 group-hover:text-primary transition-colors">
          {rowNumber}
        </span>
      </div>

      {/* 2. MÃ HỢP ĐỒNG */}
      <div className="min-w-0 flex flex-col gap-0.5">
        <div className="flex items-center gap-1.5">
          <span className="font-mono font-black text-[13px] text-primary group-hover:underline truncate">
            {contract.code || contract.id?.slice(0, 14)}
          </span>
        </div>
        <span className="text-[11px] font-medium text-muted truncate">
          {contract.type || "Hợp đồng thuê phòng"}
        </span>
      </div>

      {/* 3. KHÁCH HÀNG (AVATAR GENDER + SĐT) */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="relative shrink-0">
          <img
            src={avatarUrl}
            alt={customerName}
            className={`h-9 w-9 rounded-xl object-cover border-2 shadow-xs transition-transform group-hover:scale-105 ${
              isFemale ? "border-pink-300 bg-pink-50" : "border-sky-300 bg-sky-50"
            }`}
          />
          <span
            className={`absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-black text-white shadow-xs ${
              isFemale ? "bg-rose-500" : "bg-sky-600"
            }`}
          >
            {isFemale ? "♀" : "♂"}
          </span>
        </div>

        <div className="min-w-0 flex-1 flex flex-col">
          <span className="truncate text-[13px] font-black text-text group-hover:text-primary transition-colors">
            {customerName}
          </span>
          <div className="flex items-center gap-1.5 text-[11px] text-muted">
            {customerPhone ? (
              <span className="font-mono font-medium truncate">{customerPhone}</span>
            ) : (
              <span className="italic text-[10px]">Chưa có SĐT</span>
            )}
          </div>
        </div>
      </div>

      {/* 4. TÒA NHÀ & MÃ PHÒNG */}
      <div className="min-w-0 flex flex-col gap-1">
        <div className="inline-flex items-center gap-1.5 rounded-xl border border-border/80 bg-surface/70 px-2.5 py-1 text-xs w-fit max-w-full">
          <Building2 size={13} className="text-indigo-500 shrink-0" />
          <span className="font-bold text-text truncate">{buildingName(contract)}</span>
        </div>
        <div className="inline-flex items-center gap-1.5 text-[11px] font-bold text-muted pl-1">
          <DoorClosed size={12} className="text-amber-500 shrink-0" />
          <span className="truncate font-mono">{roomCode(contract)}</span>
        </div>
      </div>

      {/* 5. THỜI HẠN & TIẾN ĐỘ HỢP ĐỒNG */}
      <div className="min-w-0 flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2 text-[11px] font-bold font-mono">
          <span className="text-text">{formatDate(contract.startDate)}</span>
          <span className="text-muted/60">→</span>
          <span className="text-text">{formatDate(contract.endDate)}</span>
        </div>

        {/* Lifecycle Progress Bar */}
        <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-border/60">
          <div
            className={`h-full rounded-full transition-all ${
              isExpired
                ? "bg-rose-500"
                : isExpiringSoon
                ? "bg-amber-500"
                : "bg-emerald-500"
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-[10px] font-bold">
          <span
            className={`truncate uppercase tracking-wider ${
              isExpired
                ? "text-rose-600 dark:text-rose-400"
                : isExpiringSoon
                ? "text-amber-600 dark:text-amber-400"
                : "text-muted"
            }`}
          >
            {daysRemaining === null
              ? "Chưa xác định"
              : isExpired
              ? `Hết hạn ${Math.abs(daysRemaining)} ngày trước`
              : isExpiringSoon
              ? `⚠️ Còn ${daysRemaining} ngày`
              : `Còn ${daysRemaining} ngày`}
          </span>
          <span className="font-mono text-muted/80">{Math.round(progressPercent)}%</span>
        </div>
      </div>

      {/* 6. TRẠNG THÁI & HỒ SƠ */}
      <div className="flex min-w-0 flex-col items-start gap-1">
        <Badge data-testid="contract-status-badge" variant={statusConfig.color} className="text-[11px]">
          {statusConfig.label}
        </Badge>
        <div className="flex items-center gap-1 text-[10px] font-semibold text-muted">
          {isSigned ? (
            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 size={11} /> Đã duyệt hồ sơ
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
              <Clock3 size={11} /> Chờ duyệt ký
            </span>
          )}
        </div>
      </div>

      {/* 7. THAO TÁC */}
      <div className="relative flex justify-end items-center gap-1.5">
        <button
          type="button"
          aria-label="Xem chi tiết hợp đồng"
          onClick={(event) => {
            event.stopPropagation();
            onClick();
          }}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-muted transition-all hover:border-primary/40 hover:bg-primary/10 hover:text-primary shadow-xs"
        >
          <Eye size={15} />
        </button>
      </div>
    </div>
  );
}
