"use client";

import React, { useState } from "react";
import { LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Switch } from "@/components/ui/Switch";
import { useSettingsSection } from "@/lib/hooks/useSettingsSection";
import { useAuthStore } from "@/lib/auth/auth-store";

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

export default function SettingsEmailIntegration() {
  const { draft, setDraft, isSaving, save } = useSettingsSection<EmailSettings>("email-provider", "TENANT", fallback);
  const user = useAuthStore((state) => state.user);
  const [smtpPasswordTouched, setSmtpPasswordTouched] = useState(false);
  const canEditSecrets = (user?.email || "").toLowerCase() === "admin@homeland.vn";

  const saveEmail = async () => {
    const payload: Partial<EmailSettings> = { ...draft };
    if (!canEditSecrets || !smtpPasswordTouched) delete payload.smtpPassword;
    await save(payload as EmailSettings);
    setSmtpPasswordTouched(false);
  };

  return (
    <Card className="p-[20px] flex flex-col gap-[18px] border-[#0ea5e9]/15">
      <div className="flex items-start justify-between gap-[16px]">
        <div>
          <div className="flex items-center gap-[8px] text-[#0ea5e9] text-[12px] font-black uppercase tracking-[0.16em]">
            <Mail size={14} /> Email SMTP
          </div>
          <h3 className="mt-[8px] text-[18px] font-black text-text">Cấu hình gửi Email</h3>
          <p className="mt-[6px] text-[13px] text-muted max-w-[720px]">
            Lưu SMTP theo tenant để gửi email xác thực, khôi phục mật khẩu, hóa đơn và thông báo vận hành.
          </p>
        </div>
        <div className="flex items-center gap-[10px] rounded-full border border-border px-[12px] py-[8px] bg-background">
          <span className="text-[12px] font-bold text-muted">Bật Email</span>
          <Switch checked={draft.enabled} onChange={(event) => setDraft((prev) => ({ ...prev, enabled: event.target.checked }))} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-[16px]">
        <div className="flex flex-col gap-[6px]">
          <label className="text-[12px] font-bold uppercase tracking-wide text-muted">SMTP host</label>
          <Input value={draft.smtpHost} onChange={(event) => setDraft((prev) => ({ ...prev, smtpHost: event.target.value }))} placeholder="Nhập SMTP host" />
        </div>
        <div className="grid grid-cols-[1fr_auto] gap-[12px] items-end">
          <div className="flex flex-col gap-[6px]">
            <label className="text-[12px] font-bold uppercase tracking-wide text-muted">SMTP port</label>
            <Input
              type="number"
              value={draft.smtpPort}
              onChange={(event) => setDraft((prev) => ({ ...prev, smtpPort: Number(event.target.value || 587) }))}
              placeholder="587"
            />
          </div>
          <div className="flex items-center gap-[8px] h-[40px] rounded-xl border border-border px-[12px]">
            <span className="text-[12px] font-bold text-muted">TLS</span>
            <Switch checked={draft.smtpSecure} onChange={(event) => setDraft((prev) => ({ ...prev, smtpSecure: event.target.checked }))} />
          </div>
        </div>
        <div className="flex flex-col gap-[6px]">
          <label className="text-[12px] font-bold uppercase tracking-wide text-muted">SMTP user</label>
          <Input value={draft.smtpUser} onChange={(event) => setDraft((prev) => ({ ...prev, smtpUser: event.target.value }))} placeholder="apikey hoặc email" />
        </div>
        <div className="flex flex-col gap-[6px]">
          <label className="text-[12px] font-bold uppercase tracking-wide text-muted">SMTP password</label>
          <Input
            type="password"
            value={draft.smtpPassword}
            onChange={(event) => {
              setSmtpPasswordTouched(true);
              setDraft((prev) => ({ ...prev, smtpPassword: event.target.value }));
            }}
            placeholder={canEditSecrets ? "Để trống để giữ nguyên mật khẩu" : "Chỉ admin@homeland.vn được chỉnh sửa"}
            disabled={!canEditSecrets}
            data-testid="integration-secret-field"
          />
        </div>
        <div className="flex flex-col gap-[6px]">
          <label className="text-[12px] font-bold uppercase tracking-wide text-muted">Tên người gửi</label>
          <Input value={draft.fromName} onChange={(event) => setDraft((prev) => ({ ...prev, fromName: event.target.value }))} placeholder="Nhập tên người gửi" />
        </div>
        <div className="flex flex-col gap-[6px]">
          <label className="text-[12px] font-bold uppercase tracking-wide text-muted">Email người gửi</label>
          <Input value={draft.fromEmail} onChange={(event) => setDraft((prev) => ({ ...prev, fromEmail: event.target.value }))} placeholder="Nhập email người gửi" />
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-background p-[16px] flex items-start gap-[12px]">
        <ShieldCheck size={18} className="text-[#0ea5e9] mt-[2px]" />
        <div>
          <div className="font-black text-text">Lưu ý bảo mật</div>
          <div className="text-[13px] text-muted mt-[4px]">
            Credential được lưu theo tenant trong DB. Trước production nên bổ sung mã hóa trường nhạy cảm ở tầng service hoặc database.
          </div>
        </div>
      </div>

      {!canEditSecrets && (
        <div className="flex items-start gap-[9px] rounded-[8px] border border-warning/30 bg-warning/5 px-[14px] py-[11px] text-[12px] font-medium leading-[18px] text-muted">
          <LockKeyhole size={15} className="mt-[1px] shrink-0 text-warning" aria-hidden="true" />
          Mật khẩu SMTP chỉ được chỉnh sửa bởi admin@homeland.vn.
        </div>
      )}

      <div className="flex justify-end">
        <Button type="button" onClick={saveEmail} className="h-[44px] px-[24px] rounded-[12px] bg-primary text-white font-bold text-[14px] hover:bg-primary/90 transition-colors shadow-sm" isLoading={isSaving}>
          Lưu Email
        </Button>
      </div>
    </Card>
  );
}
