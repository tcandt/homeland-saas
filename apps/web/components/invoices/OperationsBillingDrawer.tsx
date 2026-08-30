"use client";

import React, { useState } from "react";
import {
  AlertTriangle,
  Banknote,
  Bot,
  Building2,
  CheckCircle2,
  Clock3,
  Copy,
  CreditCard,
  DoorClosed,
  Download,
  FileText,
  Loader2,
  Phone,
  Printer,
  QrCode,
  Receipt,
  Send,
  ShieldCheck,
  Smartphone,
  Trash2,
  Wallet,
  X,
  Zap,
  Droplets,
  Wifi,
} from "lucide-react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import {
  useIssueInvoiceMutation,
  usePayInvoiceMutation,
  useCancelInvoiceMutation,
  useWriteoffInvoiceMutation,
} from "@/lib/queries/invoices.queries";
import { useSendInvoicePaymentToZaloMutation } from "@/lib/queries/payments.queries";
import { useDeleteInvoiceMutation } from "@/lib/mutations/invoices.mutations";
import { getInvoiceFinancials } from "@/lib/invoices/invoice-financials";
import { getTenantAvatar } from "../tenants/TenantDetailDrawer";
import toast from "react-hot-toast";

function formatDate(value?: string | Date | null) {
  if (!value) return "--/--/----";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--/--/----";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function formatVnd(value?: number | null) {
  return `${Number(value || 0).toLocaleString("vi-VN")} đ`;
}

// 3 Core Payment Types in Homeland SaaS
export type BillingCategory = "DEPOSIT_RESERVATION" | "DEPOSIT_CONTRACT" | "MONTHLY_RENT";

const categoryConfig: Record<
  BillingCategory,
  { label: string; icon: any; color: string; badgeVariant: any; desc: string }
> = {
  DEPOSIT_RESERVATION: {
    label: "Cọc giữ phòng",
    icon: Wallet,
    color: "text-amber-600 bg-amber-500/10 border-amber-500/30",
    badgeVariant: "warning",
    desc: "Tiền cọc giữ chỗ trước khi vào ở (Khóa phòng)",
  },
  DEPOSIT_CONTRACT: {
    label: "Cọc hợp đồng",
    icon: ShieldCheck,
    color: "text-indigo-600 bg-indigo-500/10 border-indigo-500/30",
    badgeVariant: "info",
    desc: "Tiền đặt cọc bảo chứng tài sản trong suốt hợp đồng",
  },
  MONTHLY_RENT: {
    label: "Tiền phòng & Dịch vụ",
    icon: Building2,
    color: "text-emerald-600 bg-emerald-500/10 border-emerald-500/30",
    badgeVariant: "success",
    desc: "Tiền thuê định kỳ hàng tháng + Điện (EVN) + Nước + Dịch vụ",
  },
};

const statusMeta: Record<string, { label: string; badgeVariant: any }> = {
  DRAFT: { label: "Bản nháp", badgeVariant: "neutral" },
  Draft: { label: "Bản nháp", badgeVariant: "neutral" },
  ISSUED: { label: "Chờ thanh toán", badgeVariant: "warning" },
  Issued: { label: "Chờ thanh toán", badgeVariant: "warning" },
  PARTIALLY_PAID: { label: "Đã thu 1 phần", badgeVariant: "info" },
  "Partially Paid": { label: "Đã thu 1 phần", badgeVariant: "info" },
  OVERDUE: { label: "Quá hạn", badgeVariant: "danger" },
  Overdue: { label: "Quá hạn", badgeVariant: "danger" },
  PAID: { label: "Đã thu đủ", badgeVariant: "success" },
  Paid: { label: "Đã thu đủ", badgeVariant: "success" },
  CANCELLED: { label: "Đã hủy", badgeVariant: "neutral" },
  Cancelled: { label: "Đã hủy", badgeVariant: "neutral" },
};

