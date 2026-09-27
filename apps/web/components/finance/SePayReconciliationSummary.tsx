"use client";

import React, { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Link2, RotateCcw, SearchCheck } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { RefundProofUploader } from "@/components/common/RefundProofUploader";
import { financeApi, manualSePayAssignmentIdempotencyKey } from "@/lib/api/finance.api";
import { financeKeys, useSePayReconciliationQuery } from "@/lib/queries/finance.queries";

const statusOptions = [
  { value: "", label: "Tất cả" },
  { value: "MATCHED", label: "Đã khớp" },
  { value: "UNMATCHED", label: "Chưa khớp" },
  { value: "SHORT_AMOUNT", label: "Thiếu tiền" },
  { value: "OVER_AMOUNT", label: "Thừa tiền" },
  { value: "WRONG_BANK", label: "Sai tài khoản nhận" },
  { value: "IGNORED_OUTGOING", label: "Giao dịch ra" },
  { value: "FAILED", label: "Lỗi xử lý" },
  { value: "PROCESSING", label: "Đang xử lý" },
  { value: "PENDING_PROCESSING", label: "Chờ xử lý" },
  { value: "NEEDS_REVIEW", label: "Cần rà soát" },
  { value: "DUPLICATE_CONTENT", label: "Trùng nội dung" },
];

const sourceTypeOptions = [
  { value: "INVOICE", label: "Hóa đơn" },
  { value: "DEPOSIT", label: "Phiếu cọc" },
];

const overpaymentResolutionOptions = [
  { value: "CREDIT_BALANCE", label: "Dư có khách hàng" },
  { value: "CARRY_FORWARD", label: "Cấn trừ kỳ sau" },
  { value: "REFUND_PENDING", label: "Chờ hoàn lại" },
];

const statusLabels: Record<string, string> = {
  MATCHED: "Đã khớp",
  UNMATCHED: "Chưa khớp",
  SHORT_AMOUNT: "Thiếu tiền",
  OVER_AMOUNT: "Thừa tiền",
  WRONG_BANK: "Sai tài khoản nhận",
  IGNORED_OUTGOING: "Giao dịch ra",
  FAILED: "Lỗi xử lý",
  PROCESSING: "Đang xử lý",
  PENDING_PROCESSING: "Chờ xử lý",
  NEEDS_REVIEW: "Cần rà soát",
  DUPLICATE_CONTENT: "Trùng nội dung",
};

const statusClass: Record<string, string> = {
  MATCHED: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  UNMATCHED: "border-slate-500/20 bg-slate-500/10 text-slate-700 dark:text-slate-300",
  SHORT_AMOUNT: "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  OVER_AMOUNT: "border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  WRONG_BANK: "border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  IGNORED_OUTGOING: "border-slate-500/20 bg-slate-500/10 text-slate-600 dark:text-slate-300",
  FAILED: "border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  PROCESSING: "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  PENDING_PROCESSING: "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  NEEDS_REVIEW: "border-amber-500/20 bg-amber-500/10 text-amber-800 dark:text-amber-300",
  DUPLICATE_CONTENT: "border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-300",
};

const formatVnd = (value: number) => `${Number(value || 0).toLocaleString("vi-VN")} đ`;
const formatDateTime = (value?: string | null) => (value ? new Date(value).toLocaleString("vi-VN") : "-");

type ManualAssignmentCandidate = {
  sourceType: "INVOICE" | "DEPOSIT";
  sourceCode: string;
  customerName?: string | null;
  roomCode?: string | null;
  buildingName?: string | null;
  expectedAmount: number;
  amountDelta: number;
  matchReasons?: string[];
};

const candidateKey = (candidate: Pick<ManualAssignmentCandidate, "sourceType" | "sourceCode">) =>
  `${candidate.sourceType}:${candidate.sourceCode}`;

const candidateLabel = (candidate: ManualAssignmentCandidate) =>
  `${candidate.sourceType === "INVOICE" ? "Hóa đơn" : "Phiếu cọc"} · ${candidate.sourceCode} · ${candidate.customerName || "Chưa rõ khách"} · ${candidate.roomCode || candidate.buildingName || "Chưa rõ phòng"} · ${formatVnd(candidate.expectedAmount)}`;

