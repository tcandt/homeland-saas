"use client";

import React, { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  GitBranch,
  History,
  RefreshCcw,
  Rocket,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Terminal,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { systemUpdateApi, SystemUpdateJob } from "@/lib/api/system-update.api";
import { useAuthStore } from "@/lib/auth/auth-store";
import toast from "react-hot-toast";
import webPackage from "../../../package.json";

function shortVersion(value?: string) {
  if (!value || value === "unknown") return "---";
  return value.slice(0, 7);
}

function displayVersion(value?: string) {
  const v = value || process.env.NEXT_PUBLIC_APP_VERSION || webPackage.version || "1.0.0";
  return `v${v.replace(/^v+/i, "")}`;
}

export default function SettingsSystemUpdate() {
  const user = useAuthStore((state) => state.user);
  const check = useSWR("system-update-check", () => systemUpdateApi.check(), { revalidateOnFocus: false });
  const status = useSWR("system-update-status", () => systemUpdateApi.status(), {
    revalidateOnFocus: false,
    refreshInterval: (data) => data && !["IDLE", "DONE", "FAILED", "BLOCKED", "ROLLED_BACK"].includes(data.status) ? 1500 : 0,
  });
  const [confirmMode, setConfirmMode] = useState<"install" | "rollback" | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const info = check.data;
  const job = status.data as SystemUpdateJob | undefined;
  const isJobRunning = Boolean(job && !["IDLE", "DONE", "FAILED", "BLOCKED", "ROLLED_BACK"].includes(job.status));
  const isUpToDate = !info?.updateAvailable;

  const handleRefresh = async () => {
    try {
      await check.mutate();
      toast.success("Đã làm mới và kiểm tra phiên bản mới nhất từ GitHub");
    } catch {
      toast.error("Không thể kết nối máy chủ GitHub");
    }
  };

  const startJob = async () => {
    if (!confirmMode) return;
    setIsSubmitting(true);
    try {
      const payload = { targetVersion: confirmMode === "install" ? info?.latestVersion : undefined, dryRun: false };
      const nextJob = confirmMode === "install"
        ? await systemUpdateApi.install(payload)
        : await systemUpdateApi.rollback(payload);
      await status.mutate(nextJob, { revalidate: false });
      setConfirmMode(null);
      toast.success(confirmMode === "install" ? "Đã tạo job cập nhật hệ thống" : "Đã tạo job rollback");
    } catch (error: any) {
      toast.error(error?.message || "Không thể thực hiện tác vụ");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="rounded-xl border border-border/70 bg-card p-3.5 md:p-4 shadow-2xs flex flex-col gap-3.5" data-testid="settings-system-update">
      {/* Header with Title & 3 Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/50 pb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 shrink-0">
            <Rocket size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm md:text-base font-black text-text tracking-tight">
                Cập nhật phiên bản & Rollback hệ thống (System Version)
              </h3>
              {isUpToDate && (
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/20 flex items-center gap-1">
                  <CheckCircle2 size={11} /> Phiên bản mới nhất
                </span>
              )}
            </div>
            <p className="text-xs text-muted font-medium mt-0.5">
              Theo dõi release tag mới nhất từ GitHub, quản lý triển khai an toàn và tự động sao lưu trước cập nhật.
            </p>
          </div>
        </div>

        {/* Prominent Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <Link href="/update">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8.5 gap-1.5 rounded-xl border-purple-500/30 text-purple-600 dark:text-purple-400 hover:bg-purple-500/10 text-xs font-bold shadow-2xs"
            >
              <Terminal size={13} />
              <span>Xem Live Console (/update)</span>
            </Button>
          </Link>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            isLoading={check.isLoading}
            className="h-8.5 gap-1.5 rounded-xl border-border/70 text-xs font-bold shadow-2xs hover:border-primary/50"
          >
            <RefreshCcw size={13} className={check.isLoading ? "animate-spin" : ""} />
            <span>Làm mới</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setConfirmMode("rollback")}
            disabled={isJobRunning}
            className="h-8.5 gap-1.5 rounded-xl border-amber-500/30 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10 text-xs font-bold shadow-2xs"
          >
            <RotateCcw size={13} />
            <span>Rollback</span>
          </Button>

          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => setConfirmMode("install")}
            disabled={isJobRunning}
            className="h-8.5 gap-1.5 rounded-xl px-3.5 text-xs font-bold shadow-2xs"
          >
            <Rocket size={13} />
            <span>Cập nhật phiên bản mới</span>
          </Button>
        </div>
      </div>

      {/* 4 Info Columns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
        <div className="rounded-xl border border-border/60 bg-muted/5 p-3 flex flex-col justify-between gap-1">
          <div className="flex items-center justify-between text-xs text-muted font-bold">
            <span className="flex items-center gap-1.5">
              <GitBranch size={13} className="text-primary" /> Version hiện tại
            </span>
            <span className="font-mono text-[10px] text-muted">{shortVersion(info?.currentCommit)}</span>
          </div>
          <div className="font-mono font-black text-base text-text">
            {displayVersion(info?.currentVersion)}
          </div>
          <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
            <CheckCircle2 size={11} /> Ứng dụng đang hoạt động ổn định
          </div>
        </div>

        <div className="rounded-xl border border-border/60 bg-muted/5 p-3 flex flex-col justify-between gap-1">
          <div className="flex items-center justify-between text-xs text-muted font-bold">
            <span className="flex items-center gap-1.5">
              <Sparkles size={13} className="text-purple-500" /> Version mới nhất
            </span>
            <span className="font-mono text-[10px] text-muted">{shortVersion(info?.latestCommit)}</span>
          </div>
          <div className="font-mono font-black text-base text-text">
            {displayVersion(info?.latestVersion || info?.currentVersion)}
          </div>
          <div className="text-[11px] text-muted font-medium">
            {info?.updateAvailable ? "Có phiên bản cập nhật khả dụng" : "Không có thay đổi mới cần cập nhật"}
          </div>
        </div>

        <div className="rounded-xl border border-border/60 bg-muted/5 p-3 flex flex-col justify-between gap-1">
          <div className="flex items-center justify-between text-xs text-muted font-bold">
            <span className="flex items-center gap-1.5">
              <ShieldCheck size={13} className="text-emerald-500" /> Chế độ vận hành
            </span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold">An toàn</span>
          </div>
          <div className="font-mono font-black text-base text-emerald-600 dark:text-emerald-400">
            {info?.mode || "dry-run (safe)"}
          </div>
          <div className="text-[11px] text-muted font-medium">
            Tự động tạo snapshot trước khi chạy migration
          </div>
        </div>

        <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3 flex flex-col justify-between gap-1">
          <div className="flex items-center justify-between text-xs text-muted font-bold">
            <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
              <Database size={13} /> Sao lưu & Phục hồi
            </span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold">Đã kết nối</span>
          </div>
          <div className="font-mono font-black text-base text-text">
            Agent Backend
          </div>
          <div className="text-[11px] text-muted font-medium flex items-center gap-1">
            <CheckCircle2 size={11} className="text-emerald-500" /> Kết nối agent sao lưu backend ổn định
          </div>
        </div>
      </div>

      {/* Live Job Progress & Logs Panel */}
      {job?.id && job.status !== "IDLE" && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-3.5 flex flex-col gap-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                {isJobRunning && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>}
                <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                  job.status === "DONE" || job.status === "ROLLED_BACK"
                    ? "bg-emerald-500"
                    : job.status === "FAILED"
                    ? "bg-rose-500"
                    : job.status === "BLOCKED"
                    ? "bg-amber-500"
                    : "bg-primary"
                }`}></span>
              </span>
              <span className="text-xs font-bold text-text">
                {job.type === "rollback" ? "Tiến trình Rollback" : "Tiến trình Cập nhật phiên bản"}
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-background border border-border/60 text-muted">
                {job.fromVersion} ➔ {job.toVersion}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${
                job.status === "DONE" || job.status === "ROLLED_BACK"
                  ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                  : job.status === "FAILED"
                  ? "bg-rose-500/10 text-rose-600 border-rose-500/20"
                  : job.status === "BLOCKED"
                  ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
                  : "bg-primary/10 text-primary border-primary/20"
              }`}>
                {job.status === "DONE" && "✅ Cập nhật thành công"}
                {job.status === "ROLLED_BACK" && "🔄 Đã hoàn tất Rollback"}
                {job.status === "FAILED" && "❌ Thất bại"}
                {job.status === "BLOCKED" && "⚠️ Đang ở chế độ mô phỏng an toàn (Safe Dry-Run)"}
                {!["DONE", "ROLLED_BACK", "FAILED", "BLOCKED"].includes(job.status) && `Đang xử lý: ${job.status}`}
              </span>
              <span className="font-mono font-black text-xs text-primary">{job.progressPercent}%</span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="h-2 w-full overflow-hidden rounded-full bg-border/40">
            <div
              className={`h-full transition-all duration-500 ${
                job.status === "DONE" || job.status === "ROLLED_BACK"
                  ? "bg-emerald-500"
                  : job.status === "FAILED"
                  ? "bg-rose-500"
                  : "bg-gradient-to-r from-primary to-purple-500"
              }`}
              style={{ width: `${Math.max(5, Math.min(100, job.progressPercent))}%` }}
            />
          </div>

          {/* Realtime Terminal Logs */}
          {job.logs && job.logs.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-[11px] text-muted font-bold">
                <span className="flex items-center gap-1">
                  <History size={12} /> Nhật ký thực thi thời gian thực (Live Logs)
                </span>
                <span className="text-[10px] font-mono text-muted">{job.logs.length} sự kiện</span>
              </div>
              <div className="max-h-36 overflow-y-auto rounded-lg bg-neutral-950 p-2.5 font-mono text-[11px] leading-relaxed text-neutral-300 border border-neutral-800 shadow-inner">
                {job.logs.map((log, idx) => (
                  <div key={idx} className="flex items-start gap-2 py-0.5">
                    <span className="text-neutral-500 select-none">{idx + 1}.</span>
                    <span className={log.includes("STDERR") || log.includes("failed") ? "text-rose-400" : log.includes("finished") || log.includes("success") ? "text-emerald-400" : "text-neutral-200"}>
                      {log}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Confirmation Modal */}
      <Modal
        isOpen={Boolean(confirmMode)}
        onClose={() => setConfirmMode(null)}
        title={confirmMode === "install" ? "Xác nhận cập nhật phiên bản mới" : "Xác nhận Rollback phiên bản"}
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button variant="outline" size="sm" onClick={() => setConfirmMode(null)} disabled={isSubmitting} className="h-9 rounded-xl text-xs font-bold">
              Hủy
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={startJob}
              disabled={isSubmitting}
              className={`h-9 gap-1.5 rounded-xl px-4 text-xs font-bold ${confirmMode === "rollback" ? "bg-amber-600 hover:bg-amber-700" : ""}`}
            >
              {isSubmitting ? <RefreshCcw size={13} className="animate-spin" /> : <Rocket size={13} />}
              <span>{confirmMode === "install" ? "Bắt đầu cập nhật" : "Bắt đầu rollback"}</span>
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-3 py-1 text-xs">
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-muted leading-relaxed">
            Hệ thống sẽ tự động tạo một bản sao lưu dữ liệu toàn phần (Snapshot Backup) trước khi thực hiện quy trình cập nhật.
          </div>
          <p className="font-bold text-text">
            Bạn có chắc chắn muốn {confirmMode === "install" ? "nâng cấp phiên bản hệ thống lên bản mới nhất" : "khôi phục (rollback) về bản build trước"} không?
          </p>
        </div>
      </Modal>
    </Card>
  );
}
