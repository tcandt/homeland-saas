"use client";

import React, { useEffect, useState } from "react";
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
import { systemUpdateApi, SystemUpdateCheck, SystemUpdateJob } from "@/lib/api/system-update.api";
import { useAuthStore } from "@/lib/auth/auth-store";
import toast from "react-hot-toast";

function shortVersion(value?: string) {
  if (!value || value === "unknown") return "---";
  return value.slice(0, 7);
}

function displayVersion(value?: string) {
  if (!value || value === "unknown") return "---";
  return `v${value.replace(/^v+/i, "")}`;
}

const TERMINAL_UPDATE_STATUSES = new Set(["IDLE", "DONE", "FAILED", "BLOCKED", "ROLLED_BACK"]);

type InstallTargetSnapshot = {
  version: string;
  ref: string;
};

function isSystemUpdateJobRunning(job?: SystemUpdateJob) {
  return Boolean(job && !TERMINAL_UPDATE_STATUSES.has(job.status));
}

function getInstallDisabledReason(input: {
  info?: SystemUpdateCheck;
  job?: SystemUpdateJob;
  isChecking: boolean;
  checkError?: unknown;
  isStatusChecking: boolean;
  statusError?: unknown;
  canRunSystemUpdate: boolean;
  isPreparing: boolean;
}) {
  if (input.isPreparing) return "Đang xác nhận lại phiên bản và trạng thái hệ thống";
  if (input.isChecking) return "Đang kiểm tra phiên bản mới nhất từ GitHub";
  if (input.checkError || input.info?.versionCheckStatus === "unavailable") {
    const requestError = typeof input.checkError === "string"
      ? input.checkError
      : input.checkError instanceof Error
        ? input.checkError.message
        : null;
    return requestError || input.info?.versionCheckError || "Không thể kiểm tra phiên bản mới nhất từ GitHub";
  }
  if (!input.info) return "Chưa có kết quả kiểm tra phiên bản từ GitHub";
  if (input.info.versionCheckStatus === "tag-only") {
    return "Chỉ đọc được release tags; chưa xác minh được phiên bản trên nhánh mặc định";
  }
  if (input.info.versionCheckStatus !== "ok") return "Trạng thái kiểm tra phiên bản không hợp lệ";
  if (!input.info.updateAvailable) return "Hệ thống đang ở phiên bản mới nhất";
  if (!input.info.canInstallAutomatically && input.info.mode !== "dry-run") {
    return "Chế độ cập nhật tự động chưa được bật";
  }
  if (!input.canRunSystemUpdate) return "Tài khoản không có quyền chạy cập nhật hệ thống";
  if (!input.info.latestVersion || !input.info.targetRef) return "Phiên bản mục tiêu chưa đầy đủ";
  if (isSystemUpdateJobRunning(input.job)) return "Một tiến trình cập nhật hoặc rollback đang chạy";
  if (input.isStatusChecking) return "Đang kiểm tra trạng thái tiến trình hệ thống";
  if (input.statusError || !input.job) return "Không thể xác nhận trạng thái tiến trình hệ thống";
  return null;
}

