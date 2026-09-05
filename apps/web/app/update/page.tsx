"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import useSWR from "swr";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Cpu,
  Database,
  Download,
  GitBranch,
  GitCommit,
  HardDrive,
  Layers,
  Loader2,
  Lock,
  MoreVertical,
  Plus,
  RefreshCcw,
  Rocket,
  RotateCcw,
  Search,
  Server,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Terminal,
  Trash2,
  Zap,
} from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { systemUpdateApi, SystemUpdateJob, BackupManifestInfo } from "@/lib/api/system-update.api";
import { useAuthStore } from "@/lib/auth/auth-store";
import toast from "react-hot-toast";
import webPackage from "../../package.json";

const UPDATE_STAGES = [
  { key: "CHECKING", label: "Kiểm tra Version", percent: 8, icon: GitBranch },
  { key: "DOWNLOADING", label: "Tải Mã Nguồn", percent: 22, icon: Layers },
  { key: "BACKING_UP", label: "Tạo Snapshot", percent: 38, icon: Database },
  { key: "BUILDING", label: "Auto-Prune & Build", percent: 56, icon: Cpu },
  { key: "MIGRATING", label: "Đồng Bộ Schema", percent: 78, icon: HardDrive },
  { key: "RESTARTING", label: "Khởi Động Lại", percent: 88, icon: Server },
  { key: "HEALTH_CHECK", label: "Kiểm Tra Health", percent: 96, icon: ShieldCheck },
  { key: "DONE", label: "Hoàn Tất", percent: 100, icon: CheckCircle2 },
];

