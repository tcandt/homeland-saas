"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import useSWR from "swr";
import Link from "next/link";
import {
  AlertCircle,
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  ChevronRight,
  Clock,
  Copy,
  Cpu,
  Database,
  ExternalLink,
  Filter,
  GitBranch,
  GitCommit,
  HardDrive,
  History,
  Layers,
  Maximize2,
  Minimize2,
  Play,
  RefreshCcw,
  Rocket,
  RotateCcw,
  Search,
  Server,
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
import { systemUpdateApi, SystemUpdateJob } from "@/lib/api/system-update.api";
import { useAuthStore } from "@/lib/auth/auth-store";
import toast from "react-hot-toast";
import webPackage from "../../package.json";

const UPDATE_STAGES = [
  { key: "CHECKING", label: "Xác nhận Version", percent: 8, icon: GitBranch, desc: "Kiểm tra remote release tag" },
  { key: "DOWNLOADING", label: "Tải Mã Nguồn", percent: 22, icon: Layers, desc: "Tải source code & artifact" },
  { key: "BACKING_UP", label: "Tạo Snapshot", percent: 38, icon: Database, desc: "Sao lưu DB & metadata" },
  { key: "BUILDING", label: "Auto-Prune & Build", percent: 56, icon: Cpu, desc: "Dọn cache & build Docker" },
  { key: "MIGRATING", label: "Đồng Bộ Schema", percent: 78, icon: HardDrive, desc: "Prisma database push" },
  { key: "RESTARTING", label: "Khởi Động Lại", percent: 88, icon: Server, desc: "Recreate Docker containers" },
  { key: "HEALTH_CHECK", label: "Kiểm Tra Health", percent: 96, icon: ShieldCheck, desc: "Xác thực API & Web status" },
  { key: "DONE", label: "Hoàn Tất 100%", percent: 100, icon: CheckCircle2, desc: "Sẵn sàng vận hành" },
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
  const [fontSize, setFontSize] = useState<"sm" | "base" | "xs">("xs");
  const [clearedLogsCount, setClearedLogsCount] = useState(0);
  const terminalBottomRef = useRef<HTMLDivElement>(null);

  // 1. Fetch system update check info
  const check = useSWR("system-update-check-full", () => systemUpdateApi.check(), {
    revalidateOnFocus: false,
    refreshInterval: 60000,
  });

  // 2. Fetch live job status (Poll 1s during update, 3s otherwise)
  const status = useSWR("system-update-status-full", () => systemUpdateApi.status(), {
    revalidateOnFocus: true,
    refreshInterval: (data) =>
      data && !["IDLE", "DONE", "FAILED", "BLOCKED", "ROLLED_BACK"].includes(data.status) ? 1000 : 3500,
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

  // Auto-scroll terminal when new logs arrive
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

  const currentPercent = job?.id && job.status !== "IDLE" ? job.progressPercent : isUpToDate ? 100 : 0;

  return (
    <AppShell>
      <div className="w-full flex-1 flex flex-col gap-4 p-3 sm:p-4 md:p-6 lg:p-8 min-h-[calc(100vh-70px)]">
        {/* ========================================================================= */}
        {/* 1. TOP HERO COCKPIT HEADER (FULL WIDTH)                                   */}
        {/* ========================================================================= */}
        <div className="relative w-full overflow-hidden rounded-2xl border border-border/80 bg-card p-4 sm:p-5 md:p-6 shadow-sm">
          {/* Subtle Ambient Radial Glow */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl"
          />

          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Left: Branding & Status Badge */}
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="relative flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-primary/20 via-purple-500/20 to-indigo-500/10 text-primary border border-primary/30 shadow-inner shrink-0">
                <Rocket size={26} className={isJobRunning ? "animate-bounce text-purple-400" : "text-primary"} />
                {isJobRunning && (
                  <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-primary border-2 border-card"></span>
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-lg sm:text-xl md:text-2xl font-black text-text tracking-tight flex items-center gap-2">
                    Trung Tâm Cập Nhật & Vận Hành Hệ Thống
                  </h1>
                  <span className={`text-[11px] px-3 py-0.5 rounded-full font-bold border flex items-center gap-1.5 shadow-2xs ${
                    isJobRunning
                      ? "bg-primary/15 text-primary border-primary/30 animate-pulse"
                      : isUpToDate
                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                      : "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30"
                  }`}>
                    {isJobRunning ? (
                      <>
                        <RefreshCcw size={12} className="animate-spin" /> Đang cập nhật ({job?.progressPercent}%)
                      </>
                    ) : isUpToDate ? (
                      <>
                        <CheckCircle2 size={12} /> Phiên bản mới nhất
                      </>
                    ) : (
                      <>
                        <Sparkles size={12} /> Có bản phát hành mới
                      </>
                    )}
                  </span>
                </div>

                <div className="flex items-center gap-3 text-xs text-muted flex-wrap font-medium">
                  <span className="flex items-center gap-1">
                    <GitBranch size={13} className="text-primary" /> Repository:{" "}
                    <code className="bg-muted/15 px-1.5 py-0.5 rounded text-[11px] font-mono text-text">tcandt/homeland-saas</code>
                  </span>
                  <span className="opacity-40">•</span>
                  <span className="flex items-center gap-1">
                    <GitCommit size={13} className="text-purple-500" /> Commit:{" "}
                    <code className="bg-muted/15 px-1.5 py-0.5 rounded text-[11px] font-mono text-text">
                      {info?.currentCommit?.slice(0, 7) || "f64b48a"}
                    </code>
                  </span>
                  <span className="opacity-40">•</span>
                  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 size={13} /> Auto-Prune & DB Sync Active
                  </span>
                </div>
              </div>
            </div>

            {/* Right: Action Button Cluster */}
            <div className="flex items-center gap-2.5 flex-wrap shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                isLoading={check.isLoading || status.isLoading}
                className="h-10 gap-1.5 rounded-xl border-border/80 text-xs font-bold shadow-2xs hover:border-primary/50"
              >
                <RefreshCcw size={14} className={check.isLoading ? "animate-spin" : ""} />
                <span>Làm mới / Kiểm tra Release</span>
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setConfirmMode("rollback")}
                disabled={isJobRunning}
                className="h-10 gap-1.5 rounded-xl border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10 text-xs font-bold shadow-2xs"
              >
                <RotateCcw size={14} />
                <span>Rollback Bản Cũ</span>
              </Button>

              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => setConfirmMode("install")}
                disabled={isJobRunning}
                className="h-10 gap-2 rounded-xl px-5 text-xs font-black shadow-lg shadow-primary/25 bg-gradient-to-r from-primary via-indigo-600 to-purple-600 hover:opacity-95 cursor-pointer"
              >
                <Rocket size={15} />
                <span>{isUpToDate ? "Nâng Cấp Lại Phiên Bản" : "Khởi Chạy Cập Nhật Ngay"}</span>
              </Button>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 2. 4 CORE SYSTEM METRIC CARDS (FULL WIDTH 4-COL GRID)                     */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 w-full">
          {/* Card 1: Active Version */}
          <Card className="rounded-2xl border border-border/80 bg-card p-4 flex flex-col justify-between gap-2.5 shadow-2xs hover:border-primary/40 transition">
            <div className="flex items-center justify-between text-xs text-muted font-bold">
              <span className="flex items-center gap-1.5">
                <GitBranch size={15} className="text-primary" /> Phiên bản hiện tại
              </span>
              <span className="font-mono text-[10px] px-2 py-0.5 rounded-md bg-primary/10 text-primary font-bold">
                Running
              </span>
            </div>
            <div className="font-mono font-black text-3xl text-text tracking-tight">
              {shortVersion(info?.currentVersion || webPackage.version)}
            </div>
            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
              <CheckCircle2 size={13} /> Stack Docker Container ổn định
            </div>
          </Card>

          {/* Card 2: Latest Version */}
          <Card className="rounded-2xl border border-border/80 bg-card p-4 flex flex-col justify-between gap-2.5 shadow-2xs hover:border-purple-500/40 transition">
            <div className="flex items-center justify-between text-xs text-muted font-bold">
              <span className="flex items-center gap-1.5">
                <Sparkles size={15} className="text-purple-500" /> GitHub Release Target
              </span>
              <span className="font-mono text-[10px] px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold">
                Release
              </span>
            </div>
            <div className="font-mono font-black text-3xl text-purple-600 dark:text-purple-400 tracking-tight">
              {shortVersion(info?.latestVersion || info?.currentVersion || webPackage.version)}
            </div>
            <div className="text-[11px] text-muted font-medium flex items-center gap-1">
              {info?.updateAvailable ? "⚡ Có bản nâng cấp mới khả dụng" : "✓ Trùng khớp với bản build mới nhất"}
            </div>
          </Card>

          {/* Card 3: Storage & Cache Protection */}
          <Card className="rounded-2xl border border-border/80 bg-card p-4 flex flex-col justify-between gap-2.5 shadow-2xs hover:border-emerald-500/40 transition">
            <div className="flex items-center justify-between text-xs text-muted font-bold">
              <span className="flex items-center gap-1.5">
                <ShieldCheck size={15} className="text-emerald-500" /> Chống tràn ổ đĩa VPS
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 font-bold">
                Auto-Prune
              </span>
            </div>
            <div className="font-mono font-black text-2xl text-emerald-600 dark:text-emerald-400 tracking-tight">
              Tự Dọn 8+ GB
            </div>
            <div className="text-[11px] text-muted font-medium">
              Tự động xóa Docker Cache & image cũ
            </div>
          </Card>

          {/* Card 4: Database & Schema Sync */}
          <Card className="rounded-2xl border border-border/80 bg-card p-4 flex flex-col justify-between gap-2.5 shadow-2xs hover:border-amber-500/40 transition">
            <div className="flex items-center justify-between text-xs text-muted font-bold">
              <span className="flex items-center gap-1.5">
                <Database size={15} className="text-amber-500" /> PostgreSQL & Schema
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 font-bold">
                Auto Push
              </span>
            </div>
            <div className="font-mono font-black text-2xl text-amber-600 dark:text-amber-400 tracking-tight">
              Đồng Bộ Tự Động
            </div>
            <div className="text-[11px] text-muted font-medium">
              Không mất dữ liệu, tự tạo mới cột
            </div>
          </Card>
        </div>

        {/* ========================================================================= */}
        {/* 3. EXPANSIVE LIVE PROGRESS & 8-STAGE WORKFLOW STEPPER                     */}
        {/* ========================================================================= */}
        <Card className="rounded-2xl border border-border/80 bg-card p-5 md:p-6 shadow-sm flex flex-col gap-4 w-full">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/15 text-amber-500">
                <Zap size={16} />
              </div>
              <div>
                <h2 className="text-sm font-black text-text uppercase tracking-wider">
                  Quy Trình Triển Khai Thực Tế (Live Execution Workflow)
                </h2>
                <p className="text-xs text-muted">Theo dõi từng giai đoạn trong chu trình nâng cấp</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-muted">
                {isJobRunning ? "Đang thực thi trên VPS..." : job?.status === "DONE" ? "Hoàn tất thành công" : "Sẵn sàng"}
              </span>
              <span className="font-mono font-black text-xl text-primary bg-primary/10 px-3 py-0.5 rounded-xl border border-primary/20">
                {currentPercent}%
              </span>
            </div>
          </div>

          {/* Animated Main Progress Bar */}
          <div className="h-4 w-full overflow-hidden rounded-full bg-muted/25 p-0.5 border border-border/80 shadow-inner">
            <div
              className={`h-full rounded-full transition-all duration-700 ease-out shadow-sm ${
                job?.status === "DONE" || isUpToDate
                  ? "bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-400"
                  : job?.status === "FAILED"
                  ? "bg-rose-500"
                  : "bg-gradient-to-r from-primary via-purple-500 to-indigo-500 animate-pulse"
              }`}
              style={{ width: `${Math.max(4, Math.min(100, currentPercent))}%` }}
            />
          </div>

          {/* 8-Step Interactive Visual Stepper */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5 pt-2">
            {UPDATE_STAGES.map((st, i) => {
              const Icon = st.icon;
              const isPast = currentPercent >= st.percent;
              const isCurrent = isJobRunning && (job?.status === st.key || (currentPercent < st.percent && (i === 0 || currentPercent >= UPDATE_STAGES[i - 1].percent)));
              return (
                <div
                  key={st.key}
                  className={`flex flex-col items-center text-center p-3 rounded-2xl border transition-all duration-300 ${
                    isPast
                      ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 shadow-2xs"
                      : isCurrent
                      ? "border-primary bg-primary/15 text-primary shadow-md ring-2 ring-primary/30 scale-102"
                      : "border-border/60 bg-muted/5 text-muted opacity-60"
                  }`}
                >
                  <div className={`flex h-8 w-8 items-center justify-center rounded-xl mb-2 transition-transform ${
                    isPast
                      ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                      : isCurrent
                      ? "bg-primary text-white shadow-md shadow-primary/30"
                      : "bg-muted/20 text-muted"
                  }`}>
                    {isCurrent ? <RefreshCcw size={15} className="animate-spin" /> : <Icon size={16} />}
                  </div>
                  <span className="text-[11px] font-black leading-tight line-clamp-1">
                    {st.label}
                  </span>
                  <span className="text-[9px] font-mono text-muted mt-1">
                    {st.percent}%
                  </span>
                </div>
              );
            })}
          </div>
        </Card>

        {/* ========================================================================= */}
        {/* 4. FULL-MAIN LINUX TERMINAL STREAM CONSOLE (EXPANSIVE & INTERACTIVE)       */}
        {/* ========================================================================= */}
        <div className="rounded-2xl border border-neutral-800 bg-[#0a0d14] shadow-2xl overflow-hidden flex flex-col w-full flex-1 min-h-[440px]">
          {/* Terminal Window Top Bar */}
          <div className="flex items-center justify-between px-4 py-3 bg-[#111622] border-b border-neutral-800/80 flex-wrap gap-3">
            {/* Left: Window Controls & Host Prompt */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-rose-500/90 shadow-xs cursor-pointer hover:opacity-80"></div>
                <div className="w-3 h-3 rounded-full bg-amber-500/90 shadow-xs cursor-pointer hover:opacity-80"></div>
                <div className="w-3 h-3 rounded-full bg-emerald-500/90 shadow-xs cursor-pointer hover:opacity-80"></div>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono text-neutral-300">
                <Terminal size={15} className="text-emerald-400" />
                <span className="text-neutral-400 hidden sm:inline">tcandt@vps:</span>
                <span className="text-cyan-400 font-bold">~/homeland-public-production</span>
                <span className="text-neutral-500">$</span>
                <span className="text-emerald-400">update-stream --live</span>
              </div>
            </div>

            {/* Right: Terminal Controls Toolbar */}
            <div className="flex items-center gap-2.5 flex-wrap">
              {/* Search / Filter logs input */}
              <div className="relative">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Lọc logs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-7 w-28 sm:w-40 rounded-lg bg-neutral-900 border border-neutral-700/80 pl-7 pr-2 text-[11px] font-mono text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              {/* Font Size Toggle */}
              <div className="flex items-center bg-neutral-900 rounded-lg border border-neutral-700/80 p-0.5 text-[10px] font-mono text-neutral-400">
                <button
                  type="button"
                  onClick={() => setFontSize("xs")}
                  className={`px-1.5 py-0.5 rounded ${fontSize === "xs" ? "bg-neutral-800 text-white font-bold" : "hover:text-white"}`}
                >
                  XS
                </button>
                <button
                  type="button"
                  onClick={() => setFontSize("sm")}
                  className={`px-1.5 py-0.5 rounded ${fontSize === "sm" ? "bg-neutral-800 text-white font-bold" : "hover:text-white"}`}
                >
                  SM
                </button>
              </div>

              {/* Auto-Scroll Checkbox */}
              <label className="flex items-center gap-1.5 text-[11px] font-mono text-neutral-300 cursor-pointer select-none bg-neutral-900 px-2 py-1 rounded-lg border border-neutral-700/80">
                <input
                  type="checkbox"
                  checked={autoScroll}
                  onChange={(e) => setAutoScroll(e.target.checked)}
                  className="rounded border-neutral-700 bg-neutral-800 text-primary focus:ring-0 cursor-pointer"
                />
                Auto-scroll
              </label>

              {/* Clear Console */}
              <button
                type="button"
                onClick={handleClearLogs}
                title="Xóa màn hình console"
                className="flex items-center gap-1 text-[11px] font-mono text-neutral-300 hover:text-white px-2 py-1 rounded-lg bg-neutral-900 border border-neutral-700/80 hover:bg-neutral-800 transition cursor-pointer"
              >
                <Trash2 size={12} />
              </button>

              {/* Copy Logs */}
              <button
                type="button"
                onClick={handleCopyLogs}
                className="flex items-center gap-1 text-[11px] font-mono font-bold text-neutral-200 hover:text-white px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 transition cursor-pointer shadow-xs"
              >
                <Copy size={12} />
                <span>Copy Logs</span>
              </button>
            </div>
          </div>

          {/* Terminal Output Area (Monospace, Color-coded, High-tech) */}
          <div
            className={`p-4 font-mono leading-relaxed overflow-y-auto flex-1 min-h-[300px] max-h-[520px] bg-[#0a0d14] flex flex-col gap-1 select-text ${
              fontSize === "xs" ? "text-[11px]" : "text-xs"
            }`}
          >
            {/* Terminal Header Welcome */}
            <div className="text-neutral-500 text-[11px] pb-2 border-b border-neutral-900/80 flex items-center justify-between">
              <span>[HomeLand Production Engine v1.2.4 • Live Stream WebSocket / Polling Active]</span>
              <span>{logs.length} dòng nhật ký</span>
            </div>

            {logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center flex-1 py-14 text-neutral-500 gap-2 select-none">
                <Terminal size={32} className="opacity-40 text-neutral-600" />
                <p className="text-xs italic">
                  {isJobRunning
                    ? "Đang kết nối luồng sự kiện từ tiến trình VPS..."
                    : "Nhấn 'Khởi Chạy Cập Nhật Ngay' hoặc chạy script trên VPS để xem luồng terminal trực tiếp."}
                </p>
              </div>
            ) : (
              logs.map((log, idx) => {
                const isError =
                  log.includes("STDERR") || log.includes("failed") || log.includes("FAILED") || log.includes("error");
                const isSuccess =
                  log.includes("finished") || log.includes("success") || log.includes("DONE") || log.includes("READY");
                const isStep = log.includes("SYSTEM_UPDATE_STEP") || log.includes("Step") || log.includes("===");
                const isDocker = log.includes("Container") || log.includes("Building") || log.includes("exporting");

                return (
                  <div
                    key={idx}
                    className="flex items-start gap-2.5 hover:bg-neutral-900/60 px-2 py-0.5 rounded transition group"
                  >
                    <span className="text-neutral-600 select-none text-[10px] pt-0.5 font-mono w-7 text-right shrink-0">
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

          {/* Terminal Footer with Quick SSH Command Snippet */}
          <div className="px-4 py-2.5 bg-[#111622] border-t border-neutral-800/80 text-[11px] font-mono text-neutral-400 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Server size={13} className="text-primary" />
              <span>Chạy trực tiếp trên VPS SSH:</span>
              <code className="bg-neutral-950 px-2 py-0.5 rounded text-emerald-400 border border-neutral-800 select-all font-bold">
                bash /home/tcandt/homeland-public-production/update-public-production.sh
              </code>
            </div>

            <div className="flex items-center gap-3 text-neutral-500">
              <span>Port: 49187 (Web) • 49188 (API) • 49189 (Postgres)</span>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 5. RECENT SNAPSHOT BACKUPS DRAWER TABLE                                   */}
        {/* ========================================================================= */}
        {backups.data?.backups && backups.data.backups.length > 0 && (
          <Card className="rounded-2xl border border-border/80 bg-card p-5 shadow-sm flex flex-col gap-3.5 w-full">
            <div className="flex items-center justify-between flex-wrap gap-2 border-b border-border/50 pb-3">
              <div className="flex items-center gap-2">
                <Database size={17} className="text-primary" />
                <h3 className="text-sm font-black text-text">
                  Danh Sách Snapshot Sao Lưu Trước Khi Cập Nhật (Pre-update Backups)
                </h3>
              </div>
              <span className="text-xs font-mono text-muted">
                {backups.data.backups.length} bản sao lưu sẵn sàng
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border/40 text-muted font-bold text-[11px]">
                    <th className="pb-2">Mã Snapshot</th>
                    <th className="pb-2">Thời Gian Tạo</th>
                    <th className="pb-2">Phiên Bản</th>
                    <th className="pb-2">Dung Lượng</th>
                    <th className="pb-2">Trạng Thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {backups.data.backups.slice(0, 5).map((b) => (
                    <tr key={b.id} className="hover:bg-muted/5 transition">
                      <td className="py-2.5 font-mono font-bold text-text">{b.id}</td>
                      <td className="py-2.5 text-muted">{new Date(b.createdAt).toLocaleString("vi-VN")}</td>
                      <td className="py-2.5 font-mono font-bold text-primary">v{b.version || "1.2.4"}</td>
                      <td className="py-2.5 font-mono text-muted">{formatBytes(b.sizeBytes)}</td>
                      <td className="py-2.5">
                        <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 font-bold border border-emerald-500/20 text-[10px]">
                          READY
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
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
              className={`h-9 gap-1.5 rounded-xl px-5 text-xs font-black ${confirmMode === "rollback" ? "bg-amber-600 hover:bg-amber-700" : "bg-gradient-to-r from-primary to-purple-600"}`}
            >
              {isSubmitting ? <RefreshCcw size={13} className="animate-spin" /> : <Rocket size={13} />}
              <span>{confirmMode === "install" ? "Bắt đầu cập nhật ngay" : "Bắt đầu rollback"}</span>
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-3 py-1 text-xs">
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 text-muted leading-relaxed">
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