export default function SettingsSystemUpdate() {
  const user = useAuthStore((state) => state.user);
  const check = useSWR("system-update-check", () => systemUpdateApi.check(), { revalidateOnFocus: false });
  const status = useSWR("system-update-status", () => systemUpdateApi.status(), {
    revalidateOnFocus: false,
    refreshInterval: (data) => data && !TERMINAL_UPDATE_STATUSES.has(data.status) ? 1500 : 0,
  });
  const [confirmMode, setConfirmMode] = useState<"install" | "rollback" | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshingCheck, setIsRefreshingCheck] = useState(false);
  const [isPreparingInstall, setIsPreparingInstall] = useState(false);
  const [installTarget, setInstallTarget] = useState<InstallTargetSnapshot | null>(null);
  const [versionRefreshError, setVersionRefreshError] = useState<string | null>(null);

  const info = check.data;
  const job = status.data as SystemUpdateJob | undefined;
  const isJobRunning = isSystemUpdateJobRunning(job);
  const isChecking = check.isLoading || check.isValidating || isRefreshingCheck;
  const effectiveCheckError = versionRefreshError || check.error;
  const versionCheckFailed = Boolean(effectiveCheckError || info?.versionCheckStatus === "unavailable");
  const versionCheckDegraded = info?.versionCheckStatus === "tag-only";
  const isUpToDate = info?.updateAvailable === false && !versionCheckFailed && !versionCheckDegraded;
  const canRunSystemUpdate = Boolean(
    (user?.email || "").toLowerCase() === "admin@homeland.vn" &&
    (user?.roles?.includes("ADMIN") || user?.permissions?.includes("system.update.run")),
  );
  const installDisabledReason = getInstallDisabledReason({
    info,
    job,
    isChecking,
    checkError: effectiveCheckError,
    isStatusChecking: !job && (status.isLoading || status.isValidating),
    statusError: status.error,
    canRunSystemUpdate,
    isPreparing: isPreparingInstall,
  });
  const canInstall = installDisabledReason === null;

  useEffect(() => {
    if (!check.error && info?.checkedAt) setVersionRefreshError(null);
  }, [check.error, info?.checkedAt]);

  useEffect(() => {
    if (confirmMode !== "install" || !installTarget || !info) return;
    const targetChanged = info.latestVersion !== installTarget.version || info.targetRef !== installTarget.ref;
    if (!targetChanged && info.versionCheckStatus === "ok") return;

    setConfirmMode(null);
    setInstallTarget(null);
    toast.error("Nguồn cập nhật đã thay đổi hoặc không còn xác minh được. Vui lòng xác nhận lại.");
  }, [confirmMode, info, installTarget]);

  const handleRefresh = async () => {
    setIsRefreshingCheck(true);
    try {
      const refreshedInfo = await systemUpdateApi.check(true);
      await check.mutate(refreshedInfo, { revalidate: false });
      setVersionRefreshError(null);
      if (!refreshedInfo || refreshedInfo.versionCheckStatus === "unavailable") {
        toast.error(refreshedInfo?.versionCheckError || "Không thể kiểm tra phiên bản mới nhất từ GitHub");
        return;
      }
      if (refreshedInfo.versionCheckStatus === "tag-only") {
        toast.error("Chỉ đọc được release tags; chưa xác minh được phiên bản trên nhánh mặc định");
        return;
      }
      toast.success("Đã kiểm tra phiên bản mới nhất trên nhánh mặc định GitHub");
    } catch (error: any) {
      const message = error?.message || "Không thể kết nối máy chủ GitHub";
      setVersionRefreshError(message);
      toast.error(message);
    } finally {
      setIsRefreshingCheck(false);
    }
  };

  const openInstallConfirmation = async () => {
    if (!canInstall) {
      toast.error(installDisabledReason || "Chưa thể bắt đầu cập nhật");
      return;
    }

    setIsPreparingInstall(true);
    try {
      const freshInfo = await systemUpdateApi.check(true).catch((error: any) => {
        setVersionRefreshError(error?.message || "Không thể kiểm tra phiên bản mới nhất từ GitHub");
        throw error;
      });
      await check.mutate(freshInfo, { revalidate: false });
      setVersionRefreshError(null);
      const freshJob = await status.mutate();
      const refreshedDisabledReason = getInstallDisabledReason({
        info: freshInfo,
        job: freshJob,
        isChecking: false,
        checkError: null,
        isStatusChecking: false,
        statusError: null,
        canRunSystemUpdate,
        isPreparing: false,
      });
      if (refreshedDisabledReason) {
        toast.error(refreshedDisabledReason);
        return;
      }

      setInstallTarget({ version: freshInfo!.latestVersion, ref: freshInfo!.targetRef });
      setConfirmMode("install");
    } catch (error: any) {
      toast.error(error?.message || "Không thể xác nhận phiên bản và trạng thái hệ thống");
    } finally {
      setIsPreparingInstall(false);
    }
  };

  const closeConfirmation = () => {
    if (isSubmitting) return;
    setConfirmMode(null);
    setInstallTarget(null);
  };

  const startJob = async () => {
    if (!confirmMode) return;
    if (confirmMode === "install") {
      const targetStillMatches = Boolean(
        installTarget &&
        info?.versionCheckStatus === "ok" &&
        info.latestVersion === installTarget.version &&
        info.targetRef === installTarget.ref,
      );
      if (!canInstall || !targetStillMatches) {
        toast.error(installDisabledReason || "Nguồn cập nhật đã thay đổi. Vui lòng xác nhận lại.");
        setConfirmMode(null);
        setInstallTarget(null);
        return;
      }
    }
    setIsSubmitting(true);
    try {
      const freshJob = await status.mutate();
      if (!freshJob || isSystemUpdateJobRunning(freshJob)) {
        toast.error(freshJob ? "Một tiến trình cập nhật hoặc rollback đang chạy" : "Không thể xác nhận trạng thái tiến trình hệ thống");
        setConfirmMode(null);
        setInstallTarget(null);
        return;
      }
      const payload = {
        targetVersion: confirmMode === "install" ? installTarget?.version : undefined,
        targetRef: confirmMode === "install" ? installTarget?.ref : undefined,
        dryRun: info?.mode !== "enabled",
      };
      const nextJob = confirmMode === "install"
        ? await systemUpdateApi.install(payload)
        : await systemUpdateApi.rollback(payload);
      await status.mutate(nextJob, { revalidate: false });
      setConfirmMode(null);
      setInstallTarget(null);
      toast.success(confirmMode === "install"
        ? info?.mode === "dry-run" ? "Đã chạy mô phỏng cập nhật an toàn" : "Đã tạo job cập nhật hệ thống"
        : "Đã tạo job rollback");
    } catch (error: any) {
      if (["SYSTEM_UPDATE_TARGET_STALE", "SYSTEM_UPDATE_NOT_AVAILABLE"].includes(error?.code)) {
        setConfirmMode(null);
        setInstallTarget(null);
      }
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
              {(versionCheckFailed || versionCheckDegraded) && (
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-300 font-bold border border-amber-500/20 flex items-center gap-1">
                  <AlertTriangle size={11} /> {versionCheckFailed ? "Chưa kiểm tra được GitHub" : "Chỉ đọc được release tags"}
                </span>
              )}
            </div>
            <p className="text-xs text-muted font-medium mt-0.5">
              Theo dõi phiên bản trên nhánh mặc định và release tag GitHub, triển khai an toàn và tự động sao lưu trước cập nhật.
            </p>
          </div>
        </div>

        {/* Prominent Action Buttons */}
        <div className="flex min-w-0 shrink-0 flex-col items-start gap-1.5 sm:items-end">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href="/update"
              className="inline-flex h-8.5 min-h-11 items-center justify-center gap-1.5 rounded-xl border border-purple-500/30 px-3 text-xs font-bold text-purple-600 shadow-2xs transition-all hover:bg-purple-500/10 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 sm:min-h-0 dark:text-purple-400"
            >
              <Terminal size={13} />
              <span>Xem Live Console (/update)</span>
            </Link>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              isLoading={isChecking}
              aria-busy={isChecking}
              className="h-8.5 min-h-11 gap-1.5 rounded-xl border-border/70 text-xs font-bold shadow-2xs hover:border-primary/50 sm:min-h-0"
            >
              {!isChecking && <RefreshCcw size={13} />}
              <span>Làm mới</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setInstallTarget(null);
                setConfirmMode("rollback");
              }}
              disabled={isJobRunning || (!job && (status.isLoading || status.isValidating)) || Boolean(status.error) || !canRunSystemUpdate}
              className="h-8.5 min-h-11 gap-1.5 rounded-xl border-amber-500/30 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10 text-xs font-bold shadow-2xs sm:min-h-0"
            >
              <RotateCcw size={13} />
              <span>Rollback</span>
            </Button>

            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={openInstallConfirmation}
              disabled={!canInstall}
              isLoading={isPreparingInstall}
              aria-busy={isPreparingInstall}
              aria-describedby={!canInstall ? "settings-install-disabled-reason" : undefined}
              className="h-8.5 min-h-11 gap-1.5 rounded-xl px-3.5 text-xs font-bold shadow-2xs disabled:shadow-none disabled:saturate-50 sm:min-h-0"
            >
              {!isPreparingInstall && <Rocket size={13} />}
              <span>{info?.mode === "dry-run" ? "Mô phỏng cập nhật" : "Cập nhật phiên bản mới"}</span>
            </Button>
          </div>
          {!canInstall && (
            <p id="settings-install-disabled-reason" className="max-w-xl text-left text-[11px] font-medium text-muted sm:text-right">
              {installDisabledReason}
            </p>
          )}
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
              <Sparkles size={13} className="text-purple-500" /> {versionCheckDegraded ? "Release tag gần nhất" : "Version mới nhất"}
            </span>
            <span className="font-mono text-[10px] text-muted">{versionCheckFailed ? "---" : shortVersion(info?.latestCommit)}</span>
          </div>
          <div className="font-mono font-black text-base text-text">
            {info?.latestVersion && !versionCheckFailed ? displayVersion(info.latestVersion) : "---"}
          </div>
          <div className="text-[11px] text-muted font-medium" role="status" aria-live="polite">
            {isChecking
              ? "Đang kiểm tra phiên bản mới nhất từ GitHub..."
              : versionCheckFailed
                ? info?.versionCheckError || "Không thể kiểm tra phiên bản từ GitHub"
                : versionCheckDegraded
                  ? "Chỉ đọc được release tags; chưa xác minh được phiên bản trên nhánh mặc định"
                : info?.updateAvailable
                  ? "Có phiên bản cập nhật khả dụng"
                  : "Không có thay đổi mới cần cập nhật"}
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
                {job.status === "DONE" && "Cập nhật thành công"}
                {job.status === "ROLLED_BACK" && "Đã hoàn tất Rollback"}
                {job.status === "FAILED" && "Thất bại"}
                {job.status === "BLOCKED" && (job.dryRun
                  ? "Đã hoàn tất mô phỏng an toàn"
                  : "Release đã chuẩn bị — chờ host/service manager kích hoạt")}
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
        onClose={closeConfirmation}
        title={confirmMode === "install" ? "Xác nhận cập nhật phiên bản mới" : "Xác nhận Rollback phiên bản"}
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button variant="outline" size="sm" onClick={closeConfirmation} disabled={isSubmitting} className="h-9 min-h-11 rounded-xl text-xs font-bold sm:min-h-0">
              Hủy
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={startJob}
              disabled={isSubmitting || (confirmMode === "install" && !canInstall)}
              aria-busy={isSubmitting}
              aria-describedby={confirmMode === "install" && !canInstall ? "settings-install-modal-disabled-reason" : undefined}
              className={`h-9 min-h-11 gap-1.5 rounded-xl px-4 text-xs font-bold sm:min-h-0 ${confirmMode === "rollback" ? "bg-amber-600 hover:bg-amber-700" : ""}`}
            >
              {isSubmitting ? <RefreshCcw size={13} className="animate-spin" /> : <Rocket size={13} />}
              <span>{isSubmitting
                ? "Đang xác nhận trạng thái..."
                : confirmMode === "install"
                  ? info?.mode === "dry-run" ? "Chạy mô phỏng" : "Bắt đầu cập nhật"
                  : "Bắt đầu rollback"}</span>
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-3 py-1 text-xs">
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-muted leading-relaxed">
            {info?.mode === "dry-run"
              ? "Chế độ mô phỏng chỉ hiển thị các bước dự kiến, không tải source, dừng dịch vụ hoặc thay đổi dữ liệu."
              : "Hệ thống sẽ tạo Snapshot và chuẩn bị source đúng Git SHA. Với Docker Compose, host updater sẽ kiểm tra migration, prune image rác an toàn, dừng container ứng dụng, build/migrate/health check, rồi mới xóa image ứng dụng cũ."}
          </div>
          {confirmMode === "install" && installTarget && (
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-xl border border-border/70 bg-background p-3">
              <dt className="font-semibold text-muted">Phiên bản mục tiêu</dt>
              <dd className="font-mono font-bold text-text">{installTarget.version}</dd>
              <dt className="font-semibold text-muted">Git ref</dt>
              <dd className="break-all font-mono text-text">{installTarget.ref}</dd>
            </dl>
          )}
          {confirmMode === "install" && !canInstall && (
            <p
              id="settings-install-modal-disabled-reason"
              className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-3 font-medium text-amber-800 dark:text-amber-200"
              role="status"
            >
              {installDisabledReason}
            </p>
          )}
          <p className="font-bold text-text">
            Bạn có chắc chắn muốn {confirmMode === "install" ? `nâng cấp phiên bản hệ thống lên ${installTarget?.version || "mục tiêu đã xác minh"}` : "khôi phục (rollback) về bản build trước"} không?
          </p>
        </div>
      </Modal>
    </Card>
  );
}
