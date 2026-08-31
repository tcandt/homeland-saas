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
import { Drawer } from "../ui/Drawer";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
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

function promptResolutionAction(): DepositResolutionAction | null {
  const action = window
    .prompt(
      "Chọn cách xử lý cọc đã thu: REFUND = hoàn cọc, KEEP = giữ cọc, DEDUCT = khấu trừ phí.",
      "REFUND",
    )
    ?.trim()
    .toUpperCase();

  if (!action) return null;
  if (action === "REFUND" || action === "KEEP" || action === "DEDUCT") return action;

  window.alert("Giá trị không hợp lệ. Chỉ dùng REFUND, KEEP hoặc DEDUCT.");
  return null;
}

function promptResolutionAmount(action: DepositResolutionAction, totalAmount: number) {
  const labels: Record<DepositResolutionAction, string> = {
    REFUND: "Số tiền hoàn cho khách",
    KEEP: "Số tiền giữ lại theo chính sách",
    DEDUCT: "Số tiền khấu trừ từ cọc",
  };

  const input = window.prompt(
    `${labels[action]}? Tối đa ${currencyFormatter.format(totalAmount)} VND.`,
    String(totalAmount),
  );
  if (input === null) return null;

  const parsedAmount = Number(String(input).replace(/[^\d.-]/g, "").trim());
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0 || parsedAmount > totalAmount) {
    window.alert("Số tiền không hợp lệ.");
    return null;
  }

  return parsedAmount;
}

