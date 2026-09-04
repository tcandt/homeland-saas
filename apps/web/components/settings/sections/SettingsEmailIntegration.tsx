"use client";

import React, { useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Info,
  LockKeyhole,
  Mail,
  Send,
  Server,
  Settings2,
  ShieldCheck,
  UserCheck,
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

type EmailSettings = {
  enabled: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPassword: string;
  fromName: string;
  fromEmail: string;
  sendHtml: boolean;
};

const fallback: EmailSettings = {
  enabled: false,
  smtpHost: "",
  smtpPort: 587,
  smtpSecure: false,
  smtpUser: "",
  smtpPassword: "",
  fromName: "",
  fromEmail: "",
  sendHtml: true,
};

function shortSecret(value?: string) {
  const normalized = String(value || "").trim();
  if (!normalized) return "Chưa cấu hình";
  if (normalized.length <= 8) return "••••••••";
  return `${normalized.slice(0, 4)}••••${normalized.slice(-4)}`;
}

export default function SettingsEmailIntegration() {
  const { draft, setDraft, isSaving, save } = useSettingsSection<EmailSettings>("email-provider", "TENANT", fallback);
  const user = useAuthStore((state) => state.user);
  const canEditSecrets = (user?.email || "").toLowerCase() === "admin@homeland.vn" && Boolean(draft.smtpPassword);

  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [configDraft, setConfigDraft] = useState<EmailSettings>(fallback);
  const [smtpPasswordTouched, setSmtpPasswordTouched] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [testRecipient, setTestRecipient] = useState("");
  const [isTesting, setIsTesting] = useState(false);

  const openConfigModal = () => {
    const current = draft || fallback;
    setConfigDraft({
      enabled: Boolean(current.enabled),
      smtpHost: current.smtpHost || "",
      smtpPort: Number(current.smtpPort || 587),
      smtpSecure: Boolean(current.smtpSecure),
      smtpUser: current.smtpUser || "",
      smtpPassword: current.smtpPassword || "",
      fromName: current.fromName || "",
      fromEmail: current.fromEmail || "",
      sendHtml: current.sendHtml ?? true,
    });
    setShowPassword(false);
    setIsConfigModalOpen(true);
  };

  const closeConfigModal = () => {
    setIsConfigModalOpen(false);
  };

  const saveConfigModal = async () => {
    const isPasswordChanged = configDraft.smtpPassword !== (draft.smtpPassword || "");
    const payload: Partial<EmailSettings> = { ...configDraft };
    if (!canEditSecrets || !isPasswordChanged) delete payload.smtpPassword;

    try {
      setDraft(configDraft);
      await save(payload as EmailSettings);
      setSmtpPasswordTouched(false);
      setIsConfigModalOpen(false);
      toast.success("Đã cập nhật cấu hình Email SMTP thành công!");
    } catch (error: any) {
      toast.error(error?.message || "Lỗi khi lưu cấu hình Email");
    }
  };

  const testEmail = async () => {
    const recipient = testRecipient.trim() || configDraft.fromEmail || draft.fromEmail;
    if (!recipient) {
      toast.error("Vui lòng nhập email nhận test hoặc cấu hình Email người gửi");
      return;
    }

    setIsTesting(true);
    try {
      await settingsApi.testEmail({
        recipient,
        title: "HomeLand - Thử nghiệm gửi Email SMTP",
        message: `Đây là email thử nghiệm gửi từ hệ thống HomeLand lúc ${new Date().toLocaleString("vi-VN")}. Cấu hình SMTP hoạt động tốt!`,
      });
      toast.success(`Đã gửi email test thành công tới: ${recipient}`);
    } catch (error: any) {
      toast.error(error?.message || "Không gửi được email test. Vui lòng kiểm tra SMTP Host/User/Password.");
    } finally {
      setIsTesting(false);
    }
  };

  const smtpServerSummary = draft.smtpHost
    ? `${draft.smtpHost}:${draft.smtpPort || 587}`
    : "Chưa cấu hình";

  const senderSummary = draft.fromEmail
    ? draft.fromName ? `${draft.fromName} <${draft.fromEmail}>` : draft.fromEmail
    : "Chưa cấu hình";

  const handleToggleEnabled = async (enabled: boolean) => {
    const nextDraft = { ...draft, enabled };
    setDraft(nextDraft);
    try {
      const payload: Partial<EmailSettings> = { ...nextDraft };
      if (!draft.smtpPassword) delete payload.smtpPassword;
      await save(payload as EmailSettings);
      toast.success(enabled ? "Đã bật Email SMTP" : "Đã tắt Email SMTP");
    } catch (error: any) {
      setDraft(draft);
      toast.error(error?.message || "Lỗi khi lưu trạng thái Email");
    }
  };

  return (
    <div className="flex h-full flex-col gap-4">
      <Card className="flex h-full flex-col gap-4 border-sky-500/20 shadow-sm p-4 sm:p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 pb-2 border-b border-border/60">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 font-bold text-xs">
                <Mail size={16} />
              </div>
              <span className="text-xs font-black uppercase tracking-wider text-sky-600 dark:text-sky-400">
                Email SMTP
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
            <h3 className="text-lg font-black text-text">Cấu hình gửi Email</h3>
            <p className="text-xs text-muted">
              Lưu SMTP theo tenant để gửi email xác thực, khôi phục mật khẩu, hóa đơn và thông báo vận hành.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 shadow-sm">
            <Switch
              checked={draft.enabled}
              onChange={(event) => handleToggleEnabled(event.target.checked)}
              aria-label="Bật Email"
            />
          </div>
        </div>

        {/* Section: HỢP NHẤT TOÀN BỘ CẤU HÌNH VÀO 1 BOX TINH GỌN */}
        <div className="rounded-xl border border-border bg-background/80 p-3.5 sm:p-4 space-y-3.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted">
              <Server size={14} className="text-sky-600" /> Tích hợp Email SMTP
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={openConfigModal}
              className="h-8 rounded-xl px-3 text-xs font-bold text-sky-600 border-sky-500/30 hover:bg-sky-500/5 hover:border-sky-500"
            >
              <Settings2 size={13} className="mr-1.5" /> Thiết lập cấu hình
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-1">
            <div className="space-y-1">
              <label className="text-xs font-bold text-text flex items-center justify-between">
                <span>Tài khoản gửi SMTP</span>
                <span className="text-[10px] font-normal text-muted">(Chỉ sửa trong cấu hình)</span>
              </label>
              <Input
                value={draft.smtpUser || ""}
                placeholder="Chưa cấu hình tài khoản SMTP"
                disabled={true}
                readOnly
                className="h-9 text-xs font-mono bg-muted/20 cursor-not-allowed text-muted select-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-text flex items-center justify-between">
                <span>Mật khẩu SMTP</span>
                <span className="text-[10px] font-normal text-muted">(Chỉ sửa trong cấu hình)</span>
              </label>
              <Input
                type="password"
                value={draft.smtpPassword ? "••••••••••••••••••••••••••••••••" : ""}
                placeholder="Chưa cấu hình mật khẩu SMTP"
                disabled={true}
                readOnly
                data-testid="integration-secret-field"
                className="h-9 text-xs font-mono bg-muted/20 cursor-not-allowed text-muted select-none"
              />
            </div>
          </div>

          {/* Consolidated Summary Grid */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            <div className="rounded-xl border border-border bg-card p-3 cursor-pointer hover:border-sky-500/40 transition" onClick={openConfigModal}>
              <div className="text-[10px] uppercase font-bold tracking-wider text-muted">Máy chủ SMTP</div>
              <div className="mt-1 text-xs font-mono font-bold text-text truncate">
                {smtpServerSummary}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-3">
              <div className="text-[10px] uppercase font-bold tracking-wider text-muted">Bảo mật (TLS/SSL)</div>
              <div className="mt-1 text-xs font-bold text-text truncate">
                {draft.smtpSecure ? (
                  <span className="text-emerald-600 dark:text-emerald-400">TLS / SSL Bật</span>
                ) : (
                  <span className="text-slate-500">TLS Tắt (Port {draft.smtpPort || 587})</span>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-3">
              <div className="text-[10px] uppercase font-bold tracking-wider text-muted">Tài khoản (User)</div>
              <div className="mt-1 text-xs font-mono font-bold text-text truncate">
                {draft.smtpUser || <span className="text-muted font-normal">Chưa cấu hình</span>}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-3">
              <div className="text-[10px] uppercase font-bold tracking-wider text-muted">Mật khẩu (Secret)</div>
              <div className="mt-1 text-xs font-mono font-bold text-text truncate">
                {draft.smtpPassword ? shortSecret(draft.smtpPassword) : <span className="text-muted font-normal">Chưa cấu hình</span>}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-3 col-span-2 sm:col-span-1">
              <div className="text-[10px] uppercase font-bold tracking-wider text-muted">Người gửi (From)</div>
              <div className="mt-1 text-xs font-bold text-text truncate">
                {senderSummary}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Link chỉ dẫn */}
        <div className="mt-auto border-t border-border/60 pt-3 flex items-center justify-between">
          <span className="inline-flex items-center gap-1 text-xs font-medium text-sky-600 dark:text-sky-400">
            <ShieldCheck size={13} /> SMTP Tenant Service • Bảo mật mã hóa
          </span>
          <span className="text-[11px] text-muted">
            {draft.smtpHost ? "Đã sẵn sàng gửi thư" : "Chưa cấu hình máy chủ"}
          </span>
        </div>
      </Card>

      {/* POPUP MODAL: THIẾT LẬP TOÀN BỘ CẤU HÌNH EMAIL SMTP */}
      <Modal
        isOpen={isConfigModalOpen}
        onClose={closeConfigModal}
        title="Thiết lập cấu hình Email SMTP"
        maxWidth="max-w-[720px]"
        footer={
          <div className="flex flex-wrap items-center justify-between gap-2.5 w-full">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={testEmail}
                isLoading={isTesting}
                className="h-10 rounded-xl px-3.5 text-xs font-bold"
              >
                <Send size={14} className="mr-1.5 text-sky-600" /> Gửi thử Email
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
          {/* Nhóm 1: Máy chủ SMTP (Host & Port) */}
          <div className="rounded-xl border border-border bg-card p-3.5 space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-sky-600 uppercase tracking-wider">
              <Server size={14} /> 1. Máy chủ SMTP & Cổng kết nối
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_120px_100px] items-end">
              <div className="space-y-1">
                <label className="text-xs font-bold text-text">SMTP Host</label>
                <Input
                  value={configDraft.smtpHost}
                  onChange={(event) => setConfigDraft((prev) => ({ ...prev, smtpHost: event.target.value }))}
                  placeholder="smtp.gmail.com / smtp.sendgrid.net"
                  className="h-10 text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-text">SMTP Port</label>
                <Input
                  type="number"
                  value={configDraft.smtpPort}
                  onChange={(event) =>
                    setConfigDraft((prev) => ({ ...prev, smtpPort: Number(event.target.value || 587) }))
                  }
                  placeholder="587"
                  className="h-10 text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-text">TLS / SSL</label>
                <div className="flex items-center justify-center h-10 rounded-xl border border-border bg-background px-3">
                  <Switch
                    checked={configDraft.smtpSecure}
                    onChange={(event) => setConfigDraft((prev) => ({ ...prev, smtpSecure: event.target.checked }))}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Nhóm 2: Tài khoản & Mật khẩu */}
          <div className="rounded-xl border border-border bg-card p-3.5 space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-sky-600 uppercase tracking-wider">
              <LockKeyhole size={14} /> 2. Tài khoản & Mật khẩu ứng dụng (App Password)
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-bold text-text">SMTP User</label>
                <Input
                  value={configDraft.smtpUser}
                  onChange={(event) => setConfigDraft((prev) => ({ ...prev, smtpUser: event.target.value }))}
                  placeholder="email@example.com hoặc apikey"
                  className="h-10 text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-text">SMTP Password / Mật khẩu ứng dụng</label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={configDraft.smtpPassword}
                    onChange={(event) => {
                      setSmtpPasswordTouched(true);
                      setConfigDraft((prev) => ({ ...prev, smtpPassword: event.target.value }));
                    }}
                    placeholder={canEditSecrets ? "Mật khẩu SMTP hoặc App Password" : "Chỉ admin@homeland.vn được sửa"}
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

          {/* Nhóm 3: Thông tin người gửi (From Profile) */}
          <div className="rounded-xl border border-border bg-card p-3.5 space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-sky-600 uppercase tracking-wider">
              <UserCheck size={14} /> 3. Thông tin người gửi (Sender Profile)
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-bold text-text">Tên hiển thị người gửi</label>
                <Input
                  value={configDraft.fromName}
                  onChange={(event) => setConfigDraft((prev) => ({ ...prev, fromName: event.target.value }))}
                  placeholder="Ví dụ: HomeLand Quản Lý Tòa Nhà"
                  className="h-10 text-xs font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-text">Email người gửi (From Email)</label>
                <Input
                  value={configDraft.fromEmail}
                  onChange={(event) => setConfigDraft((prev) => ({ ...prev, fromEmail: event.target.value }))}
                  placeholder="noreply@homeland.vn"
                  className="h-10 text-xs font-mono"
                />
              </div>
            </div>

            <div className="pt-1">
              <label className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background px-3.5 py-2.5 cursor-pointer hover:border-sky-500/40 transition">
                <div>
                  <div className="text-xs font-bold text-text">Định dạng email HTML</div>
                  <div className="text-[11px] text-muted">Hỗ trợ gửi email hóa đơn và thông báo với giao diện HTML đẹp mắt.</div>
                </div>
                <Switch
                  checked={configDraft.sendHtml}
                  onChange={(event) => setConfigDraft((prev) => ({ ...prev, sendHtml: event.target.checked }))}
                />
              </label>
            </div>
          </div>

          {/* Nhóm 4: Gửi thử nghiệm */}
          <div className="rounded-xl border border-border bg-card p-3.5 space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-sky-600 uppercase tracking-wider">
              <Send size={14} /> 4. Kiểm tra gửi Email thử nghiệm
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-text">Email nhận thử nghiệm (Test Recipient)</label>
              <Input
                value={testRecipient}
                onChange={(event) => setTestRecipient(event.target.value)}
                placeholder="Nhập email của bạn để nhận thử (ví dụ: admin@gmail.com)"
                className="h-10 text-xs font-mono"
              />
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
