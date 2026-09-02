"use client";

import React, { useState } from "react";
import {
  X,
  CheckCircle2,
  Check,
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
  Receipt,
  Phone,
  CircleDashed,
  ChevronDown,
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
import { getTenantAvatar } from "../tenants/TenantDetailDrawer";

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
    Boolean(detailDeposit.contractId || detailDeposit.contractCode || isConverted);

  // Only allow standalone refund for room booking/holding deposits
  const isBookingDeposit = detailDeposit.type === "BOOKING" || detailDeposit.type === "RESERVATION";
  const avatarUrl = getTenantAvatar(
    (detailDeposit as any).customerAvatar || (detailDeposit as any).avatar,
    detailDeposit.customerName,
    (detailDeposit as any).gender
  );
  const canRefundDirectly = !isContractDeposit && isPaid;
  const wasEverCollected =
    isPaid ||
    Boolean((detailDeposit as any).paidAt) ||
    isRefunded ||
    (isBookingDeposit && isConverted);
  const canShowVietQr = !isPaid && !isRefunded && !isCancelled;

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "DRAFT":
      case "PENDING":
        return {
          label: isContractDeposit ? "Chờ thu cọc hợp đồng" : "Chờ thu cọc giữ phòng",
          variant: "neutral" as const,
          bg: isContractDeposit ? "bg-purple-500/10 text-purple-600 border-purple-500/20" : "bg-sky-500/10 text-sky-600 border-sky-500/20",
        };
      case "PAID":
        return {
          label: isContractDeposit ? "Đã thu cọc hợp đồng" : "Đã thu cọc giữ phòng",
          variant: "success" as const,
          bg: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
        };
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
        testId="deposit-detail-drawer"
        closeButtonTestId="deposit-detail-close"
        isOpen={!!detailDeposit}
        onClose={onClose}
        maxWidth="max-w-4xl"
        title={
          <div className="flex items-center gap-3 min-w-0 pr-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={avatarUrl}
              alt={detailDeposit.customerName}
              className="h-11 w-11 rounded-2xl object-cover border-2 border-primary/20 shadow-xs shrink-0"
            />
            <div className="min-w-0 flex flex-col">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-base sm:text-lg font-black text-text truncate">
                  {detailDeposit.customerName || "Khách đặt cọc"}
                </span>
                <span className="font-mono font-bold text-xs text-primary px-2.5 py-0.5 rounded-lg bg-primary/10 border border-primary/20 shrink-0">
                  {detailDeposit.code || detailDeposit.id}
                </span>
                <span data-testid="deposit-status-badge" className={`text-[10px] font-black px-2 py-0.5 rounded-md border uppercase tracking-wide ${statusConfig.bg}`}>
                  {statusConfig.label}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted font-medium mt-0.5 flex-wrap">
                <span className="inline-flex items-center gap-1 font-bold text-text">
                  <Home size={12} className="text-primary" />
                  {detailDeposit.roomCode || "Chưa xếp phòng"} · {detailDeposit.buildingName || "Tòa nhà"}
                </span>
                <span>•</span>
                <span className={`inline-flex items-center gap-1 text-[11px] font-bold ${typeConfig.color}`}>
                  <typeConfig.icon size={11} />
                  {typeConfig.label}
                </span>
                {detailDeposit.customerPhone && (
                  <>
                    <span>•</span>
                    <span className="font-mono text-muted text-[11px] flex items-center gap-1">
                      <Phone size={10} />
                      {detailDeposit.customerPhone}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        }
        footer={
          <div className="flex w-full items-center justify-between flex-wrap gap-2.5">
            <div className="flex items-center gap-2">
              {canShowVietQr && (
                <Button
                  type="button"
                  onClick={() => setShowQrModal(true)}
                  variant="outline"
                  size="sm"
                  className="h-9 rounded-xl border-sky-500/30 text-sky-600 hover:bg-sky-500/10 font-bold text-xs shadow-2xs cursor-pointer"
                >
                  <QrCode size={14} className="mr-1.5" /> Mã VietQR / Gửi Zalo
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.print()}
                className="h-9 rounded-xl text-muted hover:text-text font-bold text-xs cursor-pointer"
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
                  className="h-9 rounded-xl text-rose-500 hover:bg-rose-500/10 hover:text-rose-600 font-bold text-xs cursor-pointer"
                >
                  <X size={14} className="mr-1.5" /> Hủy phiếu
                </Button>
              )}

              {isPaid && !isContractDeposit && (
                <Button
                  data-testid="deposit-action-cancel"
                  onClick={openCancelModal}
                  disabled={cancelMutation.isPending}
                  variant="ghost"
                  size="sm"
                  className="h-9 rounded-xl text-rose-500 hover:bg-rose-500/10 hover:text-rose-600 font-bold text-xs cursor-pointer"
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
                  className="h-9 rounded-xl border-amber-500/30 text-amber-600 hover:bg-amber-500/10 font-bold text-xs cursor-pointer"
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
                  className="h-9 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-sm cursor-pointer"
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
                  className="h-9 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm cursor-pointer"
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
                  className="h-9 rounded-xl font-bold text-xs shadow-sm cursor-pointer"
                >
                  <PenTool size={14} className="mr-1.5" /> Lên hợp đồng
                </Button>
              )}
            </div>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          {/* 4 KPI STAT BOXES (CLEAN, NO DUPLICATE GIANT HERO CARD) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="bg-surface/50 border border-border/70 rounded-2xl p-3 shadow-2xs">
              <span className="text-[10px] font-black uppercase tracking-wider text-muted block">
                Số tiền cọc
              </span>
              <span className="text-sm sm:text-base font-black text-text mt-0.5 block font-mono">
                {amountStr}
              </span>
            </div>
            <div className="bg-surface/50 border border-border/70 rounded-2xl p-3 shadow-2xs">
              <span className="text-[10px] font-black uppercase tracking-wider text-muted block">
                Đã thu
              </span>
              <span className={`text-sm sm:text-base font-black mt-0.5 block font-mono ${wasEverCollected ? "text-emerald-600 dark:text-emerald-400" : "text-muted"}`}>
                {wasEverCollected ? amountStr : "0đ"}
              </span>
            </div>
            <div className="bg-surface/50 border border-border/70 rounded-2xl p-3 shadow-2xs">
              <span className="text-[10px] font-black uppercase tracking-wider text-muted block">
                Ngày tạo
              </span>
              <span className="text-xs font-bold text-text mt-0.5 block font-mono">
                {formatDate(detailDeposit.createdAt)}
              </span>
            </div>
            <div className="bg-surface/50 border border-border/70 rounded-2xl p-3 shadow-2xs">
              <span className="text-[10px] font-black uppercase tracking-wider text-muted block">
                Hạn giữ cọc
              </span>
              <span className="text-xs font-bold text-text mt-0.5 block font-mono">
                {isContractDeposit ? "Theo hợp đồng" : formatDate(detailDeposit.expiredAt)}
              </span>
            </div>
          </div>

          {/* 2-COLUMN MAIN CONTENT */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left Card: Thông tin phiếu cọc */}
            <div className="rounded-2xl border border-border/70 bg-card p-4 sm:p-5 flex flex-col gap-3 shadow-2xs">
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
                    Khoản tiền cọc này gắn liền với Hợp đồng thuê (thường thanh toán kèm tiền phòng ngay lần đầu tiên khách nhận phòng). Khi thanh lý hợp đồng, hệ thống sẽ tự động tính toán, khấu trừ điện nước/hư hại và hoàn cọc tại mục <b>Hợp đồng</b>.
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-surface/50 border border-border/40 text-xs">
                <span className="font-bold text-muted flex items-center gap-1.5">
                  <User size={13} /> Khách hàng
                </span>
                <div className="text-right">
                  <span className="font-bold text-text block">{detailDeposit.customerName || "Chưa có tên"}</span>
                  {detailDeposit.customerPhone && (
                    <span className="font-mono text-muted text-[11px] block">{detailDeposit.customerPhone}</span>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-surface/50 border border-border/40 text-xs">
                <span className="font-bold text-muted flex items-center gap-1.5">
                  <Home size={13} /> Phòng gán cọc
                </span>
                <span className="font-bold text-text">
                  {detailDeposit.roomCode || "Chưa gán phòng"} {detailDeposit.buildingName ? `(${detailDeposit.buildingName})` : ""}
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

              <div className="p-3 rounded-xl bg-surface/40 border border-border/40">
                <span className="text-[11px] font-bold text-muted block mb-1">Ghi chú phiếu cọc</span>
                <div className="text-xs font-medium text-text whitespace-pre-wrap leading-relaxed">
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

            {/* Right Card: Modern Pipeline Timeline with Exact Dual Branches */}
            <div className="rounded-2xl border border-border/70 bg-card p-4 sm:p-5 flex flex-col gap-3.5 shadow-2xs">
              <div className="flex items-center justify-between border-b border-border/50 pb-2.5">
                <h4 className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-muted">
                  <RefreshCcw size={14} className="text-primary" /> Tiến trình xử lý phiếu cọc
                </h4>
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-surface border border-border/60 text-muted">
                  {isBookingDeposit ? "6 Bước cọc giữ phòng" : "4 Bước cọc hợp đồng"}
                </span>
              </div>

              <div className="relative mt-1 flex flex-col gap-0 pl-1">
                {isBookingDeposit ? (
                  /* --- BRANCH 1: CỌC GIỮ PHÒNG (6 BƯỚC) --- */
                  <>
                    {/* B1: Tạo cọc giữ phòng (Luôn hoàn thành) */}
                    <div className="relative flex gap-3 group">
                      <div className="flex flex-col items-center shrink-0 w-9">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white shadow-xs ring-4 ring-emerald-500/15">
                          <Check size={15} className="stroke-[3]" />
                        </div>
                        {/* Thanh pipe đoạn 1 -> 2 */}
                        <div className="flex-1 w-full flex flex-col items-center justify-center my-1 min-h-[30px] relative">
                          <div
                            className={`h-full ${
                              wasEverCollected
                                ? "w-[2px] bg-emerald-500"
                                : "w-[2px] bg-gradient-to-b from-emerald-500 to-amber-500"
                            }`}
                          />
                          <div
                            className={`absolute top-1/2 -translate-y-1/2 flex items-center justify-center w-4 h-4 rounded-full bg-card border shadow-2xs ${
                              wasEverCollected
                                ? "border-emerald-500/30 text-emerald-600"
                                : "border-amber-500/40 text-amber-600"
                            }`}
                          >
                            <ChevronDown size={10} className={`stroke-[2.5] ${!wasEverCollected ? "animate-bounce" : ""}`} />
                          </div>
                        </div>
                      </div>
                      <div className="flex-1 min-w-0 pb-3">
                        <div className="p-2.5 rounded-xl bg-surface/50 border border-border/50">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-black text-text">1. Tạo cọc giữ phòng</span>
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                              Đã tạo
                            </span>
                          </div>
                          <p className="text-[11px] text-muted leading-relaxed mt-0.5">
                            Khởi tạo phiếu cọc giữ chỗ phòng {detailDeposit.roomCode || ""}
                          </p>
                          <div className="flex items-center gap-1 text-[10px] font-bold text-muted mt-1.5 pt-1.5 border-t border-border/30 font-mono">
                            <Clock3 size={11} className="text-primary/70" />
                            <span>{formatDateTime(detailDeposit.createdAt)}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* B2: Xác nhận cọc giữ phòng */}
                    {(() => {
                      const step3Done = isConverted || Boolean(detailDeposit.contractId);
                      return (
                        <div className="relative flex gap-3 group">
                          <div className="flex flex-col items-center shrink-0 w-9">
                            <div
                              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full shadow-xs transition-all relative ${
                                wasEverCollected
                                  ? "bg-emerald-500 text-white ring-4 ring-emerald-500/15"
                                  : "bg-amber-500/15 border-2 border-amber-500 text-amber-600 dark:text-amber-400 ring-4 ring-amber-500/25 shadow-md"
                              }`}
                            >
                              {!wasEverCollected && (
                                <span className="absolute -inset-1 rounded-full bg-amber-500/30 animate-ping opacity-75 pointer-events-none" />
                              )}
                              {wasEverCollected ? <Check size={15} className="stroke-[3]" /> : <Banknote size={15} className="animate-pulse" />}
                            </div>
                            {/* Thanh pipe đoạn 2 -> 3 */}
                            <div className="flex-1 w-full flex flex-col items-center justify-center my-1 min-h-[30px] relative">
                              <div
                                className={`h-full ${
                                  step3Done
                                    ? "w-[2px] bg-indigo-500"
                                    : wasEverCollected
                                    ? "w-[2px] bg-gradient-to-b from-emerald-500 to-sky-500"
                                    : "border-l-2 border-dashed border-slate-300 dark:border-slate-700 w-0"
                                }`}
                              />
                              <div
                                className={`absolute top-1/2 -translate-y-1/2 flex items-center justify-center w-4 h-4 rounded-full bg-card border shadow-2xs ${
                                  step3Done
                                    ? "border-indigo-500/30 text-indigo-600"
                                    : wasEverCollected
                                    ? "border-sky-500/40 text-sky-600"
                                    : "border-slate-300 dark:border-slate-700 text-slate-400 dark:text-slate-500"
                                }`}
                              >
                                <ChevronDown size={10} className="stroke-[2.5]" />
                              </div>
                            </div>
                          </div>
                          <div className="flex-1 min-w-0 pb-3">
                            <div
                              className={`p-2.5 rounded-xl transition-all ${
                                wasEverCollected
                                  ? "bg-surface/50 border border-border/50"
                                  : "bg-gradient-to-r from-amber-500/[0.08] via-amber-500/[0.03] to-transparent border-2 border-amber-500/50 dark:border-amber-500/40 shadow-xs"
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className={`text-xs font-black ${wasEverCollected ? "text-text" : "text-amber-900 dark:text-amber-200"}`}>
                                  2. Xác nhận cọc giữ phòng
                                </span>
                                <span
                                  className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase border ${
                                    wasEverCollected
                                      ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                                      : "bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30 flex items-center gap-1.5"
                                  }`}
                                >
                                  {!wasEverCollected && (
                                    <span className="relative flex h-2 w-2">
                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                      <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                                    </span>
                                  )}
                                  {wasEverCollected ? "Đã nhận tiền" : "Đang chờ thu"}
                                </span>
                              </div>
                              <p className={`text-[11px] leading-relaxed mt-0.5 ${wasEverCollected ? "text-muted" : "text-amber-900/80 dark:text-amber-200/80 font-medium"}`}>
                                {wasEverCollected
                                  ? `Đã nhận đủ số tiền cọc giữ phòng: ${amountStr}`
                                  : "Đang đợi khách thanh toán khoản tiền cọc giữ phòng này"}
                              </p>
                              {wasEverCollected && (
                                <div className="flex items-center gap-1 text-[10px] font-bold text-muted mt-1.5 pt-1.5 border-t border-border/30 font-mono">
                                  <Clock3 size={11} className="text-primary/70" />
                                  <span>
                                    {(detailDeposit as any).paidAt
                                      ? formatDateTime((detailDeposit as any).paidAt)
                                      : formatDateTime(detailDeposit.updatedAt)}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* B3: Chuyển thành hợp đồng */}
                    {(() => {
                      const isCompleted = isConverted || Boolean(detailDeposit.contractId);
                      const isWaiting = wasEverCollected && !isCompleted && !isRefunded && !isCancelled;
                      const step4Done = isCompleted;

                      return (
                        <div className="relative flex gap-3 group">
                          <div className="flex flex-col items-center shrink-0 w-9">
                            <div
                              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full shadow-xs transition-all relative ${
                                isCompleted
                                  ? "bg-indigo-600 text-white ring-4 ring-indigo-600/15"
                                  : isRefunded || isCancelled
                                  ? "bg-surface border border-border text-muted"
                                  : isWaiting
                                  ? "bg-sky-500/15 border-2 border-sky-500 text-sky-600 ring-4 ring-sky-500/25 shadow-md"
                                  : "bg-slate-100/70 dark:bg-slate-800/50 border border-dashed border-slate-300 dark:border-slate-700 text-slate-400 dark:text-slate-600"
                              }`}
                            >
                              {isWaiting && (
                                <span className="absolute -inset-1 rounded-full bg-sky-500/30 animate-ping opacity-75 pointer-events-none" />
                              )}
                              {isCompleted ? (
                                <Check size={15} className="stroke-[3]" />
                              ) : isWaiting ? (
                                <PenTool size={14} className="animate-pulse" />
                              ) : (
                                <CircleDashed size={14} />
                              )}
                            </div>
                            {/* Thanh pipe đoạn 3 -> 4 */}
                            <div className="flex-1 w-full flex flex-col items-center justify-center my-1 min-h-[30px] relative">
                              <div
                                className={`h-full ${
                                  step4Done
                                    ? "w-[2px] bg-emerald-500"
                                    : "border-l-2 border-dashed border-slate-300 dark:border-slate-700 w-0"
                                }`}
                              />
                              <div
                                className={`absolute top-1/2 -translate-y-1/2 flex items-center justify-center w-4 h-4 rounded-full bg-card border shadow-2xs ${
                                  step4Done
                                    ? "border-emerald-500/30 text-emerald-600"
                                    : "border-slate-300 dark:border-slate-700 text-slate-400 dark:text-slate-500"
                                }`}
                              >
                                <ChevronDown size={10} className="stroke-[2.5]" />
                              </div>
                            </div>
                          </div>
                          <div className="flex-1 min-w-0 pb-3">
                            <div
                              className={`p-2.5 rounded-xl transition-all ${
                                isCompleted
                                  ? "bg-surface/50 border border-border/50"
                                  : isWaiting
                                  ? "bg-gradient-to-r from-sky-500/[0.08] to-transparent border-2 border-sky-500/40 shadow-xs"
                                  : "bg-slate-50/40 dark:bg-slate-900/20 border border-dashed border-slate-200 dark:border-slate-800/80 opacity-55"
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span
                                  className={`text-xs ${
                                    isCompleted
                                      ? "font-black text-text"
                                      : isWaiting
                                      ? "font-black text-sky-900 dark:text-sky-200"
                                      : "font-semibold text-slate-400 dark:text-slate-500"
                                  }`}
                                >
                                  3. Chuyển thành hợp đồng
                                </span>
                                <span
                                  className={`px-2 py-0.5 rounded-md text-[10px] uppercase border ${
                                    isCompleted
                                      ? "font-black bg-indigo-500/10 text-indigo-600 border-indigo-500/20"
                                      : isRefunded || isCancelled
                                      ? "font-bold bg-muted/10 text-muted border-border"
                                      : isWaiting
                                      ? "font-black bg-sky-500/20 text-sky-700 dark:text-sky-300 border-sky-500/30 flex items-center gap-1.5"
                                      : "font-semibold bg-slate-100/70 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 border-slate-200/60 dark:border-slate-800"
                                  }`}
                                >
                                  {isWaiting && (
                                    <span className="relative flex h-2 w-2">
                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                                      <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500"></span>
                                    </span>
                                  )}
                                  {isCompleted
                                    ? "Đã chuyển"
                                    : isRefunded || isCancelled
                                    ? "Bỏ qua"
                                    : isWaiting
                                    ? "Chờ ký HĐ"
                                    : "Chờ đóng cọc"}
                                </span>
                              </div>
                              <p
                                className={`text-[11px] leading-relaxed mt-0.5 ${
                                  isCompleted
                                    ? "text-muted"
                                    : isWaiting
                                    ? "text-sky-900/80 dark:text-sky-200/80 font-medium"
                                    : "text-slate-400/80 dark:text-slate-500/80"
                                }`}
                              >
                                {isCompleted
                                  ? `Tiến hành lập hợp đồng thuê chính thức cho phòng ${detailDeposit.roomCode || ""}`
                                  : isRefunded || isCancelled
                                  ? "Không chuyển thành HĐ (Đã giải tỏa phiếu cọc giữ phòng)"
                                  : isWaiting
                                  ? `Đã nhận cọc giữ phòng, chờ lập HĐ trước ${formatDate(detailDeposit.expiredAt)}`
                                  : "Chỉ thực hiện sau khi hoàn tất thu tiền cọc giữ phòng"}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* B4: Tạo phiếu cọc HĐ */}
                    {(() => {
                      const isCompleted = isConverted || Boolean(detailDeposit.contractId);
                      return (
                        <div className="relative flex gap-3 group">
                          <div className="flex flex-col items-center shrink-0 w-9">
                            <div
                              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full shadow-xs transition-all ${
                                isCompleted
                                  ? "bg-emerald-500 text-white ring-4 ring-emerald-500/15"
                                  : isRefunded || isCancelled
                                  ? "bg-surface border border-border text-muted"
                                  : "bg-slate-100/70 dark:bg-slate-800/50 border border-dashed border-slate-300 dark:border-slate-700 text-slate-400 dark:text-slate-600"
                              }`}
                            >
                              {isCompleted ? <Check size={15} className="stroke-[3]" /> : <CircleDashed size={14} />}
                            </div>
                            {/* Thanh pipe đoạn 4 -> 5 */}
                            <div className="flex-1 w-full flex flex-col items-center justify-center my-1 min-h-[30px] relative">
                              <div
                                className={`h-full ${
                                  isCompleted
                                    ? "w-[2px] bg-emerald-500"
                                    : "border-l-2 border-dashed border-slate-300 dark:border-slate-700 w-0"
                                }`}
                              />
                              <div
                                className={`absolute top-1/2 -translate-y-1/2 flex items-center justify-center w-4 h-4 rounded-full bg-card border shadow-2xs ${
                                  isCompleted
                                    ? "border-emerald-500/30 text-emerald-600"
                                    : "border-slate-300 dark:border-slate-700 text-slate-400 dark:text-slate-500"
                                }`}
                              >
                                <ChevronDown size={10} className="stroke-[2.5]" />
                              </div>
                            </div>
                          </div>
                          <div className="flex-1 min-w-0 pb-3">
                            <div
                              className={`p-2.5 rounded-xl transition-all ${
                                isCompleted
                                  ? "bg-surface/50 border border-border/50"
                                  : "bg-slate-50/40 dark:bg-slate-900/20 border border-dashed border-slate-200 dark:border-slate-800/80 opacity-55"
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className={`text-xs ${isCompleted ? "font-black text-text" : "font-semibold text-slate-400 dark:text-slate-500"}`}>
                                  4. Tạo phiếu cọc HĐ
                                </span>
                                <span
                                  className={`px-2 py-0.5 rounded-md text-[10px] uppercase border ${
                                    isCompleted
                                      ? "font-black bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                                      : isRefunded || isCancelled
                                      ? "font-bold bg-muted/10 text-muted border-border"
                                      : "font-semibold bg-slate-100/70 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 border-slate-200/60 dark:border-slate-800"
                                  }`}
                                >
                                  {isCompleted ? "Đã tạo" : isRefunded || isCancelled ? "Bỏ qua" : "Chờ lên HĐ"}
                                </span>
                              </div>
                              <p className={`text-[11px] leading-relaxed mt-0.5 ${isCompleted ? "text-muted" : "text-slate-400/80 dark:text-slate-500/80"}`}>
                                {isCompleted
                                  ? `Phát sinh phiếu cọc bảo đảm gắn với HĐ: ${detailDeposit.contractCode || "Đã liên kết"}`
                                  : "Sẽ tự động tạo khoản cọc bảo đảm khi chuyển sang hợp đồng thuê"}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* B5: Xác nhận cọc HĐ (khấu trừ cọc trước) */}
                    {(() => {
                      const isCompleted = isConverted || Boolean(detailDeposit.contractId);
                      return (
                        <div className="relative flex gap-3 group">
                          <div className="flex flex-col items-center shrink-0 w-9">
                            <div
                              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full shadow-xs transition-all ${
                                isCompleted
                                  ? "bg-emerald-500 text-white ring-4 ring-emerald-500/15"
                                  : isRefunded || isCancelled
                                  ? "bg-surface border border-border text-muted"
                                  : "bg-slate-100/70 dark:bg-slate-800/50 border border-dashed border-slate-300 dark:border-slate-700 text-slate-400 dark:text-slate-600"
                              }`}
                            >
                              {isCompleted ? <Check size={15} className="stroke-[3]" /> : <CircleDashed size={14} />}
                            </div>
                            {/* Thanh pipe đoạn 5 -> 6 */}
                            <div className="flex-1 w-full flex flex-col items-center justify-center my-1 min-h-[30px] relative">
                              <div
                                className={`h-full ${
                                  isCompleted
                                    ? "w-[2px] bg-indigo-600"
                                    : "border-l-2 border-dashed border-slate-300 dark:border-slate-700 w-0"
                                }`}
                              />
                              <div
                                className={`absolute top-1/2 -translate-y-1/2 flex items-center justify-center w-4 h-4 rounded-full bg-card border shadow-2xs ${
                                  isCompleted
                                    ? "border-indigo-500/30 text-indigo-600"
                                    : "border-slate-300 dark:border-slate-700 text-slate-400 dark:text-slate-500"
                                }`}
                              >
                                <ChevronDown size={10} className="stroke-[2.5]" />
                              </div>
                            </div>
                          </div>
                          <div className="flex-1 min-w-0 pb-3">
                            <div
                              className={`p-2.5 rounded-xl transition-all ${
                                isCompleted
                                  ? "bg-surface/50 border border-border/50"
                                  : "bg-slate-50/40 dark:bg-slate-900/20 border border-dashed border-slate-200 dark:border-slate-800/80 opacity-55"
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className={`text-xs ${isCompleted ? "font-black text-text" : "font-semibold text-slate-400 dark:text-slate-500"}`}>
                                  5. Xác nhận cọc HĐ
                                </span>
                                <span
                                  className={`px-2 py-0.5 rounded-md text-[10px] uppercase border ${
                                    isCompleted
                                      ? "font-black bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                                      : isRefunded || isCancelled
                                      ? "font-bold bg-muted/10 text-muted border-border"
                                      : "font-semibold bg-slate-100/70 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 border-slate-200/60 dark:border-slate-800"
                                  }`}
                                >
                                  {isCompleted ? "Đã nhận đủ" : isRefunded || isCancelled ? "Bỏ qua" : "Chờ cấn trừ"}
                                </span>
                              </div>
                              <p className={`text-[11px] leading-relaxed mt-0.5 ${isCompleted ? "text-muted" : "text-slate-400/80 dark:text-slate-500/80"}`}>
                                {isCompleted
                                  ? `Khấu trừ ${amountStr} cọc giữ phòng vào cọc HĐ, thanh toán phần còn lại thành công`
                                  : "Khấu trừ số tiền cọc giữ phòng trước đó và thanh toán phần cọc HĐ còn lại"}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* B6: Lưu giữ cọc hợp đồng / Hoàn cọc (Bước cuối - không có pipe) */}
                    {(() => {
                      const isCompleted = isConverted || Boolean(detailDeposit.contractId) || isRefunded || isCancelled;
                      return (
                        <div className="relative flex gap-3 group">
                          <div className="flex flex-col items-center shrink-0 w-9">
                            <div
                              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full shadow-xs transition-all ${
                                isRefunded
                                  ? "bg-amber-500 text-white ring-4 ring-amber-500/20"
                                  : isCancelled
                                  ? "bg-rose-500 text-white ring-4 ring-rose-500/20"
                                  : isConverted || detailDeposit.contractId
                                  ? "bg-indigo-600 text-white ring-4 ring-indigo-600/15"
                                  : "bg-slate-100/70 dark:bg-slate-800/50 border border-dashed border-slate-300 dark:border-slate-700 text-slate-400 dark:text-slate-600"
                              }`}
                            >
                              {isRefunded ? (
                                <RefreshCcw size={15} />
                              ) : isCancelled ? (
                                <X size={15} />
                              ) : isConverted || detailDeposit.contractId ? (
                                <ShieldCheck size={16} />
                              ) : (
                                <CircleDashed size={14} />
                              )}
                            </div>
                          </div>
                          <div className="flex-1 min-w-0 pb-0">
                            <div
                              className={`p-2.5 rounded-xl transition-all ${
                                isCompleted
                                  ? "bg-surface/50 border border-border/50"
                                  : "bg-slate-50/40 dark:bg-slate-900/20 border border-dashed border-slate-200 dark:border-slate-800/80 opacity-55"
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span
                                  className={`text-xs ${
                                    isCompleted
                                      ? "font-black text-text"
                                      : "font-semibold text-slate-400 dark:text-slate-500"
                                  }`}
                                >
                                  {isRefunded
                                    ? "6. Đã hoàn cọc"
                                    : isCancelled
                                    ? "6. Đã hủy phiếu cọc"
                                    : isConverted || detailDeposit.contractId
                                    ? "6. Đang lưu giữ cọc hợp đồng"
                                    : "6. Lưu giữ cọc hợp đồng"}
                                </span>
                                <span
                                  className={`px-2 py-0.5 rounded-md text-[10px] uppercase border ${
                                    isRefunded
                                      ? "font-black bg-amber-500/10 text-amber-600 border-amber-500/20"
                                      : isCancelled
                                      ? "font-black bg-rose-500/10 text-rose-600 border-rose-500/20"
                                      : isConverted || detailDeposit.contractId
                                      ? "font-black bg-indigo-500/10 text-indigo-600 border-indigo-500/20"
                                      : "font-semibold bg-slate-100/70 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 border-slate-200/60 dark:border-slate-800"
                                  }`}
                                >
                                  {isRefunded
                                    ? "Đã hoàn"
                                    : isCancelled
                                    ? "Đã hủy"
                                    : isConverted || detailDeposit.contractId
                                    ? "Đang lưu giữ"
                                    : "Chưa kích hoạt"}
                                </span>
                              </div>
                              <p
                                className={`text-[11px] leading-relaxed mt-0.5 ${
                                  isCompleted
                                    ? "text-muted"
                                    : "text-slate-400/80 dark:text-slate-500/80"
                                }`}
                              >
                                {isRefunded
                                  ? "Đã hoàn lại tiền cọc giữ phòng cho khách qua kế toán"
                                  : isCancelled
                                  ? "Phiếu cọc giữ phòng đã bị hủy hoặc thu hồi"
                                  : isConverted || detailDeposit.contractId
                                  ? "Cọc được lưu giữ an toàn theo suốt thời hạn của hợp đồng thuê"
                                  : "Sẽ chuyển sang lưu giữ khi hoàn tất hợp đồng thuê"}
                              </p>
                              {(isRefunded || isCancelled) && (
                                <div className="flex items-center gap-1 text-[10px] font-bold text-muted mt-1.5 pt-1.5 border-t border-border/30 font-mono">
                                  <Clock3 size={11} className="text-primary/70" />
                                  <span>{formatDateTime(detailDeposit.updatedAt)}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </>
                ) : (
                  /* --- BRANCH 2: CỌC BẢO ĐẢM HỢP ĐỒNG (4 BƯỚC) --- */
                  <>
                    {/* B1: Tạo phiếu cọc HĐ (Luôn hoàn thành vì phiếu đã tạo) */}
                    <div className="relative flex gap-3 group">
                      <div className="flex flex-col items-center shrink-0 w-9">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white shadow-xs ring-4 ring-emerald-500/15">
                          <Check size={15} className="stroke-[3]" />
                        </div>
                        {/* Thanh pipe đoạn 1 -> 2 */}
                        <div className="flex-1 w-full flex flex-col items-center justify-center my-1 min-h-[30px] relative">
                          <div
                            className={`h-full ${
                              wasEverCollected
                                ? "w-[2px] bg-emerald-500"
                                : "w-[2px] bg-gradient-to-b from-emerald-500 to-amber-500"
                            }`}
                          />
                          <div
                            className={`absolute top-1/2 -translate-y-1/2 flex items-center justify-center w-4 h-4 rounded-full bg-card border shadow-2xs ${
                              wasEverCollected
                                ? "border-emerald-500/30 text-emerald-600"
                                : "border-amber-500/40 text-amber-600"
                            }`}
                          >
                            <ChevronDown size={10} className={`stroke-[2.5] ${!wasEverCollected ? "animate-bounce" : ""}`} />
                          </div>
                        </div>
                      </div>
                      <div className="flex-1 min-w-0 pb-3">
                        <div className="p-2.5 rounded-xl bg-surface/50 border border-border/50">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-black text-text">1. Tạo phiếu cọc HĐ</span>
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                              Đã tạo
                            </span>
                          </div>
                          <p className="text-[11px] text-muted leading-relaxed mt-0.5">
                            Cọc bảo đảm gắn liền với Hợp đồng thuê {detailDeposit.contractCode ? `(${detailDeposit.contractCode})` : ""}
                          </p>
                          <div className="flex items-center gap-1 text-[10px] font-bold text-muted mt-1.5 pt-1.5 border-t border-border/30 font-mono">
                            <Clock3 size={11} className="text-primary/70" />
                            <span>{formatDateTime(detailDeposit.createdAt)}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* B2: Xác nhận cọc HĐ (Đang đợi hoặc Đã hoàn thành) */}
                    <div className="relative flex gap-3 group">
                      <div className="flex flex-col items-center shrink-0 w-9">
                        <div
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full shadow-xs transition-all relative ${
                            wasEverCollected
                              ? "bg-emerald-500 text-white ring-4 ring-emerald-500/15"
                              : "bg-amber-500/15 border-2 border-amber-500 text-amber-600 dark:text-amber-400 ring-4 ring-amber-500/25 shadow-md"
                          }`}
                        >
                          {!wasEverCollected && (
                            <span className="absolute -inset-1 rounded-full bg-amber-500/30 animate-ping opacity-75 pointer-events-none" />
                          )}
                          {wasEverCollected ? <Check size={15} className="stroke-[3]" /> : <Banknote size={15} className="animate-pulse" />}
                        </div>
                        {/* Thanh pipe đoạn 2 -> 3 */}
                        <div className="flex-1 w-full flex flex-col items-center justify-center my-1 min-h-[30px] relative">
                          <div
                            className={`h-full ${
                              wasEverCollected
                                ? "w-[2px] bg-indigo-500"
                                : "border-l-2 border-dashed border-slate-300 dark:border-slate-700 w-0"
                            }`}
                          />
                          <div
                            className={`absolute top-1/2 -translate-y-1/2 flex items-center justify-center w-4 h-4 rounded-full bg-card border shadow-2xs ${
                              wasEverCollected
                                ? "border-indigo-500/30 text-indigo-600"
                                : "border-slate-300 dark:border-slate-700 text-slate-400 dark:text-slate-500"
                            }`}
                          >
                            <ChevronDown size={10} className="stroke-[2.5]" />
                          </div>
                        </div>
                      </div>
                      <div className="flex-1 min-w-0 pb-3">
                        <div
                          className={`p-2.5 rounded-xl transition-all ${
                            wasEverCollected
                              ? "bg-surface/50 border border-border/50"
                              : "bg-gradient-to-r from-amber-500/[0.08] via-amber-500/[0.03] to-transparent border-2 border-amber-500/50 dark:border-amber-500/40 shadow-xs"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className={`text-xs font-black ${wasEverCollected ? "text-text" : "text-amber-900 dark:text-amber-200"}`}>
                              2. Xác nhận cọc HĐ
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase border ${
                                wasEverCollected
                                  ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                                  : "bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30 flex items-center gap-1.5"
                              }`}
                            >
                              {!wasEverCollected && (
                                <span className="relative flex h-2 w-2">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                                </span>
                              )}
                              {wasEverCollected ? "Đã nhận được" : "Chờ thu cọc"}
                            </span>
                          </div>
                          <p className={`text-[11px] leading-relaxed mt-0.5 ${wasEverCollected ? "text-muted" : "text-amber-900/80 dark:text-amber-200/80 font-medium"}`}>
                            {wasEverCollected
                              ? `Đã nhận đủ số tiền cọc bảo đảm hợp đồng: ${amountStr}`
                              : "Chưa nhận được tiền cọc bảo đảm (thường thanh toán kèm tiền phòng khi khách nhận phòng lần đầu)"}
                          </p>
                          {wasEverCollected && (
                            <div className="flex items-center gap-1 text-[10px] font-bold text-muted mt-1.5 pt-1.5 border-t border-border/30 font-mono">
                              <Clock3 size={11} className="text-primary/70" />
                              <span>
                                {(detailDeposit as any).paidAt
                                  ? formatDateTime((detailDeposit as any).paidAt)
                                  : formatDateTime(detailDeposit.updatedAt)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* B3: Hợp đồng có hiệu lực */}
                    <div className="relative flex gap-3 group">
                      <div className="flex flex-col items-center shrink-0 w-9">
                        <div
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full shadow-xs transition-all ${
                            wasEverCollected
                              ? "bg-indigo-600 text-white ring-4 ring-indigo-600/15"
                              : "bg-slate-100/70 dark:bg-slate-800/50 border border-dashed border-slate-300 dark:border-slate-700 text-slate-400 dark:text-slate-600"
                          }`}
                        >
                          {wasEverCollected ? <Check size={15} className="stroke-[3]" /> : <CircleDashed size={14} />}
                        </div>
                        {/* Thanh pipe đoạn 3 -> 4 */}
                        <div className="flex-1 w-full flex flex-col items-center justify-center my-1 min-h-[30px] relative">
                          <div
                            className={`h-full ${
                              wasEverCollected
                                ? "w-[2px] bg-indigo-500"
                                : "border-l-2 border-dashed border-slate-200 dark:border-slate-800 w-0"
                            }`}
                          />
                          <div
                            className={`absolute top-1/2 -translate-y-1/2 flex items-center justify-center w-4 h-4 rounded-full bg-card border shadow-2xs ${
                              wasEverCollected
                                ? "border-indigo-500/30 text-indigo-600"
                                : "border-slate-200 dark:border-slate-800 text-slate-300 dark:text-slate-600"
                            }`}
                          >
                            <ChevronDown size={10} className="stroke-[2.5]" />
                          </div>
                        </div>
                      </div>
                      <div className="flex-1 min-w-0 pb-3">
                        <div
                          className={`p-2.5 rounded-xl transition-all ${
                            wasEverCollected
                              ? "bg-surface/50 border border-border/50"
                              : "bg-slate-50/40 dark:bg-slate-900/20 border border-dashed border-slate-200 dark:border-slate-800/80 opacity-55"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={`text-xs ${
                                wasEverCollected
                                  ? "font-black text-text"
                                  : "font-semibold text-slate-400 dark:text-slate-500"
                              }`}
                            >
                              3. Hợp đồng có hiệu lực
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] uppercase border ${
                                wasEverCollected
                                  ? "font-black bg-indigo-500/10 text-indigo-600 border-indigo-500/20"
                                  : "font-semibold bg-slate-100/70 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 border-slate-200/60 dark:border-slate-800"
                              }`}
                            >
                              {wasEverCollected ? "Đã lên HĐ" : "Chờ thu cọc"}
                            </span>
                          </div>
                          <p
                            className={`text-[11px] leading-relaxed mt-0.5 ${
                              wasEverCollected
                                ? "text-muted"
                                : "text-slate-400/80 dark:text-slate-500/80"
                            }`}
                          >
                            {wasEverCollected
                              ? `Hợp đồng thuê ${detailDeposit.contractCode || "liên kết"} chính thức có hiệu lực pháp lý`
                              : "Sẽ kích hoạt đầy đủ hiệu lực hợp đồng ngay sau khi hoàn tất thu tiền cọc"}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* B4: Đang lưu giữ cọc hợp đồng (hoặc Đã hoàn cọc / Đã hủy) - Bước cuối cùng không có pipe */}
                    <div className="relative flex gap-3 group">
                      <div className="flex flex-col items-center shrink-0 w-9">
                        <div
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full shadow-xs transition-all ${
                            isRefunded
                              ? "bg-amber-500 text-white ring-4 ring-amber-500/20"
                              : isCancelled
                              ? "bg-rose-500 text-white ring-4 ring-rose-500/20"
                              : wasEverCollected
                              ? "bg-indigo-500/10 border border-indigo-500 text-indigo-600 ring-4 ring-indigo-500/15"
                              : "bg-slate-100/70 dark:bg-slate-800/50 border border-dashed border-slate-300 dark:border-slate-700 text-slate-400 dark:text-slate-600"
                          }`}
                        >
                          {isRefunded ? (
                            <RefreshCcw size={15} />
                          ) : isCancelled ? (
                            <X size={15} />
                          ) : wasEverCollected ? (
                            <ShieldCheck size={16} />
                          ) : (
                            <CircleDashed size={14} />
                          )}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0 pb-0">
                        <div
                          className={`p-2.5 rounded-xl transition-all ${
                            wasEverCollected || isRefunded || isCancelled
                              ? "bg-surface/50 border border-border/50"
                              : "bg-slate-50/40 dark:bg-slate-900/20 border border-dashed border-slate-200 dark:border-slate-800/80 opacity-55"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={`text-xs ${
                                wasEverCollected || isRefunded || isCancelled
                                  ? "font-black text-text"
                                  : "font-semibold text-slate-400 dark:text-slate-500"
                              }`}
                            >
                              {isRefunded
                                ? "4. Đã hoàn cọc khi thanh lý HĐ"
                                : isCancelled
                                ? "4. Đã hủy / Phạt cọc"
                                : wasEverCollected
                                ? "4. Đang lưu giữ cọc hợp đồng"
                                : "4. Lưu giữ cọc hợp đồng"}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] uppercase border ${
                                isRefunded
                                  ? "font-black bg-amber-500/10 text-amber-600 border-amber-500/20"
                                  : isCancelled
                                  ? "font-black bg-rose-500/10 text-rose-600 border-rose-500/20"
                                  : wasEverCollected
                                  ? "font-black bg-indigo-500/10 text-indigo-600 border-indigo-500/20"
                                  : "font-semibold bg-slate-100/70 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 border-slate-200/60 dark:border-slate-800"
                              }`}
                            >
                              {isRefunded
                                ? "Hoàn tất"
                                : isCancelled
                                ? "Đã hủy"
                                : wasEverCollected
                                ? "Đang lưu giữ"
                                : "Chưa kích hoạt"}
                            </span>
                          </div>
                          <p
                            className={`text-[11px] leading-relaxed mt-0.5 ${
                              wasEverCollected || isRefunded || isCancelled
                                ? "text-muted"
                                : "text-slate-400/80 dark:text-slate-500/80"
                            }`}
                          >
                            {isRefunded
                              ? "Đã đối soát, khấu trừ hư hại/điện nước và hoàn lại cọc khi kết thúc HĐ"
                              : isCancelled
                              ? "Khoản cọc đã bị hủy hoặc thu hồi theo biên bản thanh lý"
                              : wasEverCollected
                              ? "Tiền cọc được lưu giữ an toàn theo suốt thời hạn của hợp đồng thuê"
                              : "Khoản cọc sẽ được kích hoạt lưu giữ bảo đảm ngay sau khi thu đủ tiền"}
                          </p>
                          {(isRefunded || isCancelled) && (
                            <div className="flex items-center gap-1 text-[10px] font-bold text-muted mt-1.5 pt-1.5 border-t border-border/30 font-mono">
                              <Clock3 size={11} className="text-primary/70" />
                              <span>{formatDateTime(detailDeposit.updatedAt)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </>
                )}
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
