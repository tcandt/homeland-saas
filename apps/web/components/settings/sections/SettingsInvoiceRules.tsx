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
  meterCutoffDay: "",
  invoiceIssueDay: "",
  paymentDueDays: "",
  gracePeriodDays: "",
  lateInterestRate: "",
  vatRate: "",
  roundingMode: "",
  billingCycle: "",
  defaultDiscount: "",
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
        <h3 className="border-b border-border pb-[12px] text-[15px] font-black text-text">Quy tắc hóa đơn</h3>

        <div className="grid grid-cols-2 gap-[14px]">
          {[
            { label: "Ngày chốt điện nước", key: "meterCutoffDay" },
            { label: "Ngày tạo hóa đơn", key: "invoiceIssueDay" },
            { label: "Hạn thanh toán", key: "paymentDueDays" },
            { label: "Thời gian gia hạn", key: "gracePeriodDays" },
            { label: "Lãi suất trễ hạn", key: "lateInterestRate" },
            { label: "Giảm giá mặc định", key: "defaultDiscount" },
          ].map((field) => (
            <div key={field.key} className="flex flex-col gap-[6px]">
              <label className="text-[12px] font-bold uppercase tracking-wide text-muted">{field.label}</label>
              <Input
                value={draft[field.key as keyof InvoiceRulesSettings]}
                onChange={(event) => setDraft((prev) => ({ ...prev, [field.key]: event.target.value }))}
              />
            </div>
          ))}

          <div className="flex flex-col gap-[6px]">
            <label className="text-[12px] font-bold uppercase tracking-wide text-muted">VAT</label>
            <Select
              value={draft.vatRate}
              onChange={(event) => setDraft((prev) => ({ ...prev, vatRate: event.target.value }))}
              options={[
                { label: "Chưa cấu hình", value: "" },
                { label: "0%", value: "0" },
                { label: "5%", value: "5" },
                { label: "8%", value: "8" },
                { label: "10%", value: "10" },
              ]}
            />
          </div>

          <div className="flex flex-col gap-[6px]">
            <label className="text-[12px] font-bold uppercase tracking-wide text-muted">Làm tròn tiền</label>
            <Select
              value={draft.roundingMode}
              onChange={(event) => setDraft((prev) => ({ ...prev, roundingMode: event.target.value }))}
              options={[
                { label: "Chưa cấu hình", value: "" },
                { label: "Không làm tròn", value: "none" },
                { label: "Làm tròn lên 1,000 VND", value: "up" },
                { label: "Làm tròn xuống 1,000 VND", value: "down" },
              ]}
            />
          </div>

          <div className="flex flex-col gap-[6px]">
            <label className="text-[12px] font-bold uppercase tracking-wide text-muted">Chu kỳ hóa đơn</label>
            <Select
              value={draft.billingCycle}
              onChange={(event) => setDraft((prev) => ({ ...prev, billingCycle: event.target.value }))}
              options={[
                { label: "Chưa cấu hình", value: "" },
                { label: "Hàng tháng", value: "monthly" },
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
