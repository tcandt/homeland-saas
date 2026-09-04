"use client";

import React, { useState } from "react";
import {
  AlertCircle,
  Bot,
  CheckCircle2,
  Eye,
  EyeOff,
  Info,
  LockKeyhole,
  MessageSquare,
  Send,
  Settings2,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Switch } from "@/components/ui/Switch";
import { useSettingsSection } from "@/lib/hooks/useSettingsSection";
import { useAuthStore } from "@/lib/auth/auth-store";
import { settingsApi } from "@/lib/api/settings.api";
import toast from "react-hot-toast";

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

function shortSecret(value?: string) {
  const normalized = String(value || "").trim();
  if (!normalized) return "Chưa cấu hình";
  if (normalized.length <= 8) return "••••••••";
  return `${normalized.slice(0, 4)}••••${normalized.slice(-4)}`;
}

export default function SettingsTelegramIntegration() {
  const { draft, setDraft, isSaving, save } = useSettingsSection<TelegramSettings>("telegram-provider", "TENANT", fallback);
  const user = useAuthStore((state) => state.user);
  const canEditSecrets = (user?.email || "").toLowerCase() === "admin@homeland.vn" && Boolean(draft.botToken);

  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [configDraft, setConfigDraft] = useState<TelegramSettings>(fallback);
  const [botTokenTouched, setBotTokenTouched] = useState(false);
  const [showBotToken, setShowBotToken] = useState(false);
  const [testRecipient, setTestRecipient] = useState("");
  const [isTesting, setIsTesting] = useState(false);

  const openConfigModal = () => {
    const current = draft || fallback;
    setConfigDraft({
      enabled: Boolean(current.enabled),
      botToken: current.botToken || "",
      defaultChatId: current.defaultChatId || "",
      parseMode: current.parseMode || "",
      disableWebPreview: current.disableWebPreview ?? true,
      note: current.note || "",
    });
    setShowBotToken(false);
    setIsConfigModalOpen(true);
  };

  const closeConfigModal = () => {
    setIsConfigModalOpen(false);
  };

  const saveConfigModal = async () => {
    const isTokenChanged = configDraft.botToken !== (draft.botToken || "");
    const payload: Partial<TelegramSettings> = { ...configDraft };
    if (!canEditSecrets || !isTokenChanged) delete payload.botToken;

    try {
      setDraft(configDraft);
      await save(payload as TelegramSettings);
      setBotTokenTouched(false);
      setIsConfigModalOpen(false);
      toast.success("Đã cập nhật cấu hình Telegram thành công!");
    } catch (error: any) {
      toast.error(error?.message || "Lỗi khi lưu cấu hình Telegram");
    }
  };

  const testTelegram = async () => {
    const recipient = testRecipient.trim() || configDraft.defaultChatId || draft.defaultChatId;
    if (!recipient) {
      toast.error("Vui lòng nhập Chat ID nhận test hoặc cấu hình Default Chat ID");
      return;
    }

    setIsTesting(true);
    try {
      await settingsApi.testTelegram({
        recipient,
        title: "HomeLand - Thử nghiệm Telegram Bot",
        message: `🤖 <b>HomeLand Notification Test</b>\nTin nhắn thử nghiệm gửi từ hệ thống lúc <code>${new Date().toLocaleString("vi-VN")}</code>.\nCấu hình Telegram Bot hoạt động tốt!`,
      });
      toast.success(`Đã gửi tin nhắn test tới Chat ID: ${recipient}`);
    } catch (error: any) {
      toast.error(error?.message || "Không gửi được tin nhắn test. Vui lòng kiểm tra Bot Token và Chat ID.");
    } finally {
      setIsTesting(false);
    }
  };

  const handleToggleEnabled = async (enabled: boolean) => {
    const nextDraft = { ...draft, enabled };
    setDraft(nextDraft);
    try {
      const payload: Partial<TelegramSettings> = { ...nextDraft };
      if (!draft.botToken) delete payload.botToken;
      await save(payload as TelegramSettings);
      toast.success(enabled ? "Đã bật Telegram Bot" : "Đã tắt Telegram Bot");
    } catch (error: any) {
      setDraft(draft);
      toast.error(error?.message || "Lỗi khi lưu trạng thái Telegram");
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
                <Bot size={16} />
              </div>
              <span className="text-xs font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Telegram Bot
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
            <h3 className="text-lg font-black text-text">Cấu hình Telegram</h3>
            <p className="text-xs text-muted">
              Lưu bot token và chat mặc định để gửi cảnh báo tự động tới nhóm vận hành hoặc từng chat cụ thể.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 shadow-sm">
            <Switch
              checked={draft.enabled}
              onChange={(event) => handleToggleEnabled(event.target.checked)}
              aria-label="Bật Telegram"
            />
          </div>
        </div>

        {/* Section: HỢP NHẤT TOÀN BỘ CẤU HÌNH VÀO 1 BOX TINH GỌN */}
        <div className="rounded-xl border border-border bg-background/80 p-3.5 sm:p-4 space-y-3.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted">
              <MessageSquare size={14} className="text-emerald-600" /> Tích hợp Telegram Bot
            </div>
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-1">
            <div className="space-y-1">
              <label className="text-xs font-bold text-text flex items-center justify-between">
                <span>Telegram Bot Token</span>
                <span className="text-[10px] font-normal text-muted">(Chỉ sửa trong cấu hình)</span>
              </label>
              <Input
                type="password"
                value={draft.botToken ? "••••••••••••••••••••••••••••••••" : ""}
                placeholder="Chưa cấu hình Bot Token"
                disabled={true}
                readOnly
                data-testid="integration-secret-field"
                className="h-9 text-xs font-mono bg-muted/20 cursor-not-allowed text-muted select-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-text flex items-center justify-between">
                <span>Chat ID mặc định</span>
                <span className="text-[10px] font-normal text-muted">(Chỉ sửa trong cấu hình)</span>
              </label>
              <Input
                value={draft.defaultChatId || ""}
                placeholder="Chưa cấu hình Chat ID"
                disabled={true}
                readOnly
                className="h-9 text-xs font-mono bg-muted/20 cursor-not-allowed text-muted select-none"
              />
            </div>
          </div>

          {/* Consolidated Summary Grid */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            <div className="rounded-xl border border-border bg-card p-3">
              <div className="text-[10px] uppercase font-bold tracking-wider text-muted">Bot Token</div>
              <div className="mt-1 text-xs font-mono font-bold text-text truncate">
                {draft.botToken ? shortSecret(draft.botToken) : <span className="text-muted font-normal">Chưa cấu hình</span>}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-3 cursor-pointer hover:border-emerald-500/40 transition" onClick={openConfigModal}>
              <div className="text-[10px] uppercase font-bold tracking-wider text-muted">Default Chat ID</div>
              <div className="mt-1 text-xs font-mono font-bold text-text truncate">
                {draft.defaultChatId || <span className="text-muted font-normal">Chưa cấu hình</span>}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-3">
              <div className="text-[10px] uppercase font-bold tracking-wider text-muted">Định dạng (Parse)</div>
              <div className="mt-1 text-xs font-bold text-text truncate">
                {draft.parseMode ? draft.parseMode : "HTML (Mặc định)"}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-3">
              <div className="text-[10px] uppercase font-bold tracking-wider text-muted">Tắt Preview Link</div>
              <div className="mt-1 text-xs font-bold text-text truncate">
                {draft.disableWebPreview ? (
                  <span className="text-emerald-600 dark:text-emerald-400">Đang bật</span>
                ) : (
                  <span className="text-slate-500">Đang tắt</span>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-3 col-span-2 sm:col-span-1">
              <div className="text-[10px] uppercase font-bold tracking-wider text-muted">Ghi chú vận hành</div>
              <div className="mt-1 text-xs font-bold text-text truncate">
                {draft.note || "Thông báo hệ thống"}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Link chỉ dẫn */}
        <div className="mt-auto border-t border-border/60 pt-3 flex items-center justify-between">
          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            <ShieldCheck size={13} /> Telegram Bot API • Hỗ trợ Chat ID nhóm & cá nhân
          </span>
          <span className="text-[11px] text-muted">
            {draft.defaultChatId ? "Đã gán nhóm mặc định" : "Chưa cấu hình nhóm"}
          </span>
        </div>
      </Card>

      {/* POPUP MODAL: THIẾT LẬP TOÀN BỘ CẤU HÌNH TELEGRAM BOT */}
      <Modal
        isOpen={isConfigModalOpen}
        onClose={closeConfigModal}
        title="Thiết lập cấu hình Telegram Bot"
        maxWidth="max-w-[720px]"
        footer={
          <div className="flex flex-wrap items-center justify-between gap-2.5 w-full">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={testTelegram}
                isLoading={isTesting}
                className="h-10 rounded-xl px-3.5 text-xs font-bold"
              >
                <Send size={14} className="mr-1.5 text-emerald-600" /> Gửi thử Telegram
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
          {/* Nhóm 1: Bot Token */}
          <div className="rounded-xl border border-border bg-card p-3.5 space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 uppercase tracking-wider">
              <Bot size={14} /> 1. Telegram Bot Token
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-text">Bot Token (Lấy từ @BotFather)</label>
              <div className="relative">
                <Input
                  type={showBotToken ? "text" : "password"}
                  value={configDraft.botToken}
                  onChange={(event) => {
                    setBotTokenTouched(true);
                    setConfigDraft((prev) => ({ ...prev, botToken: event.target.value }));
                  }}
                  placeholder={canEditSecrets ? "123456789:ABCdefGHIjklMNOpqrSTUvwxYZ" : "Chỉ admin@homeland.vn được sửa"}
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
              <span className="text-[11px] text-muted">Nhắn tin với @BotFather trên Telegram để tạo bot và lấy mã token.</span>
            </div>
          </div>

          {/* Nhóm 2: Chat ID mặc định & Định dạng */}
          <div className="rounded-xl border border-border bg-card p-3.5 space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 uppercase tracking-wider">
              <MessageSquare size={14} /> 2. Nhóm nhận tin & Định dạng tin nhắn
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-bold text-text">Default Chat ID</label>
                <Input
                  value={configDraft.defaultChatId}
                  onChange={(event) => setConfigDraft((prev) => ({ ...prev, defaultChatId: event.target.value }))}
                  placeholder="-100... hoặc Chat ID người nhận"
                  className="h-10 text-xs font-mono"
                />
                <span className="text-[11px] text-muted">Nhóm Supergroup có tiền tố <code>-100...</code>.</span>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-text">Định dạng tin nhắn (Parse Mode)</label>
                <select
                  value={configDraft.parseMode || ""}
                  onChange={(event) =>
                    setConfigDraft((prev) => ({
                      ...prev,
                      parseMode: event.target.value as TelegramSettings["parseMode"],
                    }))
                  }
                  className="h-10 w-full rounded-xl border border-border bg-background px-3 text-xs font-bold text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                >
                  <option value="">HTML (Khuyến nghị)</option>
                  <option value="MarkdownV2">MarkdownV2</option>
                </select>
              </div>
            </div>

            <div className="pt-1">
              <label className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background px-3.5 py-2.5 cursor-pointer hover:border-emerald-500/40 transition">
                <div>
                  <div className="text-xs font-bold text-text">Tắt xem trước liên kết (Disable Web Preview)</div>
                  <div className="text-[11px] text-muted">Không hiển thị khung xem trước URL trong nội dung tin nhắn.</div>
                </div>
                <Switch
                  checked={configDraft.disableWebPreview}
                  onChange={(event) =>
                    setConfigDraft((prev) => ({ ...prev, disableWebPreview: event.target.checked }))
                  }
                />
              </label>
            </div>
          </div>

          {/* Nhóm 3: Ghi chú & Thử nghiệm */}
          <div className="rounded-xl border border-border bg-card p-3.5 space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 uppercase tracking-wider">
              <Send size={14} /> 3. Ghi chú & Thử nghiệm gửi tin
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-text">Ghi chú vận hành</label>
              <Input
                value={configDraft.note}
                onChange={(event) => setConfigDraft((prev) => ({ ...prev, note: event.target.value }))}
                placeholder="Ví dụ: Nhóm Ban Quản Lý & Vận Hành"
                className="h-10 text-xs font-bold"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-text">Chat ID nhận thử nghiệm (Test Chat ID)</label>
              <Input
                value={testRecipient}
                onChange={(event) => setTestRecipient(event.target.value)}
                placeholder="Để trống sẽ gửi tới Default Chat ID"
                className="h-10 text-xs font-mono"
              />
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
