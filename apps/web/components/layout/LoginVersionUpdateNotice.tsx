"use client";

import React, { useEffect, useMemo, useState } from "react";
import { GitBranch, RefreshCcw, Rocket, X } from "lucide-react";
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
        if (info.updateAvailable) {
          setResult(info);
          setIsDismissed(false);
        }
      })
      .catch(() => undefined)
      .finally(() => setIsChecking(false));
  }, [accessToken]);

  const state = useMemo(() => {
    if (!result?.updateAvailable) return null;
    return {
      icon: <RefreshCcw size={18} />,
      title: "Có phiên bản HomeLand mới",
      tone: "border-primary/25 bg-primary/5 text-primary",
      action: "Mở cập nhật",
    };
  }, [result]);

  if (!result?.updateAvailable || isChecking || isDismissed || !state) return null;

  return (
    <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/45 px-[16px] py-[24px] backdrop-blur-sm" data-testid="login-version-update-notice">
      <div className={`w-full max-w-[560px] rounded-[14px] border bg-card p-[18px] shadow-2xl ${state.tone}`}>
        <div className="flex items-start justify-between gap-[14px]">
          <span className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[10px] bg-primary/10 text-primary">
            {state.icon || <GitBranch size={18} />}
          </span>
          <div className="min-w-0">
            <div className="text-[17px] font-black text-text">{state.title}</div>
            <p className="mt-[5px] text-[13px] font-medium leading-[20px] text-muted">
              Hệ thống phát hiện bản cập nhật mới sau khi đăng nhập. Vui lòng kiểm tra chi tiết trước khi tạo job cập nhật.
            </p>
            <div className="mt-[12px] flex flex-wrap items-center gap-x-[14px] gap-y-[6px] rounded-[8px] border border-border bg-background px-[12px] py-[10px] text-[12px] font-semibold text-muted">
              <span>Hiện tại: <span className="font-mono text-text">{shortVersion(result?.currentVersion)}</span></span>
              <span>Version mới: <span className="font-mono text-text">{shortVersion(result?.latestVersion)}</span></span>
              {result?.checkedAt && <span>Kiểm tra: {new Date(result.checkedAt).toLocaleString("vi-VN")}</span>}
            </div>
          </div>
          <button
            type="button"
            aria-label="Ẩn thông báo version"
            onClick={() => setIsDismissed(true)}
            className="inline-flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[8px] border border-border bg-card text-muted transition hover:text-text"
          >
            <X size={15} />
          </button>
        </div>
        <div className="mt-[16px] flex flex-col gap-[10px] sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => setIsDismissed(true)}
            className="inline-flex h-[40px] items-center justify-center rounded-[8px] border border-border bg-card px-[14px] text-[13px] font-black text-text transition hover:bg-background"
          >
            Để sau
          </button>
          <a
            href="/settings?section=system-update"
            className="inline-flex h-[40px] items-center justify-center gap-[8px] rounded-[8px] bg-primary px-[16px] text-[13px] font-black text-white transition hover:bg-primary/90"
          >
            <Rocket size={15} />
            {state.action}
          </a>
        </div>
      </div>
    </div>
  );
}