export default function OperationsDepositDrawer({
  deposit,
  onClose,
}: {
  deposit: UI_Deposit | null;
  onClose: () => void;
}) {
  const detailQuery = useDepositDetailQuery(deposit?.id ?? null);
  const detailDeposit = detailQuery.data?.data || deposit;

  const collectMutation = useCollectDepositMutation();
  const refundMutation = useRefundDepositMutation();
  const completePendingRefundMutation = useCompletePendingDepositRefundMutation();
  const convertMutation = useConvertContractMutation();
  const cancelMutation = useCancelDepositMutation();
  const [refundAttachmentInput, setRefundAttachmentInput] = useState("");
  const [showQrModal, setShowQrModal] = useState(false);

  if (!detailDeposit) return null;

  const amount = Number(detailDeposit.amount || 0);
  const amountStr = formatCurrency(amount);
  const isPaid = detailDeposit.status === "PAID";
  const isConverted = detailDeposit.status === "CONVERTED_TO_CONTRACT";
  const isRefunded = detailDeposit.status === "REFUNDED";
  const isCancelled = detailDeposit.status === "CANCELLED";
  const refundSummary = detailDeposit.refundSummary;
  const refundPending = !!refundSummary?.pending;
  const attachmentUrls = parseAttachmentUrls(refundAttachmentInput);

  const typeName =
    detailDeposit.type === "BOOKING"
      ? "giữ phòng"
      : detailDeposit.type === "SECURITY"
        ? "bảo đảm"
        : "giữ chỗ";

  const handleCollect = () => {
    collectMutation.mutate({ id: detailDeposit.id });
  };

  const handleRefundFlow = () => {
    const reason = window.prompt("Lý do hoàn cọc?");
    if (!reason) return;

    const amountInput = window.prompt(
      "Số tiền hoàn lại cho khách? Để trống hoặc 0 để hoàn toàn bộ.",
      String(amount),
    );
    const parsedAmount = Number(String(amountInput || "").trim() || amount);
    const refundAmount = Number.isFinite(parsedAmount) && parsedAmount > 0 ? parsedAmount : amount;
    const completeNow = window.confirm(
      "Đã chuyển tiền ngay cho khách? Chọn OK nếu đã hoàn tất, Cancel nếu chỉ tạo phiếu chi để xử lý sau.",
    );

    refundMutation.mutate({
      id: detailDeposit.id,
      reason,
      receiptStatus: completeNow ? "COMPLETED" : "PENDING",
      attachmentUrls,
      refundAmount,
    });
  };

  const handleCompletePendingRefund = () => {
    const note = window.prompt("Ghi chú xác nhận hoàn tiền / mã giao dịch?");
    completePendingRefundMutation.mutate({ id: detailDeposit.id, note: note || undefined });
  };

  const handleCancel = () => {
    const reason = window.prompt("Lý do hủy phiếu cọc?");
    if (!reason) return;

    if (!isPaid) {
      cancelMutation.mutate({ id: detailDeposit.id, reason });
      return;
    }

    const resolutionAction = promptResolutionAction();
    if (!resolutionAction) return;

    const resolutionAmount = promptResolutionAmount(resolutionAction, amount);
    if (resolutionAmount === null) return;

    const refundableAmount =
      resolutionAction === "REFUND" ? resolutionAmount : Math.max(amount - resolutionAmount, 0);
    const receiptStatus =
      refundableAmount > 0
        ? window.confirm(
            "Phần tiền hoàn lại đã được chi ngay? Chọn OK nếu đã hoàn tất, Cancel nếu cần tạo phiếu chi chờ xử lý.",
          )
          ? "COMPLETED"
          : "PENDING"
        : undefined;

    cancelMutation.mutate({
      id: detailDeposit.id,
      reason,
      resolutionAction,
      resolutionAmount,
      receiptStatus,
      attachmentUrls,
    });
  };

  const handleConvert = () => {
    if (window.confirm("Bạn có chắc muốn chuyển cọc này thành hợp đồng?")) {
      convertMutation.mutate(detailDeposit.id, {
        onSuccess: () => {
          window.alert("Đã chuyển thành hợp đồng thành công.");
          onClose();
        },
      });
    }
  };

  return (
    <Drawer
      testId="deposit-detail-drawer"
      closeTestId="deposit-detail-close"
      isOpen={!!detailDeposit}
      onClose={onClose}
      size="xl"
      title={
        <div className="flex items-center gap-[12px]">
          <h2 className="text-[20px] font-black text-text">Chi tiết đặt cọc</h2>
          <span className="rounded-[6px] border border-[#6366f1]/20 bg-[#6366f1]/10 px-[10px] py-[4px] text-[14px] font-black text-[#6366f1]">
            {detailDeposit.code}
          </span>
        </div>
      }
      footer={
        <div className="flex w-full items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-[12px]">
            <Button
              type="button"
              onClick={() => setShowQrModal(true)}
              variant="outline"
              className="border-[#0ea5e9]/30 text-[#0ea5e9] hover:bg-[#0ea5e9]/10 font-bold"
            >
              <QrCode size={16} className="mr-2" /> Mã VietQR / Gửi Zalo
            </Button>
            <Button variant="ghost">
              <Printer size={16} className="mr-2 text-muted" /> In phiếu
            </Button>
          </div>
          <div className="flex items-center gap-[12px]">
            {(detailDeposit.status === "DRAFT" ||
              detailDeposit.status === "PENDING" ||
              isPaid) && (
              <Button
                data-testid="deposit-action-cancel"
                onClick={handleCancel}
                disabled={cancelMutation.isPending}
                variant="ghost"
                className="text-muted hover:bg-rose-500/10 hover:text-rose-500"
              >
                {cancelMutation.isPending ? (
                  <Loader2 size={16} className="mr-2 animate-spin" />
                ) : isPaid ? (
                  <ShieldMinus size={16} className="mr-2" />
                ) : (
                  <X size={16} className="mr-2" />
                )}
                {isPaid ? "Hủy và xử lý cọc" : "Hủy phiếu"}
              </Button>
            )}
            {(isConverted || isPaid) && (
              <Button
                data-testid="deposit-action-refund"
                onClick={handleRefundFlow}
                disabled={refundMutation.isPending}
                className="bg-rose-500/10 text-rose-500 hover:bg-rose-500/20"
              >
                {refundMutation.isPending ? (
                  <Loader2 size={16} className="mr-2 animate-spin" />
                ) : (
                  <RefreshCcw size={16} className="mr-2" />
                )}
                Hoàn cọc
              </Button>
            )}
            {refundPending && (
              <Button
                data-testid="deposit-action-complete-refund"
                onClick={handleCompletePendingRefund}
                disabled={completePendingRefundMutation.isPending}
                className="bg-amber-500/10 text-amber-600 hover:bg-amber-500/20"
              >
                {completePendingRefundMutation.isPending ? (
                  <Loader2 size={16} className="mr-2 animate-spin" />
                ) : (
                  <CheckCircle2 size={16} className="mr-2" />
                )}
                Xác nhận đã hoàn
              </Button>
            )}
            {(detailDeposit.status === "PENDING" || detailDeposit.status === "DRAFT") && (
              <Button
                data-testid="deposit-action-collect"
                onClick={handleCollect}
                disabled={collectMutation.isPending}
                className="bg-[#8b5cf6] text-white hover:bg-[#6366f1]"
              >
                {collectMutation.isPending ? (
                  <Loader2 size={16} className="mr-2 animate-spin" />
                ) : (
                  <Banknote size={16} className="mr-2" />
                )}
                Thu tiền cọc
              </Button>
            )}
            {isPaid && (
              <Button
                data-testid="deposit-action-convert"
                onClick={handleConvert}
                disabled={convertMutation.isPending}
                variant="primary"
              >
                {convertMutation.isPending ? (
                  <Loader2 size={16} className="mr-2 animate-spin" />
                ) : (
                  <PenTool size={16} className="mr-2" />
                )}
                Lên hợp đồng
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-[24px]">
        <Card className="flex flex-col gap-[16px] p-[20px]">
          <div className="flex items-start justify-between gap-[16px]">
            <div className="flex flex-col gap-[8px]">
              <h3 className="text-[22px] font-black leading-tight text-text">
                {detailDeposit.customerName}
              </h3>
              <div className="flex flex-wrap items-center gap-[8px]">
                <span className="rounded-[6px] bg-black/5 px-[8px] py-[4px] text-[12px] font-bold dark:bg-white/5">
                  {detailDeposit.roomCode} · {detailDeposit.buildingName}
                </span>
                <span
                  className={`rounded-[6px] border px-[8px] py-[4px] text-[11px] font-black uppercase ${
                    detailDeposit.type === "SECURITY"
                      ? "border-[#8b5cf6]/20 bg-[#8b5cf6]/10 text-[#8b5cf6]"
                      : "border-[#0ea5e9]/20 bg-[#0ea5e9]/10 text-[#0ea5e9]"
                  }`}
                >
                  Cọc {typeName}
                </span>
                <span
                  data-testid="deposit-status-badge"
                  className="rounded-[6px] border border-border bg-black/5 px-[8px] py-[4px] text-[11px] font-black uppercase text-muted dark:bg-white/5"
                >
                  {detailDeposit.status}
                </span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-[4px] text-right">
              <span className="text-[12px] font-bold uppercase tracking-wider text-muted">
                Cập nhật gần nhất
              </span>
              <div className="flex items-center gap-[6px] text-[14px] font-black text-text">
                <Clock3 size={16} className="text-[#6366f1]" />
                {formatDateTime(detailDeposit.updatedAt || detailDeposit.createdAt)}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-[16px] border-t border-border/50 pt-[16px] md:grid-cols-4">
            <div className="flex flex-col gap-[4px]">
              <span className="text-[11px] font-bold uppercase text-muted">Số tiền cọc</span>
              <span className="text-[15px] font-black text-text">{amountStr}</span>
            </div>
            <div className="flex flex-col gap-[4px]">
              <span className="text-[11px] font-bold uppercase text-muted">Đã thu</span>
              <span className="text-[15px] font-black text-[#8b5cf6]">
                {isPaid || isConverted ? amountStr : "0đ"}
              </span>
            </div>
            <div className="flex flex-col gap-[4px]">
              <span className="text-[11px] font-bold uppercase text-muted">Ngày tạo</span>
              <span className="text-[14px] font-bold text-text">
                {formatDate(detailDeposit.createdAt)}
              </span>
            </div>
            <div className="flex flex-col gap-[4px]">
              <span className="text-[11px] font-bold uppercase text-muted">Hạn giữ cọc</span>
              <span className="text-[14px] font-bold text-text">
                {formatDate(detailDeposit.expiredAt)}
              </span>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 gap-[24px] lg:grid-cols-2">
          <Card className="flex flex-col gap-[16px] p-[20px]">
            <h4 className="flex items-center gap-2 border-b border-border/50 pb-3 text-[15px] font-black text-text">
              <FileText size={16} className="text-[#6366f1]" /> Ghi chú và trạng thái
            </h4>
            <div className="flex flex-col gap-[12px]">
              <div className="flex items-center justify-between rounded-[10px] bg-black/5 p-[12px] dark:bg-white/5">
                <span className="text-[13px] font-bold text-muted">Khách hàng</span>
                <span className="text-[13px] font-semibold text-text">
                  {detailDeposit.customerPhone}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-[10px] bg-black/5 p-[12px] dark:bg-white/5">
                <span className="text-[13px] font-bold text-muted">Trạng thái hiện tại</span>
                <span className="text-[13px] font-black text-text">{detailDeposit.status}</span>
              </div>
              <div className="rounded-[10px] bg-black/5 p-[12px] dark:bg-white/5">
                <div className="mb-[8px] text-[13px] font-bold text-muted">Ghi chú</div>
                <div className="whitespace-pre-wrap text-[13px] font-semibold text-text">
                  {detailDeposit.note || "Không có ghi chú"}
                </div>
              </div>
              <div className="flex flex-col gap-[8px] rounded-[10px] bg-black/5 p-[12px] dark:bg-white/5">
                <span className="text-[13px] font-bold text-muted">Chứng từ hoàn cọc</span>
                <textarea
                  value={refundAttachmentInput}
                  onChange={(event) => setRefundAttachmentInput(event.target.value)}
                  placeholder="Nhập URL chứng từ, ngăn cách bằng dấu phẩy hoặc xuống dòng"
                  className="min-h-[84px] rounded-[10px] border border-border bg-card px-3 py-2 text-[13px] text-text outline-none"
                />
                <span className="text-[11px] font-medium text-muted">
                  Được gửi kèm khi tạo phiếu hoàn hoặc hủy cọc có phát sinh hoàn tiền.
                </span>
              </div>
              {refundSummary ? (
                <div className="flex flex-col gap-[8px] rounded-[10px] border border-amber-500/20 bg-amber-500/10 p-[12px]">
                  <span className="text-[13px] font-bold text-amber-700">
                    Theo dõi phiếu hoàn cọc
                  </span>
                  <div className="flex items-center justify-between gap-[12px] text-[13px]">
                    <span className="text-muted">Mã phiếu</span>
                    <span className="font-black text-text">
                      {refundSummary.receiptCode || "Chưa có"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-[12px] text-[13px]">
                    <span className="text-muted">Trạng thái</span>
                    <span className="font-black text-text">
                      {refundSummary.taskStatus || refundSummary.receiptStatus || "-"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-[12px] text-[13px]">
                    <span className="text-muted">Số tiền</span>
                    <span className="font-black text-text">
                      {formatCurrency(refundSummary.receiptAmount)}
                    </span>
                  </div>
                  {refundSummary.receiptDescription ? (
                    <div className="rounded-[8px] bg-white/60 p-[10px] text-[12px] text-text dark:bg-black/10">
                      {refundSummary.receiptDescription}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </Card>

          <Card className="flex flex-col gap-[16px] p-[20px]">
            <h4 className="flex items-center gap-2 border-b border-border/50 pb-3 text-[15px] font-black text-text">
              <RefreshCcw size={16} className="text-[#f97316]" /> Mốc xử lý
            </h4>
            <div className="relative mt-[8px] flex flex-col gap-[0px]">
              <div className="absolute bottom-[20px] left-[15px] top-[10px] w-[2px] bg-border" />

              <div className="relative z-10 flex gap-[16px] pb-[24px]">
                <div className="flex h-[32px] w-[32px] shrink-0 items-center justify-center rounded-full border-[4px] border-card bg-[#8b5cf6]">
                  <CheckCircle2 size={14} className="text-white" />
                </div>
                <div className="flex flex-col gap-[4px] pt-[6px]">
                  <span className="text-[13px] font-bold leading-none text-text">
                    Tạo phiếu cọc
                  </span>
                  <span className="text-[11px] text-muted">
                    {formatDateTime(detailDeposit.createdAt)}
                  </span>
                </div>
              </div>

              <div className="relative z-10 flex gap-[16px] pb-[24px]">
                <div
                  className={`flex h-[32px] w-[32px] shrink-0 items-center justify-center rounded-full border-[4px] border-card ${
                    isPaid || isConverted ? "bg-[#8b5cf6]" : "bg-black/10 dark:bg-white/10"
                  }`}
                >
                  {isPaid || isConverted ? (
                    <CheckCircle2 size={14} className="text-white" />
                  ) : (
                    <div className="h-[8px] w-[8px] rounded-full bg-muted" />
                  )}
                </div>
                <div className="flex flex-col gap-[4px] pt-[6px]">
                  <span
                    className={`text-[13px] font-bold leading-none ${
                      isPaid || isConverted ? "text-text" : "text-muted"
                    }`}
                  >
                    Đã thu / đã xác nhận
                  </span>
                  <span className="text-[11px] text-muted">
                    {isPaid || isConverted
                      ? `${amountStr} · ${formatDateTime(detailDeposit.updatedAt)}`
                      : "Chưa thu"}
                  </span>
                </div>
              </div>

              <div className="relative z-10 flex gap-[16px] pb-[24px]">
                <div
                  className={`flex h-[32px] w-[32px] shrink-0 items-center justify-center rounded-full border-[4px] border-card ${
                    isConverted ? "bg-[#8b5cf6]" : "bg-black/10 dark:bg-white/10"
                  }`}
                >
                  {isConverted ? (
                    <CheckCircle2 size={14} className="text-white" />
                  ) : (
                    <div className="h-[8px] w-[8px] rounded-full bg-muted" />
                  )}
                </div>
                <div className="flex flex-col gap-[4px] pt-[6px]">
                  <span
                    className={`text-[13px] font-bold leading-none ${
                      isConverted ? "text-text" : "text-muted"
                    }`}
                  >
                    Chuyển thành hợp đồng
                  </span>
                  <span className="text-[11px] text-muted">
                    {isConverted ? "Đã chuyển thành hợp đồng" : "Chưa chuyển"}
                  </span>
                </div>
              </div>

              <div className="relative z-10 flex gap-[16px]">
                <div
                  className={`flex h-[32px] w-[32px] shrink-0 items-center justify-center rounded-full border-[4px] border-card ${
                    isRefunded || isCancelled ? "bg-rose-500" : "bg-black/10 dark:bg-white/10"
                  }`}
                >
                  {isRefunded || isCancelled ? (
                    <RefreshCcw size={14} className="text-white" />
                  ) : (
                    <div className="h-[8px] w-[8px] rounded-full bg-muted" />
                  )}
                </div>
                <div className="flex flex-col gap-[4px] pt-[6px]">
                  <span
                    className={`text-[13px] font-bold leading-none ${
                      isRefunded || isCancelled ? "text-rose-500" : "text-muted"
                    }`}
                  >
                    Hoàn tiền / hủy phiếu
                  </span>
                  <span className="text-[11px] text-muted">
                    {isRefunded || isCancelled
                      ? formatDateTime(detailDeposit.updatedAt)
                      : "Chưa xử lý"}
                  </span>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <DepositQrModal
        isOpen={showQrModal}
        onClose={() => setShowQrModal(false)}
        deposit={detailDeposit}
      />
    </Drawer>
  );
}
