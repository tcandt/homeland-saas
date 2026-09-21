"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Bell,
  Check,
  CheckCircle2,
  Mail,
  MessageSquare,
  Radio,
  Save,
  Send,
  ShieldAlert,
  Smartphone,
  Sparkles,
  Zap,
  Play,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useSettingsSection } from "@/lib/hooks/useSettingsSection";
import toast from "react-hot-toast";
import {
  getSpeechVoices,
  playNotificationSound,
  speakText,
  unlockNotificationAudio,
  type NotificationSoundId,
} from "@/lib/notification-sounds";

const channels = [
  { id: "app", label: "App / Web", icon: <Bell size={12} /> },
  { id: "email", label: "Email", icon: <Mail size={12} /> },
  { id: "sms", label: "SMS", icon: <Smartphone size={12} /> },
  { id: "zalo", label: "Zalo ZNS", icon: <MessageSquare size={12} /> },
  { id: "telegram", label: "Telegram", icon: <Send size={12} /> },
] as const;

interface NotificationMatrixRow {
  event: string;
  category: "BILLING" | "CONTRACT" | "SYSTEM" | "IOT";
  desc: string;
  app: boolean;
  email: boolean;
  sms: boolean;
  zalo: boolean;
  telegram: boolean;
}

type ReminderDays = {
  invoiceDueSoonDays: number;
  invoiceOverdueDays: number;
  contractExpiringDays: number;
};

type AudioSettings = {
  enabled: boolean;
  speakPaymentAmount: boolean;
  voiceName: string;
  speechRate: number;
  speechPitch: number;
  volume: number;
  paymentSound: NotificationSoundId;
  reminderSound: NotificationSoundId;
  overdueSound: NotificationSoundId;
  systemSound: NotificationSoundId;
};

const defaultEvents: NotificationMatrixRow[] = [
  { event: "Phát hành hóa đơn tiền phòng", category: "BILLING", desc: "Gửi thông báo khi hóa đơn dịch vụ tháng được chốt", app: true, email: true, sms: false, zalo: true, telegram: false },
  { event: "Nhắc thanh toán đến hạn", category: "BILLING", desc: "Tự động nhắc khách thuê trước hạn 3 ngày & đúng ngày", app: true, email: true, sms: true, zalo: true, telegram: true },
  { event: "Xác nhận đã thu tiền thành công", category: "BILLING", desc: "Biên nhận sau khi đối soát SePay / gạch nợ", app: true, email: true, sms: false, zalo: true, telegram: false },
  { event: "Hợp đồng sắp hết hạn (30 ngày)", category: "CONTRACT", desc: "Báo động để nhân viên và khách chủ động gia hạn", app: true, email: true, sms: false, zalo: true, telegram: true },
  { event: "Tiền cọc sắp đến hạn hoàn trả", category: "CONTRACT", desc: "Nhắc quản lý quyết toán khi khách trả phòng", app: true, email: true, sms: false, zalo: false, telegram: true },
  { event: "Cảnh báo vượt mức điện / IoT", category: "IOT", desc: "Cảnh báo khi chỉ số điện tăng đột biến hoặc mất kết nối", app: true, email: false, sms: false, zalo: false, telegram: true },
];

type NotificationAutomationSettings = {
  notifications: NotificationMatrixRow[];
  reminderDays: ReminderDays;
  audioSettings: AudioSettings;
};

const FALLBACK_SETTINGS: NotificationAutomationSettings = {
  notifications: defaultEvents,
  reminderDays: {
    invoiceDueSoonDays: 3,
    invoiceOverdueDays: 7,
    contractExpiringDays: 30,
  },
  audioSettings: {
    enabled: true,
    speakPaymentAmount: true,
    voiceName: "",
    speechRate: 0.95,
    speechPitch: 1,
    volume: 0.75,
    paymentSound: "coins",
    reminderSound: "soft",
    overdueSound: "alert",
    systemSound: "pop",
  },
};

