"use client";

import React, { useRef, useState } from "react";
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
  useCancelUnpaidDepositMutation,
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

const currencyFormatter = new Intl.NumberFormat("vi-VN");
const timelineStepTitleClass =
  "min-w-0 flex-1 truncate text-xs font-black text-text";
const timelineStepTitleMutedClass =
  "min-w-0 flex-1 truncate text-xs font-semibold text-slate-400 dark:text-slate-500";
const timelineStatusBadgeClass =
  "shrink-0 whitespace-nowrap rounded-md border px-1.5 py-1 text-[9px] uppercase leading-none tracking-tight";

function createIdempotencyKey(action: string) {
  const suffix = globalThis.crypto?.randomUUID?.()
    ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${action}-${suffix}`.slice(0, 128);
}

function formatDate(value?: string | null) {
  if (!value) return "Chưa có";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Chưa có"
    : date.toLocaleDateString("vi-VN");
}

function formatDateTime(value?: string | null) {
  if (!value) return "Chưa có";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Chưa có"
    : date.toLocaleString("vi-VN");
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
  const completePendingRefundMutation =
    useCompletePendingDepositRefundMutation();
  const convertMutation = useConvertContractMutation();
  const cancelMutation = useCancelDepositMutation();
  const cancelUnpaidMutation = useCancelUnpaidDepositMutation();

  // Sub-modal states
  const [showQrModal, setShowQrModal] = useState(false);
  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isConvertModalOpen, setIsConvertModalOpen] = useState(false);
  const [isCompletePendingModalOpen, setIsCompletePendingModalOpen] =
    useState(false);

  // Form states for Refund Modal
  const [refundReason, setRefundReason] = useState("");
  const [refundAmountInput, setRefundAmountInput] = useState("");
  const [refundReceiptStatus, setRefundReceiptStatus] = useState<
    "COMPLETED" | "PENDING"
  >("COMPLETED");
  const [refundAttachmentInput, setRefundAttachmentInput] = useState("");

  // Form states for Cancel Modal
  const [cancelReason, setCancelReason] = useState("");
  const [cancelRefundAmount, setCancelRefundAmount] = useState("");
  const [cancelKeepAmount, setCancelKeepAmount] = useState("");
  const [cancelDeductAmount, setCancelDeductAmount] = useState("");
  const [cancelReceiptStatus, setCancelReceiptStatus] = useState<
    "COMPLETED" | "PENDING"
  >("COMPLETED");

  // Form states for Convert Modal
  const [convertSecurityRequired, setConvertSecurityRequired] = useState("");
  const [convertExcessAction, setConvertExcessAction] = useState<
    "CREDIT" | "REFUND"
  >("CREDIT");

  // Form state for Complete Pending Refund Modal
  const [completePendingNote, setCompletePendingNote] = useState("");

  // Shared idempotency key for actions
  const [actionIdempotencyKey, setActionIdempotencyKey] = useState("");
  const collectIdempotencyKeyRef = useRef("");

  if (!detailDeposit) return null;

  const amount = Number(detailDeposit.amount || 0);
  const amountStr = formatCurrency(amount);
  const isPaid = detailDeposit.status === "PAID";
  const isConverted = detailDeposit.status === "CONVERTED_TO_CONTRACT";
  const isRefunded = detailDeposit.status === "REFUNDED";
  const isCancelled = detailDeposit.status === "CANCELLED";
  const isDraft =
    detailDeposit.status === "DRAFT" || detailDeposit.status === "PENDING";
  const refundSummary = detailDeposit.refundSummary;
  const refundPending = !!refundSummary?.pending;
  const availableBalance = detailDeposit.availableBalance;
  const hasAuthoritativeBalance = Number.isFinite(availableBalance);
  const coreDataUnavailable = detailQuery.isError || (detailQuery.isSuccess && !hasAuthoritativeBalance);
  const pendingOperationUnavailable = refundPending && !detailDeposit.pendingOperationId;

  // Check if this deposit belongs to a contract
  const isContractDeposit = Boolean(
    detailDeposit.contractId || detailDeposit.contractCode || isConverted,
  );

  // Only allow standalone refund for room booking/holding deposits
  const isBookingDeposit =
    detailDeposit.type === "BOOKING" || detailDeposit.type === "RESERVATION";
  const avatarUrl = getTenantAvatar(
    (detailDeposit as any).customerAvatar || (detailDeposit as any).avatar,
    detailDeposit.customerName,
    (detailDeposit as any).gender,
  );
  const canRefundDirectly = !isContractDeposit && isPaid;

  const wasEverCollected =
    isPaid ||
    Boolean((detailDeposit as any).paidAt) ||
    (hasAuthoritativeBalance && Number(availableBalance) > 0) ||
    isRefunded ||
    (isBookingDeposit && isConverted);
  const pendingReviewReceivedAmount = Math.max(
    0,
    Number(
      (detailDeposit as any).sepayPendingReviewAmount
      || (detailDeposit as any).paymentRequest?.actualReceivedAmount
      || (detailDeposit as any).paymentRequest?.pendingReviewAmount
      || 0,
    ) || 0,
  );
  const receivedAmount = wasEverCollected
    ? amount
    : Math.min(amount, pendingReviewReceivedAmount);
  const receivedAmountStr = formatCurrency(receivedAmount);
  const hasPendingReviewReceived = !wasEverCollected && receivedAmount > 0;
  const paymentRequestStatus = String(detailDeposit.paymentRequest?.status || "").toUpperCase();
  const paymentRequestCreated = Boolean(detailDeposit.paymentRequest?.id);
  const canShowVietQr = !isPaid && !isRefunded && !isCancelled;

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "DRAFT":
      case "PENDING":
        return {
          label: isContractDeposit
            ? "Chờ thu cọc hợp đồng"
            : "Chờ thu cọc giữ phòng",
          variant: "neutral" as const,
          bg: isContractDeposit
            ? "bg-purple-500/10 text-purple-600 border-purple-500/20"
            : "bg-sky-500/10 text-sky-600 border-sky-500/20",
        };
      case "PAID":
        return {
          label: isBookingDeposit
            ? "Đã thu cọc HĐ giữ chỗ"
            : isContractDeposit
              ? "Đã thu cọc hợp đồng"
              : "Đã thu cọc giữ phòng",
          variant: "success" as const,
          bg: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
        };
      case "CONVERTED_TO_CONTRACT":
        return {
          label: "Đã chuyển HĐ",
          variant: "primary" as const,
          bg: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20",
        };
      case "REFUNDED":
        return {
          label: "Đã hoàn cọc",
          variant: "warning" as const,
          bg: "bg-amber-500/10 text-amber-600 border-amber-500/20",
        };
      case "CANCELLED":
        return {
          label: "Đã hủy",
          variant: "error" as const,
          bg: "bg-rose-500/10 text-rose-600 border-rose-500/20",
        };
      default:
        return {
          label: status,
          variant: "neutral" as const,
          bg: "bg-slate-500/10 text-slate-600 border-slate-500/20",
        };
    }
  };

  const getTypeConfig = (type: string) => {
    switch (type) {
      case "SECURITY":
        return {
          label: "Cọc bảo đảm HĐ",
          icon: ShieldCheck,
          color: "text-indigo-600 bg-indigo-500/10 border-indigo-500/20",
        };
      case "BOOKING":
        return {
          label: "Cọc giữ phòng",
          icon: Bookmark,
          color: "text-amber-600 bg-amber-500/10 border-amber-500/20",
        };
      case "RESERVATION":
        return {
          label: "Phí giữ chỗ",
          icon: Bookmark,
          color: "text-sky-600 bg-sky-500/10 border-sky-500/20",
        };
      default:
        return {
          label: type,
          icon: Bookmark,
          color: "text-slate-600 bg-slate-500/10 border-slate-500/20",
        };
    }
  };

  const statusConfig = getStatusConfig(detailDeposit.status);
  const typeConfig = getTypeConfig(detailDeposit.type);

  // --- Handlers ---
  const handleCollect = () => {
    if (!collectIdempotencyKeyRef.current) {
      collectIdempotencyKeyRef.current = createIdempotencyKey("collect");
    }
    collectMutation.mutate(
      {
        id: detailDeposit.id,
        idempotencyKey: collectIdempotencyKeyRef.current,
      },
      {
        onSuccess: () => {
          collectIdempotencyKeyRef.current = "";
          showToast("Đã xác nhận thu tiền cọc thành công!", "success");
        },
        onError: (err: any) => {
          showToast(
            err?.response?.data?.message || "Lỗi khi thu tiền cọc",
            "error",
          );
        },
      },
    );
  };

  const openRefundModal = () => {
    if (!hasAuthoritativeBalance || availableBalance === undefined) {
      showToast("Chưa tải được số dư cọc từ sổ ledger. Không thể hoàn tiền.", "error");
      return;
    }

    setActionIdempotencyKey(createIdempotencyKey("refund"));
    setRefundReason("");
    setRefundAmountInput(String(availableBalance));
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
    if (
      !Number.isFinite(parsedAmount) ||
      parsedAmount <= 0 ||
      !hasAuthoritativeBalance ||
      availableBalance === undefined ||
      parsedAmount > availableBalance
    ) {
      showToast(`Số tiền hoàn không hợp lệ (Tối đa ${formatCurrency(availableBalance)})`, "error");
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
        idempotencyKey: actionIdempotencyKey,
      },
      {
        onSuccess: () => {
          showToast("Đã tạo lệnh hoàn cọc thành công!", "success");
          setIsRefundModalOpen(false);
        },
        onError: (err: any) => {
          showToast(
            err?.response?.data?.message || "Lỗi khi hoàn cọc",
            "error",
          );
        },
      },
    );
  };

  const openCancelModal = () => {
    if (isPaid && (!hasAuthoritativeBalance || availableBalance === undefined)) {
      showToast("Chưa tải được số dư cọc từ sổ ledger. Không thể xử lý cọc.", "error");
      return;
    }

    setActionIdempotencyKey(createIdempotencyKey("cancel"));
    setCancelReason("");
    setCancelRefundAmount("");
    setCancelKeepAmount(isPaid ? String(availableBalance) : "");
    setCancelDeductAmount("");
    setCancelReceiptStatus("COMPLETED");
    setIsCancelModalOpen(true);
  };

  const submitCancel = () => {
    if (!cancelReason.trim()) {
      showToast("Vui lòng nhập lý do hủy phiếu cọc", "error");
      return;
    }

    if (!isPaid) {
      cancelUnpaidMutation.mutate(
        {
          id: detailDeposit.id,
          reason: cancelReason.trim(),
          idempotencyKey: actionIdempotencyKey,
        },
        {
          onSuccess: () => {
            showToast("Đã hủy phiếu cọc thành công!", "success");
            setIsCancelModalOpen(false);
          },
          onError: (err: any) => {
            showToast(
              err?.response?.data?.message || "Lỗi khi hủy phiếu cọc",
              "error",
            );
          },
        },
      );
      return;
    }

    const parsedRefund = Number(cancelRefundAmount) || 0;
    const parsedKeep = Number(cancelKeepAmount) || 0;
    const parsedDeduct = Number(cancelDeductAmount) || 0;
    const totalAllocated = parsedRefund + parsedKeep + parsedDeduct;
    if (!hasAuthoritativeBalance || availableBalance === undefined) {
      showToast("Chưa tải được số dư cọc từ sổ ledger. Không thể xử lý cọc.", "error");
      return;
    }

    if (totalAllocated !== availableBalance) {
      showToast(
        `Tổng phân bổ (${formatCurrency(totalAllocated)}) phải bằng đúng số dư ledger (${formatCurrency(availableBalance)})`,
        "error",
      );
      return;
    }

    cancelMutation.mutate(
      {
        id: detailDeposit.id,
        reason: cancelReason.trim(),
        availableBalance,
        refundAmount: parsedRefund,
        keepAmount: parsedKeep,
        deductAmount: parsedDeduct,
        receiptStatus: parsedRefund > 0 ? cancelReceiptStatus : undefined,
        idempotencyKey: actionIdempotencyKey,
      },
      {
        onSuccess: () => {
          showToast("Đã hủy và xử lý cọc thành công!", "success");
          setIsCancelModalOpen(false);
        },
        onError: (err: any) => {
          showToast(
            err?.response?.data?.message || "Lỗi khi xử lý cọc",
            "error",
          );
        },
      },
    );
  };

  const openConvertModal = () => {
    if (!hasAuthoritativeBalance || availableBalance === undefined) {
      showToast("Chưa tải được số dư cọc từ sổ ledger. Không thể lên hợp đồng.", "error");
      return;
    }
    setActionIdempotencyKey(createIdempotencyKey("convert"));
    setConvertSecurityRequired(String(availableBalance));
    setConvertExcessAction("CREDIT");
    setIsConvertModalOpen(true);
  };

  const submitConvert = () => {
    if (!hasAuthoritativeBalance || availableBalance === undefined) {
      showToast("Chưa tải được số dư cọc từ sổ ledger. Không thể lên hợp đồng.", "error");
      return;
    }
    const requiredAmt = Number(convertSecurityRequired);
    if (!Number.isFinite(requiredAmt) || requiredAmt <= 0) {
      showToast("Vui lòng nhập mức cọc yêu cầu hợp lệ", "error");
      return;
    }

    convertMutation.mutate(
      {
        id: detailDeposit.id,
        securityRequired: requiredAmt,
        contractId: detailDeposit.contractId || undefined,
        excessAction: convertExcessAction,
        idempotencyKey: actionIdempotencyKey,
      },
      {
        onSuccess: () => {
          showToast(
            "Đã chuyển phiếu cọc thành hợp đồng thành công!",
            "success",
          );
          setIsConvertModalOpen(false);
          onClose();
        },
        onError: (err: any) => {
          showToast(
            err?.response?.data?.message || "Lỗi khi chuyển hợp đồng",
            "error",
          );
        },
      },
    );
  };

  const openCompletePendingModal = () => {
    if (!detailDeposit.pendingOperationId) {
      showToast("Không tìm thấy mã tác vụ hoàn tiền đang chờ từ CORE.", "error");
      return;
    }

    setActionIdempotencyKey(createIdempotencyKey("complete-refund"));
    setCompletePendingNote("");
    setIsCompletePendingModalOpen(true);
  };

  const submitCompletePendingRefund = () => {
    const operationId = detailDeposit.pendingOperationId;
    if (!operationId) {
      showToast("Lỗi: Không tìm thấy ID tác vụ (operationId)", "error");
      return;
    }

    completePendingRefundMutation.mutate(
      {
        operationId,
        depositId: detailDeposit.id,
        note: completePendingNote,
        idempotencyKey: actionIdempotencyKey,
      },
      {
        onSuccess: () => {
          showToast("Đã xác nhận hoàn tất phiếu chi hoàn cọc!", "success");
          setIsCompletePendingModalOpen(false);
        },
        onError: (err: any) => {
          showToast(
            err?.response?.data?.message || "Lỗi khi xác nhận hoàn cọc",
            "error",
          );
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
                <span
                  data-testid="deposit-status-badge"
                  className={`text-[10px] font-black px-2 py-0.5 rounded-md border tracking-wide ${statusConfig.bg}`}
                >
                  {statusConfig.label}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted font-medium mt-0.5 flex-wrap">
                <span className="inline-flex items-center gap-1 font-bold text-text">
                  <Home size={12} className="text-primary" />
                  {detailDeposit.roomCode || "Chưa xếp phòng"} ·{" "}
                  {detailDeposit.buildingName || "Tòa nhà"}
                </span>
                <span>•</span>
                <span
                  className={`inline-flex items-center gap-1 text-[11px] font-bold ${typeConfig.color}`}
                >
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
                variant="outline"
                size="sm"
                onClick={() => window.print()}
                className="h-9 rounded-xl border-border text-text hover:bg-muted/10 font-bold text-xs cursor-pointer shadow-2xs"
              >
                <Printer size={14} className="mr-1.5" /> In phiếu
              </Button>
            </div>

            <div className="flex items-center gap-2 flex-wrap justify-end">
              {/* Nút Hủy cọc (Chỉ cho cọc chưa lên HĐ) */}
              {isDraft && (
                <Button
                  data-testid="deposit-action-cancel"
                  onClick={openCancelModal}
                  disabled={cancelMutation.isPending || cancelUnpaidMutation.isPending}
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
                  disabled={cancelMutation.isPending || detailQuery.isLoading || !hasAuthoritativeBalance}
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
                  disabled={refundMutation.isPending || detailQuery.isLoading || !hasAuthoritativeBalance}
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
                  disabled={completePendingRefundMutation.isPending || pendingOperationUnavailable}
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
                  disabled={convertMutation.isPending || detailQuery.isLoading || !hasAuthoritativeBalance}
                  variant="primary"
                  size="sm"
                  className="h-9 rounded-xl font-bold text-xs shadow-sm cursor-pointer"
                >
                  <PenTool size={14} className="mr-1.5" /> Lên hợp đồng
                </Button>
              )}

              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="h-9 rounded-xl text-muted hover:text-text font-bold text-xs cursor-pointer"
              >
                Đóng
              </Button>
            </div>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          {(coreDataUnavailable || pendingOperationUnavailable) && (isPaid || refundPending) && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs font-semibold leading-relaxed text-rose-700 dark:text-rose-300"
            >
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <span>
                Dữ liệu CORE chưa đầy đủ
                {coreDataUnavailable ? ": chưa có số dư ledger xác thực" : ""}
                {coreDataUnavailable && pendingOperationUnavailable ? "; " : ""}
                {pendingOperationUnavailable ? ": chưa có mã tác vụ hoàn tiền đang chờ" : ""}.
                Các thao tác tài chính liên quan đã được khóa để tránh xử lý sai tiền.
              </span>
            </div>
          )}
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
              <span
                className={`text-sm sm:text-base font-black mt-0.5 block font-mono ${wasEverCollected || hasPendingReviewReceived ? "text-emerald-600 dark:text-emerald-400" : "text-muted"}`}
              >
                {wasEverCollected || hasPendingReviewReceived ? receivedAmountStr : "0đ"}
              </span>
              {hasPendingReviewReceived && (
                <span className="mt-0.5 block text-[9px] font-black uppercase tracking-tight text-amber-600">
                  Chờ xử lý
                </span>
              )}
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
                {isContractDeposit
                  ? "Theo hợp đồng"
                  : formatDate(detailDeposit.expiredAt)}
              </span>
            </div>
          </div>

          {/* 2-COLUMN MAIN CONTENT */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left Card: Thông tin phiếu cọc */}
            <div className="rounded-2xl border border-border/70 bg-card p-4 sm:p-5 flex flex-col gap-3 shadow-2xs">
              <h4 className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-muted border-b border-border/50 pb-2.5">
                <FileText size={14} className="text-primary" /> Thông tin phiếu
                cọc
              </h4>

              {/* Thông báo nghiệp vụ cọc bảo đảm hợp đồng */}
              {isContractDeposit && (
                <div className="flex items-start gap-2.5 rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-3 text-xs leading-relaxed text-indigo-700 dark:text-indigo-300">
                  <Info size={16} className="shrink-0 text-indigo-600 mt-0.5" />
                  <div>
                    <span className="font-bold block mb-0.5">
                      Cọc bảo đảm hợp đồng{" "}
                      {detailDeposit.contractCode
                        ? `(${detailDeposit.contractCode})`
                        : ""}
                    </span>
                    Khoản tiền cọc này gắn liền với Hợp đồng thuê (thường thanh
                    toán kèm tiền phòng ngay lần đầu tiên khách nhận phòng). Khi
                    thanh lý hợp đồng, hệ thống sẽ tự động tính toán, khấu trừ
                    điện nước/hư hại và hoàn cọc tại mục <b>Hợp đồng</b>.
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-surface/50 border border-border/40 text-xs">
                <span className="font-bold text-muted flex items-center gap-1.5">
                  <User size={13} /> Khách hàng
                </span>
                <div className="text-right">
                  <span className="font-bold text-text block">
                    {detailDeposit.customerName || "Chưa có tên"}
                  </span>
                  {detailDeposit.customerPhone && (
                    <span className="font-mono text-muted text-[11px] block">
                      {detailDeposit.customerPhone}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-surface/50 border border-border/40 text-xs">
                <span className="font-bold text-muted flex items-center gap-1.5">
                  <Home size={13} /> Phòng gán cọc
                </span>
                <span className="font-bold text-text">
                  {detailDeposit.roomCode || "Chưa gán phòng"}{" "}
                  {detailDeposit.buildingName
                    ? `(${detailDeposit.buildingName})`
                    : ""}
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
                <span className="text-[11px] font-bold text-muted block mb-1">
                  Ghi chú phiếu cọc
                </span>
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
                    <span className="font-bold font-mono text-text">
                      {refundSummary.receiptCode || "Chưa có"}
                    </span>
                  </div>
                  {refundSummary.receiptDescription && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted">Nội dung chi:</span>
                      <span className="font-bold text-text">
                        {refundSummary.receiptDescription}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted">Trạng thái:</span>
                    <span className="font-bold text-text">
                      {refundSummary.taskStatus ||
                        refundSummary.receiptStatus ||
                        "-"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted">Số tiền hoàn:</span>
                    <span className="font-black text-amber-700 dark:text-amber-400">
                      {formatCurrency(refundSummary.receiptAmount)}
                    </span>
                  </div>
                  {(refundSummary.taskStatus === "PENDING" ||
                    refundSummary.receiptStatus === "PENDING") && (
                    <div className="mt-1 flex justify-end">
                      <Button
                        size="sm"
                        className="bg-amber-500 hover:bg-amber-600 text-white font-bold"
                        onClick={openCompletePendingModal}
                        disabled={!detailDeposit.pendingOperationId}
                      >
                        Hoàn tất hoàn cọc
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right Card: Modern Pipeline Timeline with Exact Dual Branches */}
            <div className="rounded-2xl border border-border/70 bg-card p-4 sm:p-5 flex flex-col gap-3.5 shadow-2xs">
              <div className="flex items-center justify-between border-b border-border/50 pb-2.5">
                <h4 className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-muted">
                  <RefreshCcw size={14} className="text-primary" /> Tiến trình
                  xử lý phiếu cọc
                </h4>
                <span className="shrink-0 whitespace-nowrap rounded-md border border-border/60 bg-surface px-1.5 py-1 text-[9px] font-black uppercase leading-none tracking-tight text-muted">
                  {isBookingDeposit
                    ? "6 Bước cọc giữ phòng"
                    : "5 Bước cọc hợp đồng"}
                </span>
              </div>

              <div className="deposit-flow-timeline relative mt-1 flex flex-col gap-0 pl-1">
                {isBookingDeposit ? (
                  /* ========================================================================= */
                  /* --- BRANCH 1: CỌC GIỮ PHÒNG (6 BƯỚC)                                   --- */
                  /* 1. Tạo cọc giữ phòng -> 2. Tạo HĐ giữ chỗ -> 3. Thanh toán tiền cọc    --- */
                  /* -> 4. Xác nhận thanh toán -> 5. HĐ giữ chỗ có hiệu lực -> 6. Thông báo --- */
                  /* ========================================================================= */
                  <>
                    {/* B1: Tạo cọc giữ phòng */}
                    <div className="relative flex gap-3 group">
                      <div className="flex flex-col items-center shrink-0 w-9">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white shadow-xs ring-4 ring-emerald-500/15">
                          <Check size={15} className="stroke-[3]" />
                        </div>
                        {/* Pipe 1 -> 2 */}
                        <div className="flex-1 w-full flex flex-col items-center justify-center my-1 min-h-[30px] relative">
                          <div className="h-full w-[2px] bg-emerald-500" />
                          <div className="absolute top-1/2 -translate-y-1/2 flex items-center justify-center w-4 h-4 rounded-full bg-card border border-emerald-500/30 text-emerald-600 shadow-2xs">
                            <ChevronDown size={10} className="stroke-[2.5]" />
                          </div>
                        </div>
                      </div>
                      <div className="flex-1 min-w-0 pb-3">
                        <div className="p-2.5 rounded-xl bg-surface/50 border border-border/50">
                          <div className="flex items-center justify-between gap-2">
                            <span className={timelineStepTitleClass}>
                              1. Tạo phiếu cọc giữ phòng
                            </span>
                            <span className={`${timelineStatusBadgeClass} font-black bg-emerald-500/10 text-emerald-600 border-emerald-500/20`}>
                              Đã tạo
                            </span>
                          </div>
                          <p className="text-[11px] text-muted leading-relaxed mt-0.5">
                            Khởi tạo phiếu cọc giữ chỗ phòng{" "}
                            {detailDeposit.roomCode || ""}
                          </p>
                          <div className="flex items-center gap-1 text-[10px] font-bold text-muted mt-1.5 pt-1.5 border-t border-border/30 font-mono">
                            <Clock3 size={11} className="text-primary/70" />
                            <span>
                              {formatDateTime(detailDeposit.createdAt)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* B2: Tạo HĐ giữ chỗ */}
                    <div className="relative flex gap-3 group">
                      <div className="flex flex-col items-center shrink-0 w-9">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white shadow-xs ring-4 ring-emerald-500/15">
                          <Check size={15} className="stroke-[3]" />
                        </div>
                        {/* Pipe 2 -> 3 */}
                        <div className="flex-1 w-full flex flex-col items-center justify-center my-1 min-h-[30px] relative">
                          <div
                            className={`h-full ${wasEverCollected ? "w-[2px] bg-emerald-500" : "w-[2px] bg-gradient-to-b from-emerald-500 to-amber-500"}`}
                          />
                          <div
                            className={`absolute top-1/2 -translate-y-1/2 flex items-center justify-center w-4 h-4 rounded-full bg-card border shadow-2xs ${wasEverCollected ? "border-emerald-500/30 text-emerald-600" : "border-amber-500/40 text-amber-600"}`}
                          >
                            <ChevronDown
                              size={10}
                              className={`stroke-[2.5] ${!wasEverCollected ? "animate-bounce" : ""}`}
                            />
                          </div>
                        </div>
                      </div>
                      <div className="flex-1 min-w-0 pb-3">
                        <div className="p-2.5 rounded-xl bg-surface/50 border border-border/50">
                          <div className="flex items-center justify-between gap-2">
                            <span className={timelineStepTitleClass}>
                              2. Lập thỏa thuận cọc giữ phòng
                            </span>
                            <span className={`${timelineStatusBadgeClass} font-black bg-emerald-500/10 text-emerald-600 border-emerald-500/20`}>
                              Đã lập thỏa thuận
                            </span>
                          </div>
                          <p className="text-[11px] text-muted leading-relaxed mt-0.5">
                            Lập thỏa thuận đặt cọc giữ phòng trước khi vào ở
                            chính thức
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* B3: Thanh toán tiền cọc */}
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
                          {wasEverCollected ? (
                            <Check size={15} className="stroke-[3]" />
                          ) : (
                            <Banknote size={15} className="animate-pulse" />
                          )}
                        </div>
                        {/* Pipe 3 -> 4 */}
                        <div className="flex-1 w-full flex flex-col items-center justify-center my-1 min-h-[30px] relative">
                          <div
                            className={`h-full ${wasEverCollected ? "w-[2px] bg-emerald-500" : "border-l-2 border-dashed border-slate-300 dark:border-slate-700 w-0"}`}
                          />
                          <div
                            className={`absolute top-1/2 -translate-y-1/2 flex items-center justify-center w-4 h-4 rounded-full bg-card border shadow-2xs ${wasEverCollected ? "border-emerald-500/30 text-emerald-600" : "border-slate-300 dark:border-slate-700 text-slate-400 dark:text-slate-500"}`}
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
                            <span
                              className={`min-w-0 flex-1 truncate text-xs font-black ${wasEverCollected ? "text-text" : "text-amber-900 dark:text-amber-200"}`}
                            >
                              3. Gửi yêu cầu thanh toán cọc
                            </span>
                            <span
                              className={`${timelineStatusBadgeClass} font-black ${
                                wasEverCollected
                                  ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                                  : "bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30 flex items-center gap-1.5"
                              }`}
                            >
                              {paymentRequestCreated
                                ? "Đã gửi yêu cầu"
                                : "Chưa gửi yêu cầu"}
                            </span>
                          </div>
                          <p
                            className={`text-[11px] leading-relaxed mt-0.5 ${wasEverCollected ? "text-muted" : "text-amber-900/80 dark:text-amber-200/80 font-medium"}`}
                          >
                            {paymentRequestCreated
                                ? `Đã tạo hóa đơn và gửi thông tin thanh toán: ${amountStr}`
                                : "Tạo hóa đơn cọc giữ phòng và gửi QR thanh toán cho khách hàng"}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* B4: Xác nhận thanh toán */}
                    <div className="relative flex gap-3 group">
                      <div className="flex flex-col items-center shrink-0 w-9">
                        <div
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full shadow-xs transition-all ${
                            wasEverCollected
                              ? "bg-emerald-500 text-white ring-4 ring-emerald-500/15"
                              : "bg-slate-100/70 dark:bg-slate-800/50 border border-dashed border-slate-300 dark:border-slate-700 text-slate-400 dark:text-slate-600"
                          }`}
                        >
                          {wasEverCollected ? (
                            <Check size={15} className="stroke-[3]" />
                          ) : (
                            <CircleDashed size={14} />
                          )}
                        </div>
                        {/* Pipe 4 -> 5 */}
                        <div className="flex-1 w-full flex flex-col items-center justify-center my-1 min-h-[30px] relative">
                          <div
                            className={`h-full ${wasEverCollected ? "w-[2px] bg-indigo-500" : "border-l-2 border-dashed border-slate-300 dark:border-slate-700 w-0"}`}
                          />
                          <div
                            className={`absolute top-1/2 -translate-y-1/2 flex items-center justify-center w-4 h-4 rounded-full bg-card border shadow-2xs ${wasEverCollected ? "border-indigo-500/30 text-indigo-600" : "border-slate-300 dark:border-slate-700 text-slate-400 dark:text-slate-500"}`}
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
                              className={wasEverCollected ? timelineStepTitleClass : timelineStepTitleMutedClass}
                            >
                              4. Xác nhận đã thu tiền cọc
                            </span>
                            <span
                              className={`${timelineStatusBadgeClass} ${
                                wasEverCollected
                                  ? "font-black bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                                  : "font-semibold bg-slate-100/70 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 border-slate-200/60 dark:border-slate-800"
                              }`}
                            >
                              {wasEverCollected ? "Đã xác nhận thu" : "Chờ xác nhận thu"}
                            </span>
                          </div>
                          <p
                            className={`text-[11px] leading-relaxed mt-0.5 ${wasEverCollected ? "text-muted" : "text-slate-400/80 dark:text-slate-500/80"}`}
                          >
                            {wasEverCollected
                              ? `Đã xác nhận thu đủ ${amountStr} tiền cọc giữ phòng`
                              : paymentRequestStatus === "PENDING"
                                ? "Đang chờ SePay xác nhận giao dịch"
                                : "Tự động cập nhật khi SePay xác nhận hoặc admin ghi nhận tiền mặt"}
                          </p>
                          {wasEverCollected && (
                            <div className="flex items-center gap-1 text-[10px] font-bold text-muted mt-1.5 pt-1.5 border-t border-border/30 font-mono">
                              <Clock3 size={11} className="text-primary/70" />
                              <span>
                                {(detailDeposit as any).paidAt
                                  ? formatDateTime(
                                      (detailDeposit as any).paidAt,
                                    )
                                  : formatDateTime(detailDeposit.updatedAt)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* B5: Hợp đồng giữ chỗ có hiệu lực */}
                    <div className="relative flex gap-3 group">
                      <div className="flex flex-col items-center shrink-0 w-9">
                        <div
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full shadow-xs transition-all ${
                            wasEverCollected
                              ? "bg-indigo-600 text-white ring-4 ring-indigo-600/15"
                              : "bg-slate-100/70 dark:bg-slate-800/50 border border-dashed border-slate-300 dark:border-slate-700 text-slate-400 dark:text-slate-600"
                          }`}
                        >
                          {wasEverCollected ? (
                            <Check size={15} className="stroke-[3]" />
                          ) : (
                            <CircleDashed size={14} />
                          )}
                        </div>
                        {/* Pipe 5 -> 6 */}
                        <div className="flex-1 w-full flex flex-col items-center justify-center my-1 min-h-[30px] relative">
                          <div
                            className={`h-full ${wasEverCollected ? "w-[2px] bg-indigo-500" : "border-l-2 border-dashed border-slate-300 dark:border-slate-700 w-0"}`}
                          />
                          <div
                            className={`absolute top-1/2 -translate-y-1/2 flex items-center justify-center w-4 h-4 rounded-full bg-card border shadow-2xs ${wasEverCollected ? "border-indigo-500/30 text-indigo-600" : "border-slate-300 dark:border-slate-700 text-slate-400 dark:text-slate-500"}`}
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
                              className={wasEverCollected ? timelineStepTitleClass : timelineStepTitleMutedClass}
                            >
                              5. Phiếu cọc giữ phòng có hiệu lực
                            </span>
                            <span
                              className={`${timelineStatusBadgeClass} ${
                                wasEverCollected
                                  ? "font-black bg-indigo-500/10 text-indigo-600 border-indigo-500/20"
                                  : "font-semibold bg-slate-100/70 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 border-slate-200/60 dark:border-slate-800"
                              }`}
                            >
                              {wasEverCollected
                                ? "Đã có hiệu lực"
                                : "Chờ xác nhận thu"}
                            </span>
                          </div>
                          <p
                            className={`text-[11px] leading-relaxed mt-0.5 ${wasEverCollected ? "text-muted" : "text-slate-400/80 dark:text-slate-500/80"}`}
                          >
                            {wasEverCollected
                              ? `Phiếu cọc có hiệu lực, phòng ${detailDeposit.roomCode || ""} đã được giữ chỗ`
                              : "Phiếu cọc sẽ có hiệu lực sau khi xác nhận đủ tiền cọc"}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* B6: Thông báo sắp tới hạn & Lên HĐ chính thức */}
                    {(() => {
                      const isCompleted =
                        isConverted ||
                        isRefunded ||
                        isCancelled;
                      return (
                        <div className="relative flex gap-3 group">
                          <div className="flex flex-col items-center shrink-0 w-9">
                            <div
                              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full shadow-xs transition-all ${
                                isRefunded
                                  ? "bg-amber-500 text-white ring-4 ring-amber-500/20"
                                  : isCancelled
                                    ? "bg-rose-500 text-white ring-4 ring-rose-500/20"
                                    : isConverted
                                      ? "bg-indigo-600 text-white ring-4 ring-indigo-600/15"
                                      : wasEverCollected
                                        ? "bg-sky-500 text-white ring-4 ring-sky-500/20"
                                        : "bg-slate-100/70 dark:bg-slate-800/50 border border-dashed border-slate-300 dark:border-slate-700 text-slate-400 dark:text-slate-600"
                              }`}
                            >
                              {isRefunded ? (
                                <RefreshCcw size={15} />
                              ) : isCancelled ? (
                                <X size={15} />
                              ) : isConverted ? (
                                <ShieldCheck size={16} />
                              ) : wasEverCollected ? (
                                <Clock3 size={15} />
                              ) : (
                                <CircleDashed size={14} />
                              )}
                            </div>
                          </div>
                          <div className="flex-1 min-w-0 pb-0">
                            <div
                              className={`p-2.5 rounded-xl transition-all ${
                                isCompleted || wasEverCollected
                                  ? "bg-surface/50 border border-border/50"
                                  : "bg-slate-50/40 dark:bg-slate-900/20 border border-dashed border-slate-200 dark:border-slate-800/80 opacity-55"
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span
                                  className={isCompleted || wasEverCollected ? timelineStepTitleClass : timelineStepTitleMutedClass}
                                >
                                  {isRefunded
                                    ? "6. Đã hoàn cọc"
                                    : isCancelled
                                      ? "6. Đã hủy phiếu cọc"
                                      : isConverted
                                        ? "6. Đã chuyển sang hợp đồng thuê"
                                        : "6. Theo dõi hạn giữ chỗ"}
                                </span>
                                <span
                                  className={`${timelineStatusBadgeClass} ${
                                    isRefunded
                                      ? "font-black bg-amber-500/10 text-amber-600 border-amber-500/20"
                                      : isCancelled
                                        ? "font-black bg-rose-500/10 text-rose-600 border-rose-500/20"
                                        : isConverted
                                          ? "font-black bg-indigo-500/10 text-indigo-600 border-indigo-500/20"
                                          : wasEverCollected
                                            ? "font-bold bg-sky-500/10 text-sky-600 border-sky-500/20"
                                            : "font-semibold bg-slate-100/70 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 border-slate-200/60 dark:border-slate-800"
                                  }`}
                                >
                                  {isRefunded
                                    ? "Đã hoàn"
                                    : isCancelled
                                      ? "Đã hủy"
                                      : isConverted
                                        ? "Đã chuyển đổi"
                                        : wasEverCollected
                                          ? "Đang hiệu lực"
                                          : "Chờ thu cọc"}
                                </span>
                              </div>
                              <p
                                className={`text-[11px] leading-relaxed mt-0.5 ${isCompleted || wasEverCollected ? "text-muted" : "text-slate-400/80 dark:text-slate-500/80"}`}
                              >
                                {isRefunded
                                  ? "Đã hoàn lại tiền cọc giữ phòng cho khách qua kế toán"
                                  : isCancelled
                                    ? "Phiếu cọc giữ phòng đã bị hủy hoặc thu hồi"
                                    : isConverted
                                      ? `Đã chuyển phiếu cọc sang hợp đồng thuê: ${detailDeposit.contractCode || "Liên kết"}`
                                      : wasEverCollected
                                        ? `Tự động thông báo cho Admin khi cọc giữ phòng sắp tới hạn (${formatDate(detailDeposit.expiredAt)}) để bố trí sắp xếp`
                                        : "Chỉ theo dõi sau khi nhận đủ tiền cọc giữ phòng"}
                              </p>
                              {(isRefunded || isCancelled) && (
                                <div className="flex items-center gap-1 text-[10px] font-bold text-muted mt-1.5 pt-1.5 border-t border-border/30 font-mono">
                                  <Clock3
                                    size={11}
                                    className="text-primary/70"
                                  />
                                  <span>
                                    {formatDateTime(detailDeposit.updatedAt)}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </>
                ) : (
                  /* ========================================================================= */
                  /* --- BRANCH 2: CỌC BẢO ĐẢM HỢP ĐỒNG (5 BƯỚC)                            --- */
                  /* 1. Tạo phiếu HĐ -> 2. Thanh toán tiền cọc -> 3. Đã nhận tiền cọc        --- */
                  /* -> 4. HĐ có hiệu lực -> 5. Lưu giữ cọc hợp đồng                        --- */
                  /* ========================================================================= */
                  <>
                    {/* B1: Tạo phiếu HĐ */}
                    <div className="relative flex gap-3 group">
                      <div className="flex flex-col items-center shrink-0 w-9">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white shadow-xs ring-4 ring-emerald-500/15">
                          <Check size={15} className="stroke-[3]" />
                        </div>
                        {/* Pipe 1 -> 2 */}
                        <div className="flex-1 w-full flex flex-col items-center justify-center my-1 min-h-[30px] relative">
                          <div
                            className={`h-full ${wasEverCollected ? "w-[2px] bg-emerald-500" : "w-[2px] bg-gradient-to-b from-emerald-500 to-amber-500"}`}
                          />
                          <div
                            className={`absolute top-1/2 -translate-y-1/2 flex items-center justify-center w-4 h-4 rounded-full bg-card border shadow-2xs ${wasEverCollected ? "border-emerald-500/30 text-emerald-600" : "border-amber-500/40 text-amber-600"}`}
                          >
                            <ChevronDown
                              size={10}
                              className={`stroke-[2.5] ${!wasEverCollected ? "animate-bounce" : ""}`}
                            />
                          </div>
                        </div>
                      </div>
                      <div className="flex-1 min-w-0 pb-3">
                        <div className="p-2.5 rounded-xl bg-surface/50 border border-border/50">
                          <div className="flex items-center justify-between gap-2">
                            <span className={timelineStepTitleClass}>
                              1. Tạo phiếu HĐ
                            </span>
                            <span className={`${timelineStatusBadgeClass} font-black bg-emerald-500/10 text-emerald-600 border-emerald-500/20`}>
                              Đã tạo
                            </span>
                          </div>
                          <p className="text-[11px] text-muted leading-relaxed mt-0.5">
                            Cọc bảo đảm gắn liền với Hợp đồng thuê{" "}
                            {detailDeposit.contractCode
                              ? `(${detailDeposit.contractCode})`
                              : ""}
                          </p>
                          <div className="flex items-center gap-1 text-[10px] font-bold text-muted mt-1.5 pt-1.5 border-t border-border/30 font-mono">
                            <Clock3 size={11} className="text-primary/70" />
                            <span>
                              {formatDateTime(detailDeposit.createdAt)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* B2: Thanh toán tiền cọc */}
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
                          {wasEverCollected ? (
                            <Check size={15} className="stroke-[3]" />
                          ) : (
                            <Banknote size={15} className="animate-pulse" />
                          )}
                        </div>
                        {/* Pipe 2 -> 3 */}
                        <div className="flex-1 w-full flex flex-col items-center justify-center my-1 min-h-[30px] relative">
                          <div
                            className={`h-full ${wasEverCollected ? "w-[2px] bg-emerald-500" : "border-l-2 border-dashed border-slate-300 dark:border-slate-700 w-0"}`}
                          />
                          <div
                            className={`absolute top-1/2 -translate-y-1/2 flex items-center justify-center w-4 h-4 rounded-full bg-card border shadow-2xs ${wasEverCollected ? "border-emerald-500/30 text-emerald-600" : "border-slate-300 dark:border-slate-700 text-slate-400 dark:text-slate-500"}`}
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
                            <span
                              className={`min-w-0 flex-1 truncate text-xs font-black ${wasEverCollected ? "text-text" : "text-amber-900 dark:text-amber-200"}`}
                            >
                              2. Thanh toán tiền cọc
                            </span>
                            <span
                              className={`${timelineStatusBadgeClass} font-black ${
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
                              {wasEverCollected
                                ? "Đã thanh toán"
                                : "Chờ thanh toán"}
                            </span>
                          </div>
                          <p
                            className={`text-[11px] leading-relaxed mt-0.5 ${wasEverCollected ? "text-muted" : "text-amber-900/80 dark:text-amber-200/80 font-medium"}`}
                          >
                            {wasEverCollected
                              ? `Đã thanh toán qua hóa đơn kèm tiền phòng & dịch vụ`
                              : "Hóa đơn (Tiền phòng tháng + Tiền cọc HĐ + Tiền nước) và thông tin thanh toán đã gửi tới Zalo bot khách hàng"}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* B3: Đã nhận tiền cọc */}
                    <div className="relative flex gap-3 group">
                      <div className="flex flex-col items-center shrink-0 w-9">
                        <div
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full shadow-xs transition-all ${
                            wasEverCollected
                              ? "bg-emerald-500 text-white ring-4 ring-emerald-500/15"
                              : "bg-slate-100/70 dark:bg-slate-800/50 border border-dashed border-slate-300 dark:border-slate-700 text-slate-400 dark:text-slate-600"
                          }`}
                        >
                          {wasEverCollected ? (
                            <Check size={15} className="stroke-[3]" />
                          ) : (
                            <CircleDashed size={14} />
                          )}
                        </div>
                        {/* Pipe 3 -> 4 */}
                        <div className="flex-1 w-full flex flex-col items-center justify-center my-1 min-h-[30px] relative">
                          <div
                            className={`h-full ${wasEverCollected ? "w-[2px] bg-indigo-500" : "border-l-2 border-dashed border-slate-300 dark:border-slate-700 w-0"}`}
                          />
                          <div
                            className={`absolute top-1/2 -translate-y-1/2 flex items-center justify-center w-4 h-4 rounded-full bg-card border shadow-2xs ${wasEverCollected ? "border-indigo-500/30 text-indigo-600" : "border-slate-300 dark:border-slate-700 text-slate-400 dark:text-slate-500"}`}
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
                              className={wasEverCollected ? timelineStepTitleClass : timelineStepTitleMutedClass}
                            >
                              3. Đã nhận tiền cọc
                            </span>
                            <span
                              className={`${timelineStatusBadgeClass} ${
                                wasEverCollected
                                  ? "font-black bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                                  : "font-semibold bg-slate-100/70 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 border-slate-200/60 dark:border-slate-800"
                              }`}
                            >
                              {wasEverCollected ? "Đã nhận đủ" : "Chờ thu tiền"}
                            </span>
                          </div>
                          <p
                            className={`text-[11px] leading-relaxed mt-0.5 ${wasEverCollected ? "text-muted" : "text-slate-400/80 dark:text-slate-500/80"}`}
                          >
                            {wasEverCollected
                              ? `Đã nhận đủ số tiền cọc bảo đảm hợp đồng: ${amountStr}`
                              : "Chưa nhận được tiền cọc bảo đảm (thường thanh toán kèm tiền phòng khi khách nhận phòng lần đầu)"}
                          </p>
                          {wasEverCollected && (
                            <div className="flex items-center gap-1 text-[10px] font-bold text-muted mt-1.5 pt-1.5 border-t border-border/30 font-mono">
                              <Clock3 size={11} className="text-primary/70" />
                              <span>
                                {(detailDeposit as any).paidAt
                                  ? formatDateTime(
                                      (detailDeposit as any).paidAt,
                                    )
                                  : formatDateTime(detailDeposit.updatedAt)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* B4: HĐ có hiệu lực */}
                    <div className="relative flex gap-3 group">
                      <div className="flex flex-col items-center shrink-0 w-9">
                        <div
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full shadow-xs transition-all ${
                            wasEverCollected
                              ? "bg-indigo-600 text-white ring-4 ring-indigo-600/15"
                              : "bg-slate-100/70 dark:bg-slate-800/50 border border-dashed border-slate-300 dark:border-slate-700 text-slate-400 dark:text-slate-600"
                          }`}
                        >
                          {wasEverCollected ? (
                            <Check size={15} className="stroke-[3]" />
                          ) : (
                            <CircleDashed size={14} />
                          )}
                        </div>
                        {/* Pipe 4 -> 5 */}
                        <div className="flex-1 w-full flex flex-col items-center justify-center my-1 min-h-[30px] relative">
                          <div
                            className={`h-full ${wasEverCollected ? "w-[2px] bg-indigo-500" : "border-l-2 border-dashed border-slate-200 dark:border-slate-800 w-0"}`}
                          />
                          <div
                            className={`absolute top-1/2 -translate-y-1/2 flex items-center justify-center w-4 h-4 rounded-full bg-card border shadow-2xs ${wasEverCollected ? "border-indigo-500/30 text-indigo-600" : "border-slate-200 dark:border-slate-800 text-slate-300 dark:text-slate-600"}`}
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
                              className={wasEverCollected ? timelineStepTitleClass : timelineStepTitleMutedClass}
                            >
                              4. HĐ có hiệu lực
                            </span>
                            <span
                              className={`${timelineStatusBadgeClass} ${
                                wasEverCollected
                                  ? "font-black bg-indigo-500/10 text-indigo-600 border-indigo-500/20"
                                  : "font-semibold bg-slate-100/70 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 border-slate-200/60 dark:border-slate-800"
                              }`}
                            >
                              {wasEverCollected
                                ? "Có hiệu lực"
                                : "Chờ kích hoạt"}
                            </span>
                          </div>
                          <p
                            className={`text-[11px] leading-relaxed mt-0.5 ${wasEverCollected ? "text-muted" : "text-slate-400/80 dark:text-slate-500/80"}`}
                          >
                            {wasEverCollected
                              ? `Hợp đồng thuê ${detailDeposit.contractCode || "liên kết"} chính thức có hiệu lực pháp lý`
                              : "Sẽ kích hoạt đầy đủ hiệu lực hợp đồng ngay sau khi hoàn tất thu tiền cọc"}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* B5: Lưu giữ cọc hợp đồng (Bước cuối cùng không có pipe) */}
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
                              className={
                                wasEverCollected || isRefunded || isCancelled
                                  ? timelineStepTitleClass
                                  : timelineStepTitleMutedClass
                              }
                            >
                              {isRefunded
                                ? "5. Đã hoàn cọc khi thanh lý HĐ"
                                : isCancelled
                                  ? "5. Đã hủy / Phạt cọc"
                                  : wasEverCollected
                                    ? "5. Lưu giữ cọc hợp đồng"
                                    : "5. Lưu giữ cọc hợp đồng"}
                            </span>
                            <span
                              className={`${timelineStatusBadgeClass} ${
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
                            className={`text-[11px] leading-relaxed mt-0.5 ${wasEverCollected || isRefunded || isCancelled ? "text-muted" : "text-slate-400/80 dark:text-slate-500/80"}`}
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
                              <span>
                                {formatDateTime(detailDeposit.updatedAt)}
                              </span>
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
        testId="deposit-refund-modal"
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
              data-testid="deposit-refund-submit"
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
            <span className="font-black text-amber-700 dark:text-amber-400 text-sm">
              {amountStr}
            </span>
          </div>

          <div>
            <label className="text-xs font-bold text-text block mb-1">
              Số tiền hoàn lại cho khách (VNĐ){" "}
              <span className="text-rose-500">*</span>
            </label>
            <Input
              data-testid="deposit-refund-amount"
              type="number"
              min="1000"
              max={availableBalance}
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
              data-testid="deposit-refund-reason"
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
              data-testid="deposit-refund-status"
              value={refundReceiptStatus}
              onChange={(e) => setRefundReceiptStatus(e.target.value as any)}
              options={[
                {
                  label: "Đã chi tiền ngay cho khách (Phiếu chi Hoàn tất)",
                  value: "COMPLETED",
                },
                {
                  label:
                    "Tạo phiếu chi chờ thủ quỹ duyệt chuyển tiền (Phiếu chi Chờ xử lý)",
                  value: "PENDING",
                },
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
        testId="deposit-cancel-modal"
        isOpen={isCancelModalOpen}
        onClose={() => {
          if (cancelMutation.isPending || cancelUnpaidMutation.isPending) return;
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
              disabled={cancelMutation.isPending || cancelUnpaidMutation.isPending}
            >
              Đóng
            </Button>
            <Button
              data-testid="deposit-cancel-submit"
              size="sm"
              className="bg-rose-500 hover:bg-rose-600 text-white font-bold"
              onClick={submitCancel}
              isLoading={cancelMutation.isPending || cancelUnpaidMutation.isPending}
            >
              Xác nhận hủy phiếu
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-700 dark:text-rose-300 leading-relaxed">
            <AlertTriangle
              size={15}
              className="shrink-0 mt-0.5 text-rose-500"
            />
            <div>
              Hành động hủy phiếu đặt cọc <b>{detailDeposit.code}</b> không thể
              hoàn tác.
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-text block mb-1">
              Lý do hủy phiếu <span className="text-rose-500">*</span>
            </label>
            <textarea
              data-testid="deposit-cancel-reason"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Nhập lý do hủy phiếu đặt cọc..."
              className="w-full min-h-[75px] rounded-xl border border-border bg-card p-3 text-xs text-text outline-none focus:border-primary transition-colors"
            />
          </div>

          {isPaid && (
            <>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-border">
                <div className="flex justify-between items-center mb-3 pb-2 border-b border-border">
                  <span className="text-xs font-bold text-text">
                    Số tiền có thể xử lý:
                  </span>
                  <span className="text-sm font-bold text-primary">
                    {formatCurrency(
                      availableBalance,
                    )}{" "}
                    VNĐ
                  </span>
                </div>

                <div className="space-y-3">
                  <div>
                    <label htmlFor="cancelRefundAmount" className="text-xs font-medium text-text block mb-1">
                      Hoàn lại cho khách (VNĐ)
                    </label>
                    <Input
                      data-testid="deposit-cancel-refund-amount"
                      id="cancelRefundAmount"
                      type="number"
                      min="0"
                      value={cancelRefundAmount}
                      onChange={(e) => setCancelRefundAmount(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label htmlFor="cancelKeepAmount" className="text-xs font-medium text-text block mb-1">
                      Phạt / Giữ lại (VNĐ)
                    </label>
                    <Input
                      data-testid="deposit-cancel-keep-amount"
                      id="cancelKeepAmount"
                      type="number"
                      min="0"
                      value={cancelKeepAmount}
                      onChange={(e) => setCancelKeepAmount(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label htmlFor="cancelDeductAmount" className="text-xs font-medium text-text block mb-1">
                      Khấu trừ chi phí khác (VNĐ)
                    </label>
                    <Input
                      data-testid="deposit-cancel-deduct-amount"
                      id="cancelDeductAmount"
                      type="number"
                      min="0"
                      value={cancelDeductAmount}
                      onChange={(e) => setCancelDeductAmount(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>

              {Number(cancelRefundAmount) > 0 && (
                <div>
                  <label htmlFor="cancelReceiptStatus" className="text-xs font-bold text-text block mb-1">
                    Trạng thái chi tiền hoàn
                  </label>
                  <Select
                    data-testid="deposit-cancel-refund-status"
                    id="cancelReceiptStatus"
                    value={cancelReceiptStatus}
                    onChange={(e) =>
                      setCancelReceiptStatus(e.target.value as any)
                    }
                    options={[
                      {
                        label: "Đã chi tiền ngay cho khách (Hoàn tất)",
                        value: "COMPLETED",
                      },
                      {
                        label: "Tạo lệnh hoàn chờ xử lý (Kế toán duyệt)",
                        value: "PENDING",
                      },
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
        testId="deposit-convert-modal"
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
              data-testid="deposit-convert-submit"
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
        <div className="flex flex-col gap-4 text-xs leading-relaxed">
          <p className="text-text">
            Chuyển phiếu cọc <b>{detailDeposit.code}</b> của{" "}
            <b>{detailDeposit.customerName}</b> sang trạng thái{" "}
            <b>Đã lên hợp đồng</b>.
          </p>

          <div className="space-y-3">
            <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-border">
              <span className="font-bold">Tiền cọc hiện có:</span>
              <span className="text-primary font-bold text-sm">
                {formatCurrency(
                  availableBalance,
                )}{" "}
                VNĐ
              </span>
            </div>

            <div>
              <label className="text-xs font-bold text-text block mb-1">
                Tiền cọc bảo đảm theo Hợp đồng mới (VNĐ){" "}
                <span className="text-rose-500">*</span>
              </label>
              <Input
                data-testid="deposit-convert-security-required"
                type="number"
                min="0"
                value={convertSecurityRequired}
                onChange={(e) => setConvertSecurityRequired(e.target.value)}
                placeholder="Nhập tiền cọc bảo đảm..."
              />
            </div>

            {(() => {
              const available = availableBalance;
              if (available === undefined) return null;
              const required = Number(convertSecurityRequired) || 0;
              if (required < available) {
                return (
                  <div>
                    <label className="text-xs font-bold text-text block mb-1">
                      Xử lý phần tiền cọc dư (
                      {formatCurrency(available - required)} VNĐ)
                    </label>
                    <Select
                      data-testid="deposit-convert-excess-action"
                      value={convertExcessAction}
                      onChange={(e) =>
                        setConvertExcessAction(e.target.value as any)
                      }
                      options={[
                        {
                          label: "Ghi có vào dư nợ (Trừ vào tiền nhà)",
                          value: "CREDIT",
                        },
                        {
                          label: "Hoàn lại tiền thừa cho khách",
                          value: "REFUND",
                        },
                      ]}
                    />
                  </div>
                );
              } else if (required > available) {
                return (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300">
                    Khách cần đóng thêm{" "}
                    <b>{formatCurrency(required - available)} VNĐ</b>.
                  </div>
                );
              }
              return null;
            })()}
          </div>
        </div>
      </Modal>

      {/* --- SUB-MODAL 4: XÁC NHẬN HOÀN TẤT CHI TIỀN HOÀN CỌC --- */}
      <Modal
        testId="deposit-complete-refund-modal"
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
              data-testid="deposit-complete-refund-submit"
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
            Xác nhận rằng phiếu chi hoàn cọc cho khách hàng đã được hoàn tất
            thanh toán.
          </p>
          <div>
            <label className="text-xs font-bold text-text block mb-1">
              Ghi chú / Mã giao dịch ngân hàng
            </label>
            <Input
              data-testid="deposit-complete-refund-note"
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
