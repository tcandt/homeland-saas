"use client";

import React, { useMemo, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  Bolt,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  Info,
  LockKeyhole,
  PlugZap,
  RefreshCcw,
  Server,
  Settings2,
  ShieldCheck,
  Smartphone,
  Wifi,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Switch } from "@/components/ui/Switch";
import { useSettingsSection } from "@/lib/hooks/useSettingsSection";
import { useAuthStore } from "@/lib/auth/auth-store";
import { hunonicApi, HunonicSettingsPayload } from "@/lib/api/hunonic.api";
import toast from "react-hot-toast";

const fallback: Required<HunonicSettingsPayload> = {
  enabled: false,
  mode: "website",
  username: "",
  password: "",
  passwordConfigured: false,
  baseUrl: "https://api.hunonicpro.com/v2",
  websiteBaseUrl: "https://web.hunonic.com/api/api/hun-api",
  websiteToken: "",
  websiteTokenConfigured: false,
  websiteCookie: "",
  websiteCookieConfigured: false,
  timeoutMs: 15000,
  syncIntervalMinutes: 60,
  retentionYears: 3,
};

function shortSecret(value?: string) {
  const normalized = String(value || "").trim();
  if (!normalized) return "Chưa cấu hình";
  if (normalized.length <= 8) return "••••••••";
  return `${normalized.slice(0, 4)}••••${normalized.slice(-4)}`;
}

function formatDate(value?: string) {
  if (!value) return "Chưa đồng bộ";
  try {
    return new Date(value).toLocaleString("vi-VN");
  } catch {
    return value;
  }
}

