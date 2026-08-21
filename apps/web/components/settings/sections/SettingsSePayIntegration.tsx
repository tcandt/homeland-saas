"use client";

import React, { useMemo, useState } from "react";
import { Copy, CreditCard, Link2, LockKeyhole, MessageSquareText } from "lucide-react";
import toast from "react-hot-toast";
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

  const copyWebhook = async () => {
    await navigator.clipboard.writeText(webhookUrl);
    toast.success("Đã copy webhook URL");
  };

  const saveSePay = async () => {
    const payload: Partial<SePaySettings> = { ...draft };
    if (!canEditSecrets || !webhookApiKeyTouched) delete payload.webhookApiKey;
    await save(payload as SePaySettings);
    setWebhookApiKeyTouched(false);
  };

  return (
    <div className="flex flex-col gap-[20px]">
      <Card className="flex flex-col gap-[18px] border-[#6366f1]/15 p-[20px]">
        <div className="flex items-start justify-between gap-[16px]">
          <div>
            <div className="flex items-center gap-[8px] text-[12px] font-black uppercase tracking-[0.16em] text-[#6366f1]">
              <CreditCard size={14} /> SePay
            </div>
            <h3 className="mt-[8px] text-[18px] font-black text-text">Tích hợp thanh toán SePay</h3>
            <p className="mt-[6px] max-w-[720px] text-[13px] text-muted">
              Cấu hình dùng để sinh QR thanh toán cho hóa đơn và đặt cọc, sau đó webhook SePay sẽ xác nhận giao dịch để hệ thống cập nhật trạng thái.
            </p>
          </div>
          <div className="flex items-center gap-[10px] rounded-full border border-border bg-background px-[12px] py-[8px]">
            <span className="text-[12px] font-bold text-muted">Bật tích hợp</span>
            <Switch checked={draft.enabled} onChange={(event) => setDraft((prev) => ({ ...prev, enabled: event.target.checked }))} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-[16px] lg:grid-cols-2">
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

        <div className="grid grid-cols-1 items-end gap-[16px] lg:grid-cols-[1fr_auto]">
          <div className="flex flex-col gap-[6px]">
            <label className="text-[12px] font-bold uppercase tracking-wide text-muted">Ghi chú vận hành</label>
            <Input
              value={draft.note}
              onChange={(event) => setDraft((prev) => ({ ...prev, note: event.target.value }))}
              placeholder="QR chỉ tạo sau khi gửi hóa đơn qua Zalo"
            />
          </div>
          <div className="flex items-center gap-[10px]">
            <div className="min-w-[280px] rounded-xl border border-border bg-background px-[12px] py-[10px]">
              <div className="text-[11px] font-bold uppercase tracking-wide text-muted">Webhook endpoint</div>
              <div className="mt-[4px] break-all text-[12px] font-bold text-text">{webhookUrl}</div>
            </div>
            <Button type="button" variant="outline" onClick={copyWebhook} className="h-[42px]">
              <Copy size={14} className="mr-2" /> Copy
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-[12px] md:grid-cols-2">
          <div className="flex items-start gap-[12px] rounded-2xl border border-border bg-background p-[16px]">
            <Link2 size={18} className="mt-[2px] text-[#6366f1]" />
            <div>
              <div className="font-black text-text">Luồng tạo QR</div>
              <div className="mt-[4px] text-[13px] text-muted">
                Chỉ tạo QR sau khi hóa đơn đã được gửi tới khách hàng qua Zalo hoặc kênh thông báo tương ứng.
              </div>
            </div>
          </div>
          <div className="flex items-start gap-[12px] rounded-2xl border border-border bg-background p-[16px]">
            <MessageSquareText size={18} className="mt-[2px] text-[#8b5cf6]" />
            <div>
              <div className="font-black text-text">Kết quả thanh toán</div>
              <div className="mt-[4px] text-[13px] text-muted">
                Khi SePay xác nhận thanh toán xong, hệ thống sẽ tiếp tục ghi nhận và đẩy thông báo trả kết quả về Zalo theo workflow.
              </div>
            </div>
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
