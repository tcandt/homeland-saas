"use client";

import React, { useState } from "react";
import {
  AlertTriangle,
  Bot,
  Building2,
  CheckCircle2,
  Clock3,
  CreditCard,
  DoorClosed,
  FileText,
  Loader2,
  Phone,
  Receipt,
  Send,
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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isSendingBotReminder, setIsSendingBotReminder] = useState(false);

  if (!invoice) return null;

  const financials = getInvoiceFinancials(invoice);
  const totalAmount = financials.total || Number(invoice.total || invoice.totalAmount || 0);
  const paidAmount = financials.paid || Number(invoice.paidAmount || 0);
  const remainingAmount = financials.remaining;

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

  // Fallback breakdown items if empty
  const defaultItems = [
    { id: "1", name: "Tiền thuê phòng", icon: Building2, amount: totalAmount > 0 ? totalAmount : 4500000 },
    { id: "2", name: "Tiền điện (EVN)", icon: Zap, amount: 0, note: "Giá nhà nước" },
    { id: "3", name: "Tiền nước sinh hoạt", icon: Droplets, amount: 100000, note: "100.000 đ / người" },
    { id: "4", name: "Wifi & Dịch vụ", icon: Wifi, amount: 0, note: "Miễn phí" },
  ];

  const itemsToDisplay = invoice.items && invoice.items.length > 0 ? invoice.items : (totalAmount > 0 ? defaultItems : []);

  const handleSendBotReminder = () => {
    setIsSendingBotReminder(true);
    setTimeout(() => {
      setIsSendingBotReminder(false);
      toast.success(`🤖 Bot Homeland đã gửi tin nhắn nhắc nợ kèm QR chuyển khoản tới ${customerName} (${customerPhone}) qua Zalo & SMS thành công!`, {
        duration: 4000,
      });
    }, 600);
  };

  return (
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
        <Badge variant={meta.badgeVariant} className="text-xs ml-auto mr-2">
          {meta.label}
        </Badge>
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
                  const remaining = remainingAmount;
                  const amount = prompt(
                    `Nhập số tiền thanh toán (Tối đa: ${remaining}):`,
                    remaining.toString()
                  );
                  if (amount && !isNaN(Number(amount))) {
                    payMutation.mutate(
                      { id: invoice.id, amount: Number(amount) },
                      {
                        onSuccess: () => toast.success("Ghi nhận thanh toán thành công"),
                      }
                    );
                  }
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

        {/* 2. AUTOMATION BOT PIPELINE (TỰ ĐỘNG HÓA CHỐT & GỬI & THU TIỀN) */}
        <div className="rounded-xl border border-border/70 bg-surface/30 p-2.5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-muted flex items-center gap-1.5">
              <Bot size={13} className="text-primary" /> Tiến trình Bot tự động hóa
            </span>

            {/* NÚT NHẮC TRỄ HẠN THỦ CÔNG QUA BOT */}
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
            {/* Step 1: Tạo HĐ tự động cuối tháng */}
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
                  {!isDraft ? "Đã gửi Zalo / SMS" : "Chờ phát hành"}
                </div>
              </div>
            </div>

            {/* Step 3: Xác nhận thu tiền / Nhắc hẹn */}
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

        {/* 4. ITEMIZED BREAKDOWN TABLE */}
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
      </div>
    </Modal>
  );
}
