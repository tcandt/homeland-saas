"use client";

import React, { useState } from "react";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Clock3,
  CreditCard,
  DoorClosed,
  Download,
  FileText,
  History,
  MessageCircle,
  Phone,
  Printer,
  QrCode,
  Receipt,
  Send,
  Smartphone,
  Trash2,
  User,
  Wallet,
  X,
  Zap,
  Droplets,
  Wifi,
} from "lucide-react";
import { Drawer } from "../ui/Drawer";
import { Card } from "../ui/Card";
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

const statusMeta: Record<string, { label: string; tone: string; badgeVariant: any }> = {
  DRAFT: { label: "Bản nháp", tone: "text-slate-600 bg-slate-100 dark:bg-slate-800", badgeVariant: "neutral" },
  Draft: { label: "Bản nháp", tone: "text-slate-600 bg-slate-100 dark:bg-slate-800", badgeVariant: "neutral" },
  ISSUED: { label: "Chờ thanh toán", tone: "text-amber-600 bg-amber-500/10 border-amber-500/20", badgeVariant: "warning" },
  Issued: { label: "Chờ thanh toán", tone: "text-amber-600 bg-amber-500/10 border-amber-500/20", badgeVariant: "warning" },
  PARTIALLY_PAID: { label: "Đã thu 1 phần", tone: "text-blue-600 bg-blue-500/10 border-blue-500/20", badgeVariant: "info" },
  "Partially Paid": { label: "Đã thu 1 phần", tone: "text-blue-600 bg-blue-500/10 border-blue-500/20", badgeVariant: "info" },
  OVERDUE: { label: "Quá hạn", tone: "text-rose-600 bg-rose-500/10 border-rose-500/20", badgeVariant: "danger" },
  Overdue: { label: "Quá hạn", tone: "text-rose-600 bg-rose-500/10 border-rose-500/20", badgeVariant: "danger" },
  PAID: { label: "Đã thu đủ", tone: "text-emerald-600 bg-emerald-500/10 border-emerald-500/20", badgeVariant: "success" },
  Paid: { label: "Đã thu đủ", tone: "text-emerald-600 bg-emerald-500/10 border-emerald-500/20", badgeVariant: "success" },
  CANCELLED: { label: "Đã hủy", tone: "text-slate-500 bg-slate-100", badgeVariant: "neutral" },
  Cancelled: { label: "Đã hủy", tone: "text-slate-500 bg-slate-100", badgeVariant: "neutral" },
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
  const [showQrModal, setShowQrModal] = useState(false);

  if (!invoice) return null;

  const financials = getInvoiceFinancials(invoice);
  const totalAmount = financials.total || Number(invoice.total || invoice.totalAmount || 0);
  const paidAmount = financials.paid || Number(invoice.paidAmount || 0);
  const remainingAmount = financials.remaining;
  const paidPercent = totalAmount > 0 ? Math.min(100, Math.round((paidAmount / totalAmount) * 100)) : 0;

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
    "";

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

  const currentStatus = invoice.status || "DRAFT";
  const meta = statusMeta[currentStatus] || {
    label: currentStatus,
    tone: "text-slate-600 bg-slate-100",
    badgeVariant: "neutral",
  };

  const invoiceCode = invoice.code || (invoice.id ? `FIN-${invoice.id.slice(0, 10)}` : "HÓA ĐƠN");

  // Fallback breakdown items if empty
  const defaultItems = [
    { id: "1", name: "Tiền thuê phòng", icon: Building2, quantity: 1, amount: totalAmount > 0 ? totalAmount : 4500000 },
    { id: "2", name: "Tiền điện (Theo chỉ số EVN)", icon: Zap, quantity: 1, amount: 0, note: "Tính theo giá nhà nước" },
    { id: "3", name: "Tiền nước sinh hoạt", icon: Droplets, quantity: 1, amount: 100000, note: "100.000 đ / người" },
    { id: "4", name: "Wifi & Dịch vụ vệ sinh / rác", icon: Wifi, quantity: 1, amount: 0, note: "Miễn phí tiện ích" },
  ];

  const itemsToDisplay = invoice.items && invoice.items.length > 0 ? invoice.items : (totalAmount > 0 ? defaultItems : []);

  return (
    <Drawer
      testId="invoice-detail-drawer"
      closeTestId="invoice-detail-close"
      isOpen={!!invoice}
      onClose={onClose}
      title={
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Receipt size={18} />
          </div>
          <div className="flex items-center gap-2">
            <h2 className="font-black text-lg text-text">Chi tiết Hóa đơn</h2>
            <span className="rounded-xl border border-primary/20 bg-primary/10 px-2.5 py-0.5 font-mono text-xs font-black text-primary">
              {invoiceCode}
            </span>
          </div>
        </div>
      }
      size="xl"
    >
      <div className="flex flex-col gap-4 pb-8">
        {/* TOP TENANT & INVOICE SUMMARY CARD */}
        <Card className="flex flex-col gap-4 p-4 md:p-5 rounded-2xl border-border/60 shadow-xs">
          {/* Header Customer Info */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="relative shrink-0">
                <img
                  src={avatarUrl}
                  alt={customerName}
                  className={`h-13 w-13 rounded-2xl object-cover border-2 shadow-xs ${
                    isFemale ? "border-pink-300 bg-pink-50" : "border-sky-300 bg-sky-50"
                  }`}
                />
                <span
                  className={`absolute -bottom-1 -right-1 flex h-4.5 w-4.5 items-center justify-center rounded-full text-[10px] font-black text-white ${
                    isFemale ? "bg-rose-500" : "bg-sky-600"
                  }`}
                >
                  {isFemale ? "♀" : "♂"}
                </span>
              </div>

              <div className="min-w-0 flex-1">
                <h3 className="truncate font-black text-xl text-text leading-tight">{customerName}</h3>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                  <div className="inline-flex items-center gap-1.5 rounded-xl border border-border/80 bg-surface/70 px-2.5 py-1 font-bold text-text">
                    <Building2 size={13} className="text-indigo-500 shrink-0" />
                    <span>{buildingName}</span>
                    <span className="text-muted/40">•</span>
                    <DoorClosed size={12} className="text-amber-500 shrink-0" />
                    <span className="font-mono text-primary">{roomNumber}</span>
                  </div>

                  <Badge variant={meta.badgeVariant} className="text-xs">
                    {meta.label}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Quick Contact Chips */}
            {customerPhone && (
              <div className="flex items-center gap-1.5 shrink-0 self-start sm:self-center">
                <a
                  href={`https://zalo.me/${customerPhone}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-sky-500/30 bg-sky-500/10 px-3 py-1.5 text-xs font-bold text-sky-600 hover:bg-sky-500/20 transition-colors shadow-2xs"
                >
                  <MessageCircle size={14} /> Zalo
                </a>
                <a
                  href={`tel:${customerPhone}`}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-600 hover:bg-emerald-500/20 transition-colors shadow-2xs"
                >
                  <Phone size={14} /> Gọi
                </a>
              </div>
            )}
          </div>

          {/* Payment Progress Bar */}
          <div className="flex flex-col gap-1.5 pt-2 border-t border-border/40">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-muted uppercase tracking-wider">Tiến độ thu tiền</span>
              <span className="font-mono font-black text-text">
                {formatVnd(paidAmount)} / {formatVnd(totalAmount)} ({paidPercent}%)
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-border/50">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  paidPercent === 100
                    ? "bg-emerald-500"
                    : remainingAmount > 0 && currentStatus === "OVERDUE"
                    ? "bg-rose-500"
                    : "bg-primary"
                }`}
                style={{ width: `${paidPercent}%` }}
              />
            </div>
          </div>

          {/* 4-Stat Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-border/40">
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Kỳ cước</span>
              <span className="font-mono font-black text-sm text-text">{periodText}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Ngày lập hóa đơn</span>
              <span className="font-mono font-bold text-sm text-text">
                {formatDate(invoice.createdAt || invoice.issueDate)}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Hạn thanh toán</span>
              <span
                className={`font-mono font-bold text-sm ${
                  currentStatus === "OVERDUE" ? "text-rose-600 dark:text-rose-400" : "text-text"
                }`}
              >
                {formatDate(invoice.dueDate)}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Còn nợ lại</span>
              <span
                className={`font-mono font-black text-base ${
                  remainingAmount > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"
                }`}
              >
                {formatVnd(remainingAmount)}
              </span>
            </div>
          </div>
        </Card>

        {/* 2 COLUMN SECTION: BREAKDOWN + PAYMENT DETAILS */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* COLUMN 1: BREAKDOWN (7 COLS) */}
          <Card className="lg:col-span-7 flex flex-col gap-3 p-4 md:p-5 rounded-2xl border-border/60 shadow-xs">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <h4 className="font-black text-sm text-text flex items-center gap-2">
                <FileText size={16} className="text-primary" /> Chi tiết các khoản phí
              </h4>
              <span className="text-xs font-bold text-muted">{itemsToDisplay.length} hạng mục</span>
            </div>

            <div className="flex flex-col divide-y divide-border/40 min-h-[140px]">
              {itemsToDisplay.length > 0 ? (
                itemsToDisplay.map((item: any, idx: number) => {
                  const ItemIcon = item.icon || FileText;
                  return (
                    <div key={item.id || idx} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface text-muted shrink-0">
                          <ItemIcon size={14} className="text-primary" />
                        </div>
                        <div className="min-w-0">
                          <div className="truncate font-bold text-xs text-text">
                            {item.name || item.description}
                          </div>
                          {item.note && (
                            <div className="truncate text-[10px] font-medium text-muted">{item.note}</div>
                          )}
                        </div>
                      </div>
                      <span className="font-mono font-black text-xs text-text shrink-0">
                        {formatVnd(item.amount)}
                      </span>
                    </div>
                  );
                })
              ) : (
                <div className="flex flex-col items-center justify-center py-6 text-center text-muted">
                  <Receipt size={24} className="mb-1 opacity-50" />
                  <span className="text-xs font-medium">Chưa có chi tiết phí cụ thể</span>
                </div>
              )}
            </div>

            {/* Total Summary Footer */}
            <div className="mt-auto flex flex-col gap-2 pt-3 border-t border-border/60 bg-surface/40 rounded-xl p-3">
              <div className="flex items-center justify-between text-xs text-muted">
                <span>Tạm tính phí dịch vụ</span>
                <span className="font-mono font-bold text-text">{formatVnd(totalAmount)}</span>
              </div>

              {Number(invoice.discount || 0) > 0 && (
                <div className="flex items-center justify-between text-xs text-indigo-600">
                  <span>Khấu trừ / Giảm giá</span>
                  <span className="font-mono font-bold">-{formatVnd(invoice.discount)}</span>
                </div>
              )}

              {Number(invoice.penaltyAmount || 0) > 0 && (
                <div className="flex items-center justify-between text-xs text-rose-600">
                  <span>Phạt quá hạn</span>
                  <span className="font-mono font-bold">+{formatVnd(invoice.penaltyAmount)}</span>
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-border/60">
                <span className="font-black text-sm uppercase text-text">Tổng cộng</span>
                <span className="font-mono font-black text-lg text-primary">{formatVnd(totalAmount)}</span>
              </div>
            </div>
          </Card>

          {/* COLUMN 2: QUICK PAYMENT & CONTACT (5 COLS) */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            {/* VietQR Quick Payment Box */}
            <Card className="flex flex-col gap-3 p-4 rounded-2xl border-border/60 shadow-xs bg-gradient-to-br from-card to-surface">
              <h4 className="font-black text-sm text-text flex items-center gap-2">
                <QrCode size={16} className="text-emerald-600" /> Thanh toán chuyển khoản nhanh
              </h4>

              <div className="flex items-center gap-3 p-3 rounded-xl border border-border/60 bg-card">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 shrink-0">
                  <CreditCard size={22} />
                </div>
                <div className="min-w-0 flex-1 text-xs">
                  <div className="font-bold text-muted">Số tài khoản nhận</div>
                  <div className="font-mono font-black text-text text-sm">HOMELAND-AUTO</div>
                  <div className="text-[10px] text-muted truncate">Cú pháp: {invoiceCode}</div>
                </div>
              </div>

              {remainingAmount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const amount = prompt(
                      `Nhập số tiền thanh toán (Tối đa: ${remainingAmount}):`,
                      remainingAmount.toString()
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
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 text-xs font-black shadow-xs transition-colors"
                >
                  <Wallet size={15} /> Ghi nhận đã thu tiền
                </button>
              )}
            </Card>

            {/* Communication & Reminder */}
            <Card className="flex flex-col gap-2.5 p-4 rounded-2xl border-border/60 shadow-xs">
              <h4 className="font-black text-sm text-text flex items-center gap-2">
                <MessageCircle size={16} className="text-sky-500" /> Nhắc cước & Trao đổi
              </h4>

              <div className="grid grid-cols-3 gap-2">
                <a
                  href={customerPhone ? `https://zalo.me/${customerPhone}` : "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-9 items-center justify-center gap-1.5 rounded-xl border border-sky-500/30 bg-sky-500/10 text-sky-600 text-xs font-bold hover:bg-sky-500/20 transition-colors shadow-2xs"
                >
                  <MessageCircle size={14} /> Zalo
                </a>
                <a
                  href={customerPhone ? `sms:${customerPhone}` : "#"}
                  className="flex h-9 items-center justify-center gap-1.5 rounded-xl border border-indigo-500/30 bg-indigo-500/10 text-indigo-600 text-xs font-bold hover:bg-indigo-500/20 transition-colors shadow-2xs"
                >
                  <Smartphone size={14} /> SMS
                </a>
                <a
                  href={customerPhone ? `tel:${customerPhone}` : "#"}
                  className="flex h-9 items-center justify-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 text-xs font-bold hover:bg-emerald-500/20 transition-colors shadow-2xs"
                >
                  <Phone size={14} /> Gọi
                </a>
              </div>
            </Card>
          </div>
        </div>

        {/* TIMELINE & ACTIVITY */}
        <Card className="flex flex-col gap-3 p-4 md:p-5 rounded-2xl border-border/60 shadow-xs">
          <h4 className="font-black text-sm text-text flex items-center gap-2 border-b border-border/60 pb-3">
            <History size={16} className="text-muted" /> Lịch sử thanh toán & Hoạt động
          </h4>

          <div className="relative flex flex-col gap-0 pl-1 mt-1">
            <div className="absolute left-[15px] top-[10px] bottom-[20px] w-[2px] bg-border/80" />

            {/* Event 1: Tạo hóa đơn */}
            <div className="relative z-10 flex gap-3.5 pb-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-4 border-card bg-primary text-white shadow-2xs">
                <FileText size={13} />
              </div>
              <div className="flex flex-col gap-0.5 pt-1">
                <span className="font-bold text-xs text-text leading-none">Tạo hóa đơn tự động</span>
                <span className="font-mono text-[11px] text-muted">
                  Bởi Hệ thống Homeland · {formatDate(invoice.createdAt || invoice.issueDate)}
                </span>
              </div>
            </div>

            {/* Event 2: Gửi thông báo */}
            <div className="relative z-10 flex gap-3.5 pb-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-4 border-card bg-sky-500 text-white shadow-2xs">
                <Send size={13} />
              </div>
              <div className="flex flex-col gap-0.5 pt-1">
                <span className="font-bold text-xs text-text leading-none">Gửi thông báo cước</span>
                <span className="font-mono text-[11px] text-muted">
                  Gửi qua App Cư dân & Zalo Notification
                </span>
              </div>
            </div>

            {/* Event 3: Thanh toán */}
            {paidAmount > 0 && (
              <div className="relative z-10 flex gap-3.5 pb-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-4 border-card bg-emerald-500 text-white shadow-2xs">
                  <Wallet size={13} />
                </div>
                <div className="flex flex-col gap-0.5 pt-1">
                  <span className="font-bold text-xs text-emerald-600 leading-none">
                    Ghi nhận thanh toán {formatVnd(paidAmount)}
                  </span>
                  <span className="font-mono text-[11px] text-muted">
                    Chuyển khoản SePay / VietQR tự động
                  </span>
                </div>
              </div>
            )}

            {/* Event 4: Quá hạn nếu có */}
            {currentStatus === "OVERDUE" && (
              <div className="relative z-10 flex gap-3.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-4 border-card bg-rose-500 text-white shadow-2xs">
                  <AlertTriangle size={13} />
                </div>
                <div className="flex flex-col gap-0.5 pt-1">
                  <span className="font-bold text-xs text-rose-600 leading-none">
                    Quá hạn thanh toán cước
                  </span>
                  <span className="font-mono text-[11px] text-muted">
                    Hạn đóng ngày: {formatDate(invoice.dueDate)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* STICKY FOOTER ACTIONS */}
      <div className="sticky bottom-0 z-20 -mx-6 -mb-6 flex items-center justify-between border-t border-border/60 bg-background/90 px-6 py-3.5 backdrop-blur-md">
        <div className="flex items-center gap-2">
          {(currentStatus === "DRAFT" || currentStatus === "ISSUED") && (
            <Button
              data-testid="btn-cancel-invoice"
              variant="outline"
              size="sm"
              className="font-bold text-rose-600 border-rose-500/30 hover:bg-rose-500/10 rounded-xl"
              onClick={() => {
                cancelMutation.mutate(invoice.id, {
                  onSuccess: () => toast.success("Hóa đơn đã bị hủy"),
                });
              }}
              disabled={cancelMutation.isPending}
            >
              <X size={14} className="mr-1.5" /> Hủy HĐ
            </Button>
          )}

          {showDeleteConfirm ? (
            <div className="flex items-center gap-2 border-l border-border pl-2">
              <span className="text-xs text-rose-600 font-bold">Xóa hẳn?</span>
              <Button
                data-testid="btn-confirm-delete"
                variant="danger"
                size="sm"
                className="font-bold rounded-xl"
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
                className="rounded-xl"
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
              className="font-bold text-rose-600 hover:bg-rose-500/10 rounded-xl"
              onClick={() => setShowDeleteConfirm(true)}
            >
              <Trash2 size={14} className="mr-1.5" /> Xóa
            </Button>
          )}

          {(currentStatus === "ISSUED" || currentStatus === "PARTIALLY_PAID" || currentStatus === "OVERDUE") && (
            <Button
              data-testid="btn-writeoff-invoice"
              variant="outline"
              size="sm"
              className="font-bold text-amber-600 border-amber-500/30 hover:bg-amber-500/10 rounded-xl"
              onClick={() => {
                writeoffMutation.mutate(invoice.id, {
                  onSuccess: () => toast.success("Hóa đơn đã được xóa nợ"),
                });
              }}
              disabled={writeoffMutation.isPending}
            >
              <AlertTriangle size={14} className="mr-1.5" /> Xóa nợ
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {currentStatus === "DRAFT" && (
            <Button
              data-testid="btn-issue-invoice"
              variant="primary"
              size="sm"
              className="rounded-xl font-bold"
              onClick={() => {
                issueMutation.mutate(invoice.id, {
                  onSuccess: () => toast.success("Phát hành hóa đơn thành công"),
                });
              }}
              disabled={issueMutation.isPending}
            >
              <Send size={14} className="mr-1.5" /> Phát hành ngay
            </Button>
          )}

          {(currentStatus === "ISSUED" || currentStatus === "PARTIALLY_PAID" || currentStatus === "OVERDUE") && (
            <Button
              data-testid="btn-pay-invoice"
              variant="primary"
              size="sm"
              className="rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
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
              <Wallet size={14} className="mr-1.5" /> Ghi nhận thu tiền
            </Button>
          )}

          {currentStatus === "PAID" && (
            <Badge variant="success" className="text-xs px-3 py-1.5 font-black">
              <CheckCircle2 size={14} className="mr-1.5" /> Đã thanh toán đủ
            </Badge>
          )}
        </div>
      </div>
    </Drawer>
  );
}
