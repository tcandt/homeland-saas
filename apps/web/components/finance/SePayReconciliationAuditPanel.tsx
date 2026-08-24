"use client";

import React, { useMemo, useState } from "react";
import { AlertTriangle, ShieldAlert } from "lucide-react";
import { Select } from "@/components/ui/Select";
import { useSePayReconciliationAuditQuery } from "@/lib/queries/finance.queries";

const severityOptions = [
  { value: "", label: "Mọi mức độ" },
  { value: "CRITICAL", label: "Critical" },
  { value: "WARNING", label: "Warning" },
  { value: "INFO", label: "Info" },
];

const severityClass: Record<string, string> = {
  CRITICAL: "bg-rose-50 text-rose-700",
  WARNING: "bg-amber-50 text-amber-700",
  INFO: "bg-sky-50 text-sky-700",
};

const typeLabels: Record<string, string> = {
  CONFIRMED_REQUEST_SOURCE_OPEN: "Confirmed nhưng source chưa settled",
  SETTLED_SOURCE_MISSING_CONFIRMED_REQUEST: "Source settled nhưng request chưa confirmed",
  PROCESSED_WEBHOOK_REQUEST_UNCONFIRMED: "Webhook processed nhưng request chưa confirmed",
  CONFIRMED_REQUEST_MISSING_TRANSACTION_ID: "Confirmed thiếu transaction id",
  OVERPAYMENT_REFUND_PENDING_STALE: "Hoàn dư treo quá lâu",
  SEPAY_PAYMENT_WITHOUT_CONFIRMED_REQUEST: "Có payment SePay nhưng thiếu confirmed request",
  WEBHOOK_REVIEW_STALE: "Webhook treo cần xử lý",
  UNMATCHED_WEBHOOK_STALE: "Webhook chưa khớp nguồn",
};

const formatVnd = (value?: number | null) =>
  value === null || value === undefined ? "-" : `${Number(value || 0).toLocaleString("vi-VN")} đ`;

const formatDateTime = (value?: string | null) => (value ? new Date(value).toLocaleString("vi-VN") : "-");

