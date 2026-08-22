"use client";

import React, { useEffect, useMemo, useState } from "react";
import { CheckCircle2, GitBranch, RefreshCcw, X } from "lucide-react";
import { systemUpdateApi, SystemUpdateCheck } from "@/lib/api/system-update.api";
import { useAuthStore } from "@/lib/auth/auth-store";
import { LOGIN_VERSION_CHECK_REQUEST_KEY } from "@/lib/system-update/login-version-check";

function shortVersion(value?: string) {
  if (!value || value === "unknown") return value || "unknown";
  return value.slice(0, 7);
}

export default function LoginVersionUpdateNotice() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const [result, setResult] = useState<SystemUpdateCheck | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    if (!accessToken || typeof window === "undefined") return;

    const requested = window.sessionStorage.getItem(LOGIN_VERSION_CHECK_REQUEST_KEY);
    if (!requested) return;

    window.sessionStorage.removeItem(LOGIN_VERSION_CHECK_REQUEST_KEY);
    setIsChecking(true);
    systemUpdateApi.check()
      .then((info) => {
        setResult(info);
        setIsDismissed(false);
      })
      .catch(() => undefined)
      .finally(() => setIsChecking(false));
  }, [accessToken]);

  const state = useMemo(() => {
    if (!result) return null;
    return result.updateAvailable
      ? {
          icon: <RefreshCcw size={16} />,
          title: "Có version mới",
          tone: "border-primary/25 bg-primary/5 text-primary",
          action: "Mở cập nhật",
        }
      : {
          icon: <CheckCircle2 size={16} />,
          title: "Đang ở version mới nhất",
          tone: "border-success/25 bg-success/5 text-success",
          action: "Xem chi tiết",
        };
  }, [result]);

  if ((!result && !isChecking) || isDismissed) return null;

  return (
    <div className="px-[16px] pt-[12px] md:px-[24px]" data-testid="login-version-update-notice">
      <div className={`flex flex-col gap-[10px] rounded-[12px] border px-[14px] py-[12px] shadow-sm md:flex-row md:items-center md:justify-between ${state?.tone || "border-border bg-card text-muted"}`}>
        <div className="flex min-w-0 items-start gap-[10px]">
          <span className="mt-[2px] shrink-0">{state?.icon || <GitBranch size={16} />}</span>
          <div className="min-w-0">
            <div className="text-[13px] font-black text-text">
              {isChecking ? "Đang kiểm tra version sau đăng nhập" : state?.title}
            </div>
            <div className="mt-[4px] flex flex-wrap items-center gap-x-[14px] gap-y-[4px] text-[12px] font-semibold text-muted">
              <span>Hiện tại: <span className="font-mono text-text">{shortVersion(result?.currentVersion)}</span></span>
              <span>Version mới: <span className="font-mono text-text">{shortVersion(result?.latestVersion)}</span></span>
              {result?.checkedAt && <span>Kiểm tra: {new Date(result.checkedAt).toLocaleString("vi-VN")}</span>}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-[8px]">
          {result && (
            <a
              href="/settings?section=system-update"
              className="inline-flex h-[34px] items-center rounded-[8px] border border-border bg-card px-[12px] text-[12px] font-black text-text transition hover:bg-background"
            >
              {state?.action}
            </a>
          )}
          <button
            type="button"
            aria-label="Ẩn thông báo version"
            onClick={() => setIsDismissed(true)}
            className="inline-flex h-[34px] w-[34px] items-center justify-center rounded-[8px] border border-border bg-card text-muted transition hover:text-text"
          >
            <X size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
