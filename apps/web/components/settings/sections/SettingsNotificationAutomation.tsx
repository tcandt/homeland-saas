"use client";

import React, { useMemo } from "react";
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
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useSettingsSection } from "@/lib/hooks/useSettingsSection";
import toast from "react-hot-toast";

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
};

const FALLBACK_SETTINGS: NotificationAutomationSettings = {
  notifications: defaultEvents,
};

export default function SettingsNotificationAutomation() {
  const { draft, setDraft, isSaving, save } = useSettingsSection<NotificationAutomationSettings>(
    "notifications",
    "TENANT",
    FALLBACK_SETTINGS
  );

  const rows = useMemo(() => {
    return draft.notifications?.length > 0 ? draft.notifications : defaultEvents;
  }, [draft.notifications]);

  const activeChannelCount = channels.length;
  const activeEventCount = rows.length;

  const handleToggle = (index: number, channel: typeof channels[number]["id"]) => {
    const updated = [...rows];
    updated[index] = {
      ...updated[index],
      [channel]: !updated[index][channel],
    };
    setDraft({ notifications: updated });
  };

  const handleSaveAll = async () => {
    try {
      await save({ notifications: rows });
      toast.success("Đã lưu ma trận thông báo tự động thành công!");
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