export default function SePayReconciliationAuditPanel() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(String(currentYear));
  const [month, setMonth] = useState("");
  const [severity, setSeverity] = useState("");
  const [type, setType] = useState("");
  const params = useMemo(
    () => ({ year, ...(month ? { month } : {}), ...(severity ? { severity } : {}), ...(type ? { type } : {}) }),
    [month, severity, type, year],
  );
  const { data, isLoading, isError } = useSePayReconciliationAuditQuery(params);
  const rows = Array.isArray(data?.rows) ? data.rows : [];
  const issueTypeOptions = useMemo(
    () => [
      { value: "", label: "Mọi loại lỗi" },
      ...((Array.isArray(data?.filters?.issueTypes) ? data.filters.issueTypes : []) as Array<{ type: string; count: number }>).map(
        (item) => ({
          value: item.type,
          label: `${typeLabels[item.type] || item.type} (${item.count})`,
        }),
      ),
    ],
    [data?.filters?.issueTypes],
  );

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

  return (
    <section
      data-testid="sepay-reconciliation-audit"
      className="overflow-hidden rounded-[16px] border border-border bg-card shadow-sm"
    >
      <div className="flex flex-col gap-4 border-b border-border p-[16px] md:flex-row md:items-start md:justify-between md:p-[20px]">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.14em] text-amber-600">
            <ShieldAlert size={14} />
            SePay audit
          </div>
          <h2 className="mt-2 text-[16px] font-black text-text md:text-[18px]">Audit sai lệch thanh toán</h2>
          <p className="mt-1 max-w-[760px] text-[12px] leading-5 text-muted md:text-[13px]">
            Dò chéo giữa payment request, webhook và chứng từ nguồn để phát hiện các case lệch trạng thái cần xử lý thủ công.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:min-w-[640px] sm:grid-cols-4">
          <Select value={year} onChange={(event) => setYear(event.target.value)} options={yearOptions} />
          <Select value={month} onChange={(event) => setMonth(event.target.value)} options={monthOptions} />
          <Select value={severity} onChange={(event) => setSeverity(event.target.value)} options={severityOptions} />
          <Select value={type} onChange={(event) => setType(event.target.value)} options={issueTypeOptions} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 border-b border-border p-[16px] md:grid-cols-4 md:p-[20px]">
        <Metric label="Tổng issue" value={data?.summary?.total || 0} />
        <Metric label="Critical" value={data?.summary?.critical || 0} tone="critical" />
        <Metric label="Warning" value={data?.summary?.warning || 0} tone="warning" />
        <Metric label="Info" value={data?.summary?.info || 0} tone="info" />
      </div>

      {isLoading && <div className="p-8 text-center text-[13px] font-semibold text-muted">Đang tải SePay audit...</div>}
      {isError && <div className="p-8 text-center text-[13px] font-semibold text-rose-500">Không tải được SePay audit.</div>}

      {!isLoading && !isError && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1480px] text-left text-sm">
            <thead className="bg-surface text-[11px] uppercase text-muted">
              <tr>
                <th className="px-4 py-3 font-black">Mức độ</th>
                <th className="px-4 py-3 font-black">Loại lỗi</th>
                <th className="px-4 py-3 font-black">Nguồn</th>
                <th className="px-4 py-3 font-black">Payment / webhook</th>
                <th className="px-4 py-3 font-black">Phòng / tòa nhà</th>
                <th className="px-4 py-3 text-right font-black">Expected</th>
                <th className="px-4 py-3 text-right font-black">Actual</th>
                <th className="px-4 py-3 font-black">Tuổi lỗi</th>
                <th className="px-4 py-3 font-black">Chi tiết</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-[13px] font-semibold text-muted">
                    Không có issue nào theo bộ lọc hiện tại.
                  </td>
                </tr>
              )}
              {rows.map((row: any) => (
                <tr key={row.id} className="border-t border-border align-top">
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-black ${
                        severityClass[row.severity] || "bg-slate-100 text-slate-700"
                      }`}
                    >
                      <AlertTriangle size={12} />
                      {row.severity}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-bold text-text">{typeLabels[row.type] || row.type}</div>
                    <div className="mt-1 text-[11px] text-muted">{row.title}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-bold text-text">{row.sourceCode || row.sourceId || "-"}</div>
                    <div className="text-[11px] text-muted">
                      {row.sourceType || "-"} • {row.sourceStatus || "-"}
                    </div>
                    <div className="mt-1 text-[11px] text-muted">
                      Request: {row.requestStatus || "-"} {row.webhookStatus ? `• Webhook: ${row.webhookStatus}` : ""}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-bold text-text">{row.paymentCode || "-"}</div>
                    <div className="text-[11px] text-muted">{row.providerTransactionId || "-"}</div>
                    <div className="mt-1 text-[11px] text-muted">{formatDateTime(row.createdAt)}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-bold text-text">{row.roomCode || "-"}</div>
                    <div className="text-[11px] text-muted">{row.buildingName || "-"}</div>
                    {row.roomRentalTypeLabel ? (
                      <div className="mt-1 text-[11px] font-semibold text-[#7c3aed]">
                        {row.roomRentalTypeLabel}
                        {row.roomMemberCount ? ` • ${row.roomMemberCount} người` : ""}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-right font-black text-text">{formatVnd(row.expectedAmount)}</td>
                  <td className="px-4 py-3 text-right font-black text-[#2563eb]">{formatVnd(row.actualAmount)}</td>
                  <td className="px-4 py-3">
                    <div className="font-bold text-text">{row.ageHours !== null ? `${row.ageHours}h` : "-"}</div>
                    <div className="text-[11px] text-muted">{row.ownerName || row.bankName || "-"}</div>
                  </td>
                  <td className="px-4 py-3 text-[12px] leading-5 text-muted">{row.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  tone?: "critical" | "warning" | "info";
}) {
  const valueClass =
    tone === "critical" ? "text-rose-500" : tone === "warning" ? "text-amber-600" : tone === "info" ? "text-sky-600" : "text-text";

  return (
    <div className="rounded-[14px] border border-border bg-surface p-3">
      <div className="text-[10px] font-black uppercase tracking-wide text-muted">{label}</div>
      <div className={`mt-2 text-[16px] font-black ${valueClass}`}>{value}</div>
    </div>
  );
}
