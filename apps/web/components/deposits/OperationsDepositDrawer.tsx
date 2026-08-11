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

  if (!detailDeposit) return null;

  const handleCollect = () => {
    collectMutation.mutate({ id: detailDeposit.id });
  };

  const handleRefund = () => {
    const reason = window.prompt("Lý do hoàn tiền?");
    if (reason) refundMutation.mutate({ id: detailDeposit.id, reason });
  };

  const handleRefundFlow = () => {
    const reason = window.prompt("Ly do hoan tien / hoan coc?");
    if (!reason) return;
    const completeNow = window.confirm("Da chuyen tien ngay cho khach? Chon OK neu da hoan tat, Cancel neu chi tao phieu chi cho xu ly sau.");
    const attachmentUrls = refundAttachmentInput
      .split(/\r?\n|,/)
      .map((item) => item.trim())
      .filter(Boolean);
    refundMutation.mutate({
      id: detailDeposit.id,
      reason,
      receiptStatus: completeNow ? "COMPLETED" : "PENDING",
      attachmentUrls,
    });
  };

  const handleCompletePendingRefund = () => {
    const note = window.prompt("Ghi chu xac nhan hoan tien / ma giao dich?");
    completePendingRefundMutation.mutate({ id: detailDeposit.id, note: note || undefined });
  };

  const handleCancel = () => {
    const reason = window.prompt("Lý do hủy phiếu cọc?");
    if (reason) cancelMutation.mutate({ id: detailDeposit.id, reason });
  };

  const handleConvert = () => {
    if (window.confirm("Bạn có chắc muốn chuyển cọc này thành hợp đồng?")) {
      convertMutation.mutate(detailDeposit.id, {
        onSuccess: () => {
          window.alert("Đã chuyển thành hợp đồng thành công!");
          onClose();
        },
      });
    }
  };

  const amountStr = new Intl.NumberFormat("vi-VN").format(detailDeposit.amount);
  const typeName =
    detailDeposit.type === "BOOKING" ? "Giữ phòng" : detailDeposit.type === "SECURITY" ? "Bảo đảm" : "Giữ chỗ";
  const isPaid = detailDeposit.status === "PAID";
  const isConverted = detailDeposit.status === "CONVERTED_TO_CONTRACT";
  const isRefunded = detailDeposit.status === "REFUNDED";
  const isCancelled = detailDeposit.status === "CANCELLED";
  const refundSummary = detailDeposit.refundSummary;
  const refundPending = !!refundSummary?.pending;

  return (
    <Drawer
      testId="deposit-detail-drawer"
      closeTestId="deposit-detail-close"
      isOpen={!!detailDeposit}
      onClose={onClose}
      size="xl"
      title={
        <div className="flex items-center gap-[12px]">
          <h2 className="font-black text-[20px] text-text">Chi tiết đặt cọc</h2>
          <span className="bg-[#6366f1]/10 text-[#6366f1] border border-[#6366f1]/20 font-black text-[14px] px-[10px] py-[4px] rounded-[6px]">
            {detailDeposit.code}
          </span>
        </div>
      }
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-[12px]">
            <Button variant="ghost">
              <Printer size={16} className="mr-2 text-muted" /> In phiếu
            </Button>
          </div>
          <div className="flex items-center gap-[12px]">
            {(detailDeposit.status === "DRAFT" || detailDeposit.status === "PENDING") && (
              <Button
                onClick={handleCancel}
                disabled={cancelMutation.isPending}
                variant="ghost"
                className="text-muted hover:text-rose-500 hover:bg-rose-500/10"
              >
                {cancelMutation.isPending ? (
                  <Loader2 size={16} className="animate-spin mr-2" />
                ) : (
                  <X size={16} className="mr-2" />
                )}
                Hủy phiếu
              </Button>
            )}
            {(isConverted || isPaid) && (
              <Button
                onClick={handleRefundFlow}
                disabled={refundMutation.isPending}
                className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-500"
              >
                {refundMutation.isPending ? (
                  <Loader2 size={16} className="animate-spin mr-2" />
                ) : (
                  <RefreshCcw size={16} className="mr-2" />
                )}
                Hoàn tiền
              </Button>
            )}
            {refundPending && (
              <Button
                onClick={handleCompletePendingRefund}
                disabled={completePendingRefundMutation.isPending}
                className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-600"
              >
                {completePendingRefundMutation.isPending ? (
                  <Loader2 size={16} className="animate-spin mr-2" />
                ) : (
                  <CheckCircle2 size={16} className="mr-2" />
                )}
                Xác nhận đã hoàn
              </Button>
            )}
            {(detailDeposit.status === "PENDING" || detailDeposit.status === "DRAFT") && (
              <Button onClick={handleCollect} disabled={collectMutation.isPending} className="bg-[#8b5cf6] hover:bg-[#6366f1] text-white">
                {collectMutation.isPending ? (
                  <Loader2 size={16} className="animate-spin mr-2" />
                ) : (
                  <Banknote size={16} className="mr-2" />
                )}
                Thu tiền cọc
              </Button>
            )}
            {isPaid && (
              <Button onClick={handleConvert} disabled={convertMutation.isPending} variant="primary">
                {convertMutation.isPending ? (
                  <Loader2 size={16} className="animate-spin mr-2" />
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
        <Card className="p-[20px] flex flex-col gap-[16px]">
          <div className="flex items-start justify-between gap-[16px]">
            <div className="flex flex-col gap-[8px]">
              <h3 className="font-black text-[22px] text-text leading-tight">{detailDeposit.customerName}</h3>
              <div className="flex flex-wrap items-center gap-[8px]">
                <span className="text-[12px] font-bold bg-black/5 dark:bg-white/5 px-[8px] py-[4px] rounded-[6px]">
                  {detailDeposit.roomCode} · {detailDeposit.buildingName}
                </span>
                <span
                  className={`text-[11px] font-black uppercase px-[8px] py-[4px] rounded-[6px] border ${
                    detailDeposit.type === "SECURITY"
                      ? "text-[#8b5cf6] bg-[#8b5cf6]/10 border-[#8b5cf6]/20"
                      : "text-[#0ea5e9] bg-[#0ea5e9]/10 border-[#0ea5e9]/20"
                  }`}
                >
                  Cọc {typeName}
                </span>
                <span
                  data-testid="deposit-status-badge"
                  className="text-[11px] font-black uppercase px-[8px] py-[4px] rounded-[6px] border text-muted bg-black/5 dark:bg-white/5 border-border"
                >
                  {detailDeposit.status}
                </span>
              </div>
            </div>
            <div className="text-right flex flex-col items-end gap-[4px]">
              <span className="text-[12px] font-bold text-muted uppercase tracking-wider">Cập nhật gần nhất</span>
              <div className="flex items-center gap-[6px] text-[14px] font-black text-text">
                <Clock3 size={16} className="text-[#6366f1]" />
                {formatDateTime(detailDeposit.updatedAt || detailDeposit.createdAt)}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-[16px] pt-[16px] border-t border-border/50">
            <div className="flex flex-col gap-[4px]">
              <span className="text-[11px] font-bold text-muted uppercase">Số tiền cọc</span>
              <span className="text-[15px] font-black text-text">{amountStr}đ</span>
            </div>
            <div className="flex flex-col gap-[4px]">
              <span className="text-[11px] font-bold text-muted uppercase">Đã thu</span>
              <span className="text-[15px] font-black text-[#8b5cf6]">{isPaid || isConverted ? amountStr : "0"}đ</span>
            </div>
            <div className="flex flex-col gap-[4px]">
              <span className="text-[11px] font-bold text-muted uppercase">Ngày tạo</span>
              <span className="text-[14px] font-bold text-text">{formatDate(detailDeposit.createdAt)}</span>
            </div>
            <div className="flex flex-col gap-[4px]">
              <span className="text-[11px] font-bold text-muted uppercase">Hạn giữ cọc</span>
              <span className="text-[14px] font-bold text-text">{formatDate(detailDeposit.expiredAt)}</span>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-[24px]">
          <Card className="p-[20px] flex flex-col gap-[16px]">
            <h4 className="font-black text-[15px] text-text flex items-center gap-2 border-b border-border/50 pb-3">
              <FileText size={16} className="text-[#6366f1]" /> Ghi chú & Trạng thái
            </h4>
            <div className="flex flex-col gap-[12px]">
              <div className="flex items-center justify-between p-[12px] bg-black/5 dark:bg-white/5 rounded-[10px]">
                <span className="text-[13px] font-bold text-muted">Ghi chú</span>
                <span className="text-[13px] font-semibold text-text text-right max-w-[70%] truncate">
                  {detailDeposit.note || "Không có ghi chú"}
                </span>
              </div>
              <div className="flex items-center justify-between p-[12px] bg-black/5 dark:bg-white/5 rounded-[10px]">
                <span className="text-[13px] font-bold text-muted">Khách hàng</span>
                <span className="text-[13px] font-semibold text-text">{detailDeposit.customerPhone}</span>
              </div>
              <div className="flex items-center justify-between p-[12px] bg-black/5 dark:bg-white/5 rounded-[10px]">
                <span className="text-[13px] font-bold text-muted">Trạng thái hiện tại</span>
                <span className="text-[13px] font-black text-text">{detailDeposit.status}</span>
              </div>
              <div className="flex flex-col gap-[8px] p-[12px] bg-black/5 dark:bg-white/5 rounded-[10px]">
                <span className="text-[13px] font-bold text-muted">Chá»©ng tá»« hoÃ n tiá»n</span>
                <textarea
                  value={refundAttachmentInput}
                  onChange={(event) => setRefundAttachmentInput(event.target.value)}
                  placeholder="URL chung tu, ngan cach bang dau phay hoac xuong dong"
                  className="min-h-[84px] rounded-[10px] border border-border bg-card px-3 py-2 text-[13px] text-text outline-none"
                />
                <span className="text-[11px] font-medium text-muted">Duoc gui kem khi tao phieu chi hoan coc.</span>
              </div>
              {refundSummary ? (
                <div className="flex flex-col gap-[8px] rounded-[10px] border border-amber-500/20 bg-amber-500/10 p-[12px]">
                  <span className="text-[13px] font-bold text-amber-700">Theo dõi phiếu hoàn cọc</span>
                  <div className="flex items-center justify-between gap-[12px] text-[13px]">
                    <span className="text-muted">Mã phiếu</span>
                    <span className="font-black text-text">{refundSummary.receiptCode || "Chưa có"}</span>
                  </div>
                  <div className="flex items-center justify-between gap-[12px] text-[13px]">
                    <span className="text-muted">Trạng thái</span>
                    <span className="font-black text-text">{refundSummary.taskStatus || refundSummary.receiptStatus || "-"}</span>
                  </div>
                  <div className="flex items-center justify-between gap-[12px] text-[13px]">
                    <span className="text-muted">Số tiền</span>
                    <span className="font-black text-text">{new Intl.NumberFormat("vi-VN").format(Number(refundSummary.receiptAmount || 0))}đ</span>
                  </div>
                </div>
              ) : null}
            </div>
          </Card>

          <Card className="p-[20px] flex flex-col gap-[16px]">
            <h4 className="font-black text-[15px] text-text flex items-center gap-2 border-b border-border/50 pb-3">
              <RefreshCcw size={16} className="text-[#f97316]" /> Mốc xử lý
            </h4>
            <div className="flex flex-col gap-[0px] relative mt-[8px]">
              <div className="absolute left-[15px] top-[10px] bottom-[20px] w-[2px] bg-border" />

              <div className="flex gap-[16px] relative z-10 pb-[24px]">
                <div className="w-[32px] h-[32px] rounded-full bg-[#8b5cf6] flex items-center justify-center shrink-0 border-[4px] border-card">
                  <CheckCircle2 size={14} className="text-white" />
                </div>
                <div className="flex flex-col gap-[4px] pt-[6px]">
                  <span className="text-[13px] font-bold text-text leading-none">Tạo phiếu cọc</span>
                  <span className="text-[11px] text-muted">{formatDateTime(detailDeposit.createdAt)}</span>
                </div>
              </div>

              <div className="flex gap-[16px] relative z-10 pb-[24px]">
                <div className={`w-[32px] h-[32px] rounded-full ${isPaid || isConverted ? "bg-[#8b5cf6]" : "bg-black/10 dark:bg-white/10"} flex items-center justify-center shrink-0 border-[4px] border-card`}>
                  {isPaid || isConverted ? <CheckCircle2 size={14} className="text-white" /> : <div className="w-[8px] h-[8px] bg-muted rounded-full" />}
                </div>
                <div className="flex flex-col gap-[4px] pt-[6px]">
                  <span className={`text-[13px] font-bold ${isPaid || isConverted ? "text-text" : "text-muted"} leading-none`}>
                    Đã thu / Đã xác nhận
                  </span>
                  <span className="text-[11px] text-muted">
                    {isPaid || isConverted ? `${amountStr}đ · ${formatDateTime(detailDeposit.updatedAt)}` : "Chưa thu"}
                  </span>
                </div>
              </div>

              <div className="flex gap-[16px] relative z-10 pb-[24px]">
                <div className={`w-[32px] h-[32px] rounded-full ${isConverted ? "bg-[#8b5cf6]" : "bg-black/10 dark:bg-white/10"} flex items-center justify-center shrink-0 border-[4px] border-card`}>
                  {isConverted ? <CheckCircle2 size={14} className="text-white" /> : <div className="w-[8px] h-[8px] bg-muted rounded-full" />}
                </div>
                <div className="flex flex-col gap-[4px] pt-[6px]">
                  <span className={`text-[13px] font-bold ${isConverted ? "text-text" : "text-muted"} leading-none`}>
                    Chuyển thành hợp đồng
                  </span>
                  <span className="text-[11px] text-muted">{isConverted ? "Đã chuyển thành hợp đồng" : "Chưa chuyển"}</span>
                </div>
              </div>

              <div className="flex gap-[16px] relative z-10">
                <div className={`w-[32px] h-[32px] rounded-full ${isRefunded || isCancelled ? "bg-rose-500" : "bg-black/10 dark:bg-white/10"} flex items-center justify-center shrink-0 border-[4px] border-card`}>
                  {isRefunded || isCancelled ? <RefreshCcw size={14} className="text-white" /> : <div className="w-[8px] h-[8px] bg-muted rounded-full" />}
                </div>
                <div className="flex flex-col gap-[4px] pt-[6px]">
                  <span className={`text-[13px] font-bold ${isRefunded || isCancelled ? "text-rose-500" : "text-muted"} leading-none`}>
                    Hoàn tiền / Hủy phiếu
                  </span>
                  <span className="text-[11px] text-muted">{isRefunded || isCancelled ? formatDateTime(detailDeposit.updatedAt) : "Chưa xử lý"}</span>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </Drawer>
  );
}
