"use client";

import React, { useState } from "react";
import {
  AlertCircle,
  Building,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  ExternalLink,
  FileText,
  History,
  Info,
  Layers,
  Lock,
  MessageSquareText,
  Paperclip,
  Printer,
  Receipt,
  RotateCcw,
  Settings,
  Split,
  User,
  Wallet,
  X,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

type ExpenseDetailModalProps = {
  isOpen: boolean;
  onClose: () => void;
  expense: any;
  onApprove?: (expense: any) => void;
  onPay?: (expense: any) => void;
  onCancel?: (expense: any) => void;
  onReimburse?: (expense: any) => void;
  onDeduct?: (expense: any) => void;
  canApprove?: boolean;
  canPay?: boolean;
};

const formatVnd = (val: number) => `${Number(val || 0).toLocaleString("vi-VN")} ₫`;

const formatDate = (val?: string) => {
  if (!val) return "-";
  const date = new Date(val);
  if (Number.isNaN(date.getTime())) return "-";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

const formatDateTime = (val?: string) => {
  if (!val) return "-";
  const date = new Date(val);
  if (Number.isNaN(date.getTime())) return "-";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${day}/${month}/${year} ${hours}:${minutes}`;
};

const categoryLabels: Record<string, string> = {
  SUPPLIES: "Vật tư",
  REPAIR: "Sửa chữa",
  MAINTENANCE: "Bảo trì",
  UTILITY: "Điện nước",
  CLEANING: "Vệ sinh",
  REFUND: "Hoàn tiền",
  STAFF: "Nhân sự",
  MARKETING: "Marketing",
  OTHER: "Khác",
};

export default function ExpenseDetailModal({
  isOpen,
  onClose,
  expense,
  onApprove,
  onPay,
  onCancel,
  onReimburse,
  onDeduct,
  canApprove = true,
  canPay = true,
}: ExpenseDetailModalProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  if (!expense) return null;

  // Real database values - zero mock data
  const code = expense.code || "CP-Chi phí";
  const amount = Number(expense.amount || 0);
  const categoryKey = expense.category || "OTHER";
  const categoryName = categoryLabels[categoryKey] || expense.categoryName || "Khác";
  const buildingCode = expense.building?.code || expense.building?.name || "-";
  const ownerName = expense.owner?.name || expense.paidByOwner?.name || "-";
  const paidByName = expense.paidByOwner?.name || expense.paidByName || "-";
  const vendor = expense.vendor || "-";
  const status = expense.status || "PENDING";
  const dateStr = formatDate(expense.date || expense.createdAt);
  const dateTimeStr = formatDateTime(expense.createdAt || expense.date);
  const description = expense.description || "";
  const descriptionLines = description ? description.split("\n") : [];
  const titleText = descriptionLines[0] || categoryName;
  const bodyText = descriptionLines.slice(1).join(" ") || "";

  const attachments: string[] = Array.isArray(expense.attachmentUrls) ? expense.attachmentUrls : [];

  const isPending = status === "PENDING";
  const isApproved = status === "APPROVED";
  const isPaid = status === "PAID";
  const isCancelled = status === "CANCELLED";
  const isDeducted = expense.settlementStatus === "DEDUCTED_FROM_PROFIT";
  const isReimbursed = expense.settlementStatus === "REIMBURSED";

  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        maxWidth="max-w-4xl"
        zIndex={10050}
        testId="expense-detail-modal"
        title={
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 shadow-2xs">
              <FileText size={20} />
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-base font-bold text-slate-900 dark:text-slate-100">Chi tiết chi phí</span>
              <span className="px-2.5 py-0.5 rounded-lg border border-border text-xs font-mono font-semibold text-slate-700 dark:text-slate-300 bg-muted/20">
                {code}
              </span>
              {isPending && (
                <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200/70 dark:bg-amber-950/30 dark:border-amber-800/40 dark:text-amber-300">
                  <Clock3 size={12} /> Chờ duyệt
                </span>
              )}
              {isApproved && (
                <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/70 dark:bg-emerald-950/30 dark:border-emerald-800/40 dark:text-emerald-300">
                  <CheckCircle2 size={12} /> Đã duyệt
                </span>
              )}
              {isPaid && (
                <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/70 dark:bg-emerald-950/30 dark:border-emerald-800/40 dark:text-emerald-300">
                  <CircleDollarSign size={12} /> Đã thanh toán
                </span>
              )}
              {isCancelled && (
                <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200/70 dark:bg-rose-950/30 dark:border-rose-800/40 dark:text-rose-300">
                  <XCircle size={12} /> Đã hủy
                </span>
              )}
              {isDeducted && (
                <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200/70 dark:bg-purple-950/30 dark:border-purple-800/40 dark:text-purple-300">
                  <User size={12} /> Đã khấu trừ owner
                </span>
              )}
            </div>
          </div>
        }
        footer={
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 w-full">
            <Button
              type="button"
              variant="outline"
              onClick={handlePrint}
              className="gap-2 rounded-xl border-border/80 h-9 px-4 text-xs font-semibold"
            >
              <Printer size={15} />
              <span>In phiếu</span>
            </Button>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="rounded-xl border-border/80 h-9 px-4 text-xs font-semibold"
              >
                Đóng
              </Button>
              {isPending && canApprove && (
                <Button
                  type="button"
                  onClick={() => {
                    onApprove?.(expense);
                    onClose();
                  }}
                  className="rounded-xl bg-[#6366f1] hover:bg-[#5558e6] text-white h-9 px-4 text-xs font-bold gap-1.5 shadow-2xs"
                >
                  <span>Duyệt & tiếp tục</span>
                  <ChevronRight size={14} />
                </Button>
              )}
            </div>
          </div>
        }
      >
        <div className="flex flex-col gap-4 text-xs">
          {/* 5 TOP SUMMARY CARDS */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
            {/* Card 1: Số tiền */}
            <div className="p-3 rounded-2xl border border-border/70 bg-card shadow-2xs flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                <CircleDollarSign size={16} />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] text-muted-foreground block uppercase font-bold">Số tiền</span>
                <span className="font-mono font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100 truncate block">
                  {formatVnd(amount)}
                </span>
              </div>
            </div>

            {/* Card 2: Danh mục */}
            <div className="p-3 rounded-2xl border border-border/70 bg-card shadow-2xs flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <Layers size={16} />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] text-muted-foreground block uppercase font-bold">Danh mục</span>
                <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100 truncate block">
                  {categoryName}
                </span>
              </div>
            </div>

            {/* Card 3: Tòa nhà / Chủ */}
            <div className="p-3 rounded-2xl border border-border/70 bg-card shadow-2xs flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
                <Building size={16} />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] text-muted-foreground block uppercase font-bold">Tòa nhà / Chủ</span>
                <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100 truncate block">
                  {buildingCode} / {ownerName}
                </span>
              </div>
            </div>

            {/* Card 4: Người chi */}
            <div className="p-3 rounded-2xl border border-border/70 bg-card shadow-2xs flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                <User size={16} />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] text-muted-foreground block uppercase font-bold">Người chi</span>
                <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100 truncate block">
                  {paidByName}
                </span>
              </div>
            </div>

            {/* Card 5: Nguồn tiền */}
            <div className="p-3 rounded-2xl border border-border/70 bg-card shadow-2xs flex items-center gap-2.5 col-span-2 sm:col-span-1">
              <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <Wallet size={16} />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] text-muted-foreground block uppercase font-bold">Nguồn chi</span>
                <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100 truncate block">
                  {expense.paidByOwner ? "Chủ nhà chi" : "Tiền mặt / Ứng quỹ"}
                </span>
              </div>
            </div>
          </div>

          {/* TWO MAIN COLUMNS */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Left Column */}
            <div className="flex flex-col gap-4">
              {/* Card: Nội dung chi phí */}
              <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-2xs flex flex-col gap-2">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wide">
                  <FileText size={15} className="text-indigo-600" /> Nội dung chi phí
                </div>
                <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {titleText}
                </div>
                {bodyText && (
                  <div className="text-xs text-muted-foreground leading-relaxed">
                    {bodyText}
                  </div>
                )}
              </div>

              {/* Card: Chứng từ */}
              <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-2xs flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wide">
                    <Paperclip size={15} className="text-indigo-600" /> Chứng từ ({attachments.length})
                  </span>
                  {attachments.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedImage(attachments[0])}
                      className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                    >
                      <span>Xem đầy đủ ({attachments.length})</span>
                      <ExternalLink size={12} />
                    </button>
                  )}
                </div>

                {attachments.length === 0 ? (
                  <div className="p-8 text-center text-xs text-muted-foreground border border-dashed border-border/70 rounded-xl">
                    Chưa có chứng từ đính kèm
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {attachments.slice(0, 2).map((url, idx) => (
                      <div
                        key={idx}
                        onClick={() => setSelectedImage(url)}
                        className="group relative h-36 rounded-xl border border-border/70 overflow-hidden bg-slate-50 dark:bg-slate-900/50 cursor-pointer shadow-2xs"
                      >
                        <img
                          src={url}
                          alt={`Chứng từ ${idx + 1}`}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold">
                          Xem ảnh
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Card: Thông tin liên quan */}
              <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-2xs flex flex-col gap-3">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wide">
                  <Info size={15} className="text-indigo-600" /> Thông tin liên quan
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Nhà cung cấp</span>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">{vendor}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Ngày phát sinh</span>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">{dateStr}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Liên kết phòng/hợp đồng</span>
                    <span className="font-medium text-muted-foreground">
                      {expense.room?.code ? `Phòng ${expense.room.code}` : "Không liên kết"}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Khấu trừ owner</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {isDeducted ? "Đã khấu trừ vào lợi nhuận owner" : isReimbursed ? "Đã hoàn ứng" : "Chưa khấu trừ"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div className="flex flex-col gap-4">
              {/* Card: Tiến trình xử lý */}
              <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-2xs flex flex-col gap-3">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wide">
                  <Clock3 size={15} className="text-indigo-600" /> Tiến trình xử lý
                </div>

                <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-200 dark:before:bg-slate-800">
                  {/* Step 1: Tạo chi phí */}
                  <div className="relative">
                    <span className="absolute -left-6 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white ring-4 ring-card">
                      <Check size={11} strokeWidth={3} />
                    </span>
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center justify-between">
                        <span>Tạo chi phí</span>
                        <span className="text-[10px] font-mono text-muted-foreground">{dateTimeStr}</span>
                      </div>
                      <div className="text-[11px] text-muted-foreground">{paidByName} tạo chi phí</div>
                    </div>
                  </div>

                  {/* Step 2: Gửi duyệt */}
                  <div className="relative">
                    <span className="absolute -left-6 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white ring-4 ring-card">
                      <Check size={11} strokeWidth={3} />
                    </span>
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center justify-between">
                        <span>Gửi duyệt</span>
                        <span className="text-[10px] font-mono text-muted-foreground">{dateTimeStr}</span>
                      </div>
                      <div className="text-[11px] text-muted-foreground">{paidByName} gửi duyệt lên admin</div>
                    </div>
                  </div>

                  {/* Step 3: Chờ admin duyệt / Đã duyệt */}
                  <div className="relative">
                    <span
                      className={`absolute -left-6 top-0.5 flex h-5 w-5 items-center justify-center rounded-full ring-4 ring-card ${
                        isPending
                          ? "bg-amber-500 text-white animate-pulse"
                          : isApproved || isPaid
                          ? "bg-emerald-500 text-white"
                          : "bg-slate-300 dark:bg-slate-700 text-white"
                      }`}
                    >
                      {isApproved || isPaid ? <Check size={11} strokeWidth={3} /> : <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                    </span>
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center justify-between">
                        <span className={isPending ? "text-amber-600 dark:text-amber-400" : ""}>
                          {isPending ? "Chờ admin duyệt" : "Đã duyệt chi"}
                        </span>
                        <span className="text-[10px] font-mono text-muted-foreground">{dateTimeStr}</span>
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {isPending
                          ? "Đang chờ phê duyệt từ quản trị hệ thống"
                          : isApproved || isPaid
                          ? "Đã được phê duyệt"
                          : "Chưa có thông tin"}
                      </div>
                    </div>
                  </div>

                  {/* Step 4: Đã thanh toán */}
                  <div className="relative">
                    <span
                      className={`absolute -left-6 top-0.5 flex h-5 w-5 items-center justify-center rounded-full ring-4 ring-card ${
                        isPaid ? "bg-emerald-500 text-white" : "bg-slate-200 dark:bg-slate-800 text-slate-400"
                      }`}
                    >
                      {isPaid ? <Check size={11} strokeWidth={3} /> : <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />}
                    </span>
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center justify-between">
                        <span>Đã thanh toán</span>
                        <span className="text-[10px] font-mono text-muted-foreground">
                          {isPaid ? dateTimeStr : "--/--/---- --:--"}
                        </span>
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {isPaid ? "Hoàn tất thanh toán chi phí" : "Chưa thanh toán"}
                      </div>
                    </div>
                  </div>

                  {/* Step 5: Đối soát / Khấu trừ */}
                  <div className="relative">
                    <span
                      className={`absolute -left-6 top-0.5 flex h-5 w-5 items-center justify-center rounded-full ring-4 ring-card ${
                        isDeducted || isReimbursed ? "bg-emerald-500 text-white" : "bg-slate-200 dark:bg-slate-800 text-slate-400"
                      }`}
                    >
                      {isDeducted || isReimbursed ? <Check size={11} strokeWidth={3} /> : <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />}
                    </span>
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center justify-between">
                        <span>Đối soát / Khấu trừ</span>
                        <span className="text-[10px] font-mono text-muted-foreground">
                          {isDeducted || isReimbursed ? dateTimeStr : "--/--/---- --:--"}
                        </span>
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {isDeducted
                          ? "Đã khấu trừ vào công nợ / lợi nhuận owner"
                          : isReimbursed
                          ? "Đã hoàn ứng cho nhân sự"
                          : "Chưa đối soát"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card: Nhật ký xử lý */}
              <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-2xs flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wide">
                    <History size={15} className="text-indigo-600" /> Nhật ký xử lý
                  </span>
                </div>

                <div className="flex flex-col gap-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                      <User size={13} className="text-muted-foreground" /> {paidByName} tạo phiếu chi
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground">{dateTimeStr}</span>
                  </div>
                  {attachments.length > 0 && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                        <Paperclip size={13} className="text-muted-foreground" /> Đã đính kèm {attachments.length} chứng từ
                      </span>
                      <span className="text-[10px] font-mono text-muted-foreground">{dateTimeStr}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Card: Hành động */}
              <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-2xs flex flex-col gap-3">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wide">
                  <Settings size={15} className="text-indigo-600" /> Hành động
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isCancelled}
                    onClick={() => {
                      onCancel?.(expense);
                      onClose();
                    }}
                    className="gap-1.5 rounded-xl border-rose-300 text-rose-600 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-400 dark:hover:bg-rose-950/30 text-xs font-bold h-9"
                  >
                    <X size={14} /> Từ chối / Hủy
                  </Button>
                  <Button
                    type="button"
                    disabled={!isPending || !canApprove}
                    onClick={() => {
                      onApprove?.(expense);
                      onClose();
                    }}
                    className="gap-1.5 rounded-xl bg-[#6366f1] hover:bg-[#5558e6] text-white text-xs font-bold h-9 shadow-2xs"
                  >
                    <Check size={14} /> Duyệt chi
                  </Button>
                </div>

                {/* Secondary Actions: Đã chi / Khấu trừ / Hoàn ứng */}
                {(isApproved || isPending) && canPay && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      onPay?.(expense);
                      onClose();
                    }}
                    className="w-full gap-2 rounded-xl border-emerald-300 bg-emerald-50/60 hover:bg-emerald-100/80 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:hover:bg-emerald-950/50 dark:text-emerald-300 text-xs font-bold h-9 shadow-2xs transition-colors"
                  >
                    <CircleDollarSign size={15} className="text-emerald-600 dark:text-emerald-400" />
                    <span>Đánh dấu đã chi</span>
                  </Button>
                )}

                {isPaid && !isDeducted && !isReimbursed && (
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        onDeduct?.(expense);
                        onClose();
                      }}
                      className="gap-1.5 rounded-xl border-amber-300 text-amber-700 bg-amber-50/50 hover:bg-amber-100/60 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300 text-xs font-bold h-9"
                    >
                      <Split size={14} /> Khấu trừ lợi nhuận
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        onReimburse?.(expense);
                        onClose();
                      }}
                      className="gap-1.5 rounded-xl border-sky-300 text-sky-700 bg-sky-50/50 hover:bg-sky-100/60 dark:border-sky-800 dark:bg-sky-950/30 dark:text-sky-300 text-xs font-bold h-9"
                    >
                      <RotateCcw size={14} /> Hoàn ứng
                    </Button>
                  </div>
                )}

                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-1">
                  <Info size={13} className="text-indigo-600 shrink-0" />
                  <span>Sau khi duyệt, hệ thống có thể khấu trừ owner hoặc đánh dấu đã thanh toán tùy nguồn chi.</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Modal>

      {/* FULL IMAGE LIGHTBOX MODAL */}
      {selectedImage && (
        <div
          onClick={() => setSelectedImage(null)}
          className="fixed inset-0 z-[10070] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
        >
          <div className="relative max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl bg-black" onClick={(e) => e.stopPropagation()}>
            <img src={selectedImage} alt="Chứng từ phóng to" className="max-w-full max-h-[85vh] object-contain mx-auto" />
            <button
              type="button"
              onClick={() => setSelectedImage(null)}
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/20 hover:bg-white/40 text-white flex items-center justify-center transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
