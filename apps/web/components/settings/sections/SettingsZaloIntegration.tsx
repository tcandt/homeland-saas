"use client";

import React, { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Switch } from "@/components/ui/Switch";
import { useSettingsSection } from "@/lib/hooks/useSettingsSection";
import { ApiError } from "@/lib/api/client";
import { AlertCircle, Link2, MessageCircle, RefreshCcw } from "lucide-react";
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
  return value ? new Date(value).toLocaleString("vi-VN") : "-";
}

function formatWebhookReason(value?: string | null) {
  const code = String(value || "").trim();
  if (!code) return "OK";
  if (code === "CHAT_ID_NOT_FOUND") return "Không thấy chat ID";
  if (code === "SECRET_INVALID_OR_MISSING") return "Sai hoặc thiếu secret";
  if (code === "SYNTHETIC_CHAT_ID_IGNORED") return "Bỏ qua chat ID test";
  return code;
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

  const [secretTouched, setSecretTouched] = useState({ botToken: false });
  const [isGeneratingSecret, setIsGeneratingSecret] = useState(false);
  const [isTestingAdminGroup, setIsTestingAdminGroup] = useState(false);
  const [isTestingBot, setIsTestingBot] = useState(false);
  const [isConnectingWebhook, setIsConnectingWebhook] = useState(false);
  const [isRefreshingStatus, setIsRefreshingStatus] = useState(false);
  const [isGeneratingSetupCode, setIsGeneratingSetupCode] = useState(false);
  const [isClearingAdminGroup, setIsClearingAdminGroup] = useState(false);
  const [isAutoDetectingAdminGroup, setIsAutoDetectingAdminGroup] = useState(false);
  const [adminSetupCommand, setAdminSetupCommand] = useState("");
  const [diagnosticMessage, setDiagnosticMessage] = useState("");

  const resolvedBaseUrl = useMemo(() => {
    const candidate = draft.baseUrl
      || (typeof window !== "undefined" ? window.location.origin : "")
      || process.env.NEXT_PUBLIC_SITE_URL
      || "https://homeland.ductinh.one";
    return normalizeBaseUrl(candidate);
  }, [draft.baseUrl]);

  const webhookUrl = useMemo(
    () => resolvedBaseUrl ? `${resolvedBaseUrl}/api/v1/notifications/zalo/webhook` : "",
    [resolvedBaseUrl],
  );
  const hasAdminGroup = Boolean(String(draft.adminGroupChatId || "").trim());
  const hasRecentWebhookChat = Boolean(draft.webhookChatAvailable);
  const webhookInputValue = draft.lastWebhookPreview?.contentType || (hasRecentWebhookChat ? "application/json" : "N/A");

  const copyText = async (value: string, label: string) => {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    toast.success(`Đã copy ${label}`);
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

  const saveZalo = async () => {
    const payload: Partial<ZaloSettings> = { ...draft };
    if (!canEditSecrets || !secretTouched.botToken) delete payload.botToken;
    delete payload.botTokenConfigured;
    delete payload.webhookSecretConfigured;
    await save(payload as ZaloSettings);
    setSecretTouched({ botToken: false });
  };

  const regenerateWebhookSecret = async () => {
    if (!canEditSecrets) return;
    const webhookSecret = generateSecret();
    const nextValue = { ...draft, webhookSecret };
    setIsGeneratingSecret(true);
    setDraft(nextValue);
    try {
      await save(nextValue);
      toast.success("Đã tạo Secret mới");
    } finally {
      setIsGeneratingSecret(false);
    }
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
      toast.success(`Đã connect: ${result.webhookUrl}`);
    } catch (error: any) {
      toast.error(error?.message || "Không connect được webhook");
    } finally {
      setIsConnectingWebhook(false);
    }
  };

  const testAdminGroup = async () => {
    setIsTestingAdminGroup(true);
    try {
      await settingsApi.testZaloAdminGroup();
      toast.success("Đã gửi tin nhắn test");
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
      toast.success(`Kết nối thành công: ${botName} (${botId})`);
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
      setDraft((prev) => ({
        ...prev,
        adminSetupCodePending: true,
        adminSetupCodeExpiresAt: result?.expiresAt || null,
      }));
      if (command) {
        await navigator.clipboard.writeText(command);
      }
      toast.success("Đã tạo lệnh kết nối");
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
      setDraft((prev) => ({
        ...prev,
        adminGroupChatId: "",
        adminGroupConnectedAt: null,
        adminSetupCodePending: false,
        adminSetupCodeExpiresAt: null,
      }));
      await refreshStatus();
      toast.success("Đã xóa nhóm Admin");
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
      setDraft((prev) => ({
        ...prev,
        adminGroupChatId: result?.chat?.chatId || prev.adminGroupChatId || "",
      }));
      await refreshStatus();
      toast.success("Đã gán chat gần nhất vào nhóm Admin");
    } catch (error: any) {
      const message = resolveZaloErrorMessage(error);
      setDiagnosticMessage(message);
      toast.error(message);
    } finally {
      setIsAutoDetectingAdminGroup(false);
    }
  };

  return (
    <div className="flex flex-col gap-[20px]">
      <Card className="flex h-full flex-col gap-[14px] border-[#8b5cf6]/15 p-[16px]">
        <div className="flex items-start justify-between gap-[16px]">
          <div>
            <div className="flex items-center gap-[8px] text-[12px] font-black uppercase tracking-[0.16em] text-[#8b5cf6]">
              <MessageCircle size={14} /> Zalo Provider
            </div>
            <h3 className="mt-[8px] text-[18px] font-black text-text">Cấu hình gửi Zalo</h3>
          </div>
          <div className="flex items-center gap-[10px] rounded-full border border-border bg-background px-[12px] py-[8px]">
            <Switch checked={draft.enabled} onChange={(event) => setDraft((prev) => ({ ...prev, enabled: event.target.checked }))} aria-label="Bật Zalo" />
          </div>
        </div>

        {diagnosticMessage && (
          <div className="flex items-start gap-[10px] rounded-[12px] border border-amber-500/25 bg-amber-500/10 px-[14px] py-[12px] text-[13px] text-amber-100">
            <AlertCircle size={16} className="mt-[1px] shrink-0 text-amber-300" />
            <span className="leading-[1.5] text-amber-200">{diagnosticMessage}</span>
          </div>
        )}

        <div className="grid grid-cols-1 gap-[14px] lg:grid-cols-2">
          <div className="flex flex-col gap-[6px] lg:col-span-2">
            <label className="text-[12px] font-bold uppercase tracking-wide text-muted">Webhook</label>
            <button
              type="button"
              onClick={() => copyText(webhookUrl, "webhook URL")}
              disabled={!webhookUrl}
              className="flex w-full items-center gap-[10px] rounded-[12px] border border-border bg-background px-[14px] py-[12px] text-left transition-colors hover:border-[#8b5cf6]/35 hover:bg-[#8b5cf6]/5 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Link2 size={14} className="shrink-0 text-muted" />
              <span className="min-w-0 break-all text-[13px] font-bold text-text">{webhookUrl || "-"}</span>
            </button>
          </div>

          <div className="flex flex-col gap-[6px] lg:col-span-2">
            <label className="text-[12px] font-bold uppercase tracking-wide text-muted">Web URL</label>
            <Input
              value={draft.baseUrl}
              onChange={(event) => setDraft((prev) => ({ ...prev, baseUrl: event.target.value }))}
              placeholder="https://homeland.example.com"
              autoComplete="new-password"
              name="zalo_base_url_random"
              data-lpignore="true"
              data-1p-ignore="true"
            />
          </div>

          <div className="flex flex-col gap-[6px]">
            <label className="text-[12px] font-bold uppercase tracking-wide text-muted">Secret</label>
            <div className="flex gap-[8px]">
              <button
                type="button"
                onClick={() => copyText(draft.webhookSecret, "Secret")}
                disabled={!draft.webhookSecret}
                className="flex min-w-0 flex-1 items-center rounded-[12px] border border-border bg-background px-[14px] py-[12px] text-left transition-colors hover:border-[#8b5cf6]/35 hover:bg-[#8b5cf6]/5 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="min-w-0 flex-1 truncate whitespace-nowrap text-[13px] font-bold text-text">
                  {draft.webhookSecret || "-"}
                </span>
              </button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={regenerateWebhookSecret}
                disabled={!canEditSecrets}
                isLoading={isGeneratingSecret}
                title="Random Secret"
                aria-label="Random Secret"
              >
                <RefreshCcw size={14} />
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-[6px]">
            <label className="text-[12px] font-bold uppercase tracking-wide text-muted">Bot Token</label>
            <Input
              type="text"
              value={draft.botToken}
              onChange={(event) => {
                setSecretTouched((prev) => ({ ...prev, botToken: true }));
                setDraft((prev) => ({ ...prev, botToken: event.target.value }));
              }}
              placeholder={canEditSecrets ? "Bot Token" : "Chỉ admin@homeland.vn được chỉnh sửa"}
              disabled={!canEditSecrets}
              data-testid="integration-secret-field"
              autoComplete="new-password"
              name="zalo_bot_token_random"
              data-lpignore="true"
              data-1p-ignore="true"
            />
          </div>

          <div className="flex flex-col gap-[6px] lg:col-span-2">
            <label className="text-[12px] font-bold uppercase tracking-wide text-muted">Admin Group Chat ID</label>
            <Input
              type="text"
              value={draft.adminGroupChatId || ""}
              onChange={(event) => setDraft((prev) => ({ ...prev, adminGroupChatId: event.target.value }))}
              placeholder="Nhập Chat ID hoặc lấy tự động qua Get ChatID bên dưới"
              autoComplete="off"
            />
          </div>

          <div className="grid grid-cols-1 gap-[12px] lg:col-span-2 md:grid-cols-4">
            <Metric label="Webhook" value={draft.lastWebhookStatus || "Chưa kết nối"} detail={formatDateTime(draft.lastWebhookConnectedAt)} />
            <Metric label="Admin Group" value={draft.adminGroupChatId || "-"} detail={draft.adminGroupConnectedAt ? `Connected ${formatDateTime(draft.adminGroupConnectedAt)}` : "Not connected"} mono />
            <Metric label="Lần nhận gần nhất" value={formatDateTime(draft.lastWebhookReceivedAt)} detail={draft.lastWebhookEventName || draft.lastWebhookRejectedReason || "-"} />
            <Metric label="Webhook Chat" value={draft.lastWebhookChatId || "-"} detail={(draft.lastWebhookChatType || "unknown").toUpperCase()} mono />
          </div>

          <div className="rounded-[10px] border border-border bg-background px-[12px] py-[10px] lg:col-span-2">
            <div className="text-[11px] font-bold uppercase tracking-wide text-muted">Connect Admin Group</div>
            <div className="mt-[8px] flex flex-col gap-[8px] md:flex-row md:items-center">
              <button
                type="button"
                onClick={() => copyText(adminSetupCommand, "lệnh kết nối")}
                disabled={!adminSetupCommand}
                className="flex min-w-0 flex-1 items-center rounded-[12px] border border-border bg-background px-[14px] py-[12px] text-left transition-colors hover:border-[#8b5cf6]/35 hover:bg-[#8b5cf6]/5 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="min-w-0 flex-1 truncate whitespace-nowrap text-[13px] font-bold text-text">
                  {adminSetupCommand || "/setadmin CODE"}
                </span>
              </button>
              <Button
                type="button"
                variant="outline"
                onClick={generateAdminGroupSetupCode}
                isLoading={isGeneratingSetupCode}
                className="h-[44px] shrink-0 rounded-[12px] px-[16px] text-[12px] font-bold"
              >
                Generate
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={autoDetectAdminGroup}
                isLoading={isAutoDetectingAdminGroup}
                className="h-[44px] shrink-0 rounded-[12px] px-[16px] text-[12px] font-bold"
              >
                Get ChatID
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={clearAdminGroup}
                isLoading={isClearingAdminGroup}
                className="h-[44px] shrink-0 rounded-[12px] px-[16px] text-[12px] font-bold"
              >
                Clear Messages
              </Button>
            </div>
            <div className="mt-[6px] text-[12px] text-muted">
              {draft.adminSetupCodePending && draft.adminSetupCodeExpiresAt
                ? `Hết hạn ${formatDateTime(draft.adminSetupCodeExpiresAt)}`
                : "Gửi /setadmin CODE trong nhóm"}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-[12px] lg:col-span-2 md:grid-cols-2">
            <Metric label="Webhook Input" value={webhookInputValue} detail={`Raw ${String(draft.lastWebhookPreview?.rawBodyLength ?? 0)}`} />
            <Metric label="Trạng thái" value={formatWebhookReason(draft.lastWebhookRejectedReason)} detail={draft.lastPollingError || draft.lastWebhookEventName || (hasRecentWebhookChat ? "Đã nhận webhook" : "Chưa có webhook chat")} />
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-[10px] border-t border-border/70 pt-[14px]">
          <Button
            type="button"
            variant="outline"
            onClick={testAdminGroup}
            isLoading={isTestingAdminGroup}
            disabled={!hasAdminGroup}
            title={hasAdminGroup ? "Gửi tin nhắn test tới nhóm Admin" : "Chưa có Admin Group Chat ID"}
            className="h-[44px] rounded-[12px] px-[16px] text-[13px] font-bold"
          >
            Test Admin
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={testZaloBot}
            isLoading={isTestingBot}
            disabled={!draft.botToken && !secretTouched.botToken}
            title="Kiểm tra kết nối Bot"
            className="h-[44px] rounded-[12px] px-[16px] text-[13px] font-bold"
          >
            Test Bot
          </Button>
          <Button type="button" variant="outline" onClick={connectWebhook} isLoading={isConnectingWebhook} className="h-[44px] rounded-[12px] px-[16px] text-[13px] font-bold">
            Connect
          </Button>
          <Button type="button" variant="outline" onClick={refreshStatus} isLoading={isRefreshingStatus} className="h-[44px] rounded-[12px] px-[16px] text-[13px] font-bold">
            Refresh
          </Button>
          <Button type="button" onClick={saveZalo} className="h-[44px] rounded-[12px] bg-primary px-[24px] text-[14px] font-bold text-white shadow-sm transition-colors hover:bg-primary/90" isLoading={isSaving}>
            Lưu
          </Button>
        </div>
      </Card>
    </div>
  );
}

function Metric({ label, value, detail, mono = false }: { label: string; value: string; detail?: string; mono?: boolean }) {
  return (
    <div className="rounded-[10px] border border-border bg-background px-[12px] py-[10px]">
      <div className="text-[11px] font-bold uppercase tracking-wide text-muted">{label}</div>
      <div className={`mt-[4px] truncate text-[13px] font-black text-text ${mono ? "font-mono" : ""}`}>{value}</div>
      <div className="mt-[2px] text-[12px] text-muted">{detail || "-"}</div>
    </div>
  );
}
