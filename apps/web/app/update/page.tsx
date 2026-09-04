"use client";

import React, { useState, useEffect, useRef } from "react";
import useSWR from "swr";
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Clock,
  Copy,
  Cpu,
  Database,
  ExternalLink,
  GitBranch,
  HardDrive,
  History,
  Layers,
  Play,
  RefreshCcw,
  Rocket,
  RotateCcw,
  Server,
  ShieldCheck,
  Sparkles,
  Terminal,
  Zap,
} from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { systemUpdateApi, SystemUpdateJob } from "@/lib/api/system-update.api";
import { useAuthStore } from "@/lib/auth/auth-store";
import toast from "react-hot-toast";

const UPDATE_STAGES = [
  { key: "CHECKING", label: "Xác nhận Version", percent: 8, icon: GitBranch },
  { key: "DOWNLOADING", label: "Tải Source/Artifact", percent: 22, icon: Layers },
  { key: "BACKING_UP", label: "Tạo Snapshot Backup", percent: 38, icon: Database },
  { key: "BUILDING", label: "Dọn dẹp & Build Docker", percent: 56, icon: Cpu },
  { key: "MIGRATING", label: "Đồng bộ Database", percent: 78, icon: HardDrive },
  { key: "RESTARTING", label: "Khởi động Services", percent: 88, icon: Server },
  { key: "HEALTH_CHECK", label: "Kiểm tra Health", percent: 96, icon: ShieldCheck },
  { key: "DONE", label: "Hoàn tất thành công", percent: 100, icon: CheckCircle2 },
];

function shortVersion(value?: string) {
  if (!value || value === "unknown") return "latest";
  return value.startsWith("v") ? value : `v${value}`;
}

