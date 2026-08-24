"use client";

import React, { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Switch } from "@/components/ui/Switch";
import { useSettingsSection } from "@/lib/hooks/useSettingsSection";
import { Link2, MessageCircle, RefreshCcw } from "lucide-react";
import toast from "react-hot-toast";
import { useAuthStore } from "@/lib/auth/auth-store";
import { settingsApi } from "@/lib/api/settings.api";

type ZaloSettings = {
  enabled: boolean;
  baseUrl: string;
  botToken: string;
  webhookSecret: string;
  defaultChatId?: string;
  recentWebhookChats?: Array<{
    chatId: string;
    userId?: string | null;
    displayName?: string | null;
    eventName?: string | null;
    lastSeenAt?: string;
  }>;
  botTokenConfigured?: boolean;
  webhookSecretConfigured?: boolean;
};

const fallback: ZaloSettings = {
  enabled: false,
  baseUrl: "",
  botToken: "",
  webhookSecret: "",
  recentWebhookChats: [],
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

export default function SettingsZaloIntegration() {
  const { draft, setDraft, isSaving, save } = useSettingsSection<ZaloSettings>("zalo-provider", "TENANT", fallback);
  const user = useAuthStore((state) => state.user);
  const [secretTouched, setSecretTouched] = useState({ botToken: false });
  const [testRecipient, setTestRecipient] = useState("");
  const [isTesting, setIsTesting] = useState(false);
  const [isGeneratingSecret, setIsGeneratingSecret] = useState(false);
  const canEditSecrets = (user?.email || "").toLowerCase() === "admin@homeland.vn";
  const recentWebhookChats = Array.isArray(draft.recentWebhookChats) ? draft.recentWebhookChats : [];
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

  const saveZalo = async () => {
    const payload: Partial<ZaloSettings> = { ...draft };
    if (!canEditSecrets || !secretTouched.botToken) delete payload.botToken;
    delete payload.botTokenConfigured;
    delete payload.webhookSecretConfigured;
    await save(payload as ZaloSettings);
    setSecretTouched({ botToken: false });
  };

  const testZalo = async () => {
    const recipient = testRecipient.trim();
    if (!recipient) {
      toast.error("Nhập chat_id để gửi thử");
      return;
    }

    setIsTesting(true);
    try {
      await settingsApi.testZalo({
        recipient,
        title: "Zalo test",
        message: `HomeLand test message at ${new Date().toLocaleString("vi-VN")}`,
      });
      toast.success("Đã gửi tin nhắn test Zalo");
    } catch (error: any) {
      toast.error(error?.message || "Không gửi được tin nhắn test Zalo");
    } finally {
      setIsTesting(false);
    }
  };

  const copyText = async (value: string, label: string) => {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    toast.success(`Đã copy ${label}`);
  };

  const regenerateWebhookSecret = async () => {
    if (!canEditSecrets) return;
    const webhookSecret = generateSecret();
    const nextValue = { ...draft, webhookSecret };
    setIsGeneratingSecret(true);
    setDraft(nextValue);
    try {
      await save(nextValue);
      toast.success("Đã tạo và lưu Secret Token mới");
    } finally {
      setIsGeneratingSecret(false);
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

        <div className="rounded-[12px] border border-sky-200 bg-sky-50 px-[12px] py-[10px] text-[12px] font-semibold text-sky-900">
          Tích hợp này đã chuyển sang mô hình Zalo Bot: dùng `Bot Token` để gửi tin và `Secret Token` để xác thực webhook từ Zalo Bot.
        </div>

        <div className="grid grid-cols-1 gap-[14px] lg:grid-cols-2">
          <div className="flex flex-col gap-[6px] lg:col-span-2">
            <label className="text-[12px] font-bold uppercase tracking-wide text-muted">Webhook URL</label>
            <button
              type="button"
              onClick={() => copyText(webhookUrl, "webhook URL")}
              disabled={!webhookUrl}
              className="flex w-full items-center gap-[10px] rounded-[12px] border border-border bg-background px-[14px] py-[12px] text-left transition-colors hover:border-[#8b5cf6]/35 hover:bg-[#8b5cf6]/5 disabled:cursor-not-allowed disabled:opacity-60"
              title={webhookUrl ? "Nhấp để sao chép webhook URL" : "Nhập domain base URL để tạo webhook"}
            >
              <Link2 size={14} className="shrink-0 text-muted" />
              <span className="min-w-0 break-all text-[13px] font-bold text-text">{webhookUrl || "Nhập domain base URL để sinh webhook URL"}</span>
            </button>
          </div>

          <div className="flex flex-col gap-[6px] lg:col-span-2">
            <label className="text-[12px] font-bold uppercase tracking-wide text-muted">Domain base URL</label>
            <Input
              value={draft.baseUrl}
              onChange={(event) => setDraft((prev) => ({ ...prev, baseUrl: event.target.value }))}
              placeholder="https://homeland.ductinh.one"
            />
          </div>

          <div className="flex flex-col gap-[6px]">
            <label className="text-[12px] font-bold uppercase tracking-wide text-muted">Secret Token</label>
            <div className="flex gap-[8px]">
              <button
                type="button"
                onClick={() => copyText(draft.webhookSecret, "Secret Token")}
                disabled={!draft.webhookSecret}
                className="flex min-w-0 flex-1 items-center rounded-[12px] border border-border bg-background px-[14px] py-[12px] text-left transition-colors hover:border-[#8b5cf6]/35 hover:bg-[#8b5cf6]/5 disabled:cursor-not-allowed disabled:opacity-60"
                title={draft.webhookSecret ? "Nhấp để sao chép Secret Token" : "Bấm Random để tạo Secret Token"}
              >
                <span className="min-w-0 flex-1 truncate whitespace-nowrap text-[13px] font-bold text-text">
                  {draft.webhookSecret || "Bấm Random để tạo Secret Token"}
                </span>
              </button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={regenerateWebhookSecret}
                disabled={!canEditSecrets}
                isLoading={isGeneratingSecret}
                title="Random và lưu Secret Token"
                aria-label="Random và lưu Secret Token"
              >
                <RefreshCcw size={14} />
              </Button>
            </div>
            <div className="text-[12px] text-muted">
              Secret Token được hiển thị để copy sang Zalo Bot. Không chỉnh tay trong UI; bấm Random sẽ tạo và lưu ngay giá trị mới.
            </div>
          </div>

          <div className="flex flex-col gap-[6px]">
            <label className="text-[12px] font-bold uppercase tracking-wide text-muted">Bot Token</label>
            <Input
              type="password"
              value={draft.botToken}
              onChange={(event) => {
                setSecretTouched((prev) => ({ ...prev, botToken: true }));
                setDraft((prev) => ({ ...prev, botToken: event.target.value }));
              }}
              placeholder={canEditSecrets ? "Dán Bot Token do Zalo Bot cấp" : "Chỉ admin@homeland.vn được chỉnh sửa"}
              disabled={!canEditSecrets}
              data-testid="integration-secret-field"
            />
          </div>

          <div className="flex flex-col gap-[6px] lg:col-span-2">
            <div className="text-[12px] text-muted">
              API gửi tin sẽ dùng mặc định từ Bot Token theo mẫu <span className="font-semibold text-text">https://bot-api.zaloplatforms.com/botBOT_TOKEN/sendMessage</span>.
            </div>
          </div>

          <div className="flex flex-col gap-[6px]">
            <label className="text-[12px] font-bold uppercase tracking-wide text-muted">Chat ID để gửi thử</label>
            <Input
              value={testRecipient}
              onChange={(event) => setTestRecipient(event.target.value)}
              placeholder="Nhập chat_id nhận tin nhắn test"
            />
            <div className="text-[12px] text-muted">
              Bot Platform không gửi trực tiếp theo số điện thoại. Cần nhập <span className="font-semibold text-text">chat_id</span> hoặc định danh hội thoại thực tế của bot.
            </div>
          </div>

          {recentWebhookChats.length > 0 && (
            <div className="flex flex-col gap-[8px] lg:col-span-2">
              <label className="text-[12px] font-bold uppercase tracking-wide text-muted">Chat ID nhận từ webhook gần đây</label>
              <div className="grid grid-cols-1 gap-[8px] md:grid-cols-2">
                {recentWebhookChats.slice(0, 6).map((chat) => (
                  <button
                    key={`${chat.chatId}-${chat.lastSeenAt || ""}`}
                    type="button"
                    onClick={() => {
                      setTestRecipient(chat.chatId);
                      copyText(chat.chatId, "chat_id");
                    }}
                    className="flex min-w-0 items-center justify-between gap-[10px] rounded-[10px] border border-border bg-background px-[12px] py-[10px] text-left transition-colors hover:border-[#8b5cf6]/35 hover:bg-[#8b5cf6]/5"
                    title="Nhấp để dùng chat_id này và sao chép"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-black text-text">{chat.displayName || chat.eventName || "Zalo chat"}</span>
                      <span className="block truncate font-mono text-[12px] text-muted">{chat.chatId}</span>
                    </span>
                    <span className="shrink-0 text-[11px] font-bold text-muted">Dùng</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-[10px] border-t border-border/70 pt-[14px]">
          <Button type="button" variant="outline" onClick={testZalo} isLoading={isTesting} className="h-[44px] rounded-[12px] px-[20px] text-[14px] font-bold">
            Gửi thử Zalo
          </Button>
          <Button type="button" onClick={saveZalo} className="h-[44px] rounded-[12px] bg-primary px-[24px] text-[14px] font-bold text-white shadow-sm transition-colors hover:bg-primary/90" isLoading={isSaving}>
            Lưu Zalo
          </Button>
        </div>
      </Card>
    </div>
  );
}
