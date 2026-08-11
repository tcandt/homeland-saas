"use client";

import React, { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Link2, RotateCcw, SearchCheck } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { financeApi } from "@/lib/api/finance.api";
import { financeKeys, useSePayReconciliationQuery } from "@/lib/queries/finance.queries";

const statusOptions = [
  { value: "", label: "Tất cả" },
  { value: "MATCHED", label: "Đã khớp" },
  { value: "UNMATCHED", label: "Chưa khớp" },
  { value: "SHORT_AMOUNT", label: "Thiếu tiền" },
  { value: "OVER_AMOUNT", label: "Thừa tiền" },
  { value: "WRONG_BANK", label: "Sai ngân hàng" },
  { value: "IGNORED_OUTGOING", label: "Giao dịch ra" },
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
  WRONG_BANK: "Sai ngân hàng",
  IGNORED_OUTGOING: "Giao dịch ra",
};

const statusClass: Record<string, string> = {
  MATCHED: "bg-emerald-50 text-emerald-700",
  UNMATCHED: "bg-slate-100 text-slate-600",
  SHORT_AMOUNT: "bg-amber-50 text-amber-700",
  OVER_AMOUNT: "bg-blue-50 text-blue-700",
  WRONG_BANK: "bg-rose-50 text-rose-700",
  IGNORED_OUTGOING: "bg-slate-100 text-slate-500",
};