const soundOptions: Array<{ id: NotificationSoundId; label: string; hint: string }> = [
  { id: "coins", label: "Ting ting", hint: "Vui, rõ và phù hợp khi nhận tiền" },
  { id: "soft", label: "Êm dịu", hint: "Nhẹ nhàng cho lịch nhắc và hợp đồng" },
  { id: "alert", label: "Cảnh báo", hint: "Âm trầm hơn cho công nợ hoặc lỗi" },
  { id: "pop", label: "Tách nhẹ", hint: "Ngắn gọn cho thông báo hệ thống" },
  { id: "none", label: "Im lặng", hint: "Không phát âm thanh" },
];

export default function SettingsNotificationAutomation() {
  const { draft, setDraft, isSaving, save } = useSettingsSection<NotificationAutomationSettings>(
    "notifications",
    "TENANT",
    FALLBACK_SETTINGS
  );

  const rows = useMemo(() => {
    return draft.notifications?.length > 0 ? draft.notifications : defaultEvents;
  }, [draft.notifications]);
  const reminderDays = draft.reminderDays || FALLBACK_SETTINGS.reminderDays;
  const audioSettings = {
    ...FALLBACK_SETTINGS.audioSettings,
    ...(draft.audioSettings || {}),
  };
  const [speechVoices, setSpeechVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    const refreshVoices = () => setSpeechVoices(getSpeechVoices());
    refreshVoices();
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.addEventListener("voiceschanged", refreshVoices);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", refreshVoices);
  }, []);

  const activeChannelCount = channels.length;
  const activeEventCount = rows.length;

  const handleToggle = (index: number, channel: typeof channels[number]["id"]) => {
    const updated = [...rows];
    updated[index] = {
      ...updated[index],
      [channel]: !updated[index][channel],
    };
    setDraft({ ...draft, notifications: updated });
  };

  const handleReminderDayChange = (field: keyof ReminderDays, value: string) => {
    const numeric = Math.max(0, Math.trunc(Number(value) || 0));
    setDraft({
      ...draft,
      reminderDays: {
        ...reminderDays,
        [field]: numeric,
      },
      audioSettings,
    });
  };

  const handleAudioChange = <K extends keyof AudioSettings>(field: K, value: AudioSettings[K]) => {
    setDraft({
      ...draft,
      audioSettings: {
        ...audioSettings,
        [field]: value,
      },
    });
  };

  const previewSound = async (soundId: NotificationSoundId) => {
    const unlocked = await unlockNotificationAudio();
    if (!unlocked) {
      toast.error("Trình duyệt đang chặn âm thanh. Hãy bấm lại để cấp quyền phát âm thanh.");
      return;
    }
    await playNotificationSound(soundId, audioSettings.volume);
  };

  const previewVoice = async () => {
    const unlocked = await unlockNotificationAudio();
    if (!unlocked) {
      toast.error("Trình duyệt đang chặn âm thanh. Hãy bấm lại để cấp quyền phát âm thanh.");
      return;
    }
    speakText("Đã nhận được một triệu đồng", {
      voiceName: audioSettings.voiceName,
      volume: audioSettings.volume,
      rate: audioSettings.speechRate,
      pitch: audioSettings.speechPitch,
    });
  };

  const handleSaveAll = async () => {
    try {
      await save({ notifications: rows, reminderDays, audioSettings });
    } catch {
      toast.error("Không thể lưu cấu hình thông báo");
    }
  };

  return (
    <div className="flex flex-col gap-3" data-testid="settings-notification-root">
      {/* 4 Slim KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <Card className="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-3 shadow-2xs">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 shrink-0">
            <Radio size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-bold text-muted uppercase tracking-wider truncate">Kênh truyền dẫn</div>
            <div className="font-mono font-black text-[15px] text-text leading-tight">{activeChannelCount} Kênh kết nối</div>
            <div className="text-[10px] text-muted truncate mt-0.5">App, Email, SMS, Zalo, Telegram</div>
          </div>
        </Card>

        <Card className="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-3 shadow-2xs">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400 shrink-0">
            <Zap size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-bold text-muted uppercase tracking-wider truncate">Sự kiện kích hoạt</div>
            <div className="font-mono font-black text-[15px] text-text leading-tight">{activeEventCount} Luồng tự động</div>
            <div className="text-[10px] text-muted truncate mt-0.5">Hóa đơn, Cọc, Hợp đồng & IoT</div>
          </div>
        </Card>

        <Card className="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-3 shadow-2xs">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 shrink-0">
            <CheckCircle2 size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-bold text-muted uppercase tracking-wider truncate">Tỷ lệ phát tin</div>
            <div className="font-mono font-black text-[15px] text-emerald-600 leading-tight">99.8% thành công</div>
            <div className="text-[10px] text-muted truncate mt-0.5">Thời gian thực qua webhook</div>
          </div>
        </Card>

        <Card className="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-3 shadow-2xs">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0">
            <Sparkles size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-bold text-muted uppercase tracking-wider truncate">Chế độ nhắc nợ</div>
            <div className="font-mono font-black text-[15px] text-amber-600 leading-tight">Tự động 24/7</div>
            <div className="text-[10px] text-muted truncate mt-0.5">Cronjob chạy lúc 08:00 hàng ngày</div>
          </div>
        </Card>
      </div>

      {/* Header & Save Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-border/70 bg-card p-4 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0">
            <Bell size={18} />
          </div>
          <div>
            <h2 className="text-sm md:text-base font-black text-text tracking-tight">
              Ma trận tự động hóa & Phân luồng thông báo (Notification Automation)
            </h2>
            <p className="text-xs text-muted font-medium mt-0.5">
              Cấu hình các kênh tiếp cận khách thuê và ban quản trị khi phát sinh sự kiện vận hành.
            </p>
          </div>
        </div>

        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={handleSaveAll}
          isLoading={isSaving}
          className="h-8.5 gap-1.5 rounded-xl px-4 text-xs font-bold shadow-2xs shrink-0"
        >
          <Save size={13} />
          <span>Lưu cấu hình thông báo</span>
        </Button>
      </div>

      <Card className="rounded-xl border border-border/70 bg-card p-4 shadow-2xs">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-amber-500/20 bg-amber-500/10 text-amber-600">
            <ShieldAlert size={15} />
          </div>
          <div>
            <h3 className="text-sm font-black text-text">Số ngày nhắc tự động</h3>
            <p className="text-xs font-medium text-muted">Áp dụng cho cron thông báo hằng ngày theo từng tenant.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted">Hóa đơn sắp đến hạn</span>
            <div className="flex h-10 items-center rounded-xl border border-border bg-background px-3">
              <input
                type="number"
                min={0}
                max={60}
                value={reminderDays.invoiceDueSoonDays}
                onChange={(event) => handleReminderDayChange("invoiceDueSoonDays", event.target.value)}
                className="min-w-0 flex-1 bg-transparent text-sm font-bold text-text outline-none"
                data-testid="settings-notification-invoice-due-days"
              />
              <span className="text-xs font-semibold text-muted">ngày trước hạn</span>
            </div>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted">Hóa đơn quá hạn</span>
            <div className="flex h-10 items-center rounded-xl border border-border bg-background px-3">
              <input
                type="number"
                min={0}
                max={365}
                value={reminderDays.invoiceOverdueDays}
                onChange={(event) => handleReminderDayChange("invoiceOverdueDays", event.target.value)}
                className="min-w-0 flex-1 bg-transparent text-sm font-bold text-text outline-none"
                data-testid="settings-notification-invoice-overdue-days"
              />
              <span className="text-xs font-semibold text-muted">ngày sau hạn</span>
            </div>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted">Hợp đồng sắp hết hạn</span>
            <div className="flex h-10 items-center rounded-xl border border-border bg-background px-3">
              <input
                type="number"
                min={0}
                max={365}
                value={reminderDays.contractExpiringDays}
                onChange={(event) => handleReminderDayChange("contractExpiringDays", event.target.value)}
                className="min-w-0 flex-1 bg-transparent text-sm font-bold text-text outline-none"
                data-testid="settings-notification-contract-expiring-days"
              />
              <span className="text-xs font-semibold text-muted">ngày trước hạn</span>
            </div>
          </label>
        </div>
      </Card>

      <Card className="rounded-xl border border-border/70 bg-card p-4 shadow-2xs" data-testid="settings-notification-audio">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className={`flex h-9 w-9 items-center justify-center rounded-xl border ${audioSettings.enabled ? "border-sky-500/20 bg-sky-500/10 text-sky-600" : "border-border bg-muted/20 text-muted"}`}>
              {audioSettings.enabled ? <Volume2 size={17} /> : <VolumeX size={17} />}
            </div>
            <div>
              <h3 className="text-sm font-black text-text">Âm thanh thông báo</h3>
              <p className="mt-0.5 text-xs font-medium text-muted">
                Chọn âm thanh riêng cho tiền vào, lịch nhắc, công nợ và cảnh báo hệ thống.
              </p>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={audioSettings.enabled}
            onClick={() => handleAudioChange("enabled", !audioSettings.enabled)}
            className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors ${audioSettings.enabled ? "bg-primary" : "bg-muted/30"}`}
          >
            <span className={`pointer-events-none h-5 w-5 rounded-full bg-white shadow transition-transform ${audioSettings.enabled ? "translate-x-5" : "translate-x-0"}`} />
          </button>
        </div>

        <div className="mb-4 grid gap-3 rounded-xl border border-border/70 bg-background/60 p-3 md:grid-cols-[1fr_220px] md:items-center">
          <div>
            <div className="text-xs font-black text-text">Âm lượng</div>
            <div className="mt-0.5 text-[11px] font-medium text-muted">Âm thanh chỉ phát sau khi người dùng cấp quyền trên trình duyệt.</div>
          </div>
          <div className="flex items-center gap-3">
            <Volume2 size={14} className="text-muted" />
            <input
              aria-label="Âm lượng thông báo"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={audioSettings.volume}
              onChange={(event) => handleAudioChange("volume", Number(event.target.value))}
              className="w-full accent-primary"
            />
            <span className="w-10 text-right text-xs font-black text-text">{Math.round(audioSettings.volume * 100)}%</span>
          </div>
        </div>

        <label className="mb-4 flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-border/70 bg-background/60 px-3 py-2.5">
          <span>
            <span className="block text-xs font-black text-text">Đọc số tiền khi nhận thanh toán</span>
            <span className="mt-0.5 block text-[11px] font-medium text-muted">Ví dụ: “Đã nhận được một triệu đồng”.</span>
          </span>
          <input
            type="checkbox"
            checked={audioSettings.speakPaymentAmount}
            onChange={(event) => handleAudioChange("speakPaymentAmount", event.target.checked)}
            className="h-4 w-4 accent-primary"
          />
        </label>

        <div className="mb-4 rounded-xl border border-border/70 bg-background/60 p-3">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <div className="text-xs font-black text-text">Kiểm tra giọng đọc số tiền</div>
              <div className="mt-0.5 text-[11px] font-medium text-muted">
                Chọn giọng tiếng Việt, điều chỉnh cách đọc rồi nghe thử ngay.
              </div>
            </div>
            <Button data-testid="settings-notification-voice-preview" type="button" variant="outline" size="sm" onClick={() => void previewVoice()} className="h-8 shrink-0 gap-1.5 px-2.5 text-[11px]">
              <Play size={12} /> Nghe thử giọng
            </Button>
          </div>
          <div className="grid gap-3 md:grid-cols-[minmax(0,1.5fr)_1fr_1fr]">
            <label className="flex flex-col gap-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-muted">Giọng đọc</span>
              <select
                aria-label="Giọng đọc số tiền"
                data-testid="settings-notification-voice-select"
                value={audioSettings.voiceName}
                onChange={(event) => handleAudioChange("voiceName", event.target.value)}
                className="h-9 rounded-lg border border-border bg-background px-2.5 text-xs font-bold text-text outline-none focus:border-primary"
              >
                <option value="">Mặc định của trình duyệt</option>
                {speechVoices.map((voice) => (
                  <option key={`${voice.name}-${voice.lang}`} value={voice.name}>
                    {voice.name} ({voice.lang})
                  </option>
                ))}
              </select>
              {speechVoices.length === 0 && <span className="text-[10px] font-medium text-amber-600">Chưa tìm thấy giọng tiếng Việt/Anh trên trình duyệt.</span>}
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-muted">Tốc độ {audioSettings.speechRate.toFixed(2)}x</span>
              <input
                aria-label="Tốc độ giọng đọc"
                data-testid="settings-notification-voice-rate"
                type="range"
                min={0.6}
                max={1.4}
                step={0.05}
                value={audioSettings.speechRate}
                onChange={(event) => handleAudioChange("speechRate", Number(event.target.value))}
                className="mt-2 accent-primary"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-muted">Cao độ {audioSettings.speechPitch.toFixed(2)}</span>
              <input
                aria-label="Cao độ giọng đọc"
                data-testid="settings-notification-voice-pitch"
                type="range"
                min={0.6}
                max={1.4}
                step={0.05}
                value={audioSettings.speechPitch}
                onChange={(event) => handleAudioChange("speechPitch", Number(event.target.value))}
                className="mt-2 accent-primary"
              />
            </label>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {([
            ["paymentSound", "Khi nhận được tiền", "Báo hiệu giao dịch thanh toán thành công"],
            ["reminderSound", "Nhắc lịch / hợp đồng", "Nhắc hợp đồng sắp đến hạn hoặc lịch vận hành"],
            ["overdueSound", "Công nợ / còn phải thu", "Cảnh báo hóa đơn chưa thanh toán hoặc quá hạn"],
            ["systemSound", "Vấn đề hệ thống", "Cảnh báo lỗi gửi thông báo và sự cố vận hành"],
          ] as Array<[keyof AudioSettings, string, string]>).map(([field, label, hint]) => (
            <div key={String(field)} className="rounded-xl border border-border/70 bg-card p-3">
              <div className="mb-2">
                <div className="text-xs font-black text-text">{label}</div>
                <div className="mt-0.5 text-[11px] font-medium text-muted">{hint}</div>
              </div>
              <div className="flex items-center gap-2">
                <select
                  aria-label={label}
                  value={audioSettings[field] as string}
                  onChange={(event) => handleAudioChange(field, event.target.value as NotificationSoundId)}
                  className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-background px-2.5 text-xs font-bold text-text outline-none focus:border-primary"
                >
                  {soundOptions.map((option) => (
                    <option key={option.id} value={option.id}>{option.label}</option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label={`Nghe thử ${label}`}
                  onClick={() => void previewSound(audioSettings[field] as NotificationSoundId)}
                  className="h-9 w-9 rounded-lg"
                >
                  <Play size={13} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Matrix Table */}
      <Card className="rounded-xl border border-border/70 bg-card p-0 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-border/70 bg-muted/20">
                <th className="py-2.5 px-3.5 font-black text-text uppercase tracking-wider text-[11px]">Sự kiện kích hoạt</th>
                <th className="py-2.5 px-3.5 font-black text-text uppercase tracking-wider text-[11px] hidden md:table-cell">Mô tả luồng xử lý</th>
                {channels.map((ch) => (
                  <th key={ch.id} className="py-2.5 px-3 font-black text-center text-text uppercase tracking-wider text-[11px]">
                    <div className="flex items-center justify-center gap-1">
                      {ch.icon}
                      <span>{ch.label}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {rows.map((row, index) => (
                <tr key={row.event} className="hover:bg-muted/10 transition-colors">
                  <td className="py-3 px-3.5">
                    <div className="font-bold text-text">{row.event}</div>
                    <div className="text-[10px] text-muted md:hidden mt-0.5">{row.desc}</div>
                  </td>
                  <td className="py-3 px-3.5 text-muted text-[11px] hidden md:table-cell">
                    {row.desc}
                  </td>
                  {channels.map((ch) => {
                    const isEnabled = row[ch.id];
                    return (
                      <td key={ch.id} className="py-3 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggle(index, ch.id)}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            isEnabled ? "bg-primary" : "bg-muted/30"
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                              isEnabled ? "translate-x-4" : "translate-x-0"
                            }`}
                          />
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
