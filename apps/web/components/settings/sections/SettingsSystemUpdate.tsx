"use client";

import React, { useState } from "react";
import useSWR from "swr";
import { AlertTriangle, CheckCircle2, GitBranch, History, RefreshCcw, Rocket, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { systemUpdateApi, SystemUpdateJob } from "@/lib/api/system-update.api";
import { useAuthStore } from "@/lib/auth/auth-store";
import toast from "react-hot-toast";

function shortVersion(value?: string) {
  if (!value || value === "unknown") return value || "unknown";
  return value.slice(0, 7);
}

function displayVersion(value?: string) {
  if (!value) return "unknown";
  return value;
}

function formatDate(value?: string) {
  if (!value) return "-";
  return new Date(value).toLocaleString("vi-VN");
}

export default function SettingsSystemUpdate() {
  const user = useAuthStore((state) => state.user);
  const canOperate = (user?.email || "").toLowerCase() === "admin@homeland.vn";
  const check = useSWR("system-update-check", () => systemUpdateApi.check(), { revalidateOnFocus: false });
  const status = useSWR("system-update-status", () => systemUpdateApi.status(), {
    revalidateOnFocus: false,
    refreshInterval: (data) => data && !["IDLE", "DONE", "FAILED", "BLOCKED", "ROLLED_BACK"].includes(data.status) ? 1500 : 0,
  });
  const [confirmMode, setConfirmMode] = useState<"install" | "rollback" | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const info = check.data;
  const job = status.data as SystemUpdateJob | undefined;
  const isBlockedMode = info && !info.canInstallAutomatically;
  const isJobRunning = Boolean(job && !["IDLE", "DONE", "FAILED", "BLOCKED", "ROLLED_BACK"].includes(job.status));
  const canInstall = Boolean(canOperate && info?.updateAvailable && !isJobRunning);

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
      toast.success(confirmMode === "install" ? "Đã tạo job cập nhật" : "Đã tạo job rollback");
    } catch (error: any) {
      toast.error(error?.message || "Không tạo được job cập nhật");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-[18px]" data-testid="settings-system-update">
      <Card className="border border-border bg-card p-[20px]">
        <div className="flex flex-col gap-[18px]">
          <div className="flex flex-col gap-[14px] xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-[820px]">
              <div className="flex items-center gap-[8px] text-[12px] font-black uppercase tracking-[0.14em] text-primary">
                <Rocket size={15} />
                Cập nhật hệ thống
              </div>
              <h3 className="mt-[8px] text-[20px] font-black text-text">Version, cập nhật và rollback có kiểm soát</h3>
              <p className="mt-[6px] text-[13px] leading-6 text-muted">
                Website kiểm tra release tag mới từ GitHub, hiển thị version ứng dụng và tạo job cập nhật. Runner thật đang ở chế độ an toàn, chưa tự ghi đè source hoặc restart dịch vụ.
              </p>
            </div>
            <Button type="button" variant="outline" onClick={() => check.mutate()} isLoading={check.isLoading}>
              <RefreshCcw size={14} className="mr-2" />
              Kiểm tra version
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-[12px] md:grid-cols-3">
            <div className="rounded-[8px] border border-border bg-background p-[14px]">
              <div className="flex items-center gap-[8px] text-[12px] font-bold text-muted"><GitBranch size={14} /> Version hiện tại</div>
              <div className="mt-[8px] font-mono text-[18px] font-black text-text">{displayVersion(info?.currentVersion)}</div>
              <div className="mt-[4px] font-mono text-[11px] font-semibold text-muted">{shortVersion(info?.currentCommit)}</div>
            </div>
            <div className="rounded-[8px] border border-border bg-background p-[14px]">
              <div className="flex items-center gap-[8px] text-[12px] font-bold text-muted"><GitBranch size={14} /> Version mới nhất</div>
              <div className="mt-[8px] font-mono text-[18px] font-black text-text">{displayVersion(info?.latestVersion)}</div>
              <div className="mt-[4px] font-mono text-[11px] font-semibold text-muted">{shortVersion(info?.latestCommit)}</div>
            </div>
            <div className="rounded-[8px] border border-border bg-background p-[14px]">
              <div className="flex items-center gap-[8px] text-[12px] font-bold text-muted"><ShieldCheck size={14} /> Chế độ runner</div>
              <div className={`mt-[8px] text-[18px] font-black ${info?.canInstallAutomatically ? "text-success" : "text-warning"}`}>
                {info?.mode || "dry-run"}
              </div>
            </div>
          </div>

          <div className={`rounded-[8px] border px-[14px] py-[12px] text-[13px] font-bold ${info?.updateAvailable ? "border-primary/30 bg-primary/5 text-primary" : "border-success/30 bg-success/5 text-success"}`}>
            {info?.updateAvailable
              ? `Có bản cập nhật: ${displayVersion(info.currentVersion)} -> ${displayVersion(info.latestVersion)}`
              : `Đang ở phiên bản mới nhất: ${displayVersion(info?.currentVersion)}`}
          </div>

          {isBlockedMode && (
            <div className="flex items-start gap-[10px] rounded-[8px] border border-warning/30 bg-warning/5 px-[14px] py-[12px] text-[12px] font-semibold text-warning">
              <AlertTriangle size={16} className="mt-[1px] shrink-0" />
              <span>
                Update runner đang ở chế độ an toàn. Job sẽ mô phỏng đầy đủ progress. Để chạy runner thật, đặt <span className="font-mono">SYSTEM_UPDATE_MODE=enabled</span> trong file <span className="font-mono">.env</span> của API hoặc biến môi trường production rồi restart API.
              </span>
            </div>
          )}

          <div className="rounded-[8px] border border-border bg-background">
            <div className="border-b border-border px-[14px] py-[11px] text-[12px] font-black uppercase text-muted">Chi tiết bản cập nhật</div>
            <div className="flex flex-col gap-[8px] p-[14px] text-[13px] text-text">
              {(info?.changelog || ["Đang tải thông tin version..."]).map((item, index) => (
                <div key={`${item}-${index}`} className="flex gap-[8px]">
                  <CheckCircle2 size={14} className="mt-[2px] shrink-0 text-success" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          {job && job.status !== "IDLE" && (
            <div className="rounded-[8px] border border-border bg-background p-[14px]" data-testid="system-update-job">
              <div className="flex flex-col gap-[8px] sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-[13px] font-black text-text">Job {job.type || "update"}: {job.status}</div>
                  <div className="mt-[2px] text-[11px] font-medium text-muted">Bắt đầu: {formatDate(job.startedAt)} | Kết thúc: {formatDate(job.finishedAt)}</div>
                </div>
                <div className="font-mono text-[13px] font-black text-primary">{job.progressPercent}%</div>
              </div>
              <div className="mt-[10px] h-[8px] overflow-hidden rounded-full bg-border">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${job.progressPercent}%` }} />
              </div>
              <div className="mt-[12px] max-h-[170px] overflow-auto rounded-[8px] bg-black/[0.03] p-[10px] font-mono text-[11px] text-muted dark:bg-white/[0.04]">
                {(job.logs || []).map((line, index) => <div key={`${line}-${index}`}>{line}</div>)}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-[10px] sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" disabled={!canOperate} onClick={() => setConfirmMode("rollback")}>
              <History size={14} className="mr-2" />
              Rollback
            </Button>
            <Button type="button" disabled={!canInstall} onClick={() => setConfirmMode("install")}>
              <Rocket size={14} className="mr-2" />
              {info && !info.updateAvailable ? "Đã mới nhất" : "Cập nhật"}
            </Button>
          </div>
        </div>
      </Card>

      <Modal
        isOpen={Boolean(confirmMode)}
        onClose={() => setConfirmMode(null)}
        title={confirmMode === "rollback" ? "Xác nhận rollback" : "Xác nhận cập nhật"}
        maxWidth="max-w-[560px]"
        footer={
          <div className="flex flex-col gap-[10px] sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setConfirmMode(null)}>Hủy</Button>
            <Button type="button" onClick={startJob} isLoading={isSubmitting}>
              {confirmMode === "rollback" ? "Tạo job rollback" : "Tạo job cập nhật"}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-[12px] text-[13px] leading-6 text-muted">
          <p>
            Nếu hệ thống đang ở `dry-run`, job chỉ mô phỏng progress. Nếu bật `SYSTEM_UPDATE_MODE=enabled`, runner sẽ chạy backup, clone source, build và preflight thật trong thư mục release riêng; switch/restart chỉ chạy khi đã bật khóa vận hành riêng.
          </p>
          <div className="rounded-[8px] border border-border bg-background p-[12px]">
            <div className="font-mono text-[12px] text-text">From: {displayVersion(info?.currentVersion)} ({shortVersion(info?.currentCommit)})</div>
            <div className="mt-[4px] font-mono text-[12px] text-text">To: {confirmMode === "rollback" ? "previous-version-required" : `${displayVersion(info?.latestVersion)} (${shortVersion(info?.latestCommit)})`}</div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
