"use client";

import React, { useMemo, useState } from "react";
import { CreditCard, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Switch } from "@/components/ui/Switch";
import { useSettingsSection } from "@/lib/hooks/useSettingsSection";
import { useAuthStore } from "@/lib/auth/auth-store";

type SePaySettings = {
  enabled: boolean;
  paymentCodePrefix: string;
  qrTemplate: string;
  webhookApiKey: string;
  invoicePaidTemplateCode: string;
  sendPaymentResultToZalo: boolean;
  note: string;
};

const fallback: SePaySettings = {
  enabled: false,
  paymentCodePrefix: "",
  qrTemplate: "",
  webhookApiKey: "",
  invoicePaidTemplateCode: "",
  sendPaymentResultToZalo: false,
  note: "",
};

export default function SettingsSePayIntegration() {
  const { draft, setDraft, isSaving, save } = useSettingsSection<SePaySettings>("sepay", "TENANT", fallback);
  const user = useAuthStore((state) => state.user);
  const [webhookApiKeyTouched, setWebhookApiKeyTouched] = useState(false);
  const canEditSecrets = (user?.email || "").toLowerCase() === "admin@homeland.vn";

  const webhookUrl = useMemo(() => {
    const base = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:3001/api/v1";
    return `${base.replace(/\/$/, "")}/payments/sepay/webhook`;
  }, []);

  const saveSePay = async () => {
    const payload: Partial<SePaySettings> = { ...draft };
    if (!canEditSecrets || !webhookApiKeyTouched) delete payload.webhookApiKey;
    await save(payload as SePaySettings);
    setWebhookApiKeyTouched(false);
  };

  return (
    <div className="flex h-full flex-col gap-[16px]">
      <Card className="flex h-full flex-col gap-[14px] border-[#6366f1]/15 p-[16px]">
        <div className="flex items-start justify-between gap-[16px]">
          <div>
            <div className="flex items-center gap-[8px] text-[12px] font-black uppercase tracking-[0.16em] text-[#6366f1]">
              <CreditCard size={14} /> SePay
            </div>
            <h3 className="mt-[8px] text-[18px] font-black text-text">Tích hợp thanh toán SePay</h3>
          </div>
          <div className="flex items-center gap-[10px] rounded-full border border-border bg-background px-[12px] py-[8px]">
            <Switch checked={draft.enabled} onChange={(event) => setDraft((prev) => ({ ...prev, enabled: event.target.checked }))} />
          </div>
        </div>

        <div className="flex flex-col gap-[8px]">
          <div className="text-[12px] font-bold uppercase tracking-wide text-muted">Webhook endpoint</div>
          <div className="rounded-[12px] border border-border bg-background px-[14px] py-[12px]">
            <div className="break-all text-[13px] font-bold text-text">{webhookUrl}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-[12px] lg:grid-cols-2">
          <div className="flex flex-col gap-[6px]">
            <label className="text-[12px] font-bold uppercase tracking-wide text-muted">Tiền tố mã thanh toán</label>
            <Input
              value={draft.paymentCodePrefix}
              onChange={(event) => setDraft((prev) => ({ ...prev, paymentCodePrefix: event.target.value }))}
              placeholder="Nhập tiền tố mã thanh toán"
            />
          </div>
          <div className="flex flex-col gap-[6px]">
            <label className="text-[12px] font-bold uppercase tracking-wide text-muted">Mẫu QR</label>
            <Input
              value={draft.qrTemplate}
              onChange={(event) => setDraft((prev) => ({ ...prev, qrTemplate: event.target.value }))}
              placeholder="Nhập mẫu QR"
            />
          </div>
          <div className="flex flex-col gap-[6px]">
            <label className="text-[12px] font-bold uppercase tracking-wide text-muted">Webhook API key</label>
            <Input
              type="password"
              value={draft.webhookApiKey}
              onChange={(event) => {
                setWebhookApiKeyTouched(true);
                setDraft((prev) => ({ ...prev, webhookApiKey: event.target.value }));
              }}
              placeholder={canEditSecrets ? "Để trống để giữ nguyên API key" : "Chỉ admin@homeland.vn được chỉnh sửa"}
              disabled={!canEditSecrets}
              data-testid="integration-secret-field"
            />
          </div>
          <div className="flex flex-col gap-[6px]">
            <label className="text-[12px] font-bold uppercase tracking-wide text-muted">Template xác nhận đã thanh toán</label>
            <Input
              value={draft.invoicePaidTemplateCode}
              onChange={(event) => setDraft((prev) => ({ ...prev, invoicePaidTemplateCode: event.target.value }))}
              placeholder="Nhập template xác nhận"
            />
          </div>
        </div>
      </Card>

      {!canEditSecrets && (
        <div className="flex items-start gap-[9px] rounded-[8px] border border-warning/30 bg-warning/5 px-[14px] py-[11px] text-[12px] font-medium leading-[18px] text-muted">
          <LockKeyhole size={15} className="mt-[1px] shrink-0 text-warning" aria-hidden="true" />
          Token và mật khẩu tích hợp chỉ được chỉnh sửa bởi admin@homeland.vn. Các cấu hình vận hành khác vẫn có thể lưu bình thường.
        </div>
      )}

      <div className="flex justify-end">
        <Button
          type="button"
          onClick={saveSePay}
          className="h-[44px] rounded-[12px] bg-primary px-[24px] text-[14px] font-bold text-white shadow-sm transition-colors hover:bg-primary/90"
          isLoading={isSaving}
        >
          Lưu SePay
        </Button>
      </div>
    </div>
  );
}
