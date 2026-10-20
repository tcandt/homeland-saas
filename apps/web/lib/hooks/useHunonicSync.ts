"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiError } from "@/lib/api/client";
import { hunonicApi, HunonicSyncStatus } from "@/lib/api/hunonic.api";
import { useAuthStore } from "@/lib/auth/auth-store";
import { syncPhaseLabel } from "@/lib/hunonic/sync-presentation";

const POLL_MS = 1500;

function storageKey(tenantId?: string) {
  return tenantId ? `homeland:hunonic-sync:${tenantId}` : null;
}

function readStoredJob(tenantId?: string) {
  if (typeof window === "undefined") return null;
  const key = storageKey(tenantId);
  if (!key) return null;
  try {
    const value = localStorage.getItem(key);
    return value && value.length < 200 ? value : null;
  } catch {
    return null;
  }
}

function saveStoredJob(tenantId: string | undefined, jobId?: string) {
  if (typeof window === "undefined") return;
  const key = storageKey(tenantId);
  if (!key) return;
  try {
    if (jobId) localStorage.setItem(key, jobId);
    else localStorage.removeItem(key);
  } catch {
    // Local resume is optional; server-side jobs stay authoritative.
  }
}

export function useHunonicSync(options: { enabled?: boolean; onSuccess?: (status: HunonicSyncStatus) => void } = {}) {
  const user = useAuthStore((state) => state.user);
  const canSync = Boolean(user?.roles?.includes("ADMIN") || user?.permissions?.includes("meter.sync"));
  const tenantId = user?.tenantId;
  const enabled = options.enabled !== false;
  const activeTenant = useRef(tenantId);
  activeTenant.current = tenantId;
  const [status, setStatus] = useState<HunonicSyncStatus | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [pollError, setPollError] = useState<string | null>(null);
  const successNotified = useRef<string | null>(null);
  const onSuccessRef = useRef(options.onSuccess);
  onSuccessRef.current = options.onSuccess;

  const applyStatus = useCallback((next: HunonicSyncStatus) => {
    if (activeTenant.current !== tenantId) return;
    setStatus(next);
    setPollError(null);
    if (next.status === "RUNNING") saveStoredJob(tenantId, next.jobId);
    if (next.status === "SUCCESS" || next.status === "FAILED") saveStoredJob(tenantId);
    if (next.status === "SUCCESS" && successNotified.current !== next.jobId) {
      successNotified.current = next.jobId;
      onSuccessRef.current?.(next);
    }
  }, [tenantId]);

  useEffect(() => {
    setJobId(null);
    setStatus(null);
    setPollError(null);
    setIsStarting(false);
    successNotified.current = null;
  }, [tenantId]);

  useEffect(() => {
    if (!enabled || !canSync || !tenantId || jobId) return;
    const stored = readStoredJob(tenantId);
    if (stored) setJobId(stored);
  }, [canSync, jobId, enabled, tenantId]);

  useEffect(() => {
    if (!enabled || !canSync || !jobId) return;
    let disposed = false;
    let timer: number | undefined;
    const poll = async () => {
      try {
        const next = await hunonicApi.syncStatus(jobId);
        if (disposed) return;
        applyStatus(next);
        if (next.status === "RUNNING") timer = window.setTimeout(poll, POLL_MS);
      } catch (error: any) {
        if (disposed) return;
        if (error instanceof ApiError && error.status === 404) {
          saveStoredJob(tenantId);
          setJobId(null);
          setPollError("Không tìm thấy phiên đồng bộ đã lưu.");
          return;
        }
        // Do not change a server job to failed on a client network interruption.
        setPollError(error?.message || "Không thể cập nhật tiến độ; sẽ thử lại.");
        timer = window.setTimeout(poll, POLL_MS * 2);
      }
    };
    void poll();
    return () => {
      disposed = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [applyStatus, canSync, jobId, enabled, tenantId]);

  const start = useCallback(async () => {
    if (!enabled || !canSync) throw new Error("Bạn không có quyền đồng bộ công tơ.");
    if (isStarting) return status;
    if (status?.status === "RUNNING") return status;
    setIsStarting(true);
    try {
      const next = await hunonicApi.startSync();
      if (activeTenant.current !== tenantId) return null;
      setJobId(next.jobId);
      applyStatus(next);
      return next;
    } finally {
      if (activeTenant.current === tenantId) setIsStarting(false);
    }
  }, [applyStatus, canSync, enabled, isStarting, status, tenantId]);

  const isRunning = status?.status === "RUNNING";
  return useMemo(() => ({
    canSync,
    status,
    start,
    isRunning,
    isStarting,
    pollError,
    phaseLabel: syncPhaseLabel(status?.phase),
  }), [canSync, isRunning, isStarting, pollError, start, status]);
}