export default function SettingsHunonicIntegration() {
  const { draft, setDraft, isSaving, save } = useSettingsSection<Required<HunonicSettingsPayload>>(
    "hunonic",
    "TENANT",
    fallback,
  );
  const overview = useSWR(["hunonic-overview"], () => hunonicApi.overview(), { revalidateOnFocus: false });
  const user = useAuthStore((state) => state.user);
  const canEditSecrets = (user?.email || "").toLowerCase() === "admin@homeland.vn";

  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [configDraft, setConfigDraft] = useState<Required<HunonicSettingsPayload>>(fallback);
  const [showPassword, setShowPassword] = useState(false);
  const [showWebsiteToken, setShowWebsiteToken] = useState(false);
  const [showWebsiteCookie, setShowWebsiteCookie] = useState(false);
  const [secretTouched, setSecretTouched] = useState({
    password: false,
    websiteToken: false,
    websiteCookie: false,
  });

  const [isTesting, setIsTesting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const rawOverview = overview.data as any;
  const overviewData = rawOverview?.data || rawOverview || {};
  const totalMeters = overviewData.totalMeters || overviewData.meters?.length || 0;
  const onlineMeters = overviewData.onlineMeters || 0;
  const lastSyncAt = overviewData.lastSyncAt || overviewData.syncedAt;

  const openConfigModal = () => {
    const current = draft || fallback;
    setConfigDraft({
      enabled: Boolean(current.enabled),
      mode: current.mode || "website",
      username: current.username || "",
      password: current.password || "",
      passwordConfigured: Boolean(current.passwordConfigured),
      baseUrl: current.baseUrl || fallback.baseUrl,
      websiteBaseUrl: current.websiteBaseUrl || fallback.websiteBaseUrl,
      websiteToken: current.websiteToken || "",
      websiteTokenConfigured: Boolean(current.websiteTokenConfigured),
      websiteCookie: current.websiteCookie || "",
      websiteCookieConfigured: Boolean(current.websiteCookieConfigured),
      timeoutMs: Number(current.timeoutMs || 15000),
      syncIntervalMinutes: Number(current.syncIntervalMinutes || 60),
      retentionYears: Number(current.retentionYears || 3),
    });
    setShowPassword(false);
    setShowWebsiteToken(false);
    setShowWebsiteCookie(false);
    setSecretTouched({ password: false, websiteToken: false, websiteCookie: false });
    setIsConfigModalOpen(true);
  };

  const closeConfigModal = () => {
    setIsConfigModalOpen(false);
  };

  const saveConfigModal = async () => {
    const payload: HunonicSettingsPayload = { ...configDraft };
    delete payload.passwordConfigured;
    delete payload.websiteTokenConfigured;
    delete payload.websiteCookieConfigured;

    if (!canEditSecrets || !secretTouched.password) delete payload.password;
    if (!canEditSecrets || !secretTouched.websiteToken) delete payload.websiteToken;
    if (!canEditSecrets || !secretTouched.websiteCookie) delete payload.websiteCookie;

    try {
      setDraft(configDraft);
      await save(payload as Required<HunonicSettingsPayload>);
      await overview.mutate();
      setIsConfigModalOpen(false);
      toast.success("Đã cập nhật cấu hình Hunonic thành công!");
    } catch (error: any) {
      toast.error(error?.message || "Lỗi khi lưu cấu hình Hunonic");
    }
  };

  const testConnection = async () => {
    setIsTesting(true);
    try {
      const payload: HunonicSettingsPayload = { ...configDraft };
      if (!secretTouched.password && !configDraft.password) delete payload.password;
      if (!secretTouched.websiteToken && !configDraft.websiteToken) delete payload.websiteToken;
      if (!secretTouched.websiteCookie && !configDraft.websiteCookie) delete payload.websiteCookie;

      const result: any = await hunonicApi.test(payload);
      if (result?.success || result?.data?.success) {
        toast.success(`Kết nối Hunonic thành công! Tìm thấy ${result?.data?.totalMeters ?? result?.totalMeters ?? 0} công tơ.`);
      } else {
        toast.success("Đã gửi yêu cầu kiểm tra kết nối tới Hunonic");
      }
    } catch (error: any) {
      toast.error(error?.message || "Không thể kết nối với Hunonic. Vui lòng kiểm tra tài khoản / token.");
    } finally {
      setIsTesting(false);
    }
  };

  const syncNow = async () => {
    setIsSyncing(true);
    try {
      const result: any = await hunonicApi.sync();
      await overview.mutate();
      toast.success(`Đã đồng bộ chỉ số điện từ Hunonic thành công (${result?.data?.syncedCount ?? "toàn bộ"} công tơ)`);
    } catch (error: any) {
      toast.error(error?.message || "Không đồng bộ được chỉ số điện");
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="flex h-full flex-col gap-4">
      <Card className="flex h-full flex-col gap-4 border-emerald-500/20 shadow-sm p-4 sm:p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 pb-2 border-b border-border/60">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                <PlugZap size={16} />
              </div>
              <span className="text-xs font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Hunonic IoT
              </span>
              {draft.enabled ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Đang bật
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-500/10 text-slate-500 border border-slate-500/20">
                  Đang tắt
                </span>
              )}
            </div>
            <h3 className="text-lg font-black text-text">Cấu hình điện thông minh Hunonic</h3>
            <p className="text-xs text-muted">
              Đồng bộ chỉ số công tơ điện tự động theo chu kỳ, đối soát số điện và tính tiền điện theo phòng.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 shadow-sm">
            <Switch
              checked={draft.enabled}
              onChange={(event) => setDraft((prev) => ({ ...prev, enabled: event.target.checked }))}
              aria-label="Bật Hunonic"
            />
          </div>
        </div>

        {/* Section: HỢP NHẤT TOÀN BỘ CẤU HÌNH VÀO 1 BOX TINH GỌN */}
        <div className="rounded-xl border border-border bg-background/80 p-3.5 sm:p-4 space-y-3.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted">
              <Bolt size={14} className="text-emerald-600" /> Tích hợp Công tơ điện Hunonic
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={openConfigModal}
                className="h-8 rounded-xl px-3 text-xs font-bold text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/5 hover:border-emerald-500"
              >
                <Settings2 size={13} className="mr-1.5" /> Thiết lập cấu hình
              </Button>
            </div>
          </div>

          {/* Consolidated Summary Grid */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            <div className="rounded-xl border border-border bg-card p-3">
              <div className="text-[10px] uppercase font-bold tracking-wider text-muted">Chế độ kết nối</div>
              <div className="mt-1 text-xs font-bold text-text truncate">
                {draft.mode === "website" ? "Website Session" : "Mobile / Pro API"}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-3 cursor-pointer hover:border-emerald-500/40 transition" onClick={openConfigModal}>
              <div className="text-[10px] uppercase font-bold tracking-wider text-muted">Tài khoản Hunonic</div>
              <div className="mt-1 text-xs font-mono font-bold text-text truncate">
                {draft.username || <span className="text-muted font-normal">Chưa cấu hình</span>}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-3">
              <div className="text-[10px] uppercase font-bold tracking-wider text-muted">Trạng thái Token</div>
              <div className="mt-1 text-xs font-mono font-bold text-text truncate">
                {draft.websiteToken ? shortSecret(draft.websiteToken) : draft.password ? "Mật khẩu: Đã cài" : <span className="text-muted font-normal">Chưa cấu hình</span>}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-3">
              <div className="text-[10px] uppercase font-bold tracking-wider text-muted">Số công tơ</div>
              <div className="mt-1 text-xs font-black text-emerald-600 dark:text-emerald-400 truncate">
                {totalMeters > 0 ? `${totalMeters} công tơ (${onlineMeters} online)` : "Chưa có công tơ"}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-3 col-span-2 sm:col-span-1">
              <div className="text-[10px] uppercase font-bold tracking-wider text-muted">Đồng bộ gần nhất</div>
              <div className="mt-1 text-xs font-bold text-text truncate">
                {formatDate(lastSyncAt)}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Link chỉ dẫn */}
        <div className="mt-auto border-t border-border/60 pt-3 flex items-center justify-between">
          <Link
            href="/electricity"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 hover:underline"
          >
            <span>Mở Bảng theo dõi & Chỉ số công tơ điện</span>
            <ArrowRight size={13} />
          </Link>
          <span className="text-[11px] text-muted">
            {draft.syncIntervalMinutes ? `Tự động quét mỗi ${draft.syncIntervalMinutes} phút` : "Chưa bật chu kỳ tự động"}
          </span>
        </div>
      </Card>

      {/* POPUP MODAL: THIẾT LẬP TOÀN BỘ CẤU HÌNH HUNONIC */}
      <Modal
        isOpen={isConfigModalOpen}
        onClose={closeConfigModal}
        title="Thiết lập cấu hình Hunonic IoT Provider"
        maxWidth="max-w-[720px]"
        footer={
          <div className="flex flex-wrap items-center justify-between gap-2.5 w-full">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={testConnection}
                isLoading={isTesting}
                className="h-10 rounded-xl px-3.5 text-xs font-bold"
              >
                <Zap size={14} className="mr-1.5 text-emerald-600" /> Kiểm tra kết nối
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={syncNow}
                isLoading={isSyncing}
                className="h-10 rounded-xl px-3.5 text-xs font-bold"
              >
                <RefreshCcw size={14} className="mr-1.5 text-emerald-600" /> Đồng bộ ngay
              </Button>
            </div>
            <div className="flex items-center gap-2.5">
              <Button type="button" variant="outline" onClick={closeConfigModal}>
                Hủy bỏ
              </Button>
              <Button type="button" onClick={saveConfigModal} className="bg-primary text-white font-bold">
                Lưu cấu hình
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
          {/* Nhóm 1: Chế độ kết nối & Tài khoản */}
          <div className="rounded-xl border border-border bg-card p-3.5 space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 uppercase tracking-wider">
              <Server size={14} /> 1. Chế độ kết nối & Tài khoản Hunonic
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-text">Chế độ kết nối</label>
              <select
                value={configDraft.mode || "website"}
                onChange={(event) =>
                  setConfigDraft((prev) => ({
                    ...prev,
                    mode: event.target.value as "mobile" | "website",
                  }))
                }
                className="h-10 w-full rounded-xl border border-border bg-background px-3 text-xs font-bold text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              >
                <option value="website">Website Session (Khuyến nghị cho Web Portal)</option>
                <option value="mobile">Mobile / Hunonic Pro API v2</option>
              </select>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-bold text-text">Số điện thoại / Username</label>
                <Input
                  value={configDraft.username}
                  onChange={(event) => setConfigDraft((prev) => ({ ...prev, username: event.target.value }))}
                  placeholder="0987654321"
                  className="h-10 text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-text">Mật khẩu tài khoản</label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={configDraft.password}
                    onChange={(event) => {
                      setSecretTouched((prev) => ({ ...prev, password: true }));
                      setConfigDraft((prev) => ({ ...prev, password: event.target.value }));
                    }}
                    placeholder={canEditSecrets ? "Nhập mật khẩu" : "Chỉ admin@homeland.vn được sửa"}
                    disabled={!canEditSecrets}
                    className="pr-10 text-xs font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-text"
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Nhóm 2: Token & Cookies */}
          <div className="rounded-xl border border-border bg-card p-3.5 space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 uppercase tracking-wider">
              <ShieldCheck size={14} /> 2. Token & Thông tin Web API
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-text">Website Base URL</label>
              <Input
                value={configDraft.websiteBaseUrl}
                onChange={(event) => setConfigDraft((prev) => ({ ...prev, websiteBaseUrl: event.target.value }))}
                placeholder="https://web.hunonic.com/api/api/hun-api"
                className="h-10 text-xs font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-text">Website Bearer Token (Tùy chọn ghi đè)</label>
              <div className="relative">
                <Input
                  type={showWebsiteToken ? "text" : "password"}
                  value={configDraft.websiteToken}
                  onChange={(event) => {
                    setSecretTouched((prev) => ({ ...prev, websiteToken: true }));
                    setConfigDraft((prev) => ({ ...prev, websiteToken: event.target.value }));
                  }}
                  placeholder={canEditSecrets ? "Bearer Token từ web.hunonic.com" : "Chỉ admin@homeland.vn được sửa"}
                  disabled={!canEditSecrets}
                  className="pr-10 text-xs font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowWebsiteToken(!showWebsiteToken)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-text"
                >
                  {showWebsiteToken ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-text">Website Cookie Session</label>
              <div className="relative">
                <Input
                  type={showWebsiteCookie ? "text" : "password"}
                  value={configDraft.websiteCookie}
                  onChange={(event) => {
                    setSecretTouched((prev) => ({ ...prev, websiteCookie: true }));
                    setConfigDraft((prev) => ({ ...prev, websiteCookie: event.target.value }));
                  }}
                  placeholder={canEditSecrets ? "Cookie session từ trình duyệt" : "Chỉ admin@homeland.vn được sửa"}
                  disabled={!canEditSecrets}
                  className="pr-10 text-xs font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowWebsiteCookie(!showWebsiteCookie)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-text"
                >
                  {showWebsiteCookie ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
          </div>

          {/* Nhóm 3: Chu kỳ đồng bộ & Thời gian lưu trữ */}
          <div className="rounded-xl border border-border bg-card p-3.5 space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 uppercase tracking-wider">
              <Clock size={14} /> 3. Chu kỳ đồng bộ & Hiệu năng
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-text">Chu kỳ đồng bộ (Phút)</label>
                <Input
                  type="number"
                  value={configDraft.syncIntervalMinutes}
                  onChange={(event) =>
                    setConfigDraft((prev) => ({
                      ...prev,
                      syncIntervalMinutes: Number(event.target.value || 60),
                    }))
                  }
                  placeholder="60"
                  className="h-10 text-xs font-mono font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-text">Timeout (Mili-giây)</label>
                <Input
                  type="number"
                  value={configDraft.timeoutMs}
                  onChange={(event) =>
                    setConfigDraft((prev) => ({
                      ...prev,
                      timeoutMs: Number(event.target.value || 15000),
                    }))
                  }
                  placeholder="15000"
                  className="h-10 text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-text">Lưu trữ lịch sử (Năm)</label>
                <Input
                  type="number"
                  value={configDraft.retentionYears}
                  onChange={(event) =>
                    setConfigDraft((prev) => ({
                      ...prev,
                      retentionYears: Number(event.target.value || 3),
                    }))
                  }
                  placeholder="3"
                  className="h-10 text-xs font-mono"
                />
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
