"use client";

import React, { useMemo } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Switch } from "@/components/ui/Switch";
import { useSettingsSection } from "@/lib/hooks/useSettingsSection";
import { MessageCircle, Copy, ShieldCheck, Smartphone } from "lucide-react";
import toast from "react-hot-toast";

type ZaloSettings = {
  enabled: boolean;
  officialAccountId: string;
  accessToken: string;
  appSecret: string;
  senderName: string;
  paymentRequestTemplateCode: string;
  paymentConfirmationTemplateCode: string;
  defaultRecipientHint: string;
  note: string;
};

const fallback: ZaloSettings = {
  enabled: true,
  officialAccountId: "",
  accessToken: "",
  appSecret: "",
  senderName: "HomeLand",
  paymentRequestTemplateCode: "INVOICE_ZALO_PAYMENT_REQUEST",
  paymentConfirmationTemplateCode: "INVOICE_ZALO_PAYMENT_CONFIRMATION",
  defaultRecipientHint: "Dùng số Zalo của khách thuê trong hồ sơ khách hàng.",
  note: "Zalo dùng để gửi hóa đơn kèm QR và xác nhận thanh toán sau webhook SePay.",
};

export default function SettingsZaloIntegration() {
  const { draft, setDraft, isSaving, save } = useSettingsSection<ZaloSettings>("zalo-provider", "TENANT", fallback);

  const webhookHint = useMemo(() => {
    const base = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:3001/api/v1";
    return `${base.replace(/\/$/, "")}/payments/sepay/webhook`;
  }, []);

  const copyHint = async () => {
    await navigator.clipboard.writeText(webhookHint);
    toast.success("Đã copy endpoint");
  };

  return (
    <div className="flex flex-col gap-[20px]">
      <Card className="p-[20px] flex flex-col gap-[18px] border-[#8b5cf6]/15">
        <div className="flex items-start justify-between gap-[16px]">
          <div>
            <div className="flex items-center gap-[8px] text-[#8b5cf6] text-[12px] font-black uppercase tracking-[0.16em]">
              <MessageCircle size={14} /> Zalo Provider
            </div>
            <h3 className="mt-[8px] text-[18px] font-black text-text">Cấu hình gửi Zalo</h3>
            <p className="mt-[6px] text-[13px] text-muted max-w-[720px]">
              Dùng để gửi hóa đơn kèm QR SePay và trả xác nhận thanh toán về Zalo cho khách thuê.
            </p>
          </div>
          <div className="flex items-center gap-[10px] rounded-full border border-border px-[12px] py-[8px] bg-background">
            <span className="text-[12px] font-bold text-muted">Bật Zalo</span>
            <Switch checked={draft.enabled} onChange={(event) => setDraft((prev) => ({ ...prev, enabled: event.target.checked }))} />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-[16px]">
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
            <Input value={draft.accessToken} onChange={(event) => setDraft((prev) => ({ ...prev, accessToken: event.target.value }))} placeholder="Zalo access token" />
          </div>
          <div className="flex flex-col gap-[6px]">
            <label className="text-[12px] font-bold uppercase tracking-wide text-muted">App secret</label>
            <Input value={draft.appSecret} onChange={(event) => setDraft((prev) => ({ ...prev, appSecret: event.target.value }))} placeholder="Zalo app secret" />
          </div>
          <div className="flex flex-col gap-[6px]">
            <label className="text-[12px] font-bold uppercase tracking-wide text-muted">Template yêu cầu thanh toán</label>
            <Input value={draft.paymentRequestTemplateCode} onChange={(event) => setDraft((prev) => ({ ...prev, paymentRequestTemplateCode: event.target.value }))} />
          </div>
          <div className="flex flex-col gap-[6px]">
            <label className="text-[12px] font-bold uppercase tracking-wide text-muted">Template xác nhận thanh toán</label>
            <Input value={draft.paymentConfirmationTemplateCode} onChange={(event) => setDraft((prev) => ({ ...prev, paymentConfirmationTemplateCode: event.target.value }))} />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-[16px] items-end">
          <div className="flex flex-col gap-[6px]">
            <label className="text-[12px] font-bold uppercase tracking-wide text-muted">Ghi chú vận hành</label>
            <Input value={draft.note} onChange={(event) => setDraft((prev) => ({ ...prev, note: event.target.value }))} />
          </div>
          <div className="flex items-center gap-[10px]">
            <div className="rounded-xl border border-border bg-background px-[12px] py-[10px] min-w-[280px]">
              <div className="text-[11px] font-bold uppercase tracking-wide text-muted">SePay webhook</div>
              <div className="mt-[4px] text-[12px] font-bold text-text break-all">{webhookHint}</div>
            </div>
            <Button type="button" variant="outline" onClick={copyHint} className="h-[42px]">
              <Copy size={14} className="mr-2" /> Copy
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-[12px]">
          <div className="rounded-2xl border border-border bg-background p-[16px] flex items-start gap-[12px]">
            <ShieldCheck size={18} className="text-[#8b5cf6] mt-[2px]" />
            <div>
              <div className="font-black text-text">Khách thuê</div>
              <div className="text-[13px] text-muted mt-[4px]">
                Zalo sẽ gửi theo số Zalo trong hồ sơ khách thuê hoặc theo số điện thoại/nhận diện tương ứng.
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-background p-[16px] flex items-start gap-[12px]">
            <Smartphone size={18} className="text-[#6366f1] mt-[2px]" />
            <div>
              <div className="font-black text-text">Luồng thanh toán</div>
              <div className="text-[13px] text-muted mt-[4px]">
                Gửi hóa đơn kèm QR, sau đó khi SePay xác nhận sẽ nhắn lại trạng thái đã nhận tiền.
              </div>
            </div>
          </div>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button type="button" onClick={() => save()} className="h-[44px] px-[24px] rounded-[12px] bg-primary text-white font-bold text-[14px] hover:bg-primary/90 transition-colors shadow-sm" isLoading={isSaving}>
          Lưu Zalo
        </Button>
      </div>
    </div>
  );
}