function formatBytes(bytes?: number) {
  if (!bytes) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function shortVersion(value?: string) {
  if (!value || value === "unknown") return "v1.2.4";
  return value.startsWith("v") ? value : `v${value}`;
}

export default function SystemUpdateLivePage() {
  const user = useAuthStore((state) => state.user);
  const [confirmMode, setConfirmMode] = useState<"install" | "rollback" | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [fontSize, setFontSize] = useState<"sm" | "xs">("xs");
  const [clearedLogsCount, setClearedLogsCount] = useState(0);
  const [copied, setCopied] = useState(false);
  const terminalBottomRef = useRef<HTMLDivElement>(null);

  // Snapshot action menu & modal states
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [selectedSnapshotForRestore, setSelectedSnapshotForRestore] = useState<BackupManifestInfo | null>(null);
  const [restorePassword, setRestorePassword] = useState("");
  const [isRestoring, setIsRestoring] = useState(false);
  const [snapshotToDelete, setSnapshotToDelete] = useState<BackupManifestInfo | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // 1. Fetch system update check info
  const check = useSWR("system-update-check-full", () => systemUpdateApi.check(), {
    revalidateOnFocus: false,
    refreshInterval: 60000,
  });

  // 2. Fetch live job status
  const status = useSWR("system-update-status-full", () => systemUpdateApi.status(), {
    revalidateOnFocus: true,
    refreshInterval: (data) =>
      data && !["IDLE", "DONE", "FAILED", "BLOCKED", "ROLLED_BACK"].includes(data.status) ? 1200 : 4000,
  });

  // 3. Fetch snapshots list
  const backups = useSWR("system-update-backups-full", () => systemUpdateApi.backups(), {
    revalidateOnFocus: false,
    refreshInterval: 30000,
  });

  const info = check.data;
  const job = status.data as SystemUpdateJob | undefined;
  const isJobRunning = Boolean(job && !["IDLE", "DONE", "FAILED", "BLOCKED", "ROLLED_BACK"].includes(job.status));
  const isUpToDate = !info?.updateAvailable;

  const logs = useMemo(() => {
    const rawLogs = job?.logs || [];
    const sliced = rawLogs.slice(clearedLogsCount);
    if (!searchTerm.trim()) return sliced;
    return sliced.filter((l) => l.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [job?.logs, clearedLogsCount, searchTerm]);

  // Auto-scroll terminal
  useEffect(() => {
    if (autoScroll && terminalBottomRef.current) {
      terminalBottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs.length, autoScroll]);

  const handleRefresh = async () => {
    try {
      await Promise.all([check.mutate(), status.mutate(), backups.mutate()]);
      toast.success("Đã đồng bộ thông tin mới nhất từ máy chủ GitHub");
    } catch {
      toast.error("Không thể kết nối máy chủ");
    }
  };

  const handleCopyLogs = () => {
    const rawLogs = job?.logs || [];
    if (rawLogs.length === 0) {
      toast.error("Chưa có logs để sao chép");
      return;
    }
    navigator.clipboard.writeText(rawLogs.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Đã sao chép toàn bộ logs vào clipboard");
  };

  const handleClearLogs = () => {
    setClearedLogsCount(job?.logs?.length || 0);
    toast.success("Đã xóa màn hình console");
  };

  const startJob = async () => {
    if (!confirmMode) return;
    setIsSubmitting(true);
    setClearedLogsCount(0);
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

  const handleDownloadManifest = (backup: BackupManifestInfo) => {
    const jsonStr = JSON.stringify(backup, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${backup.id}-manifest.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Đã tải file manifest của ${backup.name}`);
  };

  const handleExecuteRestore = async () => {
    if (!selectedSnapshotForRestore?.id) return;
    if (!restorePassword) {
      toast.error("Vui lòng nhập mật khẩu quản trị viên để xác nhận");
      return;
    }

    setIsRestoring(true);
    try {
      const res = await systemUpdateApi.restoreBackup({
        snapshotId: selectedSnapshotForRestore.id,
        password: restorePassword,
      });
      await backups.mutate();
      setSelectedSnapshotForRestore(null);
      setRestorePassword("");
      toast.success(res.message || "Khôi phục dữ liệu từ snapshot thành công!", { duration: 5000 });
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || "Khôi phục thất bại. Vui lòng kiểm tra lại mật khẩu.");
    } finally {
      setIsRestoring(false);
    }
  };

  const handleDeleteSnapshot = async () => {
    if (!snapshotToDelete) return;
    setIsDeleting(true);
    try {
      await systemUpdateApi.deleteBackup(snapshotToDelete.id);
      await backups.mutate();
      toast.success(`Đã xóa bản sao lưu ${snapshotToDelete.name}`);
      setSnapshotToDelete(null);
    } catch (err: any) {
      toast.error(err?.message || "Không thể xóa bản sao lưu");
    } finally {
      setIsDeleting(false);
    }
  };

  const currentPercent = job?.id && job.status !== "IDLE" ? job.progressPercent : isUpToDate ? 100 : 0;

  return (
    <AppShell>
      <div className="w-full flex-1 flex flex-col gap-2.5 p-2.5 sm:p-3.5 md:p-4 max-w-7xl mx-auto min-h-[calc(100vh-70px)]">
        {/* ========================================================================= */}
        {/* 0. SLIM TOP BAR WITH BREADCRUMB & VPS HOST                                */}
        {/* ========================================================================= */}
        <div className="flex items-center justify-between gap-2 px-1">
          <Link
            href="/settings?section=backup"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-muted hover:text-primary transition group"
          >
            <span className="p-1 rounded-lg bg-card border border-border/70 group-hover:border-primary/40 transition">
              <ArrowLeft size={12} />
            </span>
            <span>Cài đặt & Sao lưu</span>
          </Link>

          <div className="flex items-center gap-1.5 text-[11px] font-mono text-muted">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Host: 100.86.210.86 (Production)</span>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 1. SLIM & ELEGANT COMMAND HEADER                                          */}
        {/* ========================================================================= */}
        <div className="rounded-xl border border-border/70 bg-card p-3 sm:p-3.5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-purple-500/15 to-indigo-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/25 shrink-0 shadow-2xs">
              <Rocket size={18} className={isJobRunning ? "animate-bounce" : ""} />
              {isJobRunning && (
                <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary border border-card"></span>
                </span>
              )}
            </div>

            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-sm sm:text-base font-black text-text tracking-tight">
                  Cập Nhật Phiên Bản & Live Console
                </h1>
                <span className={`text-[10px] px-2 py-0.2 rounded-md font-bold border flex items-center gap-1 ${
                  isJobRunning
                    ? "bg-primary/15 text-primary border-primary/30 animate-pulse"
                    : isUpToDate
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                    : "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20"
                }`}>
                  {isJobRunning ? (
                    <>
                      <RefreshCcw size={10} className="animate-spin" /> Đang cập nhật ({job?.progressPercent}%)
                    </>
                  ) : isUpToDate ? (
                    <>
                      <CheckCircle2 size={10} /> Phiên bản mới nhất
                    </>
                  ) : (
                    <>
                      <Sparkles size={10} /> Có bản phát hành mới
                    </>
                  )}
                </span>
              </div>

              <div className="flex items-center gap-2 text-[11px] text-muted flex-wrap">
                <span>Repo: <code className="font-mono text-text font-semibold">tcandt/homeland-saas</code></span>
                <span className="opacity-40">•</span>
                <span>Commit: <code className="font-mono text-primary font-bold">{info?.currentCommit?.slice(0, 7) || "a8f506c"}</code></span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              isLoading={check.isLoading || status.isLoading}
              className="h-8 gap-1.5 rounded-lg border-border/70 text-xs font-bold shadow-2xs hover:border-primary/50"
            >
              <RefreshCcw size={12} className={check.isLoading ? "animate-spin" : ""} />
              <span>Kiểm tra Release</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setConfirmMode("rollback")}
              disabled={isJobRunning}
              className="h-8 gap-1.5 rounded-lg border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10 text-xs font-bold shadow-2xs"
            >
              <RotateCcw size={12} />
              <span>Rollback</span>
            </Button>

            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => setConfirmMode("install")}
              disabled={isJobRunning}
              className="h-8 gap-1.5 rounded-lg px-3.5 text-xs font-bold shadow-sm shadow-primary/20 bg-primary hover:bg-primary/90 cursor-pointer"
            >
              <Rocket size={13} />
              <span>{isUpToDate ? "Cập Nhật Lại" : "Nâng Cấp Ngay"}</span>
            </Button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 2. 4 COMPACT SYSTEM METRICS (SLEEK HORIZONTAL TILES)                       */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 w-full">
          {/* Tile 1: Active Version */}
          <div className="rounded-xl border border-border/70 bg-card p-2.5 sm:p-3 flex items-center justify-between gap-2 shadow-2xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
                <GitBranch size={15} />
              </span>
              <div className="min-w-0">
                <div className="text-[11px] text-muted font-bold truncate">Version hiện tại</div>
                <div className="font-mono font-black text-sm sm:text-base text-text">
                  {shortVersion(info?.currentVersion || webPackage.version)}
                </div>
              </div>
            </div>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold shrink-0">
              Running
            </span>
          </div>

          {/* Tile 2: Target Release */}
          <div className="rounded-xl border border-border/70 bg-card p-2.5 sm:p-3 flex items-center justify-between gap-2 shadow-2xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                <Sparkles size={15} />
              </span>
              <div className="min-w-0">
                <div className="text-[11px] text-muted font-bold truncate">Release Target</div>
                <div className="font-mono font-black text-sm sm:text-base text-purple-600 dark:text-purple-400">
                  {shortVersion(info?.latestVersion || info?.currentVersion || webPackage.version)}
                </div>
              </div>
            </div>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold shrink-0">
              GitHub
            </span>
          </div>

          {/* Tile 3: Disk & Cache */}
          <div className="rounded-xl border border-border/70 bg-card p-2.5 sm:p-3 flex items-center justify-between gap-2 shadow-2xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <ShieldCheck size={15} />
              </span>
              <div className="min-w-0">
                <div className="text-[11px] text-muted font-bold truncate">Chống tràn ổ VPS</div>
                <div className="font-black text-sm sm:text-base text-emerald-600 dark:text-emerald-400">
                  Auto-Prune
                </div>
              </div>
            </div>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold shrink-0">
              Active
            </span>
          </div>

          {/* Tile 4: Database Sync */}
          <div className="rounded-xl border border-border/70 bg-card p-2.5 sm:p-3 flex items-center justify-between gap-2 shadow-2xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                <Database size={15} />
              </span>
              <div className="min-w-0">
                <div className="text-[11px] text-muted font-bold truncate">Schema Postgres</div>
                <div className="font-black text-sm sm:text-base text-amber-600 dark:text-amber-400">
                  Auto Push
                </div>
              </div>
            </div>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold shrink-0">
              Prisma
            </span>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 3. SLEEK EXECUTION STEPPER PIPELINE                                       */}
        {/* ========================================================================= */}
        <Card className="rounded-xl border border-border/70 bg-card p-3 sm:p-3.5 shadow-2xs flex flex-col gap-2.5 w-full">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap size={14} className="text-amber-500" />
              <span className="text-xs font-black text-text uppercase tracking-wider">
                Tiến Trình Thực Thi Triển Khai
              </span>
            </div>
            <span className="font-mono font-black text-xs text-primary bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20">
              {currentPercent}%
            </span>
          </div>

          {/* Slim Progress Bar */}
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted/20">
            <div
              className={`h-full transition-all duration-500 ${
                job?.status === "DONE" || isUpToDate
                  ? "bg-emerald-500"
                  : job?.status === "FAILED"
                  ? "bg-rose-500"
                  : "bg-gradient-to-r from-primary to-purple-500"
              }`}
              style={{ width: `${Math.max(4, Math.min(100, currentPercent))}%` }}
            />
          </div>

          {/* Connected Step Chips */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-1.5 pt-0.5">
            {UPDATE_STAGES.map((st, i) => {
              const Icon = st.icon;
              const isPast = currentPercent >= st.percent;
              const isCurrent = isJobRunning && (job?.status === st.key || (currentPercent < st.percent && (i === 0 || currentPercent >= UPDATE_STAGES[i - 1].percent)));
              return (
                <div
                  key={st.key}
                  className={`flex items-center gap-1.5 p-1.5 px-2 rounded-lg border text-[11px] transition ${
                    isPast
                      ? "border-emerald-500/25 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 font-bold"
                      : isCurrent
                      ? "border-primary bg-primary/10 text-primary font-bold shadow-2xs"
                      : "border-border/40 bg-muted/5 text-muted opacity-50"
                  }`}
                >
                  {isCurrent ? (
                    <RefreshCcw size={11} className="animate-spin text-primary shrink-0" />
                  ) : (
                    <Icon size={12} className="shrink-0" />
                  )}
                  <span className="truncate text-[10px]">{st.label}</span>
                </div>
              );
            })}
          </div>
        </Card>

        {/* ========================================================================= */}
        {/* 4. HIGH-TECH TERMINAL STREAM CONSOLE                                      */}
        {/* ========================================================================= */}
        <div className="rounded-xl border border-neutral-800 bg-[#080b11] shadow-xl overflow-hidden flex flex-col w-full min-h-[380px] max-h-[480px]">
          {/* Terminal Window Header */}
          <div className="flex items-center justify-between px-3.5 py-2 bg-[#0e121a] border-b border-neutral-800/80 flex-wrap gap-2">
            <div className="flex items-center gap-2.5">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80"></span>
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80"></span>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80"></span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] font-mono text-neutral-300">
                <Terminal size={13} className="text-emerald-400" />
                <span className="text-neutral-400 hidden sm:inline">tcandt@vps:</span>
                <span className="text-cyan-400 font-semibold">~/homeland-production</span>
                <span className="text-neutral-500">$</span>
                <span className="text-emerald-400">update-stream --live</span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <div className="relative">
                <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-neutral-500" />
                <input
                  type="text"
                  placeholder="Lọc log..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-6.5 w-24 sm:w-32 rounded bg-neutral-900 border border-neutral-700/80 pl-6 pr-1.5 text-[10px] font-mono text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex items-center bg-neutral-900 rounded border border-neutral-700/80 p-0.5 text-[9px] font-mono text-neutral-400">
                <button
                  type="button"
                  onClick={() => setFontSize("xs")}
                  className={`px-1 py-0.5 rounded ${fontSize === "xs" ? "bg-neutral-800 text-white font-bold" : ""}`}
                >
                  XS
                </button>
                <button
                  type="button"
                  onClick={() => setFontSize("sm")}
                  className={`px-1 py-0.5 rounded ${fontSize === "sm" ? "bg-neutral-800 text-white font-bold" : ""}`}
                >
                  SM
                </button>
              </div>

              <label className="flex items-center gap-1 text-[10px] font-mono text-neutral-300 cursor-pointer select-none bg-neutral-900 px-1.5 py-0.5 rounded border border-neutral-700/80">
                <input
                  type="checkbox"
                  checked={autoScroll}
                  onChange={(e) => setAutoScroll(e.target.checked)}
                  className="rounded border-neutral-700 bg-neutral-800 text-primary focus:ring-0 h-3 w-3"
                />
                Scroll
              </label>

              <button
                type="button"
                onClick={handleClearLogs}
                title="Xóa log"
                className="text-[10px] font-mono text-neutral-300 hover:text-white px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-700/80 transition cursor-pointer"
              >
                <Trash2 size={11} />
              </button>

              <button
                type="button"
                onClick={handleCopyLogs}
                className="flex items-center gap-1 text-[10px] font-mono font-bold text-neutral-200 hover:text-white px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 transition cursor-pointer"
              >
                {copied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                <span>{copied ? "Copied" : "Copy"}</span>
              </button>
            </div>
          </div>

          {/* Terminal Logs Output */}
          <div
            className={`p-3.5 font-mono leading-relaxed overflow-y-auto flex-1 min-h-[260px] max-h-[380px] bg-[#080b11] flex flex-col gap-0.5 select-text ${
              fontSize === "xs" ? "text-[11px]" : "text-xs"
            }`}
          >
            <div className="text-neutral-500 text-[10px] pb-1.5 border-b border-neutral-900 flex items-center justify-between">
              <span>[HomeLand Engine • Live Production Console]</span>
              <span>{logs.length} dòng log</span>
            </div>

            {logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center flex-1 py-10 text-neutral-500 gap-1.5 select-none">
                <Terminal size={24} className="opacity-40 text-neutral-600" />
                <p className="text-[11px] italic">
                  {isJobRunning
                    ? "Đang kết nối luồng sự kiện từ tiến trình VPS..."
                    : "Nhấn 'Nâng Cấp Ngay' hoặc chạy script update trên VPS để theo dõi log thời gian thực."}
                </p>
              </div>
            ) : (
              logs.map((log, idx) => {
                const isError = log.includes("STDERR") || log.includes("failed") || log.includes("FAILED") || log.includes("error");
                const isSuccess = log.includes("finished") || log.includes("success") || log.includes("DONE") || log.includes("READY");
                const isStep = log.includes("SYSTEM_UPDATE_STEP") || log.includes("Step") || log.includes("===");
                const isDocker = log.includes("Container") || log.includes("Building") || log.includes("exporting");

                return (
                  <div key={idx} className="flex items-start gap-2 hover:bg-neutral-900/50 px-1.5 py-0.2 rounded transition group">
                    <span className="text-neutral-600 select-none text-[9px] pt-0.5 font-mono w-6 text-right shrink-0">
                      {idx + 1}
                    </span>
                    <span
                      className={`break-all leading-normal ${
                        isError
                          ? "text-rose-400 font-semibold"
                          : isSuccess
                          ? "text-emerald-400 font-semibold"
                          : isStep
                          ? "text-cyan-400 font-bold"
                          : isDocker
                          ? "text-purple-300"
                          : "text-neutral-200"
                      }`}
                    >
                      {log}
                    </span>
                  </div>
                );
              })
            )}
            <div ref={terminalBottomRef} />
          </div>

          {/* Terminal Footer */}
          <div className="px-3.5 py-1.5 bg-[#0e121a] border-t border-neutral-800/80 text-[10px] font-mono text-neutral-400 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-1.5">
              <Server size={11} className="text-primary" />
              <span>SSH VPS:</span>
              <code className="bg-neutral-950 px-1.5 py-0.2 rounded text-emerald-400 border border-neutral-800 select-all font-bold">
                bash deploy/public-production/update-public-production.sh
              </code>
            </div>
            <span className="text-neutral-500">Port 49187 (Web) • 49188 (API)</span>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 5. PRE-UPDATE SNAPSHOT BACKUPS (WITH 3-DOTS ACTION MENU)                  */}
        {/* ========================================================================= */}
        <Card className="rounded-xl border border-border/70 bg-card overflow-visible shadow-2xs">
          <div className="p-3 sm:p-3.5 border-b border-border/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database size={15} className="text-primary" />
              <h3 className="text-xs font-black text-text uppercase tracking-wider">
                Danh Sách Snapshot Sao Lưu Trước Khi Cập Nhật ({backups.data?.backups?.length || 0})
              </h3>
            </div>
            <span className="text-[11px] font-mono text-muted">
              Tổng: <b className="text-text font-bold">{formatBytes(backups.data?.storageUsedBytes || 0)}</b>
            </span>
          </div>

          {(!backups.data?.backups || backups.data.backups.length === 0) ? (
            <div className="p-6 text-center text-xs text-muted">Chưa có snapshot sao lưu nào.</div>
          ) : (
            <div className="overflow-visible">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/10 text-muted font-bold border-b border-border/50 text-[11px]">
                  <tr>
                    <th className="py-2 px-3.5">Mã Snapshot / ID</th>
                    <th className="py-2 px-3.5">Loại sao lưu</th>
                    <th className="py-2 px-3.5">Dung Lượng</th>
                    <th className="py-2 px-3.5">Thời Gian Tạo</th>
                    <th className="py-2 px-3.5">Trạng Thái</th>
                    <th className="py-2 px-3.5 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {backups.data.backups.map((b) => (
                    <tr key={b.id} className="hover:bg-muted/10 transition">
                      <td className="py-2.5 px-3.5 font-mono">
                        <div className="font-bold text-text">{b.name}</div>
                        <div className="text-[10px] text-muted">{b.id}</div>
                      </td>
                      <td className="py-2.5 px-3.5">
                        {b.type === "pre_update" ? (
                          <span className="px-1.5 py-0.2 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold text-[10px] border border-purple-500/20">
                            Trước cập nhật
                          </span>
                        ) : b.type === "daily_schedule" ? (
                          <span className="px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold text-[10px] border border-blue-500/20">
                            Định kỳ
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.2 rounded bg-slate-500/10 text-slate-600 dark:text-slate-400 font-bold text-[10px] border border-slate-500/20">
                            Thủ công
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3.5 font-mono font-medium">{formatBytes(b.sizeBytes)}</td>
                      <td className="py-2.5 px-3.5 text-muted">{new Date(b.createdAt).toLocaleString("vi-VN")}</td>
                      <td className="py-2.5 px-3.5">
                        <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold text-[10px]">
                          <CheckCircle2 size={11} /> Sẵn sàng
                        </span>
                      </td>
                      <td className="py-2.5 px-3.5 text-right relative">
                        {/* 3-Dots Action Dropdown */}
                        <div className="relative inline-block text-left">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenDropdownId(openDropdownId === b.id ? null : b.id);
                            }}
                            className="h-7 w-7 rounded-lg flex items-center justify-center text-muted hover:text-text hover:bg-muted/20 active:scale-95 transition cursor-pointer"
                            title="Thao tác"
                          >
                            <MoreVertical size={14} />
                          </button>

                          {openDropdownId === b.id && (
                            <>
                              <div className="fixed inset-0 z-40" onClick={() => setOpenDropdownId(null)} />
                              <div className="absolute right-0 bottom-full mb-1 w-40 rounded-xl border border-border/80 bg-card p-1 shadow-xl z-50 flex flex-col gap-0.5 text-left">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenDropdownId(null);
                                    handleDownloadManifest(b);
                                  }}
                                  className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-xs font-medium text-text hover:bg-muted/20 transition cursor-pointer"
                                >
                                  <Download size={13} className="text-primary" />
                                  <span>Tải về</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenDropdownId(null);
                                    setSelectedSnapshotForRestore(b);
                                    setRestorePassword("");
                                  }}
                                  className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 transition cursor-pointer"
                                >
                                  <RotateCcw size={13} />
                                  <span>Khôi phục</span>
                                </button>
                                <div className="h-[1px] bg-border/60 my-0.5" />
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenDropdownId(null);
                                    setSnapshotToDelete(b);
                                  }}
                                  className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                                >
                                  <Trash2 size={13} />
                                  <span>Xóa bản lưu</span>
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* Confirmation Modal for Update/Rollback */}
      <Modal
        isOpen={Boolean(confirmMode)}
        onClose={() => setConfirmMode(null)}
        title={confirmMode === "install" ? "Xác nhận nâng cấp phiên bản hệ thống" : "Xác nhận Rollback phiên bản"}
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button variant="outline" size="sm" onClick={() => setConfirmMode(null)} disabled={isSubmitting} className="h-8.5 rounded-xl text-xs font-bold">
              Hủy
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={startJob}
              disabled={isSubmitting}
              className={`h-8.5 gap-1.5 rounded-xl px-4 text-xs font-bold ${confirmMode === "rollback" ? "bg-amber-600 hover:bg-amber-700" : ""}`}
            >
              {isSubmitting ? <RefreshCcw size={13} className="animate-spin" /> : <Rocket size={13} />}
              <span>{confirmMode === "install" ? "Bắt đầu cập nhật ngay" : "Bắt đầu rollback"}</span>
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

      {/* Modal Khôi phục Snapshot */}
      {selectedSnapshotForRestore && (
        <Modal
          isOpen={Boolean(selectedSnapshotForRestore)}
          onClose={() => {
            if (!isRestoring) {
              setSelectedSnapshotForRestore(null);
              setRestorePassword("");
            }
          }}
          maxWidth="max-w-md"
          title={
            <span className="flex items-center gap-2 text-blue-600 dark:text-blue-400 text-base font-black">
              <RotateCcw size={18} className="shrink-0" />
              Khôi phục dữ liệu từ bản sao lưu
            </span>
          }
        >
          <div className="flex flex-col gap-3 py-1 text-xs leading-relaxed">
            <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-3 flex flex-col gap-1">
              <div className="font-bold text-text flex items-center justify-between">
                <span>Snapshot: <b className="font-mono text-primary">{selectedSnapshotForRestore.name}</b></span>
                <span className="text-[10px] text-muted">{new Date(selectedSnapshotForRestore.createdAt).toLocaleString("vi-VN")}</span>
              </div>
              <div className="text-[11px] text-muted font-mono">
                Dung lượng: {formatBytes(selectedSnapshotForRestore.sizeBytes)} | ID: {selectedSnapshotForRestore.id}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-bold text-text text-xs flex items-center gap-1.5">
                <Lock size={13} className="text-muted" /> Mật khẩu tài khoản Quản trị viên:
              </label>
              <input
                type="password"
                placeholder="Nhập mật khẩu Admin để xác nhận"
                value={restorePassword}
                onChange={(e) => setRestorePassword(e.target.value)}
                className="h-9 px-3 rounded-xl border border-border bg-card text-xs text-text focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>

            {/* Actions */}
            <div className="mt-5 flex items-center justify-end gap-3 pt-4 border-t border-border">
              <button
                type="button"
                onClick={() => {
                  setSelectedSnapshotForRestore(null);
                  setRestorePassword("");
                }}
                disabled={isRestoring}
                className="inline-flex h-10 items-center justify-center px-5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700/80 border border-transparent shadow-xs transition-all active:scale-[0.98] cursor-pointer whitespace-nowrap disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleExecuteRestore}
                disabled={isRestoring || !restorePassword}
                className="inline-flex h-10 items-center justify-center gap-2 px-5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-blue-600 via-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:from-blue-700 active:to-indigo-700 shadow-md shadow-blue-600/25 hover:shadow-lg hover:shadow-blue-600/35 active:scale-[0.98] transition-all cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isRestoring ? <Loader2 size={15} className="animate-spin shrink-0" /> : <RotateCcw size={15} className="shrink-0" />}
                <span className="whitespace-nowrap">{isRestoring ? "Đang khôi phục..." : "Xác nhận khôi phục"}</span>
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal Xác nhận Xóa Snapshot */}
      {snapshotToDelete && (
        <Modal
          isOpen={Boolean(snapshotToDelete)}
          onClose={() => {
            if (!isDeleting) setSnapshotToDelete(null);
          }}
          maxWidth="max-w-md"
          title={
            <span className="flex items-center gap-2 text-rose-600 dark:text-rose-400 text-base font-black">
              <Trash2 size={18} className="shrink-0" />
              Xác nhận xóa bản sao lưu
            </span>
          }
        >
          <div className="flex flex-col gap-3 py-1 text-xs">
            <p className="text-text font-medium leading-relaxed">
              Bạn có chắc chắn muốn xóa bản sao lưu <b className="font-mono text-text">{snapshotToDelete.name}</b> (ID: <span className="font-mono text-muted">{snapshotToDelete.id}</span>) không?
            </p>
            <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-2.5 text-muted text-[11px]">
              Hành động này sẽ giải phóng dung lượng ổ đĩa VPS và không thể hoàn tác file này.
            </div>
            <div className="mt-5 flex items-center justify-end gap-3 pt-4 border-t border-border">
              <button
                type="button"
                onClick={() => setSnapshotToDelete(null)}
                disabled={isDeleting}
                className="inline-flex h-10 items-center justify-center px-5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700/80 border border-transparent shadow-xs transition-all active:scale-[0.98] cursor-pointer whitespace-nowrap disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleDeleteSnapshot}
                disabled={isDeleting}
                className="inline-flex h-10 items-center justify-center gap-2 px-5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-red-600 via-rose-600 to-rose-600 hover:from-red-500 hover:to-rose-500 active:from-red-700 active:to-rose-700 shadow-md shadow-rose-600/25 hover:shadow-lg hover:shadow-rose-600/35 active:scale-[0.98] transition-all cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeleting ? <Loader2 size={15} className="animate-spin shrink-0" /> : <Trash2 size={15} className="shrink-0" />}
                <span className="whitespace-nowrap">{isDeleting ? "Đang xóa..." : "Xác nhận xóa"}</span>
              </button>
            </div>
          </div>
        </Modal>
      )}
    </AppShell>
  );
}
