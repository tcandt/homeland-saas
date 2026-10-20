"use client";

import { HunonicSyncStatus } from "@/lib/api/hunonic.api";
import { syncPhaseLabel } from "@/lib/hunonic/sync-presentation";

export function HunonicSyncProgress({ status, error }: { status: HunonicSyncStatus | null; error?: string | null }) {
  if (!status && !error) return null;
  const isSuccess = status?.status === "SUCCESS";
  const isFailed = status?.status === "FAILED";
  const percent = isSuccess ? 100 : Math.max(0, Math.min(99, Number(status?.percent || 0)));
  const message = isFailed ? (status?.error || "Đồng bộ thất bại") : (error || syncPhaseLabel(status?.phase));
  return (
    <div className={`min-h-[52px] rounded-lg border px-3 py-2 text-xs ${isFailed ? "border-red-500/30 bg-red-500/5 text-red-700" : "border-emerald-500/25 bg-emerald-500/5 text-text"}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0 break-words font-semibold">{message}</span>
        <span className="shrink-0 font-black tabular-nums">{percent}%</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Tiến độ đồng bộ Hunonic" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
        <div className={`h-full rounded-full transition-[width] duration-300 ${isFailed ? "bg-red-500" : "bg-emerald-500"}`} style={{ width: `${percent}%` }} />
      </div>
      {status && <div className="mt-1 text-[11px] text-muted tabular-nums">{status.processed}/{status.total || "?"} công việc</div>}
      {isSuccess && status.result?.backfillWarning && <p role="alert" className="mt-1 text-amber-700 dark:text-amber-400">Chỉ số hiện tại đã đồng bộ; chưa tải được lịch sử. Cần thử đồng bộ lại.</p>}
      {isSuccess && Boolean(status.result?.skippedIncompletePoints) && <p role="alert" className="mt-1 text-amber-700 dark:text-amber-400">Hunonic trả thiếu dữ liệu cho {status.result?.skippedIncompletePoints} điểm lịch sử; các điểm này chưa được lưu.</p>}
    </div>
  );
}
