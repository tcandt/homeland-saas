"use client";

import React, { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Switch } from "@/components/ui/Switch";
import { useSettingsSection } from "@/lib/hooks/useSettingsSection";
import { ApiError } from "@/lib/api/client";
import {
  AlertCircle,
  Bot,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  Info,
  Link2,
  LockKeyhole,
  MessageCircle,
  RefreshCcw,
  Send,
  Settings2,
  ShieldCheck,
  Users,
  Zap,
} from "lucide-react";
import toast from "react-hot-toast";
import { useAuthStore } from "@/lib/auth/auth-store";
import { settingsApi } from "@/lib/api/settings.api";

type ZaloSettings = {
  enabled: boolean;
  baseUrl: string;
  botToken: string;
  webhookSecret: string;
  adminGroupChatId?: string;
  adminGroupConnectedAt?: string | null;
  adminSetupCodePending?: boolean;
  adminSetupCodeExpiresAt?: string | null;
  lastWebhookConnectedAt?: string | null;
  lastWebhookStatus?: string | null;
  lastWebhookReceivedAt?: string | null;
  lastWebhookEventName?: string | null;
  lastWebhookChatId?: string | null;
  lastWebhookChatType?: "group" | "private" | "unknown" | null;
  lastWebhookRejectedReason?: string | null;
  lastWebhookPreview?: {
    contentType?: string | null;
    rawBodyLength?: number;
  } | null;
  botTokenConfigured?: boolean;
  webhookSecretConfigured?: boolean;
  webhookChatAvailable?: boolean;
  lastPollingError?: string | null;
};

const fallback: ZaloSettings = {
  enabled: false,
  baseUrl: "",
  botToken: "",
  webhookSecret: "",
};

function normalizeBaseUrl(value: string) {
  const raw = value.trim();
  if (!raw) return "";
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  return withProtocol.replace(/\/+$/, "");
}

