"use client";

import React, { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Link2, SearchCheck } from "lucide-react";
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
  { value: "UNMATCHED", label: "Chưa match" },
  { value: "SHORT_AMOUNT", label: "Thiếu tiền" },
  { value: "OVER_AMOUNT", label: "Thừa tiền" },
  { value: "WRONG_BANK", label: "Sai bank" },
  { value: "IGNORED_OUTGOING", label: "Giao dịch ra" },
];

const sourceTypeOptions = [
  { value: "INVOICE", label: "Hóa đơn" },
  { value: "DEPOSIT", label: "Phiếu cọc" },
];

const statusLabels: Record<string, string> = {
  MATCHED: "Đã khớp",
  UNMATCHED: "Chưa match",
  SHORT_AMOUNT: "Thiếu tiền",
  OVER_AMOUNT: "Thừa tiền",
  WRONG_BANK: "Sai bank",
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
  const [sourceType, setSourceType] = useState<"INVOICE" | "DEPOSIT">("INVOICE");
  const [sourceCode, setSourceCode] = useState("");
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

  return (
    <>
      <section className="overflow-hidden rounded-[16px] border border-border bg-card shadow-sm">
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
            <Select value={year} onChange={(event) => setYear(event.target.value)} options={yearOptions} />
            <Select value={month} onChange={(event) => setMonth(event.target.value)} options={monthOptions} />
            <Select value={status} onChange={(event) => setStatus(event.target.value)} options={statusOptions} />
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
                  return (
                    <tr key={row.id} className="border-t border-border">
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
                        <div className="text-[11px] text-muted">{row.requestStatus || row.providerTransactionId || "-"}</div>
                      </td>
                      <td className="px-4 py-3 text-right font-black text-[#059669]">{formatVnd(row.amount)}</td>
                      <td className="px-4 py-3 text-right font-black text-text">{formatVnd(row.expectedAmount)}</td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-text">{row.bankAccount?.bankName || row.accountNumber || "-"}</div>
                        <div className="text-[11px] text-muted">{row.owner?.name || "Chưa xác định owner"}</div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {canManualAssign ? (
                          <Button variant="outline" size="sm" onClick={() => openAssignModal(row)}>
                            <Link2 size={14} className="mr-1.5" />
                            Gán tay
                          </Button>
                        ) : (
                          <span className="text-[12px] font-semibold text-muted">-</span>
                        )}
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
        footer={
          <div className="flex items-center justify-end gap-3">
            <Button variant="outline" onClick={closeAssignModal}>
              Hủy
            </Button>
            <Button onClick={handleManualAssign} disabled={isSubmitting}>
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
                <Select value={sourceType} onChange={(event) => setSourceType(event.target.value as "INVOICE" | "DEPOSIT")} options={sourceTypeOptions} />
              </div>
              <div>
                <div className="mb-2 text-[12px] font-black uppercase tracking-wide text-muted">
                  {sourceType === "INVOICE" ? "Mã hóa đơn" : "Mã phiếu cọc"}
                </div>
                <Input
                  value={sourceCode}
                  onChange={(event) => setSourceCode(event.target.value)}
                  placeholder={sourceType === "INVOICE" ? "VD: INV-001" : "VD: DEP-001"}
                />
              </div>
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
