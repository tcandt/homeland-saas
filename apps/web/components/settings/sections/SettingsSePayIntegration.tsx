"use client";

import React, { useMemo } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Switch } from "@/components/ui/Switch";
import { useSettingsSection } from "@/lib/hooks/useSettingsSection";
import { Copy, CreditCard, Link2, MessageSquareText } from "lucide-react";
import toast from "react-hot-toast";

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

  const webhookUrl = useMemo(() => {
    const base = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:3001/api/v1";
    return `${base.replace(/\/$/, "")}/payments/sepay/webhook`;
  }, []);

  const copyWebhook = async () => {
    await navigator.clipboard.writeText(webhookUrl);
    toast.success("Đã copy webhook URL");
  };

  return (
    <div className="flex flex-col gap-[20px]">
      <Card className="p-[20px] flex flex-col gap-[18px] border-[#6366f1]/15">
        <div className="flex items-start justify-between gap-[16px]">
          <div>
            <div className="flex items-center gap-[8px] text-[#6366f1] text-[12px] font-black uppercase tracking-[0.16em]">
              <CreditCard size={14} /> SePay
            </div>
            <h3 className="mt-[8px] text-[18px] font-black text-text">Tích hợp thanh toán SePay</h3>
            <p className="mt-[6px] text-[13px] text-muted max-w-[720px]">
              Cấu hình dùng để sinh QR thanh toán cho hóa đơn và đặt cọc, sau đó webhook SePay sẽ xác nhận giao dịch để hệ thống cập nhật trạng thái.
            </p>
          </div>
          <div className="flex items-center gap-[10px] rounded-full border border-border px-[12px] py-[8px] bg-background">
            <span className="text-[12px] font-bold text-muted">Bật tích hợp</span>
            <Switch checked={draft.enabled} onChange={(event) => setDraft((prev) => ({ ...prev, enabled: event.target.checked }))} />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-[16px]">
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
              value={draft.webhookApiKey}
              onChange={(event) => setDraft((prev) => ({ ...prev, webhookApiKey: event.target.value }))}
              placeholder="Apikey dùng để xác thực webhook"
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

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-[16px] items-end">
          <div className="flex flex-col gap-[6px]">
            <label className="text-[12px] font-bold uppercase tracking-wide text-muted">Ghi chú vận hành</label>
            <Input
              value={draft.note}
              onChange={(event) => setDraft((prev) => ({ ...prev, note: event.target.value }))}
              placeholder="QR chỉ tạo sau khi gửi hóa đơn qua Zalo"
            />
          </div>
          <div className="flex items-center gap-[10px]">
            <div className="rounded-xl border border-border bg-background px-[12px] py-[10px] min-w-[280px]">
              <div className="text-[11px] font-bold uppercase tracking-wide text-muted">Webhook endpoint</div>
              <div className="mt-[4px] text-[12px] font-bold text-text break-all">{webhookUrl}</div>
            </div>
            <Button type="button" variant="outline" onClick={copyWebhook} className="h-[42px]">
              <Copy size={14} className="mr-2" /> Copy
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-[12px]">
          <div className="rounded-2xl border border-border bg-background p-[16px] flex items-start gap-[12px]">
            <Link2 size={18} className="text-[#6366f1] mt-[2px]" />
            <div>
              <div className="font-black text-text">Luồng tạo QR</div>
              <div className="text-[13px] text-muted mt-[4px]">
                Chỉ tạo QR sau khi hóa đơn đã được gửi tới khách hàng qua Zalo hoặc kênh thông báo tương ứng.
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-background p-[16px] flex items-start gap-[12px]">
            <MessageSquareText size={18} className="text-[#8b5cf6] mt-[2px]" />
            <div>
              <div className="font-black text-text">Kết quả thanh toán</div>
              <div className="text-[13px] text-muted mt-[4px]">
                Khi SePay xác nhận thanh toán xong, hệ thống sẽ tiếp tục ghi nhận và đẩy thông báo trả kết quả về Zalo theo workflow.
              </div>
            </div>
          </div>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button type="button" onClick={() => save()} className="h-[44px] px-[24px] rounded-[12px] bg-primary text-white font-bold text-[14px] hover:bg-primary/90 transition-colors shadow-sm" isLoading={isSaving}>
          Lưu SePay
        </Button>
      </div>
    </div>
  );
}