export default function OperationsBillingDrawer({
  invoice,
  onClose,
}: {
  invoice: any | null;
  onClose: () => void;
}) {
  const issueMutation = useIssueInvoiceMutation();
  const payMutation = usePayInvoiceMutation();
  const cancelMutation = useCancelInvoiceMutation();
  const writeoffMutation = useWriteoffInvoiceMutation();
  const deleteMutation = useDeleteInvoiceMutation();
  const sendZaloMutation = useSendInvoicePaymentToZaloMutation();

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isSendingBotReminder, setIsSendingBotReminder] = useState(false);
  const [activeTab, setActiveTab] = useState<"ITEMS" | "QR">("ITEMS");
  const [showPayModal, setShowPayModal] = useState(false);
  const [payMethod, setPayMethod] = useState<"CASH" | "BANK_TRANSFER">("BANK_TRANSFER");
  const [customPayAmount, setCustomPayAmount] = useState<string>("");

  if (!invoice) return null;

  const financials = getInvoiceFinancials(invoice);
  const totalAmount = financials.total || Number(invoice.total || invoice.totalAmount || 0);
  const paidAmount = financials.paid || Number(invoice.paidAmount || 0);
  const remainingAmount = financials.remaining;

  // Determine Category (Holding Deposit vs Security Deposit vs Monthly Rent)
  const resolvedCategory: BillingCategory =
    invoice.category ||
    (invoice.type === "DEPOSIT" || invoice.title?.includes("giữ chỗ")
      ? "DEPOSIT_RESERVATION"
      : invoice.title?.includes("Cọc hợp đồng")
      ? "DEPOSIT_CONTRACT"
      : "MONTHLY_RENT");

  const categoryInfo = categoryConfig[resolvedCategory] || categoryConfig.MONTHLY_RENT;

  // Robust customer & room resolution
  const customerName =
    invoice.customer?.fullName ||
    invoice.customer?.name ||
    invoice.contract?.customer?.fullName ||
    invoice.contract?.customer?.name ||
    invoice.tenant?.name ||
    invoice.tenantName ||
    "Nguyễn Đức Tính";

  const customerPhone =
    invoice.customer?.phone ||
    invoice.contract?.customer?.phone ||
    invoice.tenantPhone ||
    "0567867889";

  const customerGender =
    invoice.customer?.gender ||
    invoice.contract?.customer?.gender ||
    "";

  const isFemale =
    customerGender === "FEMALE" ||
    customerGender === "Nữ" ||
    customerGender === "nu";

  const avatarUrl = getTenantAvatar(
    invoice.customer?.avatar || invoice.contract?.customer?.avatar,
    customerName,
    customerGender
  );

  const roomNumber =
    invoice.contract?.room?.code ||
    invoice.contract?.room?.number ||
    invoice.contract?.room?.name ||
    invoice.room?.code ||
    invoice.room?.number ||
    "PN 31-01";

  const buildingName =
    invoice.contract?.room?.building?.code ||
    invoice.contract?.room?.building?.name ||
    invoice.building?.name ||
    invoice.building?.code ||
    "Tòa LK01.31";

  const periodText =
    invoice.period ||
    invoice.billingPeriod ||
    (invoice.createdAt
      ? `Tháng ${String(new Date(invoice.createdAt).getMonth() + 1).padStart(2, "0")}/${new Date(invoice.createdAt).getFullYear()}`
      : "Tháng 08/2026");

  const currentStatus = (invoice.status || "DRAFT").toUpperCase();
  const isPaid = currentStatus === "PAID";
  const isPartiallyPaid = currentStatus === "PARTIALLY_PAID";
  const isOverdue = currentStatus === "OVERDUE";
  const isDraft = currentStatus === "DRAFT";
  const isIssued = currentStatus === "ISSUED";

  const meta = statusMeta[invoice.status || "DRAFT"] || {
    label: invoice.status || "Bản nháp",
    badgeVariant: "neutral",
  };

  const invoiceCode = invoice.code || (invoice.id ? `FIN-${invoice.id.slice(0, 10)}` : "HÓA ĐƠN");

  // VietQR generation params
  const bankName = "MBBank (Quân Đội)";
  const bankAccount = "0567867889";
  const accountHolder = "HOMELAND MANAGEMENT";
  const amountToPay = remainingAmount > 0 ? remainingAmount : totalAmount;
  const qrUrl = `https://img.vietqr.io/image/MB-${bankAccount}-compact2.png?amount=${amountToPay}&addInfo=${encodeURIComponent(invoiceCode)}&accountName=${encodeURIComponent(accountHolder)}`;

  // Breakdown items depending on payment category
  const defaultItems =
    resolvedCategory === "DEPOSIT_RESERVATION"
      ? [
          { id: "1", name: "Tiền cọc giữ chỗ phòng", icon: Wallet, amount: totalAmount > 0 ? totalAmount : 1000000, note: "Khóa phòng trước khi dọn vào" },
        ]
      : resolvedCategory === "DEPOSIT_CONTRACT"
      ? [
          { id: "1", name: "Tiền đặt cọc hợp đồng", icon: ShieldCheck, amount: totalAmount > 0 ? totalAmount : 4500000, note: "Bảo đảm tài sản (Khấu trừ khi trả phòng)" },
        ]
      : [
          { id: "1", name: "Tiền thuê phòng", icon: Building2, amount: totalAmount > 0 ? totalAmount : 4500000 },
          { id: "2", name: "Tiền điện (Theo chỉ số EVN)", icon: Zap, amount: 0, note: "Giá nhà nước" },
          { id: "3", name: "Tiền nước sinh hoạt", icon: Droplets, amount: 100000, note: "100.000 đ / người" },
          { id: "4", name: "Wifi & Dịch vụ vệ sinh/rác", icon: Wifi, amount: 0, note: "Miễn phí tiện ích" },
        ];

  const itemsToDisplay = invoice.items && invoice.items.length > 0 ? invoice.items : defaultItems;

  const handleSendBotReminder = async () => {
    if (!invoice?.id) return;
    setIsSendingBotReminder(true);
    try {
      await sendZaloMutation.mutateAsync(invoice.id);
      toast.success(
        `🤖 Bot Zalo đã gửi thông báo nhắc nợ kèm VietQR tới ${customerName} (${customerPhone}) thành công!`,
        { duration: 5000 }
      );
    } catch (err: any) {
      const errorMsg =
        err?.message ||
        `Khách thuê ${customerName} chưa liên kết Zalo ID với Bot. Vui lòng gửi link Bot Zalo để khách bấm Bắt đầu.`;
      toast.error(errorMsg, { duration: 6000 });
    } finally {
      setIsSendingBotReminder(false);
    }
  };

  const handleConfirmPayment = () => {
    const payVal = customPayAmount ? Number(customPayAmount) : remainingAmount;
    if (payVal <= 0 || isNaN(payVal)) {
      toast.error("Vui lòng nhập số tiền hợp lệ");
      return;
    }

    payMutation.mutate(
      { id: invoice.id, amount: payVal },
      {
        onSuccess: () => {
          setShowPayModal(false);
          setCustomPayAmount("");
          toast.success(
            `Đã ghi nhận thu ${formatVnd(payVal)} (${payMethod === "CASH" ? "Tiền mặt" : "Chuyển khoản VietQR"}) thành công!`
          );
        },
      }
    );
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`Đã sao chép ${label}`);
  };

  return (
    <>
      <Modal
        isOpen={!!invoice}
        onClose={onClose}
        maxWidth="max-w-[580px]"
        title={
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Receipt size={17} />
            </div>
            <div>
              <h2 className="text-base font-black text-text leading-tight">Hóa đơn thu tiền</h2>
              <span className="font-mono text-xs font-bold text-muted">{invoiceCode}</span>
            </div>
          </div>
        }
        headerActions={
          <div className="flex items-center gap-1.5 ml-auto mr-2">
            <span className={`inline-flex items-center gap-1 text-[11px] font-black rounded-lg border px-2 py-0.5 ${categoryInfo.color}`}>
              <categoryInfo.icon size={12} />
              {categoryInfo.label}
            </span>
            <Badge variant={meta.badgeVariant} className="text-xs">
              {meta.label}
            </Badge>
          </div>
        }
        footer={
          <div className="flex w-full items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              {showDeleteConfirm ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-rose-600 font-bold">Xóa hẳn?</span>
                  <Button
                    data-testid="btn-confirm-delete"
                    variant="danger"
                    size="sm"
                    className="rounded-xl font-bold h-8.5 px-2.5 text-xs"
                    onClick={() =>
                      deleteMutation.mutate(invoice.id, {
                        onSuccess: () => {
                          setShowDeleteConfirm(false);
                          onClose();
                        },
                      })
                    }
                    isLoading={deleteMutation.isPending}
                  >
                    Xác nhận
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="rounded-xl h-8.5 px-2 text-xs"
                    onClick={() => setShowDeleteConfirm(false)}
                  >
                    Hủy
                  </Button>
                </div>
              ) : (
                <Button
                  data-testid="btn-delete-invoice"
                  variant="ghost"
                  size="sm"
                  className="rounded-xl h-8.5 text-xs font-bold text-rose-600 hover:bg-rose-500/10 px-2.5"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  <Trash2 size={13} className="mr-1" /> Xóa
                </Button>
              )}

              {(isDraft || isIssued) && !showDeleteConfirm && (
                <Button
                  data-testid="btn-cancel-invoice"
                  variant="ghost"
                  size="sm"
                  className="rounded-xl h-8.5 text-xs font-bold text-muted hover:text-text px-2.5"
                  onClick={() => {
                    cancelMutation.mutate(invoice.id, {
                      onSuccess: () => toast.success("Hóa đơn đã bị hủy"),
                    });
                  }}
                  disabled={cancelMutation.isPending}
                >
                  Hủy HĐ
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl h-8.5 text-xs font-bold px-3"
                onClick={onClose}
              >
                Đóng
              </Button>

              {isDraft && (
                <Button
                  data-testid="btn-issue-invoice"
                  variant="primary"
                  size="sm"
                  className="rounded-xl h-8.5 text-xs font-black px-3.5 shadow-xs"
                  onClick={() => {
                    issueMutation.mutate(invoice.id, {
                      onSuccess: () => toast.success("Phát hành hóa đơn thành công"),
                    });
                  }}
                  disabled={issueMutation.isPending}
                >
                  <Send size={13} className="mr-1.5" /> Phát hành ngay
                </Button>
              )}

              {(isIssued || isPartiallyPaid || isOverdue) && (
                <Button
                  data-testid="btn-pay-invoice"
                  variant="primary"
                  size="sm"
                  className="rounded-xl h-8.5 text-xs font-black px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                  onClick={() => {
                    setCustomPayAmount(remainingAmount.toString());
                    setShowPayModal(true);
                  }}
                  disabled={payMutation.isPending}
                >
                  <Wallet size={13} className="mr-1.5" /> Ghi nhận thu tiền
                </Button>
              )}

              {isPaid && (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-1.5">
                  <CheckCircle2 size={13} /> Đã thu đủ
                </span>
              )}
            </div>
          </div>
        }
      >
        <div className="flex flex-col gap-3">
          {/* 1. CUSTOMER & ROOM PROFILE */}
          <div className="flex items-center justify-between rounded-xl border border-border/70 bg-surface/40 p-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative shrink-0">
                <img
                  src={avatarUrl}
                  alt={customerName}
                  className={`h-10 w-10 rounded-xl object-cover border-2 shadow-2xs ${
                    isFemale ? "border-pink-300 bg-pink-50" : "border-sky-300 bg-sky-50"
                  }`}
                />
                <span
                  className={`absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-black text-white ${
                    isFemale ? "bg-rose-500" : "bg-sky-600"
                  }`}
                >
                  {isFemale ? "♀" : "♂"}
                </span>
              </div>

              <div className="min-w-0">
                <div className="truncate font-black text-sm text-text">{customerName}</div>
                <div className="flex items-center gap-1.5 text-xs text-muted">
                  <Building2 size={12} className="text-indigo-500 shrink-0" />
                  <span className="truncate">{buildingName}</span>
                  <span className="text-muted/40">•</span>
                  <DoorClosed size={11} className="text-amber-500 shrink-0" />
                  <span className="font-mono font-bold text-primary truncate">{roomNumber}</span>
                </div>
              </div>
            </div>

            {customerPhone && (
              <a
                href={`tel:${customerPhone}`}
                className="inline-flex items-center gap-1 rounded-xl border border-border bg-card px-2.5 py-1 text-[11px] font-bold text-muted hover:text-text hover:border-primary/40 transition-colors shrink-0"
              >
                <Phone size={12} className="text-emerald-500" />
                <span className="font-mono">{customerPhone}</span>
              </a>
            )}
          </div>

          {/* 2. AUTOMATION BOT PIPELINE */}
          <div className="rounded-xl border border-border/70 bg-surface/30 p-2.5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-muted flex items-center gap-1.5">
                <Bot size={13} className="text-primary" /> Tiến trình Bot tự động hóa
              </span>

              {/* MANUAL BOT REMINDER BUTTON */}
              {(isIssued || isOverdue || isPartiallyPaid) && (
                <button
                  type="button"
                  disabled={isSendingBotReminder}
                  onClick={handleSendBotReminder}
                  className="inline-flex items-center gap-1.5 text-[11px] font-black text-primary bg-primary/10 hover:bg-primary/20 border border-primary/30 rounded-lg px-2.5 py-0.5 transition-all shadow-2xs active:scale-95"
                >
                  {isSendingBotReminder ? (
                    <Loader2 size={11} className="animate-spin" />
                  ) : (
                    <Bot size={12} className="text-primary" />
                  )}
                  {isSendingBotReminder ? "Đang gửi..." : "Bot nhắc nợ ngay"}
                </button>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2">
              {/* Step 1: Tạo HĐ tự động */}
              <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-2">
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white shrink-0 text-[10px]">
                  <CheckCircle2 size={12} />
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] font-black text-text leading-tight truncate">1. Tạo hóa đơn</div>
                  <div className="text-[9px] text-emerald-600 font-bold truncate">Tự động chốt</div>
                </div>
              </div>

              {/* Step 2: Bot gửi HĐ */}
              <div
                className={`flex items-center gap-2 rounded-xl border p-2 ${
                  !isDraft
                    ? "border-emerald-500/30 bg-emerald-500/5"
                    : "border-border/60 bg-card"
                }`}
              >
                <div
                  className={`flex h-5 w-5 items-center justify-center rounded-full shrink-0 text-[10px] ${
                    !isDraft ? "bg-emerald-500 text-white" : "bg-surface text-muted"
                  }`}
                >
                  {!isDraft ? <CheckCircle2 size={12} /> : <Bot size={11} />}
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] font-black text-text leading-tight truncate">2. Bot gửi HĐ</div>
                  <div className="text-[9px] font-bold truncate text-muted">
                    {!isDraft ? "Đã gửi Zalo/SMS" : "Chờ phát hành"}
                  </div>
                </div>
              </div>

              {/* Step 3: Thu tiền / Nhắc hẹn */}
              <div
                className={`flex items-center gap-2 rounded-xl border p-2 ${
                  isPaid
                    ? "border-emerald-500/30 bg-emerald-500/5"
                    : isPartiallyPaid
                    ? "border-blue-500/30 bg-blue-500/5"
                    : isOverdue
                    ? "border-rose-500/30 bg-rose-500/5"
                    : "border-amber-500/30 bg-amber-500/5"
                }`}
              >
                <div
                  className={`flex h-5 w-5 items-center justify-center rounded-full shrink-0 text-[10px] ${
                    isPaid
                      ? "bg-emerald-500 text-white"
                      : isPartiallyPaid
                      ? "bg-blue-500 text-white"
                      : isOverdue
                      ? "bg-rose-500 text-white"
                      : "bg-amber-500 text-white"
                  }`}
                >
                  {isPaid ? (
                    <CheckCircle2 size={12} />
                  ) : isOverdue ? (
                    <AlertTriangle size={12} />
                  ) : isPartiallyPaid ? (
                    <CreditCard size={11} />
                  ) : (
                    <Clock3 size={11} />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] font-black text-text leading-tight truncate">
                    3. {isPaid ? "Đã nhận đủ" : isPartiallyPaid ? "Nhận 1 phần" : isOverdue ? "Bot nhắc hẹn" : "Chờ thu"}
                  </div>
                  <div
                    className={`text-[9px] font-bold truncate ${
                      isPaid
                        ? "text-emerald-600"
                        : isPartiallyPaid
                        ? "text-blue-600"
                        : isOverdue
                        ? "text-rose-600"
                        : "text-amber-600"
                    }`}
                  >
                    {isPaid
                      ? "Xác nhận đủ"
                      : isPartiallyPaid
                      ? `Còn ${formatVnd(remainingAmount)}`
                      : isOverdue
                      ? "Quá hạn nợ"
                      : "Chờ khách đóng"}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 3. TOTAL AMOUNT & HIGHLIGHT METRICS */}
          <div className="rounded-xl border border-border/70 bg-gradient-to-br from-card via-surface/40 to-card p-3.5 text-center shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted block mb-1">
              Tổng tiền cần thanh toán
            </span>
            <div className="font-mono text-2xl font-black text-primary leading-tight">
              {formatVnd(totalAmount)}
            </div>

            <div className="grid grid-cols-3 gap-2 pt-3 mt-3 border-t border-border/50 text-left">
              <div>
                <span className="text-[10px] font-bold uppercase text-muted block">Kỳ cước</span>
                <span className="font-mono font-bold text-xs text-text">{periodText}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-muted block">Ngày lập</span>
                <span className="font-mono font-bold text-xs text-text">
                  {formatDate(invoice.createdAt || invoice.issueDate)}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-muted block">Hạn đóng</span>
                <span
                  className={`font-mono font-bold text-xs ${
                    isOverdue ? "text-rose-600" : "text-text"
                  }`}
                >
                  {formatDate(invoice.dueDate)}
                </span>
              </div>
            </div>
          </div>

          {/* 4. VIEW TABS: CHI TIẾT PHÍ vs QUÉT MÃ VIETQR */}
          <div className="flex rounded-xl bg-surface/70 p-1 gap-1 border border-border/60">
            <button
              type="button"
              onClick={() => setActiveTab("ITEMS")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-black transition-all ${
                activeTab === "ITEMS"
                  ? "bg-card text-text shadow-xs border border-border/60"
                  : "text-muted hover:text-text"
              }`}
            >
              <FileText size={13} /> Khoản mục phí
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("QR")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-black transition-all ${
                activeTab === "QR"
                  ? "bg-card text-primary shadow-xs border border-primary/30"
                  : "text-muted hover:text-text"
              }`}
            >
              <QrCode size={13} /> Quét mã VietQR (Tự động)
            </button>
          </div>

          {/* TAB 1: ITEMIZED BREAKDOWN TABLE */}
          {activeTab === "ITEMS" && (
            <div className="rounded-xl border border-border/70 bg-card overflow-hidden">
              <div className="flex items-center justify-between px-3.5 py-2 border-b border-border/60 bg-surface/50 text-[11px] font-black uppercase tracking-wider text-muted select-none">
                <span>Khoản mục phí</span>
                <span>Thành tiền</span>
              </div>

              <div className="divide-y divide-border/40 px-3.5 py-1">
                {itemsToDisplay.map((item: any, idx: number) => {
                  const ItemIcon = item.icon || FileText;
                  return (
                    <div key={item.id || idx} className="flex items-center justify-between py-2 text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <ItemIcon size={13} className="text-primary shrink-0" />
                        <span className="font-bold text-text truncate">
                          {item.name || item.description}
                        </span>
                        {item.note && (
                          <span className="text-[10px] text-muted italic shrink-0">
                            ({item.note})
                          </span>
                        )}
                      </div>
                      <span className="font-mono font-black text-text shrink-0 pl-2">
                        {formatVnd(item.amount)}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Subtotal summary */}
              <div className="flex items-center justify-between px-3.5 py-2.5 border-t border-border/60 bg-surface/30 text-xs">
                <span className="font-black uppercase text-text">Tổng cộng</span>
                <span className="font-mono font-black text-sm text-primary">{formatVnd(totalAmount)}</span>
              </div>
            </div>
          )}

          {/* TAB 2: VIETQR PAYMENT SCANNER */}
          {activeTab === "QR" && (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-border/70 bg-card p-4 text-center">
              <div className="flex h-44 w-44 items-center justify-center rounded-2xl bg-white p-2 border-2 border-primary/20 shadow-xs">
                <img
                  src={qrUrl}
                  alt="VietQR Homeland"
                  className="h-full w-full object-contain"
                />
              </div>

              <div className="w-full grid grid-cols-2 gap-2 text-left text-xs pt-1">
                <div className="rounded-xl border border-border/60 bg-surface/40 p-2">
                  <span className="text-[10px] text-muted block font-bold">Ngân hàng</span>
                  <span className="font-black text-text">{bankName}</span>
                </div>
                <div className="rounded-xl border border-border/60 bg-surface/40 p-2">
                  <span className="text-[10px] text-muted block font-bold">Số tài khoản</span>
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-black text-text">{bankAccount}</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(bankAccount, "Số tài khoản")}
                      className="text-muted hover:text-primary"
                    >
                      <Copy size={12} />
                    </button>
                  </div>
                </div>
                <div className="col-span-2 rounded-xl border border-primary/20 bg-primary/5 p-2">
                  <span className="text-[10px] text-primary font-bold block">Nội dung chuyển khoản (Memo)</span>
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-black text-primary text-sm">{invoiceCode}</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(invoiceCode, "Cú pháp chuyển khoản")}
                      className="text-primary hover:underline flex items-center gap-1 font-bold text-[11px]"
                    >
                      <Copy size={12} /> Sao chép
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* QUICK PAYMENT CONFIRMATION SUB-MODAL */}
      {showPayModal && (
        <Modal
          isOpen={showPayModal}
          onClose={() => setShowPayModal(false)}
          maxWidth="max-w-[420px]"
          title="Xác nhận ghi nhận thu tiền"
          footer={
            <div className="flex w-full items-center justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowPayModal(false)}>
                Hủy
              </Button>
              <Button
                variant="primary"
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 font-bold"
                onClick={handleConfirmPayment}
                isLoading={payMutation.isPending}
              >
                Xác nhận đã thu
              </Button>
            </div>
          }
        >
          <div className="flex flex-col gap-3.5 text-xs">
            {/* Method selection */}
            <div>
              <label className="font-bold text-muted block mb-1.5">Phương thức thanh toán</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPayMethod("BANK_TRANSFER")}
                  className={`flex items-center justify-center gap-1.5 p-2.5 rounded-xl border font-bold transition-all ${
                    payMethod === "BANK_TRANSFER"
                      ? "border-emerald-500 bg-emerald-500/10 text-emerald-600 shadow-2xs"
                      : "border-border bg-card text-muted hover:text-text"
                  }`}
                >
                  <CreditCard size={14} /> Chuyển khoản (QR)
                </button>
                <button
                  type="button"
                  onClick={() => setPayMethod("CASH")}
                  className={`flex items-center justify-center gap-1.5 p-2.5 rounded-xl border font-bold transition-all ${
                    payMethod === "CASH"
                      ? "border-emerald-500 bg-emerald-500/10 text-emerald-600 shadow-2xs"
                      : "border-border bg-card text-muted hover:text-text"
                  }`}
                >
                  <Banknote size={14} /> Tiền mặt trực tiếp
                </button>
              </div>
            </div>

            {/* Amount Input */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-bold text-muted">Số tiền thực thu (VNĐ)</label>
                <button
                  type="button"
                  onClick={() => setCustomPayAmount(remainingAmount.toString())}
                  className="text-primary font-bold hover:underline text-[11px]"
                >
                  Thu đủ 100% ({formatVnd(remainingAmount)})
                </button>
              </div>
              <input
                type="number"
                value={customPayAmount}
                onChange={(e) => setCustomPayAmount(e.target.value)}
                placeholder="Nhập số tiền..."
                className="w-full h-10 px-3 rounded-xl border border-border bg-surface font-mono font-black text-sm text-text outline-none focus:border-primary"
              />
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
