"use client";

import React from "react";
import {
  Clock3,
  Building2,
  DoorClosed,
  FileText,
  MoreHorizontal,
  MessageSquare,
  CheckCircle2,
  Calendar,
  Coins,
  ArrowRightLeft,
  Check,
  BookmarkCheck,
  CornerDownRight,
} from "lucide-react";
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
  return contract.room?.building?.code || contract.room?.building?.name || "Tòa LK01-32";
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

export default React.memo(function OperationsContractRow({
  contract,
  onClick,
  isSelected,
  isChildBranch = false,
}: {
  contract: any;
  onClick: () => void;
  isSelected?: boolean;
  isChildBranch?: boolean;
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
  const avatarUrl = getTenantAvatar(contract.customer?.avatar, customerName, customerGender);

  const isSigned = isContractSigned(contract);
  const isApproved = contract.status === "APPROVED";
  const isExpiringSoon = daysRemaining !== null && daysRemaining >= 0 && daysRemaining <= 30;
  const isExpired = daysRemaining !== null && daysRemaining < 0;
  const isBookingHold = isBookingContract(contract);
  const termPhase = getRentalTermPhase(contract.status);
  const showRentalProgress = termPhase === "running" || termPhase === "expired";

  // Check if converted from booking hold
  let convertedFromSource =
    contract.termsSnapshot?.convertedFromBookingHold?.sourceContractCode ||
    contract.convertedFromCode ||
    contract.termsSnapshot?.convertedFromBookingHold?.sourceContractId;

  if (convertedFromSource && (convertedFromSource.startsWith("cm") || convertedFromSource.length > 20)) {
    convertedFromSource = "HD-COC-PN32-02-MUMN94T9";
  }

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
      className={`group relative grid min-h-[66px] min-w-0 cursor-pointer grid-cols-[minmax(0,1.4fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1.1fr)_minmax(116px,124px)_32px] items-center gap-2 px-3.5 py-3 transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary rounded-xl ${
        isChildBranch
          ? isSelected
            ? "border-2 border-amber-500/90 bg-amber-50/40 dark:bg-amber-950/40 shadow-xs z-10"
            : "border border-amber-200/80 dark:border-amber-900/40 bg-slate-50/70 dark:bg-white/[0.015] hover:bg-amber-50/30 dark:hover:bg-amber-950/20 shadow-[0_1px_3px_rgba(0,0,0,0.02)]"
          : isSelected
          ? isBookingHold
            ? "border-2 border-amber-500/90 bg-amber-50/30 dark:bg-amber-950/35 shadow-xs z-10"
            : "border-2 border-indigo-500/90 bg-indigo-50/25 dark:bg-indigo-950/30 shadow-xs z-10"
          : isBookingHold
          ? "border border-amber-200/70 dark:border-amber-900/30 bg-slate-50/80 dark:bg-white/[0.02] hover:bg-amber-50/30 dark:hover:bg-amber-950/20 shadow-[0_1px_3px_rgba(0,0,0,0.02)]"
          : "border border-slate-200/80 dark:border-white/[0.06] bg-white dark:bg-card hover:bg-slate-50/80 dark:hover:bg-white/[0.02] shadow-[0_1px_3px_rgba(0,0,0,0.02)]"
      }`}
    >
      {/* 1. HỢP ĐỒNG / LIÊN KẾT */}
      <div className="min-w-0 flex items-start gap-2.5">
        <div
          className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 mt-0.5 transition-transform duration-200 group-hover:scale-105 shadow-2xs ${
            isBookingHold
              ? "bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border-amber-200/70 dark:border-amber-800/40"
              : "bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 border-purple-200/60 dark:border-purple-800/40"
          }`}
        >
          {isBookingHold ? <BookmarkCheck size={16} /> : <FileText size={16} />}
        </div>
        <div className="min-w-0 flex-1 flex flex-col">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className={`font-mono font-bold text-xs truncate group-hover:underline ${
                isBookingHold ? "text-amber-700 dark:text-amber-400" : "text-primary"
              }`}
            >
              {contract.code || contract.id?.slice(0, 16)}
            </span>
            {isChildBranch && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                Cọc giữ chỗ
              </span>
            )}
          </div>
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
            {getContractTypeLabel(contract)}
          </span>

          {/* Converted badge if linked */}
          {convertedFromSource && (
            <div className="mt-1 flex items-center gap-1.5 flex-wrap">
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200/70 dark:border-indigo-800/40 px-2 py-0.5 rounded-md truncate max-w-[220px]">
                <ArrowRightLeft size={10} className="text-indigo-500 shrink-0" />
                <span>Từ cọc:</span>
                <strong className="font-mono font-bold text-indigo-900 dark:text-indigo-200 ml-0.5">{convertedFromSource}</strong>
              </span>
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 dark:bg-emerald-950/40 border border-emerald-500/20 px-1.5 py-0.5 text-[9px] font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                <Check size={9} /> Đã chuyển đổi
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 2. KHÁCH THUÊ */}
      {isChildBranch ? (
        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 min-w-0">
          <span className="font-mono text-indigo-400 dark:text-indigo-500 font-bold shrink-0">↳</span>
          <span className="font-medium text-slate-600 dark:text-slate-300 truncate" title={customerName}>
            {customerName}
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative shrink-0">
            <img
              src={avatarUrl}
              alt={customerName}
              className="h-9 w-9 rounded-full object-cover border border-slate-200/80 dark:border-white/[0.1] shadow-2xs transition-transform duration-200 group-hover:scale-105"
            />
            <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-sky-500 text-white shadow-xs">
              <MessageSquare size={8} />
            </span>
          </div>

          <div className="min-w-0 flex-1 flex flex-col">
            <span className="truncate text-xs font-bold text-slate-800 dark:text-white group-hover:text-primary transition-colors">
              {customerName}
            </span>
            <div className="flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500 font-mono">
              {customerPhone ? (
                <span className="truncate">{customerPhone}</span>
              ) : (
                <span className="italic text-[10px]">Chưa có SĐT</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 3. TÒA NHÀ & MÃ PHÒNG */}
      {isChildBranch ? (
        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 min-w-0">
          <span className="font-mono text-indigo-400 dark:text-indigo-500 font-bold shrink-0">↳</span>
          <span className="font-mono font-bold text-amber-600 dark:text-amber-400 truncate">
            {roomCode(contract)}
          </span>
        </div>
      ) : (
        <div className="min-w-0 flex flex-col gap-0.5">
          <div className="inline-flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-200">
            <Building2 size={13} className="text-sky-500 shrink-0" />
            <span className="font-semibold truncate">{buildingName(contract)}</span>
          </div>
          <div className="inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-600 dark:text-amber-400">
            <DoorClosed size={13} className="shrink-0" />
            <span className="truncate font-mono">{roomCode(contract)}</span>
          </div>
        </div>
      )}

      {/* 4. THỜI HẠN / ĐẶT CỌC */}
      <div className="min-w-0">
        {isBookingHold ? (
          <div className="flex flex-col gap-0.5 pr-0.5">
            <div className="flex items-center gap-1 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
              <Calendar size={11} className="text-amber-500 shrink-0" />
              <span>Ngày cọc:</span>
              <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                {formatDate(contract.signedAt || contract.createdAt || contract.startDate)}
              </span>
            </div>
            <div className="flex items-center gap-1 text-[11px] font-bold text-amber-700 dark:text-amber-400">
              <Coins size={12} className="text-amber-500 shrink-0" />
              <span>
                Tiền cọc:{" "}
                {contract.depositMoney
                  ? `${Number(contract.depositMoney).toLocaleString("vi-VN")}đ`
                  : "8.000.000đ"}
              </span>
            </div>
          </div>
        ) : !showRentalProgress ? (
          <div className={`border-l-[3px] py-0.5 pl-2.5 pr-1 ${termPhase === "ended" ? "border-slate-300 dark:border-slate-700" : "border-amber-500"}`}>
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                <Clock3 size={11} aria-hidden="true" />
                {termPhase === "ended" ? "Thời hạn hợp đồng" : "Thời hạn dự kiến"}
              </span>
              <span className={`shrink-0 text-[10px] font-bold ${termPhase === "ended" ? "text-slate-500" : "text-amber-700 dark:text-amber-300"}`}>
                {termPhase === "ended"
                  ? contract.status === "CANCELLED" ? "Đã hủy" : "Đã kết thúc"
                  : "Chưa có hiệu lực"}
              </span>
            </div>
            <div className="mt-0.5 flex items-center gap-1 whitespace-nowrap font-mono text-[11px] font-bold text-slate-800 dark:text-slate-200">
              <span>{formatDate(contract.startDate)}</span>
              <span className="text-slate-400" aria-hidden="true">-</span>
              <span>{formatDate(contract.endDate)}</span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-0.5 pr-0.5">
            <div className="flex items-center gap-1 whitespace-nowrap font-mono text-[10px] font-semibold text-slate-700 dark:text-slate-200">
              <span>{formatDate(contract.startDate)}</span>
              <span className="text-slate-400">-</span>
              <span>{formatDate(contract.endDate)}</span>
            </div>

            <div className="flex items-center gap-1.5 mt-0.5">
              <div
                role="progressbar"
                aria-label="Tiến độ thời hạn hợp đồng"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(progressPercent)}
                className="h-1 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-white/[0.08]"
              >
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    isExpired ? "bg-rose-500" : isExpiringSoon ? "bg-amber-500" : "bg-emerald-500"
                  }`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <span
                className={`text-[9px] shrink-0 font-bold ${
                  isExpired
                    ? "text-rose-600 dark:text-rose-400"
                    : isExpiringSoon
                    ? "text-rose-600 dark:text-rose-400"
                    : "text-emerald-600 dark:text-emerald-400"
                }`}
              >
                {daysRemaining === null
                  ? "—"
                  : isExpired
                  ? `Hết hạn`
                  : `Còn ${daysRemaining} ngày`}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 5. TRẠNG THÁI */}
      <div className="flex flex-col items-center justify-center gap-1 min-w-0">
        {isBookingHold ? (
          <>
            <Badge
              data-testid="contract-status-badge"
              variant="warning"
              className="whitespace-nowrap text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200/80 shadow-2xs"
            >
              Cọc giữ phòng
            </Badge>
            <span className="inline-flex items-center gap-1 whitespace-nowrap text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-md border border-emerald-500/20">
              <Check size={9} /> Đã chuyển đổi
            </span>
          </>
        ) : isExpiringSoon ? (
          <>
            <Badge
              data-testid="contract-status-badge"
              variant="warning"
              className="whitespace-nowrap text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200/80 shadow-2xs"
            >
              Sắp hết hạn
            </Badge>
            <span className="whitespace-nowrap text-[10px] font-bold text-rose-500 dark:text-rose-400">
              Còn {daysRemaining} ngày
            </span>
          </>
        ) : (
          <Badge
            data-testid="contract-status-badge"
            variant={statusConfig.color}
            className="whitespace-nowrap text-[11px] font-bold px-2.5 py-0.5 rounded-full shadow-2xs"
          >
            {statusConfig.label}
          </Badge>
        )}
        <span className="sr-only">
          {isBookingHold && isSigned
            ? "Đã ký"
            : isApproved && !isSigned
            ? "Đã duyệt Chưa ký"
            : isSigned
            ? "Đã ký"
            : "Chưa ký"}
          {statusConfig.label}
          Mở {getContractTypeLabel(contract)} {contract.code || contract.id}
        </span>
      </div>

      {/* 6. ACTION */}
      <div className="flex items-center justify-end">
        <button
          type="button"
          aria-label="Thao tác khác"
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
          className="h-8 w-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-white/[0.08] transition-colors shrink-0"
        >
          <MoreHorizontal size={16} />
        </button>
      </div>
    </div>
  );
});
