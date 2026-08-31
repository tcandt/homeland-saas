"use client";

import React, { useState } from "react";
import {
  X,
  CheckCircle2,
  RefreshCcw,
  Banknote,
  PenTool,
  Printer,
  Loader2,
  Clock3,
  FileText,
  ShieldMinus,
  QrCode,
  User,
  Home,
  Bookmark,
  ShieldCheck,
  Calendar,
  AlertCircle,
  Link as LinkIcon,
  Info,
  DollarSign,
  AlertTriangle,
} from "lucide-react";
import { UI_Deposit } from "../../lib/adapters/deposit.adapter";
import {
  useCollectDepositMutation,
  useRefundDepositMutation,
  useCompletePendingDepositRefundMutation,
  useConvertContractMutation,
  useCancelDepositMutation,
} from "../../lib/mutations/deposits.mutations";
import { useDepositDetailQuery } from "../../lib/queries/deposits.queries";
import { useToast } from "../ui/ToastContext";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { Badge } from "../ui/Badge";
import DepositQrModal from "./DepositQrModal";

type DepositResolutionAction = "REFUND" | "KEEP" | "DEDUCT";

const currencyFormatter = new Intl.NumberFormat("vi-VN");

function formatDate(value?: string | null) {
  if (!value) return "Chưa có";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Chưa có" : date.toLocaleDateString("vi-VN");
}

function formatDateTime(value?: string | null) {
  if (!value) return "Chưa có";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Chưa có" : date.toLocaleString("vi-VN");
}

function formatCurrency(value?: number | null) {
  return `${currencyFormatter.format(Number(value || 0))}đ`;
}