function generateSecret() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${crypto.randomUUID().replace(/-/g, "")}${crypto.randomUUID().replace(/-/g, "")}`.slice(0, 64);
  }
  const bytes = new Uint8Array(32);
  (globalThis.crypto || window.crypto).getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString("vi-VN");
  } catch {
    return value;
  }
}

function shortSecret(value?: string) {
  const normalized = String(value || "").trim();
  if (!normalized) return "Chưa cấu hình";
  if (normalized.length <= 8) return "••••••••";
  return `${normalized.slice(0, 4)}••••${normalized.slice(-4)}`;
}

function resolveZaloErrorMessage(error: unknown) {
  if (!(error instanceof ApiError)) {
    return "Không lấy được trạng thái Zalo.";
  }

  if (error.code === "AUTH_PASSWORD_CHANGE_REQUIRED") {
    return "Phiên đăng nhập đang bị chặn bởi yêu cầu đổi mật khẩu. Hãy đổi mật khẩu hoặc bấm 'Bỏ qua lúc này' rồi thử lại.";
  }

  if (error.code === "ZALO_NO_WEBHOOK_CHAT_AVAILABLE") {
    return "Production chưa nhận được webhook chat thật từ Zalo group. Hãy nhắn /id hoặc /setadmin CODE trong đúng nhóm rồi refresh lại.";
  }

  return error.message || "Không lấy được trạng thái Zalo.";
}

export default function SettingsZaloIntegration() {
  const { draft, setDraft, isSaving, save } = useSettingsSection<ZaloSettings>("zalo-provider", "TENANT", fallback);
  const user = useAuthStore((state) => state.user);
  const canEditSecrets = (user?.email || "").toLowerCase() === "admin@homeland.vn";

  // Modal & Edit Draft States
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [configDraft, setConfigDraft] = useState<ZaloSettings>(fallback);
  const [secretTouched, setSecretTouched] = useState({ botToken: false });
  const [showBotToken, setShowBotToken] = useState(false);
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);

  // Actions & Loading States
  const [isTestingAdminGroup, setIsTestingAdminGroup] = useState(false);
  const [isTestingBot, setIsTestingBot] = useState(false);
  const [isConnectingWebhook, setIsConnectingWebhook] = useState(false);
  const [isRefreshingStatus, setIsRefreshingStatus] = useState(false);
  const [isGeneratingSetupCode, setIsGeneratingSetupCode] = useState(false);
  const [isClearingAdminGroup, setIsClearingAdminGroup] = useState(false);
  const [isAutoDetectingAdminGroup, setIsAutoDetectingAdminGroup] = useState(false);
  const [adminSetupCommand, setAdminSetupCommand] = useState("");
  const [diagnosticMessage, setDiagnosticMessage] = useState("");
  const [copiedUrl, setCopiedUrl] = useState(false);

  const resolvedBaseUrl = useMemo(() => {
    const candidate =
      draft.baseUrl ||
      (typeof window !== "undefined" ? window.location.origin : "") ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      "https://homeland.ductinh.one";
    return normalizeBaseUrl(candidate);
  }, [draft.baseUrl]);

  const webhookUrl = useMemo(
    () => (resolvedBaseUrl ? `${resolvedBaseUrl}/api/v1/notifications/zalo/webhook` : ""),
    [resolvedBaseUrl],
  );

  const modalWebhookUrl = useMemo(() => {
    const base =
      normalizeBaseUrl(configDraft.baseUrl) ||
      (typeof window !== "undefined" ? window.location.origin : "https://homeland.ductinh.one");
    return `${base}/api/v1/notifications/zalo/webhook`;
  }, [configDraft.baseUrl]);

  const hasAdminGroup = Boolean(String(draft.adminGroupChatId || "").trim());

  const copyText = async (value: string, label: string) => {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
    toast.success(`Đã sao chép ${label}`);
  };

  const refreshStatus = async () => {
    setIsRefreshingStatus(true);
    try {
      const result = await settingsApi.getZaloStatus();
      setDiagnosticMessage("");
      setDraft((prev) => ({
        ...prev,
        ...(result?.status || {}),
      }));
      toast.success("Đã làm mới trạng thái Zalo");
      return result?.status;
    } catch (error: any) {
      const message = resolveZaloErrorMessage(error);
      setDiagnosticMessage(message);
      toast.error(message);
      throw error;
    } finally {
      setIsRefreshingStatus(false);
    }
  };

  const openConfigModal = () => {
    setConfigDraft({
      ...draft,
      botToken: draft.botToken || "",
      webhookSecret: draft.webhookSecret || "",
    });
    setShowBotToken(false);
    setShowWebhookSecret(false);
    setIsConfigModalOpen(true);
  };

  const closeConfigModal = () => {
    setIsConfigModalOpen(false);
  };

  const saveConfigModal = async () => {
    const payload: Partial<ZaloSettings> = { ...configDraft };
    if (!canEditSecrets || !secretTouched.botToken) delete payload.botToken;
    delete payload.botTokenConfigured;
    delete payload.webhookSecretConfigured;

    try {
      setDraft(configDraft);
      await save(payload as ZaloSettings);
      setSecretTouched({ botToken: false });
      setIsConfigModalOpen(false);
      toast.success("Đã cập nhật cấu hình Zalo thành công!");
    } catch (error: any) {
      toast.error(error?.message || "Lỗi khi lưu cấu hình Zalo");
    }
  };

  const regenerateWebhookSecret = () => {
    if (!canEditSecrets) return;
    const webhookSecret = generateSecret();
    setConfigDraft((prev) => ({ ...prev, webhookSecret }));
    toast.success("Đã tạo Secret mới (hãy bấm Lưu để áp dụng)");
  };

  const connectWebhook = async () => {
    setIsConnectingWebhook(true);
    try {
      const result = await settingsApi.connectZaloWebhook();
      setDiagnosticMessage("");
      setDraft((prev) => ({
        ...prev,
        lastWebhookConnectedAt: new Date().toISOString(),
        lastWebhookStatus: "CONNECTED",
      }));
      await refreshStatus();
      toast.success(`Đã kết nối webhook thành công!`);
    } catch (error: any) {
      toast.error(error?.message || "Không kết nối được webhook");
    } finally {
      setIsConnectingWebhook(false);
    }
  };

  const testAdminGroup = async () => {
    setIsTestingAdminGroup(true);
    try {
      await settingsApi.testZaloAdminGroup();
      toast.success("Đã gửi tin nhắn test tới nhóm Admin");
    } catch (error: any) {
      toast.error(error?.message || "Không gửi được tin nhắn test");
    } finally {
      setIsTestingAdminGroup(false);
    }
  };

  const testZaloBot = async () => {
    setIsTestingBot(true);
    try {
      const response = await settingsApi.testZaloBot();
      const botData = response?.result?.result || response?.result?.data || response?.result || {};
      const botName = botData.first_name || botData.name || botData.username || "Bot";
      const botId = botData.id || botData.oa_id || "N/A";
      toast.success(`Kết nối thành công: ${botName} (ID: ${botId})`);
    } catch (error: any) {
      toast.error(error?.message || "Không thể kết nối với Bot. Vui lòng kiểm tra Token.");
    } finally {
      setIsTestingBot(false);
    }
  };

  const generateAdminGroupSetupCode = async () => {
    setIsGeneratingSetupCode(true);
    try {
      const result = await settingsApi.generateZaloAdminGroupSetupCode();
      setDiagnosticMessage("");
      const command = String(result?.command || "").trim();
      setAdminSetupCommand(command);
      setConfigDraft((prev) => ({
        ...prev,
        adminSetupCodePending: true,
        adminSetupCodeExpiresAt: result?.expiresAt || null,
      }));
      setDraft((prev) => ({
        ...prev,
        adminSetupCodePending: true,
        adminSetupCodeExpiresAt: result?.expiresAt || null,
      }));
      if (command) {
        await navigator.clipboard.writeText(command);
      }
      toast.success("Đã tạo lệnh kết nối và copy vào clipboard");
    } catch (error: any) {
      toast.error(error?.message || "Không tạo được mã kết nối");
    } finally {
      setIsGeneratingSetupCode(false);
    }
  };

  const clearAdminGroup = async () => {
    setIsClearingAdminGroup(true);
    try {
      await settingsApi.clearZaloAdminGroup();
      setDiagnosticMessage("");
      setAdminSetupCommand("");
      setConfigDraft((prev) => ({
        ...prev,
        adminGroupChatId: "",
        adminGroupConnectedAt: null,
        adminSetupCodePending: false,
        adminSetupCodeExpiresAt: null,
      }));
      setDraft((prev) => ({
        ...prev,
        adminGroupChatId: "",
        adminGroupConnectedAt: null,
        adminSetupCodePending: false,
        adminSetupCodeExpiresAt: null,
      }));
      await refreshStatus();
      toast.success("Đã xóa liên kết nhóm Admin");
    } catch (error: any) {
      toast.error(error?.message || "Không xóa được nhóm Admin");
    } finally {
      setIsClearingAdminGroup(false);
    }
  };

  const autoDetectAdminGroup = async () => {
    setIsAutoDetectingAdminGroup(true);
    try {
      const result = await settingsApi.autoDetectZaloAdminGroup();
      setDiagnosticMessage("");
      const newChatId = result?.chat?.chatId || draft.adminGroupChatId || "";
      setConfigDraft((prev) => ({ ...prev, adminGroupChatId: newChatId }));
      setDraft((prev) => ({ ...prev, adminGroupChatId: newChatId }));
      await refreshStatus();
      toast.success("Đã nhận diện và gán nhóm Admin thành công!");
    } catch (error: any) {
      const message = resolveZaloErrorMessage(error);
      setDiagnosticMessage(message);
      toast.error(message);
    } finally {
      setIsAutoDetectingAdminGroup(false);
    }
  };

  const getWebhookStatusBadge = () => {
    if (draft.lastWebhookStatus === "CONNECTED") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 size={12} /> Đã kết nối
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 text-xs font-semibold text-slate-600 dark:text-slate-400">
        Chưa kết nối
      </span>
    );
  };

  return (
    <div className="flex h-full flex-col gap-4">
      <Card className="flex h-full flex-col gap-4 border-purple-500/20 shadow-sm p-4 sm:p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 pb-2 border-b border-border/60">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold text-xs">
                <MessageCircle size={16} />
              </div>
              <span className="text-xs font-black uppercase tracking-wider text-purple-600 dark:text-purple-400">
                Zalo Provider
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
            <h3 className="text-lg font-black text-text">Cấu hình gửi Zalo</h3>
            <p className="text-xs text-muted">
              Gửi thông báo hợp đồng, hóa đơn, biến động số dư và tiếp nhận đăng ký phòng qua Zalo Bot.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 shadow-sm">
            <Switch
              checked={draft.enabled}
              onChange={(event) => setDraft((prev) => ({ ...prev, enabled: event.target.checked }))}
              aria-label="Bật Zalo"
            />
          </div>
        </div>

        {diagnosticMessage && (
          <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200">
            <AlertCircle size={16} className="mt-0.5 shrink-0 text-amber-500" />
            <span className="leading-relaxed">{diagnosticMessage}</span>
          </div>
        )}

        {/* Section: HỢP NHẤT TOÀN BỘ CẤU HÌNH VÀO 1 BOX TINH GỌN */}
        <div className="rounded-xl border border-border bg-background/80 p-3.5 sm:p-4 space-y-3.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted">
              <Link2 size={14} className="text-purple-600" /> Tích hợp Webhook & Zalo Bot
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={openConfigModal}
              className="h-8 rounded-xl px-3 text-xs font-bold text-purple-600 border-purple-500/30 hover:bg-purple-500/5 hover:border-purple-500"
            >
              <Settings2 size={13} className="mr-1.5" /> Thiết lập cấu hình
            </Button>
          </div>

          {/* Webhook URL preview box */}
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center justify-between overflow-hidden rounded-xl border border-border bg-card px-3.5 py-2.5">
              <div className="min-w-0">
                <div className="text-[10px] uppercase font-bold text-muted tracking-wider">
                  Webhook URL hoàn chỉnh (Zalo Bot Webhook)
                </div>
                <div className="truncate text-xs font-mono font-bold text-text mt-0.5 select-all">
                  {webhookUrl || "Chưa có Webhook URL"}
                </div>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => copyText(webhookUrl, "Webhook URL")}
              disabled={!webhookUrl}
              className="h-12 px-3.5 shrink-0 rounded-xl text-xs font-bold shadow-sm"
            >
              {copiedUrl ? <Check size={15} className="text-emerald-500" /> : <Copy size={15} />}
              <span className="ml-1.5 hidden sm:inline">{copiedUrl ? "Đã sao chép" : "Sao chép URL"}</span>
            </Button>
          </div>

          {/* Consolidated Summary Grid */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            <div className="rounded-xl border border-border bg-card p-3">
              <div className="text-[10px] uppercase font-bold tracking-wider text-muted">Webhook Status</div>
              <div className="mt-1">{getWebhookStatusBadge()}</div>
            </div>

            <div className="rounded-xl border border-border bg-card p-3 cursor-pointer hover:border-purple-500/40 transition" onClick={openConfigModal}>
              <div className="text-[10px] uppercase font-bold tracking-wider text-muted">Admin Group ID</div>
              <div className="mt-1 text-xs font-mono font-bold text-text truncate">
                {draft.adminGroupChatId ? draft.adminGroupChatId : <span className="text-muted font-normal">Chưa kết nối</span>}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-3">
              <div className="text-[10px] uppercase font-bold tracking-wider text-muted">Bot Token</div>
              <div className="mt-1 text-xs font-mono font-bold text-text truncate">
                {draft.botToken ? shortSecret(draft.botToken) : <span className="text-muted font-normal">Chưa cấu hình</span>}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-3">
              <div className="text-[10px] uppercase font-bold tracking-wider text-muted">Webhook Secret</div>
              <div className="mt-1 text-xs font-mono font-bold text-text truncate">
                {draft.webhookSecret ? shortSecret(draft.webhookSecret) : <span className="text-muted font-normal">Chưa cấu hình</span>}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-3 col-span-2 sm:col-span-1">
              <div className="text-[10px] uppercase font-bold tracking-wider text-muted">Lần nhận gần nhất</div>
              <div className="mt-1 text-xs font-bold text-text truncate">
                {formatDateTime(draft.lastWebhookReceivedAt)}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Link chỉ dẫn */}
        <div className="mt-auto border-t border-border/60 pt-3 flex items-center justify-between">
          <span className="inline-flex items-center gap-1 text-xs font-medium text-purple-600 dark:text-purple-400">
            <MessageCircle size={13} /> Zalo Platform Bot API
          </span>
          <span className="text-[11px] text-muted">
            {draft.lastWebhookConnectedAt ? `Kết nối: ${formatDateTime(draft.lastWebhookConnectedAt)}` : "Chưa kết nối webhook"}
          </span>
        </div>
      </Card>

      {/* POPUP MODAL: THIẾT LẬP TOÀN BỘ CẤU HÌNH ZALO & CÔNG CỤ TESTING */}
      <Modal
        isOpen={isConfigModalOpen}
        onClose={closeConfigModal}
        title="Thiết lập cấu hình Zalo Provider & Webhook"
        maxWidth="max-w-[720px]"
        footer={
          <div className="flex flex-wrap items-center justify-between gap-2.5 w-full">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={testAdminGroup}
                isLoading={isTestingAdminGroup}
                disabled={!hasAdminGroup}
                className="h-10 rounded-xl px-3 text-xs font-bold"
              >
                <Send size={13} className="mr-1.5 text-purple-600" /> Test Admin
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={testZaloBot}
                isLoading={isTestingBot}
                disabled={!draft.botToken}
                className="h-10 rounded-xl px-3 text-xs font-bold"
              >
                <Bot size={13} className="mr-1.5" /> Test Bot
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={connectWebhook}
                isLoading={isConnectingWebhook}
                className="h-10 rounded-xl px-3 text-xs font-bold"
              >
                <Link2 size={13} className="mr-1.5 text-primary" /> Connect
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={refreshStatus}
                isLoading={isRefreshingStatus}
                className="h-10 rounded-xl px-3 text-xs font-bold"
              >
                <RefreshCcw size={13} className="mr-1.5" /> Làm mới
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
          {/* Nhóm 1: Webhook Endpoint & Domain */}
          <div className="rounded-xl border border-border bg-card p-3.5 space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-purple-600 uppercase tracking-wider">
              <Link2 size={14} /> 1. Webhook Endpoint & Domain
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-text">Web URL (Base URL domain công khai)</label>
              <Input
                value={configDraft.baseUrl}
                onChange={(event) => setConfigDraft((prev) => ({ ...prev, baseUrl: event.target.value }))}
                placeholder="https://homeland.ductinh.one"
                autoComplete="off"
                className="h-10 text-xs font-mono"
              />
              <span className="text-[11px] text-muted">Domain công khai để Zalo Server gửi webhook tới.</span>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-text">Webhook URL hoàn chỉnh</label>
              <div className="flex items-center gap-1.5">
                <Input
                  value={modalWebhookUrl}
                  readOnly
                  className="h-10 text-xs font-mono bg-background/50 font-semibold select-all"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => copyText(modalWebhookUrl, "Webhook URL")}
                  className="h-10 px-3 shrink-0 rounded-xl text-xs font-bold"
                >
                  <Copy size={13} className="mr-1" /> Copy
                </Button>
              </div>
            </div>
          </div>

          {/* Nhóm 2: Bot Token & Webhook Secret */}
          <div className="rounded-xl border border-border bg-card p-3.5 space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-purple-600 uppercase tracking-wider">
              <ShieldCheck size={14} /> 2. Thông tin Bot Token & Secret
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-text">Zalo Bot Token</label>
              <div className="relative">
                <Input
                  type={showBotToken ? "text" : "password"}
                  value={configDraft.botToken}
                  onChange={(event) => {
                    setSecretTouched((prev) => ({ ...prev, botToken: true }));
                    setConfigDraft((prev) => ({ ...prev, botToken: event.target.value }));
                  }}
                  placeholder={canEditSecrets ? "Dán Bot Token từ Zalo Developer / Bot Platform" : "Chỉ admin@homeland.vn được sửa"}
                  disabled={!canEditSecrets}
                  className="pr-10 text-xs font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowBotToken(!showBotToken)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-text"
                >
                  {showBotToken ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-text">Webhook Secret (Khóa xác thực chữ ký webhook)</label>
              <div className="flex items-center gap-1.5">
                <div className="relative flex-1">
                  <Input
                    type={showWebhookSecret ? "text" : "password"}
                    value={configDraft.webhookSecret}
                    onChange={(event) =>
                      setConfigDraft((prev) => ({ ...prev, webhookSecret: event.target.value }))
                    }
                    placeholder="Webhook Secret"
                    disabled={!canEditSecrets}
                    className="pr-10 text-xs font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowWebhookSecret(!showWebhookSecret)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-text"
                  >
                    {showWebhookSecret ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={regenerateWebhookSecret}
                  disabled={!canEditSecrets}
                  className="h-10 px-3 shrink-0 rounded-xl text-xs font-bold"
                  title="Tạo ngẫu nhiên Secret mới"
                >
                  <RefreshCcw size={13} className="mr-1" /> Random Secret
                </Button>
              </div>
            </div>
          </div>

          {/* Nhóm 3: Kết nối nhóm Admin (Admin Group) */}
          <div className="rounded-xl border border-border bg-card p-3.5 space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-purple-600 uppercase tracking-wider">
              <Users size={14} /> 3. Kết nối nhóm Zalo Admin
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-text">Admin Group Chat ID</label>
              <Input
                type="text"
                value={configDraft.adminGroupChatId || ""}
                onChange={(event) =>
                  setConfigDraft((prev) => ({ ...prev, adminGroupChatId: event.target.value }))
                }
                placeholder="Nhập Chat ID hoặc lấy tự động qua Get ChatID bên dưới"
                className="h-10 text-xs font-mono"
              />
            </div>

            <div className="rounded-xl border border-border bg-background p-3 space-y-2.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-muted">Công cụ nhận diện nhóm tự động</div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={() => copyText(adminSetupCommand, "lệnh kết nối")}
                  disabled={!adminSetupCommand}
                  className="flex min-w-0 flex-1 items-center rounded-xl border border-border bg-card px-3 py-2 text-left transition hover:border-purple-500/40 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span className="min-w-0 flex-1 truncate font-mono text-xs font-bold text-text">
                    {adminSetupCommand || "/setadmin CODE"}
                  </span>
                </button>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={generateAdminGroupSetupCode}
                    isLoading={isGeneratingSetupCode}
                    className="h-9 px-3 rounded-xl text-xs font-bold"
                  >
                    Generate
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={autoDetectAdminGroup}
                    isLoading={isAutoDetectingAdminGroup}
                    className="h-9 px-3 rounded-xl text-xs font-bold"
                  >
                    Get ChatID
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={clearAdminGroup}
                    isLoading={isClearingAdminGroup}
                    className="h-9 px-3 rounded-xl text-xs font-bold text-rose-600 hover:text-rose-700"
                  >
                    Xóa nhóm
                  </Button>
                </div>
              </div>
              <div className="text-[11px] text-muted">
                {configDraft.adminSetupCodePending && configDraft.adminSetupCodeExpiresAt
                  ? `Mã kết nối có hiệu lực đến: ${formatDateTime(configDraft.adminSetupCodeExpiresAt)}`
                  : "Thêm Bot vào nhóm Admin ➔ Gửi lệnh /setadmin CODE hoặc /id ➔ Bấm Get ChatID"}
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
