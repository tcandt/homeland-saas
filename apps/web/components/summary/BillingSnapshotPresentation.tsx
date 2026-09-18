import React from "react";

interface BillingProvenanceBadgeProps {
  hasContract: boolean;
  dataSource?: string | null;
  snapshotId?: string | null;
  usagePeriod?: string | null;
  testId: string;
  className?: string;
}

interface ElectricityMismatchAlertProps {
  reconciliation?: {
    deltaKwh: number;
    deltaAmount: number;
    status: "MATCHED" | "MISMATCHED";
  } | null;
  testId: string;
  compact?: boolean;
}

function formatVnd(value: number) {
  return `${Number(value || 0).toLocaleString("vi-VN")} đ`;
}

function formatKwh(value: number) {
  return `${Number(value || 0).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} kWh`;
}

/** Presentation only: the API remains the source of billing amounts and provenance. */
export function BillingProvenanceBadge({
  hasContract,
  dataSource,
  snapshotId,
  usagePeriod,
  testId,
  className = "",
}: BillingProvenanceBadgeProps) {
  if (!hasContract) return null;

  const isLockedSnapshot = dataSource === "LOCKED_SNAPSHOT";
  const label = isLockedSnapshot ? "Snapshot đã khóa" : "Dữ liệu chưa khóa";
  const snapshotTrace = `snapshot ${snapshotId || "không có mã"}, kỳ ${usagePeriod || "không rõ"}`;

  return (
    <span
      data-testid={testId}
      aria-label={`Nguồn dữ liệu hóa đơn: ${label}${isLockedSnapshot ? `, ${snapshotTrace}` : ""}`}
      title={isLockedSnapshot ? `Nguồn hóa đơn: ${snapshotTrace}` : undefined}
      className={`inline-flex rounded-sm px-1 py-0.5 text-[9px] font-bold ${
        isLockedSnapshot
          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          : "bg-amber-500/10 text-amber-700 dark:text-amber-300"
      } ${className}`}
    >
      {isLockedSnapshot ? `${label} · ${snapshotTrace}` : label}
    </span>
  );
}

/** Presentation only: reconciliation values are rendered exactly as supplied by the API. */
export function ElectricityMismatchAlert({
  reconciliation,
  testId,
  compact = false,
}: ElectricityMismatchAlertProps) {
  if (reconciliation?.status !== "MISMATCHED") return null;

  const delta = `${formatKwh(reconciliation.deltaKwh)} · ${formatVnd(reconciliation.deltaAmount)}`;

  if (compact) {
    return (
      <span
        data-testid={testId}
        role="alert"
        aria-label={`Cảnh báo đối soát điện: lệch ${delta}`}
        className="rounded-sm bg-red-500/10 px-1 py-0.5 text-red-700 dark:text-red-300"
      >
        Lệch {delta}
      </span>
    );
  }

  return (
    <div
      data-testid={testId}
      role="alert"
      aria-live="polite"
      className="border-t border-red-500/20 bg-red-500/10 px-3.5 py-2.5 text-[11px] font-bold text-red-700 dark:text-red-300"
    >
      Số Hunonic hiện tại lệch snapshot: {delta}. Hóa đơn vẫn giữ nguyên số snapshot; cần đối soát trước khi điều chỉnh.
    </div>
  );
}
