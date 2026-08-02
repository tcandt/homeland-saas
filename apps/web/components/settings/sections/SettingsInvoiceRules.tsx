"use client";

import React from "react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useSettingsSection } from "@/lib/hooks/useSettingsSection";

type InvoiceRulesSettings = {
  meterCutoffDay: string;
  invoiceIssueDay: string;
  paymentDueDays: string;
  gracePeriodDays: string;
  lateInterestRate: string;
  vatRate: string;
  roundingMode: string;
  billingCycle: string;
  defaultDiscount: string;
};

const fallback: InvoiceRulesSettings = {
  meterCutoffDay: "25",
  invoiceIssueDay: "1",
  paymentDueDays: "10",
  gracePeriodDays: "3",
  lateInterestRate: "0.05",
  vatRate: "0",
  roundingMode: "none",
  billingCycle: "monthly",
  defaultDiscount: "0",
};

export default function SettingsInvoiceRules() {
  const { draft, setDraft, isSaving, save } = useSettingsSection<InvoiceRulesSettings>("invoice-rules", "TENANT", fallback);

  return (
    <form
      className="flex flex-col gap-[20px]"
      onSubmit={async (event) => {
        event.preventDefault();
        await save();
      }}
    >
      <Card className="p-[20px] flex flex-col gap-[16px]">
        <h3 className="font-black text-[15px] text-text border-b border-border pb-[12px]">Invoice Rules</h3>
        <div className="grid grid-cols-2 gap-[14px]">
          {[
            { label: "Ngày chốt điện nước (ngày/tháng)", key: "meterCutoffDay" },
            { label: "Ngày tạo hóa đơn", key: "invoiceIssueDay" },
            { label: "Hạn thanh toán (ngày sau tạo HĐ)", key: "paymentDueDays" },
            { label: "Grace Period (ngày gia hạn)", key: "gracePeriodDays" },
            { label: "Lãi suất trễ hạn", key: "lateInterestRate" },
            { label: "Giảm giá mặc định", key: "defaultDiscount" },
          ].map((field) => (
            <div key={field.key} className="flex flex-col gap-[6px]">
              <label className="text-[12px] font-bold text-muted uppercase tracking-wide">{field.label}</label>
              <Input value={draft[field.key as keyof InvoiceRulesSettings]} onChange={(event) => setDraft((prev) => ({ ...prev, [field.key]: event.target.value }))} />
            </div>
          ))}
          <div className="flex flex-col gap-[6px]">
            <label className="text-[12px] font-bold text-muted uppercase tracking-wide">VAT</label>
            <Select
              value={draft.vatRate}
              onChange={(event) => setDraft((prev) => ({ ...prev, vatRate: event.target.value }))}
              options={[
                { label: "Không áp dụng (0%)", value: "0" },
                { label: "5%", value: "5" },
                { label: "8%", value: "8" },
                { label: "10%", value: "10" },
              ]}
            />
          </div>
          <div className="flex flex-col gap-[6px]">
            <label className="text-[12px] font-bold text-muted uppercase tracking-wide">Làm tròn tiền</label>
            <Select
              value={draft.roundingMode}
              onChange={(event) => setDraft((prev) => ({ ...prev, roundingMode: event.target.value }))}
              options={[
                { label: "Không làm tròn", value: "none" },
                { label: "Làm tròn lên 1,000 VNĐ", value: "up" },
                { label: "Làm tròn xuống 1,000 VNĐ", value: "down" },
              ]}
            />
          </div>
          <div className="flex flex-col gap-[6px]">
            <label className="text-[12px] font-bold text-muted uppercase tracking-wide">Hóa đơn định kỳ</label>
            <Select
              value={draft.billingCycle}
              onChange={(event) => setDraft((prev) => ({ ...prev, billingCycle: event.target.value }))}
              options={[
                { label: "Hàng tháng (mặc định)", value: "monthly" },
                { label: "Hàng quý", value: "quarterly" },
                { label: "6 tháng", value: "semi" },
                { label: "Hàng năm", value: "yearly" },
              ]}
            />
          </div>
        </div>
        <div className="flex justify-end border-t border-border pt-[16px]">
          <Button type="submit" variant="primary" isLoading={isSaving}>
            Lưu quy tắc hóa đơn
          </Button>
        </div>
      </Card>
    </form>
  );
}
