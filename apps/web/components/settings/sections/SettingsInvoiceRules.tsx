"use client";
import React from "react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

function Field({ label, value, suffix = "" }: any) {
  return (
    <div className="flex flex-col gap-[6px]">
      <label className="text-[12px] font-bold text-muted uppercase tracking-wide">{label}</label>
      <div className="relative">
        <Input defaultValue={value} className={suffix ? "pr-[40px]" : ""} />
        {suffix && <span className="absolute right-[12px] top-1/2 -translate-y-1/2 text-[12px] font-bold text-muted">{suffix}</span>}
      </div>
    </div>
  );
}
export default function SettingsInvoiceRules() {
  return (
    <div className="flex flex-col gap-[20px]">
      <Card className="p-[20px] flex flex-col gap-[16px]">
        <h3 className="font-black text-[15px] text-text border-b border-border pb-[12px]">Invoice Rules</h3>
        <div className="grid grid-cols-2 gap-[14px]">
          <Field label="Ngày chốt điện nước (ngày/tháng)" value="25" />
          <Field label="Ngày tạo hóa đơn" value="1" />
          <Field label="Hạn thanh toán (ngày sau tạo HĐ)" value="10" suffix="ngày" />
          <Field label="Grace Period (ngày gia hạn)" value="3" suffix="ngày" />
          <Field label="Lãi suất trễ hạn" value="0.05" suffix="%/ngày" />
          <div className="flex flex-col gap-[6px]">
            <label className="text-[12px] font-bold text-muted uppercase tracking-wide">VAT</label>
            <Select options={[
              {label: "Không áp dụng (0%)", value: "0"},
              {label: "5%", value: "5"},
              {label: "8%", value: "8"},
              {label: "10%", value: "10"}
            ]} defaultValue="0" />
          </div>
          <div className="flex flex-col gap-[6px]">
            <label className="text-[12px] font-bold text-muted uppercase tracking-wide">Làm tròn tiền</label>
            <Select options={[
              {label: "Không làm tròn", value: "none"},
              {label: "Làm tròn lên 1,000 VNĐ", value: "up"},
              {label: "Làm tròn xuống 1,000 VNĐ", value: "down"}
            ]} defaultValue="none" />
          </div>
          <div className="flex flex-col gap-[6px]">
            <label className="text-[12px] font-bold text-muted uppercase tracking-wide">Hóa đơn định kỳ</label>
            <Select options={[
              {label: "Hàng tháng (mặc định)", value: "monthly"},
              {label: "Hàng quý", value: "quarterly"},
              {label: "6 tháng", value: "semi"},
              {label: "Hàng năm", value: "yearly"}
            ]} defaultValue="monthly" />
          </div>
          <Field label="Giảm giá mặc định" value="0" suffix="%" />
        </div>
        <div className="flex justify-end border-t border-border pt-[16px]">
          <Button variant="primary">Lưu quy tắc hóa đơn</Button>
        </div>
      </Card>
    </div>
  );
}
