"use client";

import React, { useState } from "react";
import { Bot, LockKeyhole, Send, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Switch } from "@/components/ui/Switch";
import { useSettingsSection } from "@/lib/hooks/useSettingsSection";
import { useAuthStore } from "@/lib/auth/auth-store";

type TelegramSettings = {
  enabled: boolean;
  botToken: string;
  defaultChatId: string;
  parseMode: "" | "HTML" | "MarkdownV2";
  disableWebPreview: boolean;
  note: string;
};

const fallback: TelegramSettings = {
  enabled: false,
  botToken: "",
  defaultChatId: "",
  parseMode: "",
  disableWebPreview: true,
  note: "",
};

export default function SettingsTelegramIntegration() {
  const { draft, setDraft, isSaving, save } = useSettingsSection<TelegramSettings>("telegram-provider", "TENANT", fallback);
  const user = useAuthStore((state) => state.user);
  const [botTokenTouched, setBotTokenTouched] = useState(false);
  const canEditSecrets = (user?.email || "").toLowerCase() === "admin@homeland.vn";

  const saveTelegram = async () => {
    const payload: Partial<TelegramSettings> = { ...draft };
    if (!canEditSecrets || !botTokenTouched) delete payload.botToken;
    await save(payload as TelegramSettings);
    setBotTokenTouched(false);
  };

  return (
    <Card className="p-[20px] flex flex-col gap-[18px] border-[#22c55e]/15">
      <div className="flex items-start justify-between gap-[16px]">
        <div>
          <div className="flex items-center gap-[8px] text-[#22c55e] text-[12px] font-black uppercase tracking-[0.16em]">
            <Bot size={14} /> Telegram Bot
          </div>
          <h3 className="mt-[8px] text-[18px] font-black text-text">Cấu hình Telegram</h3>
          <p className="mt-[6px] text-[13px] text-muted max-w-[720px]">
            Lưu bot token và chat mặc định để gửi cảnh báo tự động tới nhóm vận hành hoặc từng chat cụ thể.
          </p>
        </div>
        <div className="flex items-center gap-[10px] rounded-full border border-border px-[12px] py-[8px] bg-background">
          <span className="text-[12px] font-bold text-muted">Bật Telegram</span>
          <Switch checked={draft.enabled} onChange={(event) => setDraft((prev) => ({ ...prev, enabled: event.target.checked }))} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-[16px]">
        <div className="flex flex-col gap-[6px]">
          <label className="text-[12px] font-bold uppercase tracking-wide text-muted">Bot token</label>
          <Input
            type="password"
            value={draft.botToken}
            onChange={(event) => {
              setBotTokenTouched(true);
              setDraft((prev) => ({ ...prev, botToken: event.target.value }));
            }}
            placeholder={canEditSecrets ? "Để trống để giữ nguyên bot token" : "Chỉ admin@homeland.vn được chỉnh sửa"}
            disabled={!canEditSecrets}
            data-testid="integration-secret-field"
          />
        </div>
        <div className="flex flex-col gap-[6px]">
          <label className="text-[12px] font-bold uppercase tracking-wide text-muted">Default chat ID</label>
          <Input value={draft.defaultChatId} onChange={(event) => setDraft((prev) => ({ ...prev, defaultChatId: event.target.value }))} placeholder="-100..." />
        </div>
        <div className="flex flex-col gap-[6px]">
          <label className="text-[12px] font-bold uppercase tracking-wide text-muted">Parse mode</label>
          <Input value={draft.parseMode} onChange={(event) => setDraft((prev) => ({ ...prev, parseMode: event.target.value as TelegramSettings["parseMode"] }))} placeholder="HTML hoặc MarkdownV2" />
        </div>
        <div className="flex items-center gap-[10px] h-[40px] rounded-xl border border-border px-[12px] self-end">
          <Send size={14} className="text-[#22c55e]" />
          <span className="text-[12px] font-bold text-muted flex-1">Tắt preview link</span>
          <Switch checked={draft.disableWebPreview} onChange={(event) => setDraft((prev) => ({ ...prev, disableWebPreview: event.target.checked }))} />
        </div>
        <div className="flex flex-col gap-[6px] lg:col-span-2">
          <label className="text-[12px] font-bold uppercase tracking-wide text-muted">Ghi chú vận hành</label>
          <Input value={draft.note} onChange={(event) => setDraft((prev) => ({ ...prev, note: event.target.value }))} />
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-background p-[16px] flex items-start gap-[12px]">
        <ShieldCheck size={18} className="text-[#22c55e] mt-[2px]" />
        <div>
          <div className="font-black text-text">Recipient linh hoạt</div>
          <div className="text-[13px] text-muted mt-[4px]">
            Nếu notification có recipient hoặc telegramChatId trong payload thì hệ thống dùng giá trị đó; nếu không sẽ dùng default chat ID.
          </div>
        </div>
      </div>

      {!canEditSecrets && (
        <div className="flex items-start gap-[9px] rounded-[8px] border border-warning/30 bg-warning/5 px-[14px] py-[11px] text-[12px] font-medium leading-[18px] text-muted">
          <LockKeyhole size={15} className="mt-[1px] shrink-0 text-warning" aria-hidden="true" />
          Bot token chỉ được chỉnh sửa bởi admin@homeland.vn.
        </div>
      )}

      <div className="flex justify-end">
        <Button type="button" onClick={saveTelegram} className="h-[44px] px-[24px] rounded-[12px] bg-primary text-white font-bold text-[14px] hover:bg-primary/90 transition-colors shadow-sm" isLoading={isSaving}>
          Lưu Telegram
        </Button>
      </div>
    </Card>
  );
}