export default function SystemUpdateLivePage() {
  const user = useAuthStore((state) => state.user);
  const [confirmMode, setConfirmMode] = useState<"install" | "rollback" | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const terminalBottomRef = useRef<HTMLDivElement>(null);

  // 1. Fetch check info
  const check = useSWR("system-update-check-page", () => systemUpdateApi.check(), {
    revalidateOnFocus: false,
    refreshInterval: 10000,
  });

  // 2. Fetch live job status every 1 second when running
  const status = useSWR("system-update-status-page", () => systemUpdateApi.status(), {
    revalidateOnFocus: true,
    refreshInterval: (data) =>
      data && !["IDLE", "DONE", "FAILED", "BLOCKED", "ROLLED_BACK"].includes(data.status) ? 1000 : 4000,
  });

  const info = check.data;
  const job = status.data as SystemUpdateJob | undefined;
  const isJobRunning = Boolean(job && !["IDLE", "DONE", "FAILED", "BLOCKED", "ROLLED_BACK"].includes(job.status));
  const isUpToDate = !info?.updateAvailable;

  // Auto-scroll terminal to bottom when logs update
  useEffect(() => {
    if (autoScroll && terminalBottomRef.current) {
      terminalBottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [job?.logs, autoScroll]);

  const handleRefresh = async () => {
    try {
      await Promise.all([check.mutate(), status.mutate()]);
      toast.success("Đã làm mới thông tin phiên bản từ GitHub");
    } catch {
      toast.error("Không thể kết nối máy chủ");
    }
  };

  const handleCopyLogs = () => {
    if (!job?.logs || job.logs.length === 0) {
      toast.error("Chưa có logs để sao chép");
      return;
    }
    navigator.clipboard.writeText(job.logs.join("\n"));
    toast.success("Đã sao chép toàn bộ nhật ký vào clipboard");
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
      toast.success(confirmMode === "install" ? "🚀 Đã khởi chạy tiến trình cập nhật" : "🔄 Đã khởi chạy tiến trình rollback");
    } catch (error: any) {
      toast.error(error?.message || "Không thể thực hiện tác vụ");
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentPercent = job?.id && job.status !== "IDLE" ? job.progressPercent : isUpToDate ? 100 : 0;

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl flex flex-col gap-5 p-4 md:p-6 pb-20">
        {/* Top Header Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-2xl border border-border/80 bg-gradient-to-r from-card via-card to-primary/5 p-5 shadow-sm">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary border border-primary/20 shadow-inner shrink-0">
              <Rocket size={24} className={isJobRunning ? "animate-bounce" : ""} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg md:text-xl font-black text-text tracking-tight">
                  Tiến Trình Cập Nhật Hệ Thống (System Live Update)
                </h1>
                <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold border flex items-center gap-1 ${
                  isJobRunning
                    ? "bg-primary/10 text-primary border-primary/30 animate-pulse"
                    : isUpToDate
                    ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                    : "bg-amber-500/10 text-amber-600 border-amber-500/20"
                }`}>
                  {isJobRunning ? (
                    <>
                      <RefreshCcw size={11} className="animate-spin" /> Đang cập nhật {job?.progressPercent}%
                    </>
                  ) : isUpToDate ? (
                    <>
                      <CheckCircle2 size={11} /> Đang ở bản mới nhất
                    </>
                  ) : (
                    <>
                      <Sparkles size={11} /> Có bản mới khả dụng
                    </>
                  )}
                </span>
              </div>
              <p className="text-xs text-muted font-medium mt-1">
                Giám sát thời gian thực quá trình build container, đồng bộ schema database và quản lý vòng đời triển khai VPS.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              isLoading={check.isLoading || status.isLoading}
              className="h-9 gap-1.5 rounded-xl border-border/70 text-xs font-bold shadow-2xs hover:border-primary/50"
            >
              <RefreshCcw size={13} className={check.isLoading ? "animate-spin" : ""} />
              <span>Kiểm tra lại</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setConfirmMode("rollback")}
              disabled={isJobRunning}
              className="h-9 gap-1.5 rounded-xl border-amber-500/30 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10 text-xs font-bold shadow-2xs"
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
              className="h-9 gap-2 rounded-xl px-4 text-xs font-bold shadow-md bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90"
            >
              <Rocket size={14} />
              <span>{isUpToDate ? "Cập nhật lại phiên bản" : "Bắt đầu cập nhật ngay"}</span>
            </Button>
          </div>
        </div>

        {/* 3 Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          <Card className="rounded-xl border border-border/70 bg-card p-4 flex flex-col justify-between gap-2 shadow-2xs">
            <div className="flex items-center justify-between text-xs text-muted font-bold">
              <span className="flex items-center gap-1.5">
                <GitBranch size={14} className="text-primary" /> Version đang chạy
              </span>
              <span className="font-mono text-[10px] text-muted">Active</span>
            </div>
            <div className="font-mono font-black text-2xl text-text tracking-tight">
              {shortVersion(info?.currentVersion)}
            </div>
            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
              <CheckCircle2 size={12} /> Database & Web Container Healthy
            </div>
          </Card>

          <Card className="rounded-xl border border-border/70 bg-card p-4 flex flex-col justify-between gap-2 shadow-2xs">
            <div className="flex items-center justify-between text-xs text-muted font-bold">
              <span className="flex items-center gap-1.5">
                <Sparkles size={14} className="text-purple-500" /> Version mới nhất trên GitHub
              </span>
              <span className="font-mono text-[10px] text-muted">Release</span>
            </div>
            <div className="font-mono font-black text-2xl text-purple-600 dark:text-purple-400 tracking-tight">
              {shortVersion(info?.latestVersion || info?.currentVersion)}
            </div>
            <div className="text-[11px] text-muted font-medium">
              {info?.updateAvailable ? "⚡ Có bản nâng cấp khả dụng" : "Đã đồng bộ với GitHub release"}
            </div>
          </Card>

          <Card className="rounded-xl border border-border/70 bg-card p-4 flex flex-col justify-between gap-2 shadow-2xs">
            <div className="flex items-center justify-between text-xs text-muted font-bold">
              <span className="flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-emerald-500" /> Cơ chế bảo vệ
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 font-bold">Auto-Prune</span>
            </div>
            <div className="font-mono font-black text-lg text-emerald-600 dark:text-emerald-400">
              Tự dọn Docker Cache
            </div>
            <div className="text-[11px] text-muted font-medium">
              Tự động sao lưu Snapshot & Push Schema DB
            </div>
          </Card>
        </div>

        {/* Big Live Progress Stepper & Bar */}
        <Card className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm flex flex-col gap-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Zap size={18} className="text-amber-500" />
              <h2 className="text-sm font-black text-text uppercase tracking-wider">
                Tiến Trình Thực Thi Thực Tế (Live Progress)
              </h2>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted font-medium">
                {isJobRunning ? "Đang xử lý tự động trên VPS..." : job?.status === "DONE" ? "Đã hoàn thành 100%" : "Trạng thái sẵn sàng"}
              </span>
              <span className="font-mono font-black text-lg text-primary">{currentPercent}%</span>
            </div>
          </div>

          {/* Animated Main Progress Bar */}
          <div className="h-3.5 w-full overflow-hidden rounded-full bg-border/40 p-0.5 border border-border/60">
            <div
              className={`h-full rounded-full transition-all duration-700 ease-out ${
                job?.status === "DONE" || isUpToDate
                  ? "bg-gradient-to-r from-emerald-500 to-teal-400 shadow-sm"
                  : job?.status === "FAILED"
                  ? "bg-rose-500"
                  : "bg-gradient-to-r from-primary via-purple-500 to-indigo-500 animate-pulse"
              }`}
              style={{ width: `${Math.max(5, Math.min(100, currentPercent))}%` }}
            />
          </div>

          {/* 8-Step Timeline Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 pt-2">
            {UPDATE_STAGES.map((st, i) => {
              const Icon = st.icon;
              const isPast = currentPercent >= st.percent;
              const isCurrent = isJobRunning && (job?.status === st.key || (currentPercent < st.percent && (i === 0 || currentPercent >= UPDATE_STAGES[i - 1].percent)));
              return (
                <div
                  key={st.key}
                  className={`flex flex-col items-center text-center p-2.5 rounded-xl border transition-all ${
                    isPast
                      ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400"
                      : isCurrent
                      ? "border-primary bg-primary/10 text-primary shadow-sm ring-2 ring-primary/20 scale-102"
                      : "border-border/50 bg-muted/5 text-muted opacity-60"
                  }`}
                >
                  <div className={`flex h-7 w-7 items-center justify-center rounded-lg mb-1.5 ${
                    isPast
                      ? "bg-emerald-500/20 text-emerald-600"
                      : isCurrent
                      ? "bg-primary text-white"
                      : "bg-muted/20 text-muted"
                  }`}>
                    {isCurrent ? <RefreshCcw size={13} className="animate-spin" /> : <Icon size={14} />}
                  </div>
                  <span className="text-[10px] font-bold leading-tight line-clamp-2">
                    {st.label}
                  </span>
                  <span className="text-[9px] font-mono mt-1 opacity-75">
                    {st.percent}%
                  </span>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Real-time Linux Terminal Console Box */}
        <Card className="rounded-2xl border border-neutral-800 bg-neutral-950 shadow-xl overflow-hidden flex flex-col">
          {/* Terminal Window Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-neutral-900 border-b border-neutral-800 flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-rose-500/80"></div>
                <div className="w-3 h-3 rounded-full bg-amber-500/80"></div>
                <div className="w-3 h-3 rounded-full bg-emerald-500/80"></div>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono text-neutral-300">
                <Terminal size={14} className="text-emerald-400" />
                <span>homeland@vps:~/homeland-public-production $ update-stream</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 text-[11px] font-mono text-neutral-400 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={autoScroll}
                  onChange={(e) => setAutoScroll(e.target.checked)}
                  className="rounded border-neutral-700 bg-neutral-800 text-primary focus:ring-0"
                />
                Auto-scroll
              </label>

              <button
                type="button"
                onClick={handleCopyLogs}
                className="flex items-center gap-1 text-[11px] font-mono text-neutral-300 hover:text-white px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 transition"
              >
                <Copy size={12} />
                <span>Copy Logs</span>
              </button>
            </div>
          </div>

          {/* Terminal Output Body */}
          <div className="p-4 font-mono text-xs text-neutral-200 leading-relaxed overflow-y-auto max-h-[360px] min-h-[220px] bg-neutral-950 flex flex-col gap-1 select-text">
            <div className="text-neutral-500 text-[11px] pb-2 border-b border-neutral-900">
              [HomeLand Production Update Engine v1.2.4 - WebSocket/Polling Stream Active]
            </div>

            {(!job?.logs || job.logs.length === 0) ? (
              <div className="text-neutral-400 py-6 text-center italic">
                {isJobRunning ? "Đang kết nối luồng sự kiện từ VPS..." : "Nhấn 'Bắt đầu cập nhật' để khởi chạy quy trình và xem luồng log trực tiếp tại đây."}
              </div>
            ) : (
              job.logs.map((log, idx) => {
                const isError = log.includes("STDERR") || log.includes("failed") || log.includes("FAILED") || log.includes("error");
                const isSuccess = log.includes("finished") || log.includes("success") || log.includes("DONE") || log.includes("READY");
                const isStep = log.includes("SYSTEM_UPDATE_STEP") || log.includes("Step");

                return (
                  <div key={idx} className="flex items-start gap-2.5 hover:bg-neutral-900/50 px-1.5 py-0.5 rounded transition">
                    <span className="text-neutral-600 select-none text-[10px] pt-0.5">{String(idx + 1).padStart(3, "0")}</span>
                    <span className={`break-all ${
                      isError
                        ? "text-rose-400 font-semibold"
                        : isSuccess
                        ? "text-emerald-400 font-semibold"
                        : isStep
                        ? "text-cyan-400 font-bold"
                        : "text-neutral-300"
                    }`}>
                      {log}
                    </span>
                  </div>
                );
              })
            )}
            <div ref={terminalBottomRef} />
          </div>

          {/* Terminal Footer with VPS Command Tip */}
          <div className="px-4 py-2.5 bg-neutral-900/90 border-t border-neutral-800 text-[11px] font-mono text-neutral-400 flex items-center justify-between flex-wrap gap-2">
            <span className="flex items-center gap-1.5">
              <Server size={12} className="text-primary" /> Lệnh chạy trực tiếp trên VPS SSH:
            </span>
            <code className="bg-neutral-950 px-2 py-0.5 rounded text-emerald-400 border border-neutral-800 select-all">
              bash /home/tcandt/homeland-public-production/update-public-production.sh
            </code>
          </div>
        </Card>
      </div>

      {/* Confirmation Modal */}
      <Modal
        isOpen={Boolean(confirmMode)}
        onClose={() => setConfirmMode(null)}
        title={confirmMode === "install" ? "Xác nhận nâng cấp phiên bản hệ thống" : "Xác nhận Rollback phiên bản"}
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
            Hệ thống sẽ tự động dọn dẹp Docker Build Cache, tạo bản Snapshot sao lưu dữ liệu toàn phần, sau đó build container mới và đồng bộ schema database.
          </div>
          <p className="font-bold text-text">
            Bạn có chắc chắn muốn {confirmMode === "install" ? "nâng cấp phiên bản hệ thống lên bản mới nhất" : "khôi phục (rollback) về bản build trước"} không?
          </p>
        </div>
      </Modal>
    </AppShell>
  );
}
