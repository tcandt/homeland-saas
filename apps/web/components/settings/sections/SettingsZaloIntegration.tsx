"use client";

import React, { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Switch } from "@/components/ui/Switch";
import { useSettingsSection } from "@/lib/hooks/useSettingsSection";
import { Globe2, MessageCircle, RefreshCcw } from "lucide-react";
import toast from "react-hot-toast";
import { useAuthStore } from "@/lib/auth/auth-store";

type ZaloSettings = {
  enabled: boolean;
  baseUrl: string;
  officialAccountId: string;
  accessToken: string;
  appSecret: string;
  webhookSecret: string;
  messageEndpoint: string;
  senderName: string;
  accessTokenConfigured?: boolean;
  appSecretConfigured?: boolean;
  webhookSecretConfigured?: boolean;
};

const fallback: ZaloSettings = {
  enabled: false,
  baseUrl: "",
  officialAccountId: "",
  accessToken: "",
  appSecret: "",
  webhookSecret: "",
  messageEndpoint: "",
  senderName: "",
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

function maskSecret(value: string) {
  if (!value) return "";
  if (value.length <= 10) return value;
  return `${value.slice(0, 10)}${"•".repeat(Math.max(8, value.length - 10))}`;
}

export default function SettingsZaloIntegration() {
  const { draft, setDraft, isSaving, save } = useSettingsSection<ZaloSettings>("zalo-provider", "TENANT", fallback);
  const user = useAuthStore((state) => state.user);
  const [secretTouched, setSecretTouched] = useState({ accessToken: false, appSecret: false, webhookSecret: false });
  const canEditSecrets = (user?.email || "").toLowerCase() === "admin@homeland.vn";

  const baseUrl = useMemo(() => normalizeBaseUrl(draft.baseUrl || process.env.NEXT_PUBLIC_SITE_URL || "https://homeland.ductinh.one"), [draft.baseUrl]);
  const webhookUrl = useMemo(() => {
    if (!baseUrl) return "";
    return `${baseUrl}/api/v1/notifications/zalo/webhook`;
  }, [baseUrl]);
  const copyText = async (value: string, label: string) => {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    toast.success(label === "webhook" ? "Đã sao chép webhook" : `Đã copy ${label}`);
  };

  const saveZalo = async () => {
    const payload: Partial<ZaloSettings> = { ...draft };
    if (!canEditSecrets || !secretTouched.accessToken) delete payload.accessToken;
    if (!canEditSecrets || !secretTouched.appSecret) delete payload.appSecret;
    if (!canEditSecrets || !secretTouched.webhookSecret) delete payload.webhookSecret;
    delete payload.accessTokenConfigured;
    delete payload.appSecretConfigured;
    delete payload.webhookSecretConfigured;
    await save(payload as ZaloSettings);
    setSecretTouched({ accessToken: false, appSecret: false, webhookSecret: false });
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

        <div className="flex flex-col gap-[8px]">
          <div className="text-[12px] font-bold uppercase tracking-wide text-muted">Webhook URL</div>
          <button
            type="button"
            onClick={() => copyText(webhookUrl, "webhook")}
            disabled={!webhookUrl}
            className="flex w-full items-center rounded-[12px] border border-border bg-background px-[14px] py-[12px] text-left transition-colors hover:border-[#8b5cf6]/35 hover:bg-[#8b5cf6]/5 disabled:cursor-not-allowed disabled:opacity-60"
            title={webhookUrl ? "Nhấp để sao chép webhook" : "Nhập domain base URL để tạo webhook"}
            aria-label="Sao chép webhook"
          >
            <div className="min-w-0 flex-1">
              <div className="break-all text-[13px] font-bold text-text">{webhookUrl || "Nhập domain base URL để sinh webhook"}</div>
            </div>
          </button>
        </div>

        <div className="grid grid-cols-1 gap-[14px] lg:grid-cols-3">
          <div className="flex flex-col gap-[6px] lg:col-span-3">
            <label className="text-[12px] font-bold uppercase tracking-wide text-muted">Domain base URL</label>
            <div className="relative">
              <Globe2 size={14} className="pointer-events-none absolute left-[12px] top-1/2 -translate-y-1/2 text-muted" />
              <Input
                value={draft.baseUrl}
                onChange={(event) => setDraft((prev) => ({ ...prev, baseUrl: event.target.value }))}
                placeholder="https://homeland.ductinh.one"
                className="pl-[36px]"
              />
            </div>
          </div>

          <div className="flex flex-col gap-[6px]">
            <label className="text-[12px] font-bold uppercase tracking-wide text-muted">Official Account ID</label>
            <Input value={draft.officialAccountId} onChange={(event) => setDraft((prev) => ({ ...prev, officialAccountId: event.target.value }))} placeholder="OA ID" />
          </div>

          <div className="flex flex-col gap-[6px]">
            <label className="text-[12px] font-bold uppercase tracking-wide text-muted">Sender name</label>
            <Input value={draft.senderName} onChange={(event) => setDraft((prev) => ({ ...prev, senderName: event.target.value }))} placeholder="HomeLand" />
          </div>

          <div className="flex flex-col gap-[6px]">
            <label className="text-[12px] font-bold uppercase tracking-wide text-muted">Access token</label>
            <Input
              type="password"
              value={draft.accessToken}
              onChange={(event) => {
                setSecretTouched((prev) => ({ ...prev, accessToken: true }));
                setDraft((prev) => ({ ...prev, accessToken: event.target.value }));
              }}
              placeholder={canEditSecrets ? "Để trống để giữ nguyên access token" : "Chỉ admin@homeland.vn được chỉnh sửa"}
              disabled={!canEditSecrets}
              data-testid="integration-secret-field"
            />
          </div>

          <div className="flex flex-col gap-[6px]">
            <label className="text-[12px] font-bold uppercase tracking-wide text-muted">App secret</label>
            <div className="flex gap-[8px]">
              <button
                type="button"
                onClick={() => copyText(draft.appSecret, "app secret")}
                disabled={!draft.appSecret}
                className="flex min-w-0 flex-1 items-center rounded-[12px] border border-border bg-background px-[14px] py-[12px] text-left transition-colors hover:border-[#8b5cf6]/35 hover:bg-[#8b5cf6]/5 disabled:cursor-not-allowed disabled:opacity-60"
                title={draft.appSecret ? "Nhấp để sao chép app secret" : "Bấm Sinh secret để tạo app secret"}
                aria-label="Sao chép app secret"
              >
                <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-text">{draft.appSecret ? maskSecret(draft.appSecret) : "Bấm Sinh secret để tạo app secret"}</span>
              </button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => {
                  if (!canEditSecrets) return;
                  const secret = generateSecret();
                  setSecretTouched((prev) => ({ ...prev, appSecret: true }));
                  setDraft((prev) => ({ ...prev, appSecret: secret }));
                }}
                disabled={!canEditSecrets}
                title="Sinh app secret mới"
                aria-label="Sinh app secret mới"
                >
                  <RefreshCcw size={14} />
                </Button>
            </div>
          </div>

          <div className="flex flex-col gap-[6px]">
            <label className="text-[12px] font-bold uppercase tracking-wide text-muted">Webhook secret key</label>
            <div className="flex gap-[8px]">
              <button
                type="button"
                onClick={() => copyText(draft.webhookSecret, "webhook secret")}
                disabled={!draft.webhookSecret}
                className="flex min-w-0 flex-1 items-center rounded-[12px] border border-border bg-background px-[14px] py-[12px] text-left transition-colors hover:border-[#8b5cf6]/35 hover:bg-[#8b5cf6]/5 disabled:cursor-not-allowed disabled:opacity-60"
                title={draft.webhookSecret ? "Nhấp để sao chép webhook secret" : "Sinh secret cho webhook"}
                aria-label="Sao chép webhook secret"
              >
                <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-text">{draft.webhookSecret ? maskSecret(draft.webhookSecret) : "Sinh secret cho webhook"}</span>
              </button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => {
                  if (!canEditSecrets) return;
                  const secret = generateSecret();
                  setSecretTouched((prev) => ({ ...prev, webhookSecret: true }));
                  setDraft((prev) => ({ ...prev, webhookSecret: secret }));
                }}
                disabled={!canEditSecrets}
                title="Sinh secret mới"
                aria-label="Sinh secret mới"
              >
                <RefreshCcw size={14} />
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-[6px]">
            <label className="text-[12px] font-bold uppercase tracking-wide text-muted">Message API endpoint</label>
            <Input
              value={draft.messageEndpoint}
              onChange={(event) => setDraft((prev) => ({ ...prev, messageEndpoint: event.target.value }))}
              placeholder="https://openapi.zalo.me/v3.0/oa/message/cs"
            />
          </div>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button type="button" onClick={saveZalo} className="h-[44px] rounded-[12px] bg-primary px-[24px] text-[14px] font-bold text-white shadow-sm transition-colors hover:bg-primary/90" isLoading={isSaving}>
          Lưu Zalo
        </Button>
      </div>
    </div>
  );
}
