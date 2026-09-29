"use client";

import React from "react";
import { CheckCircle2, Clock3, Building2, DoorClosed } from "lucide-react";
import { getRentalTermPhase } from "../../lib/contracts/contract-status";
import { getContractDisplayStatus, getLinkedRental, isBookingContract, isContractSigned } from "../../lib/contracts/booking-conversion";
import { Badge } from "../ui/Badge";
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

function isBookingHoldContract(contract: any) {
  const text = [
    contract?.contractTemplate,
    contract?.loaiHopDong,
    contract?.type,
    contract?.purpose,
    contract?.code,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return (
    contract?.isBookingHold === true ||
    text.includes("booking_hold") ||
    text.includes("cọc giữ phòng") ||
    text.includes("coc giu phong") ||
    String(contract?.code || "").toUpperCase().startsWith("HD-COC")
  );
}

function getContractTypeLabel(contract: any) {
  if (isBookingHoldContract(contract)) return "Hợp đồng cọc giữ phòng";
  return contract.type || "Hợp đồng thuê phòng";
}

export default function OperationsContractRow({
  contract,
  onClick,
}: {
  contract: any;
  onClick: () => void;
}) {
  const statusConfig = getContractDisplayStatus(contract);
  const linkedRental = getLinkedRental(contract);
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

  const isSigned = isContractSigned(contract);
  const isExpiringSoon = daysRemaining !== null && daysRemaining >= 0 && daysRemaining <= 30;
  const isExpired = daysRemaining !== null && daysRemaining < 0;
  const isBookingHold = isBookingContract(contract);
  const termPhase = getRentalTermPhase(contract.status);
  const showRentalProgress = termPhase === "running" || termPhase === "expired";

  return (
    <div
      data-testid="contract-card"
      onClick={onClick}
      role="button"
      tabIndex={0}
      aria-label={`Mở ${getContractTypeLabel(contract)} ${contract.code || contract.id}`}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      }}
      className="group relative grid min-h-[108px] min-w-0 cursor-pointer grid-cols-[minmax(180px,0.9fr)_minmax(220px,1.2fr)_minmax(180px,1fr)_minmax(320px,1.65fr)_140px] items-center gap-3 bg-card px-3 py-3.5 transition-colors hover:bg-surface/80 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
    >
      {/* MÃ HỢP ĐỒNG */}
      <div className="min-w-0 flex flex-col gap-0.5">
        <div className="flex items-center gap-1.5">
          <span className="font-mono font-black text-[13px] text-primary group-hover:underline truncate">
            {contract.code || contract.id?.slice(0, 14)}
          </span>
        </div>
        <span className="text-[11px] font-medium text-muted truncate">
          {getContractTypeLabel(contract)}
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
      <div className="min-w-0">
        {isBookingHold ? (
          <div className="mx-auto flex max-w-[260px] flex-col items-center justify-center gap-1 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-center">
            <span className="text-[11px] font-black uppercase leading-none tracking-wider text-amber-600 dark:text-amber-300">
              Cọc giữ phòng
            </span>
            <span className="text-[10px] font-semibold leading-tight text-muted">
              {linkedRental ? `Hợp đồng thuê: ${linkedRental.code || linkedRental.id}` : "Chưa tính thời hạn ở · Chờ chuyển sang thuê"}
            </span>
          </div>
        ) : !showRentalProgress ? (
          <div className={`border-l-[3px] py-1 pl-3 pr-1 ${termPhase === "ended" ? "border-muted/50" : "border-amber-500"}`}>
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-muted">
                <Clock3 size={13} aria-hidden="true" />
                {termPhase === "ended" ? "Thời hạn hợp đồng" : "Thời hạn dự kiến"}
              </span>
              <span className={`shrink-0 text-[11px] font-bold ${termPhase === "ended" ? "text-muted" : "text-amber-700 dark:text-amber-300"}`}>
                {termPhase === "ended"
                  ? contract.status === "CANCELLED" ? "Đã hủy" : "Đã chấm dứt"
                  : "Chưa có hiệu lực"}
              </span>
            </div>
            <div className="mt-2 flex items-center gap-2 whitespace-nowrap font-mono text-xs font-bold text-text">
              <span>{formatDate(contract.startDate)}</span>
              <span className="text-muted" aria-hidden="true">→</span>
              <span>{formatDate(contract.endDate)}</span>
            </div>
          </div>
        ) : (
          <div className="border-l-[3px] border-emerald-500 py-1 pl-3 pr-1">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex items-center gap-1.5 whitespace-nowrap text-xs font-bold font-mono text-text">
                <span className="truncate">{formatDate(contract.startDate)}</span>
                <span className="text-emerald-500">→</span>
                <span className="truncate">{formatDate(contract.endDate)}</span>
              </div>
              <span className="shrink-0 text-[11px] font-bold font-mono text-emerald-700 dark:text-emerald-300">
                {Math.round(progressPercent)}%
              </span>
            </div>

            <div role="progressbar" aria-label="Tiến độ thời hạn hợp đồng" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progressPercent)} className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-emerald-100 dark:bg-emerald-950/60">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            <div className="mt-1.5 flex justify-end text-[11px] font-semibold">
              <span
                className={
                  isExpired
                    ? "text-rose-600 dark:text-rose-400"
                  : isExpiringSoon
                    ? "text-amber-700 dark:text-amber-300"
                    : "text-emerald-700 dark:text-emerald-300"
                }
              >
                {daysRemaining === null
                  ? "Chưa xác định"
                  : isExpired
                  ? `Hết hạn ${Math.abs(daysRemaining)} ngày trước`
                  : `Còn ${daysRemaining} ngày`}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 6. TRẠNG THÁI & HỒ SƠ */}
      <div className="flex min-w-0 flex-col items-center justify-center gap-1 text-center">
        <Badge data-testid="contract-status-badge" variant={statusConfig.color} className="text-[11px]">
          {statusConfig.label}
        </Badge>
        <div className="flex items-center gap-1 text-[10px] font-semibold text-muted">
          {isSigned ? (
            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 size={11} /> Đã ký
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
              <Clock3 size={11} /> Chưa ký
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