export default function SePayReconciliationSummary() {
  const queryClient = useQueryClient();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(String(currentYear));
  const [month, setMonth] = useState("");
  const [status, setStatus] = useState("");
  const [activeRow, setActiveRow] = useState<any | null>(null);
  const [resolutionRow, setResolutionRow] = useState<any | null>(null);
  const [refundCompletionRow, setRefundCompletionRow] = useState<any | null>(null);
  const [refundCompletionNote, setRefundCompletionNote] = useState("");
  const [refundCompletionAttachmentUrls, setRefundCompletionAttachmentUrls] = useState<string[]>([]);
  const [isRefundCompletionProofUploading, setIsRefundCompletionProofUploading] = useState(false);
  const [sourceType, setSourceType] = useState<"INVOICE" | "DEPOSIT">("INVOICE");
  const [sourceCode, setSourceCode] = useState("");
  const [selectedCandidateKey, setSelectedCandidateKey] = useState("");
  const [candidateSearch, setCandidateSearch] = useState("");
  const [showManualCodeEntry, setShowManualCodeEntry] = useState(false);
  const [overpaymentResolution, setOverpaymentResolution] = useState<"CREDIT_BALANCE" | "CARRY_FORWARD" | "REFUND_PENDING">("CREDIT_BALANCE");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const params = useMemo(() => ({ year, ...(month ? { month } : {}), ...(status ? { status } : {}) }), [month, status, year]);
  const { data, isLoading, isError } = useSePayReconciliationQuery(params);
  const rows = Array.isArray(data?.rows) ? data.rows : [];
  const actionRequiredCount = Number(data?.summary?.unmatched || 0) +
    Number(data?.summary?.wrongBank || 0) +
    Number(data?.summary?.failed || 0) +
    Number(data?.summary?.needsReview || 0);
  const amountExceptionCount = Number(data?.summary?.shortAmount || 0) + Number(data?.summary?.overAmount || 0);
  const inFlightCount = Number(data?.summary?.processing || 0) + Number(data?.summary?.pendingProcessing || 0);

  const yearOptions = useMemo(
    () =>
      Array.from({ length: 5 }, (_, index) => {
        const value = String(currentYear - index);
        return { value, label: value };
      }),
    [currentYear],
  );

  const monthOptions = [
    { value: "", label: "Cả năm" },
    ...Array.from({ length: 12 }, (_, index) => ({ value: String(index + 1), label: `Tháng ${index + 1}` })),
  ];

  const openAssignModal = (row: any) => {
    setActiveRow(row);
    setSourceType(row.sourceType === "DEPOSIT" ? "DEPOSIT" : "INVOICE");
    setSourceCode("");
    setSelectedCandidateKey("");
    setCandidateSearch("");
    setShowManualCodeEntry(false);
  };

  const closeAssignModal = () => {
    setActiveRow(null);
    setSourceCode("");
    setSelectedCandidateKey("");
    setCandidateSearch("");
    setShowManualCodeEntry(false);
    setIsSubmitting(false);
  };

  const allAssignmentCandidates = useMemo<ManualAssignmentCandidate[]>(() => {
    return Array.isArray(activeRow?.manualAssignmentCandidates)
      ? activeRow.manualAssignmentCandidates
      : [];
  }, [activeRow?.manualAssignmentCandidates]);

  const assignmentCandidates = useMemo<ManualAssignmentCandidate[]>(() => {
    const candidates = allAssignmentCandidates;
    const normalizedSearch = candidateSearch.trim().toLocaleLowerCase("vi-VN");
    if (!normalizedSearch) return candidates;

    return candidates.filter((candidate: ManualAssignmentCandidate) =>
      [candidate.sourceCode, candidate.customerName, candidate.roomCode, candidate.buildingName]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase("vi-VN").includes(normalizedSearch)),
    );
  }, [allAssignmentCandidates, candidateSearch]);

  const selectedCandidate = useMemo(
    () => allAssignmentCandidates.find((candidate) => candidateKey(candidate) === selectedCandidateKey) || null,
    [allAssignmentCandidates, selectedCandidateKey],
  );

  const selectAssignmentCandidate = (key: string) => {
    setSelectedCandidateKey(key);
    const candidate = assignmentCandidates.find((item) => candidateKey(item) === key);
    if (!candidate) return;
    setSourceType(candidate.sourceType);
    setSourceCode(candidate.sourceCode);
    setShowManualCodeEntry(false);
  };

  const openResolveModal = (row: any) => {
    setResolutionRow(row);
    setOverpaymentResolution("CREDIT_BALANCE");
  };

  const closeResolveModal = () => {
    setResolutionRow(null);
    setIsSubmitting(false);
  };

  const openRefundCompletionModal = (row: any) => {
    setRefundCompletionRow(row);
    setRefundCompletionNote("");
    setRefundCompletionAttachmentUrls([]);
    setIsRefundCompletionProofUploading(false);
  };

  const closeRefundCompletionModal = () => {
    setRefundCompletionRow(null);
    setRefundCompletionNote("");
    setRefundCompletionAttachmentUrls([]);
    setIsRefundCompletionProofUploading(false);
    setIsSubmitting(false);
  };

  const handleManualAssign = async () => {
    if (!activeRow || !sourceCode.trim()) {
      toast.error("Cần chọn chứng từ đề xuất hoặc nhập mã thay thế.");
      return;
    }

    setIsSubmitting(true);
    try {
      const assignment = {
        logId: activeRow.id,
        sourceType,
        sourceCode: sourceCode.trim(),
      };
      await financeApi.manualAssignSePayTransaction(
        assignment,
        manualSePayAssignmentIdempotencyKey(assignment),
      );
      await queryClient.invalidateQueries({ queryKey: financeKeys.all });
      toast.success("Đã gán thủ công giao dịch SePay.");
      closeAssignModal();
    } catch (error: any) {
      toast.error(error?.message || "Không thể gán giao dịch SePay.");
      setIsSubmitting(false);
    }
  };

  const handleResolveOverpayment = async () => {
    if (!resolutionRow) return;
    setIsSubmitting(true);
    try {
      await financeApi.resolveSePayOverpayment({
        logId: resolutionRow.id,
        resolution: overpaymentResolution,
      });
      await queryClient.invalidateQueries({ queryKey: financeKeys.all });
      toast.success("Đã xử lý tiền thừa.");
      closeResolveModal();
    } catch (error: any) {
      toast.error(error?.message || "Không thể xử lý tiền thừa.");
      setIsSubmitting(false);
    }
  };

  const handleCompleteOverpaymentRefund = async () => {
    if (!refundCompletionRow) return;
    if (refundCompletionAttachmentUrls.length === 0) {
      toast.error("Cần tải chứng từ hoàn tiền trước khi xác nhận.");
      return;
    }
    setIsSubmitting(true);
    try {
      await financeApi.completeSePayOverpaymentRefund({
        logId: refundCompletionRow.id,
        note: refundCompletionNote.trim() || undefined,
        attachmentUrls: refundCompletionAttachmentUrls,
      });
      await queryClient.invalidateQueries({ queryKey: financeKeys.all });
      toast.success("Đã xác nhận hoàn tất hoàn dư.");
      closeRefundCompletionModal();
    } catch (error: any) {
      toast.error(error?.message || "Không thể xác nhận hoàn tất hoàn dư.");
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <section
        data-testid="sepay-reconciliation-summary"
        className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-border/70 bg-card shadow-2xs"
      >
        <div className="border-b border-border/70 px-3 py-3 md:px-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.14em] text-primary">
                <SearchCheck size={14} aria-hidden />
                Trung tâm đối soát
              </div>
              <h2 className="mt-1 text-lg font-black tracking-tight text-text">Đối soát giao dịch SePay</h2>
              <p className="mt-0.5 text-xs text-muted">Kiểm tra kết quả khớp, chênh lệch và xử lý ngoại lệ trên cùng một bảng.</p>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 xl:min-w-[520px]">
              <label className="min-w-0">
                <span className="mb-1 block text-[10px] font-black uppercase tracking-wide text-muted">Năm</span>
                <Select
                  data-testid="sepay-reconciliation-year"
                  value={year}
                  onChange={(event) => setYear(event.target.value)}
                  options={yearOptions}
                />
              </label>
              <label className="min-w-0">
                <span className="mb-1 block text-[10px] font-black uppercase tracking-wide text-muted">Kỳ đối soát</span>
                <Select
                  data-testid="sepay-reconciliation-month"
                  value={month}
                  onChange={(event) => setMonth(event.target.value)}
                  options={monthOptions}
                />
              </label>
              <label className="min-w-0">
                <span className="mb-1 block text-[10px] font-black uppercase tracking-wide text-muted">Trạng thái</span>
                <Select
                  data-testid="sepay-reconciliation-status"
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                  options={statusOptions}
                />
              </label>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 divide-x divide-y divide-border/70 border-b border-border/70 bg-surface/50 md:grid-cols-5 md:divide-y-0">
          <Metric label="Tổng giao dịch" value={data?.summary?.total || 0} />
          <Metric label="Đã khớp" value={data?.summary?.matched || 0} tone="success" />
          <Metric label="Cần xử lý" value={actionRequiredCount} tone="danger" />
          <Metric label="Chênh lệch tiền" value={amountExceptionCount} tone="warning" />
          <Metric label="Đang chạy" value={inFlightCount} tone="info" />
        </div>

        {isLoading && (
          <div className="grid gap-2 p-4" aria-label="Đang tải đối soát SePay">
            <div className="h-12 animate-pulse rounded-lg bg-surface" />
            <div className="h-12 animate-pulse rounded-lg bg-surface" />
          </div>
        )}
        {isError && (
          <div role="alert" className="m-4 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm font-semibold text-rose-700 dark:text-rose-300">
            Không tải được dữ liệu đối soát SePay. Vui lòng thử lại sau.
          </div>
        )}

        {!isLoading && !isError && (
          <div className="min-h-0 flex-1">
            <div className="flex items-center justify-between gap-3 border-b border-border/70 px-4 py-2.5">
              <div>
                <div className="text-xs font-black uppercase tracking-wide text-text">Kết quả đối soát</div>
                <div className="mt-0.5 text-xs text-muted">{rows.length} giao dịch theo bộ lọc hiện tại</div>
              </div>
              {status ? (
                <span className="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[11px] font-black text-primary">
                  {statusLabels[status] || status}
                </span>
              ) : null}
            </div>

            <div className="overflow-auto">
              {rows.length === 0 && (
                <div className="px-4 py-12 text-center">
                  <SearchCheck size={28} className="mx-auto text-muted/60" aria-hidden />
                  <div className="mt-3 text-sm font-black text-text">Không có giao dịch phù hợp</div>
                  <div className="mt-1 text-xs text-muted">Hãy đổi kỳ hoặc trạng thái để xem dữ liệu khác.</div>
                </div>
              )}

              {rows.length > 0 && (
                <table className="w-full min-w-[1080px] border-collapse text-center text-xs">
                  <thead className="sticky top-0 z-10 border-b border-border/70 bg-surface text-[10px] font-black uppercase tracking-wide text-muted">
                    <tr>
                      <th className="w-[135px] px-3 py-3">Thời điểm</th>
                      <th className="w-[145px] px-3 py-3">Trạng thái</th>
                      <th className="w-[190px] px-3 py-3">Giao dịch</th>
                      <th className="px-3 py-3">Chứng từ liên quan</th>
                      <th className="w-[180px] px-3 py-3">Đối chiếu tiền</th>
                      <th className="w-[175px] px-3 py-3">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {rows.map((row: any) => {
                  const isContentDuplicate = row.status === "DUPLICATE_CONTENT";
                  const canManualAssign = ["UNMATCHED", "SHORT_AMOUNT", "OVER_AMOUNT", "WRONG_BANK", "FAILED", "NEEDS_REVIEW"].includes(row.status);
                  const isRefundPending =
                    row.overpaymentResolution === "REFUND_PENDING" && !row.overpaymentRefundCompletedAt;
                  const canResolveOverpayment =
                    ["OVER_AMOUNT", "DUPLICATE_CONTENT"].includes(row.status) &&
                    !row.overpaymentResolution;
                  const resolutionLabel =
                    row.overpaymentResolution === "CREDIT_BALANCE"
                      ? "Đã chuyển dư có"
                      : row.overpaymentResolution === "CARRY_FORWARD"
                        ? "Đã cấn trừ kỳ sau"
                        : row.overpaymentResolution === "REFUND_PENDING" && row.overpaymentRefundCompletedAt
                          ? "Đã hoàn dư"
                          : row.overpaymentResolution === "REFUND_PENDING"
                            ? "Chờ hoàn dư"
                            : null;
                  return (
                    <tr
                      key={row.id}
                      data-testid={`sepay-row-${row.id}`}
                      className="align-middle transition-colors hover:bg-primary/[0.03]"
                    >
                      <td className="px-3 py-3 font-semibold leading-5 text-muted">{formatDateTime(row.createdAt)}</td>
                      <td className="px-3 py-3">
                        <span
                          className={`inline-flex items-center justify-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11px] font-black ${
                            statusClass[row.status] || "border-slate-500/20 bg-slate-500/10 text-slate-600"
                          }`}
                        >
                          {row.status === "MATCHED" ? <CheckCircle2 size={13} aria-hidden /> : <AlertTriangle size={13} aria-hidden />}
                          {statusLabels[row.status] || row.status}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-mono text-sm font-black text-text">{row.paymentCode || "Không có mã"}</div>
                        <div className="mt-1 truncate font-mono text-[11px] text-muted">
                          {row.providerTransactionId || "Chưa có mã giao dịch"}
                        </div>
                        <div className="mt-1 text-[11px] text-muted">
                          {row.bankAccount?.bankName || row.accountNumber || "Chưa xác định ngân hàng"}
                        </div>
                        {row.bankMatch === "SEPAY_VIRTUAL_ACCOUNT" ? (
                          <div className="mt-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">Tài khoản ảo SePay đã xác minh</div>
                        ) : row.bankMatch === "MISMATCH" ? (
                          <div className="mt-1 text-[11px] font-semibold text-rose-700 dark:text-rose-300">Sai tài khoản nhận</div>
                        ) : null}
                      </td>
                      <td className="px-3 py-3">
                        <div className="text-sm font-black text-text">{row.sourceType || "Chưa gắn chứng từ"}</div>
                        <div className="mt-1 text-[11px] text-muted">
                          {row.roomCode || "Chưa xác định phòng"} · {row.buildingName || "Chưa xác định tòa"}
                        </div>
                        <div className="mt-1 text-[11px] text-muted">{row.owner?.name || "Chưa xác định chủ sở hữu"}</div>
                        {resolutionLabel ? (
                          <div className="mt-1 text-[11px] font-semibold text-[#2563eb]">{resolutionLabel}</div>
                        ) : null}
                        {row.overpaymentRefundReceiptId ? (
                          <div className="mt-1 text-[11px] text-muted">Chứng từ hoàn: {row.overpaymentRefundReceiptId}</div>
                        ) : null}
                        {Array.isArray(row.overpaymentRefundAttachmentUrls) && row.overpaymentRefundAttachmentUrls.length > 0 ? (
                          <div className="mt-1 text-[11px] text-muted">{row.overpaymentRefundAttachmentUrls.length} tệp chứng từ đã lưu</div>
                        ) : null}
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-mono text-sm font-black text-emerald-600 dark:text-emerald-300">{formatVnd(row.amount)}</div>
                        <div className="mt-1 text-[11px] font-semibold text-text">Phải thu: {formatVnd(row.expectedAmount)}</div>
                        <div className={`mt-1 text-[11px] font-semibold ${Number(row.amountDiff || 0) === 0 ? "text-muted" : Number(row.amountDiff || 0) < 0 ? "text-amber-700 dark:text-amber-300" : "text-blue-700 dark:text-blue-300"}`}>
                          {Number(row.amountDiff || 0) === 0 ? "Khớp số tiền" : `Chênh ${formatVnd(Math.abs(Number(row.amountDiff || 0)))}`}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap items-center justify-center gap-1.5">
                          {isRefundPending && (
                            <Button
                              data-testid={`sepay-refund-complete-open-${row.id}`}
                              variant="outline"
                              size="sm"
                              onClick={() => openRefundCompletionModal(row)}
                            >
                              <CheckCircle2 size={14} className="mr-1.5" />
                              Xác nhận hoàn
                            </Button>
                          )}
                          {canResolveOverpayment && (
                            <Button
                              data-testid={`sepay-resolve-open-${row.id}`}
                              variant="outline"
                              size="sm"
                              onClick={() => openResolveModal(row)}
                            >
                              <RotateCcw size={14} className="mr-1.5" />
                              {isContentDuplicate ? "Xử lý giao dịch trùng" : "Xử lý thừa"}
                            </Button>
                          )}
                          {canManualAssign ? (
                            <Button
                              data-testid={`sepay-manual-assign-open-${row.id}`}
                              variant="outline"
                              size="sm"
                              onClick={() => openAssignModal(row)}
                            >
                              <Link2 size={14} className="mr-1.5" />
                              Gán giao dịch
                            </Button>
                          ) : !canResolveOverpayment && !isRefundPending ? (
                            <span className="text-[12px] font-semibold text-muted">-</span>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </section>

      <Modal
        isOpen={!!activeRow}
        onClose={closeAssignModal}
        title="Gán giao dịch SePay"
        maxWidth="max-w-3xl"
        testId="sepay-manual-assign-modal"
        footer={
          <div className="flex items-center justify-end gap-3">
            <Button variant="outline" onClick={closeAssignModal}>
              Hủy
            </Button>
            <Button data-testid="sepay-manual-assign-submit" onClick={handleManualAssign} disabled={isSubmitting || !sourceCode.trim()}>
              {isSubmitting ? "Đang gán..." : "Gán theo lựa chọn"}
            </Button>
          </div>
        }
      >
        {activeRow && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div className="rounded-xl border border-border/70 bg-surface/60 p-3">
                <div className="text-[10px] font-black uppercase tracking-wide text-muted">Mã thanh toán</div>
                <div className="mt-1 font-mono text-sm font-black text-text">{activeRow.paymentCode || "-"}</div>
              </div>
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-3">
                <div className="text-[10px] font-black uppercase tracking-wide text-muted">Tiền vào</div>
                <div className="mt-1 font-mono text-sm font-black text-emerald-600">{formatVnd(activeRow.amount || 0)}</div>
              </div>
              <div className="rounded-xl border border-border/70 bg-surface/60 p-3">
                <div className="text-[10px] font-black uppercase tracking-wide text-muted">Ngân hàng nhận</div>
                <div className="mt-1 text-sm font-black text-text">{activeRow.bankAccount?.bankName || activeRow.accountNumber || "Chưa xác định"}</div>
              </div>
            </div>

            <div className="rounded-xl border border-blue-500/20 bg-blue-500/[0.06] px-3 py-2.5 text-xs leading-5 text-blue-800 dark:text-blue-200">
              Chọn chứng từ đề xuất phù hợp nhất. Hệ thống vẫn kiểm tra tenant, số dư, ngân hàng và chống ghi nhận trùng trước khi lưu.
            </div>

            <div className="space-y-3 rounded-xl border border-border/70 p-3.5">
              <div className="flex items-center justify-between gap-3">
                <div className="text-[12px] font-black uppercase tracking-wide text-muted">Chứng từ đề xuất</div>
                <div className="text-[11px] font-semibold text-muted">{allAssignmentCandidates.length} chứng từ có thể gán</div>
              </div>
              <Input
                data-testid="sepay-manual-assign-suggestion-search"
                value={candidateSearch}
                onChange={(event) => setCandidateSearch(event.target.value)}
                placeholder="Lọc theo mã, khách thuê, phòng hoặc tòa nhà"
              />
              <Select
                data-testid="sepay-manual-assign-suggestion-select"
                value={selectedCandidateKey}
                onChange={(event) => selectAssignmentCandidate(event.target.value)}
                options={[
                  { value: "", label: assignmentCandidates.length ? "Chọn chứng từ để gán" : "Không có chứng từ phù hợp" },
                  ...assignmentCandidates.map((candidate) => ({
                    value: candidateKey(candidate),
                    label: candidateLabel(candidate),
                  })),
                ]}
              />
              {selectedCandidate ? (
                <div data-testid="sepay-manual-assign-selected" className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.07] p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-black text-emerald-900 dark:text-emerald-200">{candidateLabel(selectedCandidate)}</div>
                    <div className="text-xs font-black text-emerald-700 dark:text-emerald-300">Chênh {formatVnd(selectedCandidate.amountDelta)}</div>
                  </div>
                  <div className="mt-1 text-[11px] font-semibold text-emerald-800 dark:text-emerald-300">
                    {selectedCandidate.matchReasons?.length ? selectedCandidate.matchReasons.join(" · ") : "Cần kiểm tra lại trước khi gán"}
                  </div>
                </div>
              ) : (
                <p className="text-[12px] leading-5 text-muted">
                  Danh sách ưu tiên đúng mã thanh toán, loại chứng từ, phòng/khách/tòa nhà và chênh lệch số tiền thấp nhất.
                </p>
              )}
            </div>

            <div className="rounded-xl border border-dashed border-border/80 bg-surface/30 p-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowManualCodeEntry((visible) => !visible);
                  setSelectedCandidateKey("");
                  setSourceCode("");
                }}
              >
                {showManualCodeEntry ? "Ẩn nhập mã thay thế" : "Không thấy chứng từ? Nhập mã thay thế"}
              </Button>
              {showManualCodeEntry ? (
                <div className="mt-3 grid grid-cols-1 gap-3 border-t border-border/70 pt-3 md:grid-cols-2">
                  <div>
                    <div className="mb-2 text-[12px] font-black uppercase tracking-wide text-muted">Loại nguồn</div>
                    <Select
                      data-testid="sepay-manual-assign-source-type"
                      value={sourceType}
                      onChange={(event) => setSourceType(event.target.value as "INVOICE" | "DEPOSIT")}
                      options={sourceTypeOptions}
                    />
                  </div>
                  <div>
                    <div className="mb-2 text-[12px] font-black uppercase tracking-wide text-muted">
                      {sourceType === "INVOICE" ? "Mã hóa đơn" : "Mã phiếu cọc"}
                    </div>
                    <Input
                      data-testid="sepay-manual-assign-source-code"
                      value={sourceCode}
                      onChange={(event) => setSourceCode(event.target.value)}
                      placeholder={sourceType === "INVOICE" ? "VD: INV-001" : "VD: DEP-001"}
                    />
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={!!resolutionRow}
        onClose={closeResolveModal}
        title={resolutionRow?.status === "DUPLICATE_CONTENT" ? "Xử lý giao dịch trùng nội dung" : "Xử lý tiền thừa SePay"}
        maxWidth="max-w-xl"
        testId="sepay-resolve-modal"
        footer={
          <div className="flex items-center justify-end gap-3">
            <Button variant="outline" onClick={closeResolveModal}>
              Hủy
            </Button>
            <Button data-testid="sepay-resolve-submit" onClick={handleResolveOverpayment} disabled={isSubmitting}>
              {isSubmitting ? "Đang xử lý..." : "Xác nhận xử lý"}
            </Button>
          </div>
        }
      >
        {resolutionRow && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div className="rounded-xl border border-border/70 bg-surface/60 p-3">
                <div className="text-[10px] font-black uppercase tracking-wide text-muted">Payment code</div>
                <div className="mt-2 text-[13px] font-black text-text">{resolutionRow.paymentCode || "-"}</div>
              </div>
              <div className="rounded-xl border border-border/70 bg-surface/60 p-3">
                <div className="text-[10px] font-black uppercase tracking-wide text-muted">Tiền vào</div>
                <div className="mt-2 text-[13px] font-black text-[#059669]">{formatVnd(resolutionRow.amount || 0)}</div>
              </div>
              <div className="rounded-xl border border-border/70 bg-surface/60 p-3">
                <div className="text-[10px] font-black uppercase tracking-wide text-muted">
                  {resolutionRow.status === "DUPLICATE_CONTENT" ? "Giao dịch cần xử lý" : "Tiền thừa"}
                </div>
                <div className="mt-2 text-[13px] font-black text-blue-600">
                  {formatVnd(
                    resolutionRow.status === "DUPLICATE_CONTENT"
                      ? Number(resolutionRow.amount || 0)
                      : Math.max(0, Number(resolutionRow.amount || 0) - Number(resolutionRow.expectedAmount || 0)),
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-blue-500/20 bg-blue-500/[0.06] p-3 text-xs leading-5 text-blue-900 dark:text-blue-200">
              {resolutionRow.status === "DUPLICATE_CONTENT"
                ? "Đây là giao dịch ngân hàng mới có cùng nội dung với giao dịch đã xác nhận. Hệ thống không thu lần hai vào hóa đơn cũ; toàn bộ giao dịch này phải được ghi dư có, cấn kỳ sau hoặc hoàn lại."
                : "`Dư có khách hàng` và `Cấn trừ kỳ sau` sẽ tạo credit note để dùng về sau. `Chờ hoàn lại` sẽ tạo tác vụ vận hành để kế toán xử lý hoàn tiền."}
            </div>

            <div>
              <div className="mb-2 text-[12px] font-black uppercase tracking-wide text-muted">Hướng xử lý</div>
              <Select
                data-testid="sepay-resolve-select"
                value={overpaymentResolution}
                onChange={(event) =>
                  setOverpaymentResolution(
                    event.target.value as "CREDIT_BALANCE" | "CARRY_FORWARD" | "REFUND_PENDING",
                  )
                }
                options={overpaymentResolutionOptions}
              />
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={!!refundCompletionRow}
        onClose={closeRefundCompletionModal}
        title="Hoàn tất hoàn dư SePay"
        maxWidth="max-w-xl"
        testId="sepay-refund-complete-modal"
        footer={
          <div className="flex items-center justify-end gap-3">
            <Button variant="outline" onClick={closeRefundCompletionModal}>
              Hủy
            </Button>
            <Button
              data-testid="sepay-refund-complete-submit"
              onClick={handleCompleteOverpaymentRefund}
              disabled={isSubmitting || isRefundCompletionProofUploading}
            >
              {isSubmitting ? "Đang cập nhật..." : "Xác nhận đã hoàn"}
            </Button>
          </div>
        }
      >
        {refundCompletionRow && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div className="rounded-xl border border-border/70 bg-surface/60 p-3">
                <div className="text-[10px] font-black uppercase tracking-wide text-muted">Payment code</div>
                <div className="mt-2 text-[13px] font-black text-text">{refundCompletionRow.paymentCode || "-"}</div>
              </div>
              <div className="rounded-xl border border-border/70 bg-surface/60 p-3">
                <div className="text-[10px] font-black uppercase tracking-wide text-muted">Tiền thừa</div>
                <div className="mt-2 text-[13px] font-black text-blue-600">
                  {formatVnd(
                    refundCompletionRow.overpaymentAmount ||
                      Math.max(
                        0,
                        Number(refundCompletionRow.amount || 0) - Number(refundCompletionRow.expectedAmount || 0),
                      ),
                  )}
                </div>
              </div>
              <div className="rounded-xl border border-border/70 bg-surface/60 p-3">
                <div className="text-[10px] font-black uppercase tracking-wide text-muted">Tác vụ</div>
                <div className="mt-2 text-[13px] font-black text-text">
                  {refundCompletionRow.overpaymentTaskTitle || "Đang chờ hoàn"}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.07] p-3 text-xs leading-5 text-amber-900 dark:text-amber-200">
              Xác nhận này sẽ đóng tác vụ hoàn dư, hoàn tất chứng từ và ghi bút toán chi tiền để đối soát sau.
            </div>

            <div>
              <div className="mb-2 text-[12px] font-black uppercase tracking-wide text-muted">
                Ghi chú hoàn tất
              </div>
              <Input
                data-testid="sepay-refund-complete-note"
                value={refundCompletionNote}
                onChange={(event) => setRefundCompletionNote(event.target.value)}
                placeholder="Mã giao dịch hoàn tiền, người thực hiện hoặc ghi chú nội bộ"
              />
            </div>
            <RefundProofUploader
              value={refundCompletionAttachmentUrls}
              onChange={setRefundCompletionAttachmentUrls}
              onUploadingChange={setIsRefundCompletionProofUploading}
              disabled={isSubmitting}
              required
              folder="sepay-overpayment-refunds"
            />
          </div>
        )}
      </Modal>
    </>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  tone?: "success" | "warning" | "danger" | "info";
}) {
  const valueClass =
    tone === "success"
      ? "text-emerald-600 dark:text-emerald-300"
      : tone === "warning"
        ? "text-orange-600 dark:text-orange-300"
        : tone === "danger"
          ? "text-rose-600 dark:text-rose-300"
          : tone === "info"
            ? "text-blue-600 dark:text-blue-300"
            : "text-text";

  return (
    <div className="px-3 py-2.5 text-center">
      <div className="text-[10px] font-black uppercase tracking-[0.08em] text-muted">{label}</div>
      <div className={`mt-1 font-mono text-lg font-black ${valueClass}`}>{value}</div>
    </div>
  );
}