const formatVnd = (value: number) => `${Number(value || 0).toLocaleString("vi-VN")} đ`;
const formatDateTime = (value?: string | null) => (value ? new Date(value).toLocaleString("vi-VN") : "-");

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
  const [sourceType, setSourceType] = useState<"INVOICE" | "DEPOSIT">("INVOICE");
  const [sourceCode, setSourceCode] = useState("");
  const [overpaymentResolution, setOverpaymentResolution] = useState<"CREDIT_BALANCE" | "CARRY_FORWARD" | "REFUND_PENDING">("CREDIT_BALANCE");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const params = useMemo(() => ({ year, ...(month ? { month } : {}), ...(status ? { status } : {}) }), [month, status, year]);
  const { data, isLoading, isError } = useSePayReconciliationQuery(params);
  const rows = Array.isArray(data?.rows) ? data.rows : [];

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
  };

  const closeAssignModal = () => {
    setActiveRow(null);
    setSourceCode("");
    setIsSubmitting(false);
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
  };

  const closeRefundCompletionModal = () => {
    setRefundCompletionRow(null);
    setRefundCompletionNote("");
    setIsSubmitting(false);
  };

  const handleManualAssign = async () => {
    if (!activeRow || !sourceCode.trim()) {
      toast.error("Cần nhập mã hóa đơn hoặc mã cọc.");
      return;
    }

    setIsSubmitting(true);
    try {
      await financeApi.manualAssignSePayTransaction({
        logId: activeRow.id,
        sourceType,
        sourceCode: sourceCode.trim(),
      });
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
    setIsSubmitting(true);
    try {
      await financeApi.completeSePayOverpaymentRefund({
        logId: refundCompletionRow.id,
        note: refundCompletionNote.trim() || undefined,
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
        className="overflow-hidden rounded-[16px] border border-border bg-card shadow-sm"
      >
        <div className="flex flex-col gap-4 border-b border-border p-[16px] md:flex-row md:items-start md:justify-between md:p-[20px]">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.14em] text-[#8b5cf6]">
              <SearchCheck size={14} />
              SePay reconciliation
            </div>
            <h2 className="mt-2 text-[16px] font-black text-text md:text-[18px]">Đối soát SePay</h2>
            <p className="mt-1 max-w-[760px] text-[12px] leading-5 text-muted md:text-[13px]">
              Đọc webhook raw payload, phân loại giao dịch khớp hóa đơn hoặc cọc, thiếu tiền, thừa tiền, sai bank hoặc chưa match payment code.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:min-w-[470px] sm:grid-cols-3">
            <Select
              data-testid="sepay-reconciliation-year"
              value={year}
              onChange={(event) => setYear(event.target.value)}
              options={yearOptions}
            />
            <Select
              data-testid="sepay-reconciliation-month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
              options={monthOptions}
            />
            <Select
              data-testid="sepay-reconciliation-status"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              options={statusOptions}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 border-b border-border p-[16px] md:grid-cols-6 md:p-[20px]">
          <Metric label="Tổng log" value={data?.summary?.total || 0} />
          <Metric label="Đã khớp" value={data?.summary?.matched || 0} tone="success" />
          <Metric label="Chưa match" value={data?.summary?.unmatched || 0} />
          <Metric label="Thiếu" value={data?.summary?.shortAmount || 0} tone="warning" />
          <Metric label="Thừa" value={data?.summary?.overAmount || 0} tone="info" />
          <Metric label="Sai bank" value={data?.summary?.wrongBank || 0} tone="danger" />
        </div>

        {isLoading && <div className="p-8 text-center text-[13px] font-semibold text-muted">Đang tải đối soát SePay...</div>}
        {isError && <div className="p-8 text-center text-[13px] font-semibold text-rose-500">Không tải được đối soát SePay.</div>}

        {!isLoading && !isError && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1260px] text-left text-sm">
              <thead className="bg-surface text-[11px] uppercase text-muted">
                <tr>
                  <th className="px-4 py-3 font-black">Thời điểm</th>
                  <th className="px-4 py-3 font-black">Trạng thái</th>
                  <th className="px-4 py-3 font-black">Payment code</th>
                  <th className="px-4 py-3 font-black">Nguồn</th>
                  <th className="px-4 py-3 text-right font-black">Tiền vào</th>
                  <th className="px-4 py-3 text-right font-black">Phải thu</th>
                  <th className="px-4 py-3 font-black">Bank / owner</th>
                  <th className="px-4 py-3 text-right font-black">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-[13px] font-semibold text-muted">
                      Chưa có webhook SePay phù hợp bộ lọc.
                    </td>
                  </tr>
                )}
                {rows.map((row: any) => {
                  const canManualAssign = row.status !== "MATCHED" && row.status !== "IGNORED_OUTGOING";
                  const isRefundPending =
                    row.overpaymentResolution === "REFUND_PENDING" && !row.overpaymentRefundCompletedAt;
                  const canResolveOverpayment = row.status === "OVER_AMOUNT" && !row.overpaymentResolution;
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
                    <tr key={row.id} data-testid={`sepay-row-${row.id}`} className="border-t border-border">
                      <td className="px-4 py-3 text-[12px] font-semibold text-muted">{formatDateTime(row.createdAt)}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-black ${
                            statusClass[row.status] || "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {row.status === "MATCHED" ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
                          {statusLabels[row.status] || row.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-black text-text">{row.paymentCode || "-"}</td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-text">{row.sourceType || "-"}</div>
                        <div className="text-[11px] text-muted">
                          {row.requestStatus || row.providerTransactionId || "-"}
                        </div>
                        {resolutionLabel ? (
                          <div className="mt-1 text-[11px] font-semibold text-[#2563eb]">
                            {resolutionLabel}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-right font-black text-[#059669]">{formatVnd(row.amount)}</td>
                      <td className="px-4 py-3 text-right font-black text-text">{formatVnd(row.expectedAmount)}</td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-text">{row.bankAccount?.bankName || row.accountNumber || "-"}</div>
                        <div className="text-[11px] text-muted">{row.owner?.name || "Chưa xác định owner"}</div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
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
                              Xử lý thừa
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
                              Gán tay
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
          </div>
        )}
      </section>

      <Modal
        isOpen={!!activeRow}
        onClose={closeAssignModal}
        title="Gán giao dịch SePay"
        maxWidth="max-w-xl"
        testId="sepay-manual-assign-modal"
        footer={
          <div className="flex items-center justify-end gap-3">
            <Button variant="outline" onClick={closeAssignModal}>
              Hủy
            </Button>
            <Button data-testid="sepay-manual-assign-submit" onClick={handleManualAssign} disabled={isSubmitting}>
              {isSubmitting ? "Đang gán..." : "Xác nhận gán"}
            </Button>
          </div>
        }
      >
        {activeRow && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-[14px] border border-border bg-surface p-3">
                <div className="text-[10px] font-black uppercase tracking-wide text-muted">Payment code</div>
                <div className="mt-2 text-[14px] font-black text-text">{activeRow.paymentCode || "-"}</div>
              </div>
              <div className="rounded-[14px] border border-border bg-surface p-3">
                <div className="text-[10px] font-black uppercase tracking-wide text-muted">Tiền vào</div>
                <div className="mt-2 text-[14px] font-black text-[#059669]">{formatVnd(activeRow.amount || 0)}</div>
              </div>
            </div>

            <div className="rounded-[14px] border border-amber-200 bg-amber-50 p-3 text-[12px] leading-5 text-amber-800">
              Gán tay sẽ đi qua luồng thanh toán hiện có của hóa đơn hoặc phiếu cọc. Hệ thống không tự xử lý phần tiền thừa ở bước này.
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
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
          </div>
        )}
      </Modal>

      <Modal
        isOpen={!!resolutionRow}
        onClose={closeResolveModal}
        title="Xử lý tiền thừa SePay"
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
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-[14px] border border-border bg-surface p-3">
                <div className="text-[10px] font-black uppercase tracking-wide text-muted">Payment code</div>
                <div className="mt-2 text-[13px] font-black text-text">{resolutionRow.paymentCode || "-"}</div>
              </div>
              <div className="rounded-[14px] border border-border bg-surface p-3">
                <div className="text-[10px] font-black uppercase tracking-wide text-muted">Tiền vào</div>
                <div className="mt-2 text-[13px] font-black text-[#059669]">{formatVnd(resolutionRow.amount || 0)}</div>
              </div>
              <div className="rounded-[14px] border border-border bg-surface p-3">
                <div className="text-[10px] font-black uppercase tracking-wide text-muted">Tiền thừa</div>
                <div className="mt-2 text-[13px] font-black text-blue-600">{formatVnd(Math.max(0, Number(resolutionRow.amount || 0) - Number(resolutionRow.expectedAmount || 0)))}</div>
              </div>
            </div>

            <div className="rounded-[14px] border border-blue-200 bg-blue-50 p-3 text-[12px] leading-5 text-blue-900">
              `Dư có khách hàng` và `Cấn trừ kỳ sau` sẽ tạo credit note để dùng về sau. `Chờ hoàn lại` sẽ tạo tác vụ vận hành để kế toán xử lý hoàn tiền.
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
              disabled={isSubmitting}
            >
              {isSubmitting ? "Đang cập nhật..." : "Xác nhận đã hoàn"}
            </Button>
          </div>
        }
      >
        {refundCompletionRow && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-[14px] border border-border bg-surface p-3">
                <div className="text-[10px] font-black uppercase tracking-wide text-muted">Payment code</div>
                <div className="mt-2 text-[13px] font-black text-text">{refundCompletionRow.paymentCode || "-"}</div>
              </div>
              <div className="rounded-[14px] border border-border bg-surface p-3">
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
              <div className="rounded-[14px] border border-border bg-surface p-3">
                <div className="text-[10px] font-black uppercase tracking-wide text-muted">Tác vụ</div>
                <div className="mt-2 text-[13px] font-black text-text">
                  {refundCompletionRow.overpaymentTaskTitle || "Đang chờ hoàn"}
                </div>
              </div>
            </div>

            <div className="rounded-[14px] border border-amber-200 bg-amber-50 p-3 text-[12px] leading-5 text-amber-900">
              Xác nhận này sẽ đóng tác vụ hoàn dư và ghi dấu vết vào payment request để đối soát sau.
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
      ? "text-[#059669]"
      : tone === "warning"
        ? "text-[#f97316]"
        : tone === "danger"
          ? "text-rose-500"
          : tone === "info"
            ? "text-blue-600"
            : "text-text";

  return (
    <div className="rounded-[14px] border border-border bg-surface p-3">
      <div className="text-[10px] font-black uppercase tracking-wide text-muted">{label}</div>
      <div className={`mt-2 text-[16px] font-black ${valueClass}`}>{value}</div>
    </div>
  );
}