function parseAttachmentUrls(input: string) {
  return input
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function OperationsDepositDrawer({
  deposit,
  onClose,
}: {
  deposit: UI_Deposit | null;
  onClose: () => void;
}) {
  const { showToast } = useToast();
  const detailQuery = useDepositDetailQuery(deposit?.id ?? null);
  const detailDeposit = detailQuery.data?.data || deposit;

  const collectMutation = useCollectDepositMutation();
  const refundMutation = useRefundDepositMutation();
  const completePendingRefundMutation = useCompletePendingDepositRefundMutation();
  const convertMutation = useConvertContractMutation();
  const cancelMutation = useCancelDepositMutation();

  // Sub-modal states
  const [showQrModal, setShowQrModal] = useState(false);
  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isConvertModalOpen, setIsConvertModalOpen] = useState(false);
  const [isCompletePendingModalOpen, setIsCompletePendingModalOpen] = useState(false);

  // Form states for Refund Modal
  const [refundReason, setRefundReason] = useState("");
  const [refundAmountInput, setRefundAmountInput] = useState("");
  const [refundReceiptStatus, setRefundReceiptStatus] = useState<"COMPLETED" | "PENDING">("COMPLETED");
  const [refundAttachmentInput, setRefundAttachmentInput] = useState("");

  // Form states for Cancel Modal
  const [cancelReason, setCancelReason] = useState("");
  const [cancelResolutionAction, setCancelResolutionAction] = useState<DepositResolutionAction>("KEEP");
  const [cancelResolutionAmount, setCancelResolutionAmount] = useState("");
  const [cancelReceiptStatus, setCancelReceiptStatus] = useState<"COMPLETED" | "PENDING">("COMPLETED");

  // Form state for Complete Pending Refund Modal
  const [completePendingNote, setCompletePendingNote] = useState("");

  if (!detailDeposit) return null;

  const amount = Number(detailDeposit.amount || 0);
  const amountStr = formatCurrency(amount);
  const isPaid = detailDeposit.status === "PAID";
  const isConverted = detailDeposit.status === "CONVERTED_TO_CONTRACT";
  const isRefunded = detailDeposit.status === "REFUNDED";
  const isCancelled = detailDeposit.status === "CANCELLED";
  const isDraft = detailDeposit.status === "DRAFT" || detailDeposit.status === "PENDING";
  const refundSummary = detailDeposit.refundSummary;
  const refundPending = !!refundSummary?.pending;

  // Check if this deposit belongs to a contract
  const isContractDeposit =
    detailDeposit.type === "SECURITY" ||
    !!detailDeposit.contractId ||
    !!detailDeposit.contractCode ||
    isConverted;

  // Only allow standalone refund for room booking/holding deposits
  const canRefundDirectly = !isContractDeposit && isPaid;

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "DRAFT":
      case "PENDING":
        return { label: "Chờ thu", variant: "neutral" as const, bg: "bg-sky-500/10 text-sky-600 border-sky-500/20" };
      case "PAID":
        return { label: "Đã thu cọc", variant: "success" as const, bg: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" };
      case "CONVERTED_TO_CONTRACT":
        return { label: "Đã chuyển HĐ", variant: "primary" as const, bg: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20" };
      case "REFUNDED":
        return { label: "Đã hoàn cọc", variant: "warning" as const, bg: "bg-amber-500/10 text-amber-600 border-amber-500/20" };
      case "CANCELLED":
        return { label: "Đã hủy", variant: "error" as const, bg: "bg-rose-500/10 text-rose-600 border-rose-500/20" };
      default:
        return { label: status, variant: "neutral" as const, bg: "bg-slate-500/10 text-slate-600 border-slate-500/20" };
    }
  };

  const getTypeConfig = (type: string) => {
    switch (type) {
      case "SECURITY":
        return { label: "Cọc bảo đảm HĐ", icon: ShieldCheck, color: "text-indigo-600 bg-indigo-500/10 border-indigo-500/20" };
      case "BOOKING":
        return { label: "Cọc giữ phòng", icon: Bookmark, color: "text-amber-600 bg-amber-500/10 border-amber-500/20" };
      case "RESERVATION":
        return { label: "Phí giữ chỗ", icon: Bookmark, color: "text-sky-600 bg-sky-500/10 border-sky-500/20" };
      default:
        return { label: type, icon: Bookmark, color: "text-slate-600 bg-slate-500/10 border-slate-500/20" };
    }
  };

  const statusConfig = getStatusConfig(detailDeposit.status);
  const typeConfig = getTypeConfig(detailDeposit.type);

  // --- Handlers ---
  const handleCollect = () => {
    collectMutation.mutate(
      { id: detailDeposit.id },
      {
        onSuccess: () => {
          showToast("Đã xác nhận thu tiền cọc thành công!", "success");
        },
        onError: (err: any) => {
          showToast(err?.response?.data?.message || "Lỗi khi thu tiền cọc", "error");
        },
      },
    );
  };

  const openRefundModal = () => {
    setRefundReason("");
    setRefundAmountInput(String(amount));
    setRefundReceiptStatus("COMPLETED");
    setRefundAttachmentInput("");
    setIsRefundModalOpen(true);
  };

  const submitRefund = () => {
    if (!refundReason.trim()) {
      showToast("Vui lòng nhập lý do hoàn cọc", "error");
      return;
    }
    const parsedAmount = Number(refundAmountInput.trim());
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0 || parsedAmount > amount) {
      showToast(`Số tiền hoàn không hợp lệ (Tối đa ${amountStr})`, "error");
      return;
    }

    const attachmentUrls = parseAttachmentUrls(refundAttachmentInput);

    refundMutation.mutate(
      {
        id: detailDeposit.id,
        reason: refundReason.trim(),
        receiptStatus: refundReceiptStatus,
        attachmentUrls,
        refundAmount: parsedAmount,
      },
      {
        onSuccess: () => {
          showToast("Đã tạo lệnh hoàn cọc thành công!", "success");
          setIsRefundModalOpen(false);
        },
        onError: (err: any) => {
          showToast(err?.response?.data?.message || "Lỗi khi hoàn cọc", "error");
        },
      },
    );
  };

  const openCancelModal = () => {
    setCancelReason("");
    setCancelResolutionAction("KEEP");
    setCancelResolutionAmount(String(amount));
    setCancelReceiptStatus("COMPLETED");
    setIsCancelModalOpen(true);
  };

  const submitCancel = () => {
    if (!cancelReason.trim()) {
      showToast("Vui lòng nhập lý do hủy phiếu cọc", "error");
      return;
    }

    if (!isPaid) {
      cancelMutation.mutate(
        { id: detailDeposit.id, reason: cancelReason.trim() },
        {
          onSuccess: () => {
            showToast("Đã hủy phiếu cọc thành công!", "success");
            setIsCancelModalOpen(false);
          },
          onError: (err: any) => {
            showToast(err?.response?.data?.message || "Lỗi khi hủy phiếu cọc", "error");
          },
        },
      );
      return;
    }

    const parsedAmount = Number(cancelResolutionAmount.trim());
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0 || parsedAmount > amount) {
      showToast(`Số tiền xử lý không hợp lệ (Tối đa ${amountStr})`, "error");
      return;
    }

    const refundableAmount =
      cancelResolutionAction === "REFUND" ? parsedAmount : Math.max(amount - parsedAmount, 0);

    cancelMutation.mutate(
      {
        id: detailDeposit.id,
        reason: cancelReason.trim(),
        resolutionAction: cancelResolutionAction,
        resolutionAmount: parsedAmount,
        receiptStatus: refundableAmount > 0 ? cancelReceiptStatus : undefined,
      },
      {
        onSuccess: () => {
          showToast("Đã hủy và xử lý cọc thành công!", "success");
          setIsCancelModalOpen(false);
        },
        onError: (err: any) => {
          showToast(err?.response?.data?.message || "Lỗi khi xử lý cọc", "error");
        },
      },
    );
  };

  const openConvertModal = () => {
    setIsConvertModalOpen(true);
  };

  const submitConvert = () => {
    convertMutation.mutate(detailDeposit.id, {
      onSuccess: () => {
        showToast("Đã chuyển phiếu cọc thành hợp đồng thành công!", "success");
        setIsConvertModalOpen(false);
        onClose();
      },
      onError: (err: any) => {
        showToast(err?.response?.data?.message || "Lỗi khi chuyển hợp đồng", "error");
      },
    });
  };

  const openCompletePendingModal = () => {
    setCompletePendingNote("");
    setIsCompletePendingModalOpen(true);
  };

  const submitCompletePendingRefund = () => {
    completePendingRefundMutation.mutate(
      { id: detailDeposit.id, note: completePendingNote.trim() || undefined },
      {
        onSuccess: () => {
          showToast("Đã xác nhận hoàn tất phiếu chi hoàn cọc!", "success");
          setIsCompletePendingModalOpen(false);
        },
        onError: (err: any) => {
          showToast(err?.response?.data?.message || "Lỗi khi xác nhận hoàn cọc", "error");
        },
      },
    );
  };

  return (
    <>
      <Modal
        testId="deposit-detail-modal"
        isOpen={!!detailDeposit}
        onClose={onClose}
        maxWidth="max-w-4xl"
        title={
          <div className="flex items-center gap-3">
            <span className="text-[18px] font-black text-text">Chi tiết phiếu cọc</span>
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 bg-primary/10 border border-primary/20 rounded-lg">
              <span className="font-mono font-bold text-[11px] text-primary">{detailDeposit.code || detailDeposit.id}</span>
            </div>
          </div>
        }
        footer={
          <div className="flex w-full items-center justify-between flex-wrap gap-2.5">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                onClick={() => setShowQrModal(true)}
                variant="outline"
                size="sm"
                className="h-9 rounded-xl border-sky-500/30 text-sky-600 hover:bg-sky-500/10 font-bold text-xs shadow-2xs"
              >
                <QrCode size={14} className="mr-1.5" /> Mã VietQR / Gửi Zalo
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-9 rounded-xl text-muted hover:text-text font-bold text-xs"
              >
                <Printer size={14} className="mr-1.5" /> In phiếu
              </Button>
            </div>

            <div className="flex items-center gap-2">
              {/* Nút Hủy cọc (Chỉ cho cọc chưa lên HĐ) */}
              {isDraft && (
                <Button
                  data-testid="deposit-action-cancel"
                  onClick={openCancelModal}
                  disabled={cancelMutation.isPending}
                  variant="ghost"
                  size="sm"
                  className="h-9 rounded-xl text-rose-500 hover:bg-rose-500/10 hover:text-rose-600 font-bold text-xs"
                >
                  <X size={14} className="mr-1.5" /> Hủy phiếu
                </Button>
              )}

              {isPaid && !isContractDeposit && (
                <Button
                  data-testid="deposit-action-cancel-paid"
                  onClick={openCancelModal}
                  disabled={cancelMutation.isPending}
                  variant="ghost"
                  size="sm"
                  className="h-9 rounded-xl text-rose-500 hover:bg-rose-500/10 hover:text-rose-600 font-bold text-xs"
                >
                  <ShieldMinus size={14} className="mr-1.5" /> Hủy & xử lý cọc
                </Button>
              )}

              {/* Nút Hoàn cọc (Chỉ bấm được cho cọc giữ phòng trước, không hoàn trực tiếp cọc HĐ) */}
              {canRefundDirectly && (
                <Button
                  data-testid="deposit-action-refund"
                  onClick={openRefundModal}
                  disabled={refundMutation.isPending}
                  variant="outline"
                  size="sm"
                  className="h-9 rounded-xl border-amber-500/30 text-amber-600 hover:bg-amber-500/10 font-bold text-xs"
                >
                  <RefreshCcw size={14} className="mr-1.5" /> Hoàn cọc giữ phòng
                </Button>
              )}

              {/* Nút Xác nhận đã hoàn tiền (khi có phiếu chi chờ duyệt) */}
              {refundPending && (
                <Button
                  data-testid="deposit-action-complete-refund"
                  onClick={openCompletePendingModal}
                  disabled={completePendingRefundMutation.isPending}
                  size="sm"
                  className="h-9 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-sm"
                >
                  <CheckCircle2 size={14} className="mr-1.5" /> Xác nhận đã hoàn tiền
                </Button>
              )}

              {/* Nút Thu tiền cọc */}
              {isDraft && (
                <Button
                  data-testid="deposit-action-collect"
                  onClick={handleCollect}
                  disabled={collectMutation.isPending}
                  size="sm"
                  className="h-9 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm"
                >
                  {collectMutation.isPending ? (
                    <Loader2 size={14} className="mr-1.5 animate-spin" />
                  ) : (
                    <Banknote size={14} className="mr-1.5" />
                  )}
                  Thu tiền cọc
                </Button>
              )}

              {/* Nút Lên hợp đồng (cho cọc giữ chỗ đã thu tiền) */}
              {isPaid && !isContractDeposit && (
                <Button
                  data-testid="deposit-action-convert"
                  onClick={openConvertModal}
                  disabled={convertMutation.isPending}
                  variant="primary"
                  size="sm"
                  className="h-9 rounded-xl font-bold text-xs shadow-sm"
                >
                  <PenTool size={14} className="mr-1.5" /> Lên hợp đồng
                </Button>
              )}
            </div>
          </div>
        }
      >
        <div className="flex flex-col gap-5">
          {/* HERO CARD */}
          <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-card via-card to-primary/5 p-5 md:p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 text-primary font-black text-xl shadow-xs">
                  {detailDeposit.customerName ? detailDeposit.customerName.slice(0, 2).toUpperCase() : "DC"}
                </div>
                <div>
                  <h3 className="text-lg md:text-xl font-black text-text leading-tight">
                    {detailDeposit.customerName || "Khách đặt cọc"}
                  </h3>
                  <div className="flex flex-wrap items-center gap-2 mt-1.5">
                    <span className="flex items-center gap-1 text-xs font-semibold text-muted bg-card px-2.5 py-0.5 rounded-lg border border-border/60">
                      <Home size={12} className="text-primary" />
                      {detailDeposit.roomCode || "Chưa xếp phòng"} · {detailDeposit.buildingName || "Chưa có tòa"}
                    </span>
                    <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md border ${typeConfig.color}`}>
                      <typeConfig.icon size={11} />
                      {typeConfig.label}
                    </span>
                    <span className={`text-[11px] font-black px-2 py-0.5 rounded-md border uppercase ${statusConfig.bg}`}>
                      {statusConfig.label}
                    </span>
                  </div>
                </div>
              </div>

              <div className="sm:text-right text-left flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-border/40">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted block">
                  Cập nhật gần nhất
                </span>
                <div className="flex items-center gap-1.5 text-xs font-bold text-text mt-0.5">
                  <Clock3 size={13} className="text-primary" />
                  {formatDateTime(detailDeposit.updatedAt || detailDeposit.createdAt)}
                </div>
              </div>
            </div>

            {/* Quick KPI Stat Boxes */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 border-t border-border/60 pt-4 mt-4">
              <div className="bg-card/80 border border-border/60 rounded-xl p-3 shadow-2xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted block">
                  Số tiền cọc
                </span>
                <span className="text-base font-black text-text mt-0.5 block">
                  {amountStr}
                </span>
              </div>
              <div className="bg-card/80 border border-border/60 rounded-xl p-3 shadow-2xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted block">
                  Đã thu
                </span>
                <span className={`text-base font-black mt-0.5 block ${isPaid || isConverted ? "text-emerald-600 dark:text-emerald-400" : "text-muted"}`}>
                  {isPaid || isConverted ? amountStr : "0đ"}
                </span>
              </div>
              <div className="bg-card/80 border border-border/60 rounded-xl p-3 shadow-2xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted block">
                  Ngày tạo
                </span>
                <span className="text-xs font-bold text-text mt-0.5 block">
                  {formatDate(detailDeposit.createdAt)}
                </span>
              </div>
              <div className="bg-card/80 border border-border/60 rounded-xl p-3 shadow-2xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted block">
                  Hạn giữ cọc
                </span>
                <span className="text-xs font-bold text-text mt-0.5 block">
                  {formatDate(detailDeposit.expiredAt)}
                </span>
              </div>
            </div>
          </div>

          {/* 2-COLUMN MAIN CONTENT */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left Card: Chi tiết & Ghi chú */}
            <div className="rounded-2xl border border-border/70 bg-card p-4 md:p-5 flex flex-col gap-3.5 shadow-2xs">
              <h4 className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-muted border-b border-border/50 pb-2.5">
                <FileText size={14} className="text-primary" /> Thông tin phiếu cọc
              </h4>

              {/* Thông báo nghiệp vụ cọc bảo đảm hợp đồng */}
              {isContractDeposit && (
                <div className="flex items-start gap-2.5 rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-3 text-xs leading-relaxed text-indigo-700 dark:text-indigo-300">
                  <Info size={16} className="shrink-0 text-indigo-600 mt-0.5" />
                  <div>
                    <span className="font-bold block mb-0.5">
                      Cọc bảo đảm hợp đồng {detailDeposit.contractCode ? `(${detailDeposit.contractCode})` : ""}
                    </span>
                    Khoản tiền cọc này gắn liền với Hợp đồng thuê. Khi thanh lý hợp đồng, hệ thống sẽ tự động tính toán, khấu trừ điện nước/hư hại và hoàn cọc chính xác tại mục <b>Hợp đồng</b>.
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-muted/5 border border-border/40 text-xs">
                <span className="font-bold text-muted flex items-center gap-1.5">
                  <User size={13} /> Khách hàng
                </span>
                <span className="font-bold text-text font-mono">
                  {detailDeposit.customerPhone || "Chưa có SĐT"}
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-muted/5 border border-border/40 text-xs">
                <span className="font-bold text-muted flex items-center gap-1.5">
                  <Home size={13} /> Phòng gán cọc
                </span>
                <span className="font-bold text-text">
                  {detailDeposit.roomCode || "Chưa gán phòng"}
                </span>
              </div>

              {(detailDeposit.contractCode || detailDeposit.contractId) && (
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-indigo-500/5 border border-indigo-500/20 text-xs">
                  <span className="font-bold text-indigo-600 flex items-center gap-1.5">
                    <LinkIcon size={13} /> Hợp đồng liên kết
                  </span>
                  <span className="font-bold text-indigo-600 font-mono">
                    {detailDeposit.contractCode || detailDeposit.contractId}
                  </span>
                </div>
              )}

              <div className="p-3 rounded-xl bg-muted/5 border border-border/40">
                <span className="text-[11px] font-bold text-muted block mb-1">Ghi chú</span>
                <div className="text-xs font-semibold text-text whitespace-pre-wrap leading-relaxed">
                  {detailDeposit.note || "Không có ghi chú"}
                </div>
              </div>

              {refundSummary && (
                <div className="flex flex-col gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5">
                  <span className="text-xs font-black text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                    <AlertCircle size={14} /> Theo dõi phiếu hoàn cọc
                  </span>
                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="text-muted">Mã phiếu chi:</span>
                    <span className="font-bold font-mono text-text">{refundSummary.receiptCode || "Chưa có"}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted">Trạng thái:</span>
                    <span className="font-bold text-text">{refundSummary.taskStatus || refundSummary.receiptStatus || "-"}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted">Số tiền hoàn:</span>
                    <span className="font-black text-amber-700 dark:text-amber-400">{formatCurrency(refundSummary.receiptAmount)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Right Card: Lifecycle Timeline */}
            <div className="rounded-2xl border border-border/70 bg-card p-4 md:p-5 flex flex-col gap-3.5 shadow-2xs">
              <h4 className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-muted border-b border-border/50 pb-2.5">
                <RefreshCcw size={14} className="text-primary" /> Mốc xử lý phiếu cọc
              </h4>

              <div className="relative mt-2 flex flex-col gap-0 pl-1">
                {/* Vertical connecting line */}
                <div className="absolute bottom-5 left-[19px] top-3 w-[2px] bg-border/80" />

                {/* Step 1: Tạo cọc */}
                <div className="relative z-10 flex gap-3.5 pb-6">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-card bg-emerald-600 text-white shadow-xs">
                    <CheckCircle2 size={14} />
                  </div>
                  <div className="flex flex-col pt-0.5">
                    <span className="text-xs font-black text-text leading-tight">
                      Tạo phiếu cọc
                    </span>
                    <span className="text-[11px] text-muted mt-0.5">
                      {formatDateTime(detailDeposit.createdAt)}
                    </span>
                  </div>
                </div>

                {/* Step 2: Thu tiền */}
                <div className="relative z-10 flex gap-3.5 pb-6">
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-card shadow-xs ${
                      isPaid || isConverted
                        ? "bg-emerald-600 text-white"
                        : "bg-muted/20 border-border text-muted"
                    }`}
                  >
                    {isPaid || isConverted ? (
                      <CheckCircle2 size={14} />
                    ) : (
                      <div className="h-2 w-2 rounded-full bg-muted/40" />
                    )}
                  </div>
                  <div className="flex flex-col pt-0.5">
                    <span
                      className={`text-xs font-black leading-tight ${
                        isPaid || isConverted ? "text-text" : "text-muted"
                      }`}
                    >
                      Đã thu tiền / Xác nhận cọc
                    </span>
                    <span className="text-[11px] text-muted mt-0.5">
                      {isPaid || isConverted
                        ? `${amountStr} · ${formatDateTime(detailDeposit.updatedAt)}`
                        : "Chưa thu tiền"}
                    </span>
                  </div>
                </div>

                {/* Step 3: Lên hợp đồng */}
                <div className="relative z-10 flex gap-3.5 pb-6">
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-card shadow-xs ${
                      isConverted
                        ? "bg-indigo-600 text-white"
                        : "bg-muted/20 border-border text-muted"
                    }`}
                  >
                    {isConverted ? (
                      <CheckCircle2 size={14} />
                    ) : (
                      <div className="h-2 w-2 rounded-full bg-muted/40" />
                    )}
                  </div>
                  <div className="flex flex-col pt-0.5">
                    <span
                      className={`text-xs font-black leading-tight ${
                        isConverted ? "text-indigo-600 dark:text-indigo-400" : "text-muted"
                      }`}
                    >
                      Chuyển thành hợp đồng
                    </span>
                    <span className="text-[11px] text-muted mt-0.5">
                      {isConverted ? "Đã liên kết với hợp đồng thuê" : "Chưa chuyển thành HĐ"}
                    </span>
                  </div>
                </div>

                {/* Step 4: Hoàn cọc / Hủy */}
                <div className="relative z-10 flex gap-3.5">
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-card shadow-xs ${
                      isRefunded
                        ? "bg-amber-500 text-white"
                        : isCancelled
                          ? "bg-rose-500 text-white"
                          : "bg-muted/20 border-border text-muted"
                    }`}
                  >
                    {isRefunded || isCancelled ? (
                      <RefreshCcw size={14} />
                    ) : (
                      <div className="h-2 w-2 rounded-full bg-muted/40" />
                    )}
                  </div>
                  <div className="flex flex-col pt-0.5">
                    <span
                      className={`text-xs font-black leading-tight ${
                        isRefunded
                          ? "text-amber-600 dark:text-amber-400"
                          : isCancelled
                            ? "text-rose-500"
                            : "text-muted"
                      }`}
                    >
                      {isRefunded ? "Đã hoàn cọc" : isCancelled ? "Đã hủy phiếu cọc" : "Hoàn tiền / Hủy phiếu"}
                    </span>
                    <span className="text-[11px] text-muted mt-0.5">
                      {isRefunded || isCancelled
                        ? formatDateTime(detailDeposit.updatedAt)
                        : "Chưa hoàn / Chưa hủy"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Modal>

      {/* --- SUB-MODAL 1: XÁC NHẬN HOÀN CỌC GIỮ PHÒNG --- */}
      <Modal
        isOpen={isRefundModalOpen}
        onClose={() => {
          if (refundMutation.isPending) return;
          setIsRefundModalOpen(false);
        }}
        maxWidth="max-w-md"
        title="Hoàn tiền cọc giữ phòng"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsRefundModalOpen(false)}
              disabled={refundMutation.isPending}
            >
              Hủy bỏ
            </Button>
            <Button
              size="sm"
              className="bg-amber-500 hover:bg-amber-600 text-white font-bold"
              onClick={submitRefund}
              isLoading={refundMutation.isPending}
            >
              Xác nhận hoàn cọc
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs">
            <span className="text-muted font-bold">Số tiền cọc gốc:</span>
            <span className="font-black text-amber-700 dark:text-amber-400 text-sm">{amountStr}</span>
          </div>

          <div>
            <label className="text-xs font-bold text-text block mb-1">
              Số tiền hoàn lại cho khách (VNĐ) <span className="text-rose-500">*</span>
            </label>
            <Input
              type="number"
              min="1000"
              max={amount}
              value={refundAmountInput}
              onChange={(e) => setRefundAmountInput(e.target.value)}
              placeholder="Nhập số tiền hoàn lại..."
            />
          </div>

          <div>
            <label className="text-xs font-bold text-text block mb-1">
              Lý do hoàn cọc <span className="text-rose-500">*</span>
            </label>
            <textarea
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
              placeholder="Ví dụ: Khách đổi kế hoạch không thuê nữa / hoàn lại theo thỏa thuận..."
              className="w-full min-h-[75px] rounded-xl border border-border bg-card p-3 text-xs text-text outline-none focus:border-primary transition-colors"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-text block mb-1">
              Hình thức chi tiền
            </label>
            <Select
              value={refundReceiptStatus}
              onChange={(e) => setRefundReceiptStatus(e.target.value as any)}
              options={[
                { label: "Đã chi tiền ngay cho khách (Phiếu chi Hoàn tất)", value: "COMPLETED" },
                { label: "Tạo phiếu chi chờ thủ quỹ duyệt chuyển tiền (Phiếu chi Chờ xử lý)", value: "PENDING" },
              ]}
            />
          </div>

          <div>
            <label className="text-xs font-bold text-text block mb-1">
              Chứng từ / Link biên nhận (nếu có)
            </label>
            <Input
              value={refundAttachmentInput}
              onChange={(e) => setRefundAttachmentInput(e.target.value)}
              placeholder="Nhập link ảnh giao dịch / biên lai chuyển khoản..."
            />
          </div>
        </div>
      </Modal>

      {/* --- SUB-MODAL 2: HỦY PHIẾU CỌC --- */}
      <Modal
        isOpen={isCancelModalOpen}
        onClose={() => {
          if (cancelMutation.isPending) return;
          setIsCancelModalOpen(false);
        }}
        maxWidth="max-w-md"
        title="Hủy phiếu đặt cọc"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsCancelModalOpen(false)}
              disabled={cancelMutation.isPending}
            >
              Đóng
            </Button>
            <Button
              size="sm"
              className="bg-rose-500 hover:bg-rose-600 text-white font-bold"
              onClick={submitCancel}
              isLoading={cancelMutation.isPending}
            >
              Xác nhận hủy phiếu
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-700 dark:text-rose-300 leading-relaxed">
            <AlertTriangle size={15} className="shrink-0 mt-0.5 text-rose-500" />
            <div>
              Hành động hủy phiếu đặt cọc <b>{detailDeposit.code}</b> không thể hoàn tác.
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-text block mb-1">
              Lý do hủy phiếu <span className="text-rose-500">*</span>
            </label>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Nhập lý do hủy phiếu đặt cọc..."
              className="w-full min-h-[75px] rounded-xl border border-border bg-card p-3 text-xs text-text outline-none focus:border-primary transition-colors"
            />
          </div>

          {isPaid && (
            <>
              <div>
                <label className="text-xs font-bold text-text block mb-1">
                  Cách xử lý tiền cọc đã thu ({amountStr})
                </label>
                <Select
                  value={cancelResolutionAction}
                  onChange={(e) => setCancelResolutionAction(e.target.value as any)}
                  options={[
                    { label: "Giữ lại toàn bộ cọc (Phạt cọc không hoàn lại)", value: "KEEP" },
                    { label: "Hoàn lại một phần hoặc toàn bộ tiền cho khách", value: "REFUND" },
                    { label: "Khấu trừ chi phí giữ phòng", value: "DEDUCT" },
                  ]}
                />
              </div>

              <div>
                <label className="text-xs font-bold text-text block mb-1">
                  Số tiền {cancelResolutionAction === "REFUND" ? "hoàn lại" : cancelResolutionAction === "KEEP" ? "giữ lại" : "khấu trừ"} (VNĐ)
                </label>
                <Input
                  type="number"
                  min="1000"
                  max={amount}
                  value={cancelResolutionAmount}
                  onChange={(e) => setCancelResolutionAmount(e.target.value)}
                  placeholder="Nhập số tiền..."
                />
              </div>

              {cancelResolutionAction === "REFUND" && (
                <div>
                  <label className="text-xs font-bold text-text block mb-1">
                    Hình thức chi tiền hoàn
                  </label>
                  <Select
                    value={cancelReceiptStatus}
                    onChange={(e) => setCancelReceiptStatus(e.target.value as any)}
                    options={[
                      { label: "Đã chi tiền ngay cho khách (Hoàn tất)", value: "COMPLETED" },
                      { label: "Tạo phiếu chi chờ duyệt (Chờ xử lý)", value: "PENDING" },
                    ]}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </Modal>

      {/* --- SUB-MODAL 3: CHUYỂN HỢP ĐỒNG --- */}
      <Modal
        isOpen={isConvertModalOpen}
        onClose={() => {
          if (convertMutation.isPending) return;
          setIsConvertModalOpen(false);
        }}
        maxWidth="max-w-md"
        title="Lên hợp đồng từ phiếu cọc"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsConvertModalOpen(false)}
              disabled={convertMutation.isPending}
            >
              Hủy bỏ
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={submitConvert}
              isLoading={convertMutation.isPending}
            >
              Xác nhận lên hợp đồng
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-3 text-xs leading-relaxed">
          <p className="text-text">
            Bạn đang chuyển phiếu cọc <b>{detailDeposit.code}</b> của khách hàng <b>{detailDeposit.customerName}</b> ({amountStr}) sang trạng thái <b>Đã lên hợp đồng</b>.
          </p>
          <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-700 dark:text-indigo-300">
            Số tiền cọc này sẽ được chuyển thành cọc bảo đảm của hợp đồng thuê phòng tương ứng.
          </div>
        </div>
      </Modal>

      {/* --- SUB-MODAL 4: XÁC NHẬN HOÀN TẤT CHI TIỀN HOÀN CỌC --- */}
      <Modal
        isOpen={isCompletePendingModalOpen}
        onClose={() => {
          if (completePendingRefundMutation.isPending) return;
          setIsCompletePendingModalOpen(false);
        }}
        maxWidth="max-w-md"
        title="Xác nhận đã chi tiền hoàn cọc"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsCompletePendingModalOpen(false)}
              disabled={completePendingRefundMutation.isPending}
            >
              Hủy bỏ
            </Button>
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
              onClick={submitCompletePendingRefund}
              isLoading={completePendingRefundMutation.isPending}
            >
              Xác nhận đã chi tiền
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-3">
          <p className="text-xs text-text leading-relaxed">
            Xác nhận rằng phiếu chi hoàn cọc cho khách hàng đã được hoàn tất thanh toán.
          </p>
          <div>
            <label className="text-xs font-bold text-text block mb-1">
              Ghi chú / Mã giao dịch ngân hàng
            </label>
            <Input
              value={completePendingNote}
              onChange={(e) => setCompletePendingNote(e.target.value)}
              placeholder="Ví dụ: Đã CK Vietcombank FT123456789..."
            />
          </div>
        </div>
      </Modal>

      <DepositQrModal
        isOpen={showQrModal}
        onClose={() => setShowQrModal(false)}
        deposit={detailDeposit}
      />
    </>
  );
}
