"use client";
import React from "react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

function Field({ label, value, type = "text", suffix = "" }: any) {
  return (
    <div className="flex flex-col gap-[6px]">
      <label className="text-[12px] font-bold text-muted uppercase tracking-wide">{label}</label>
      <div className="relative">
        <Input type={type} defaultValue={value} className={suffix ? "pr-[40px]" : ""} />
        {suffix && <span className="absolute right-[12px] top-1/2 -translate-y-1/2 text-[12px] font-bold text-muted">{suffix}</span>}
      </div>
    </div>
  );
}
export default function SettingsContractRules() {
  return (
    <div className="flex flex-col gap-[20px]">
      <Card className="p-[20px] flex flex-col gap-[16px]">
        <h3 className="font-black text-[15px] text-text border-b border-border pb-[12px]">Contract Rules</h3>
        <div className="grid grid-cols-2 gap-[14px]">
          <Field label="Thời hạn hợp đồng mặc định (tháng)" value="12" />
          <Field label="Nhắc gia hạn trước (ngày)" value="30" />
          <Field label="Notice Days (báo trước khi kết thúc)" value="60" />
          <Field label="Phí phạt vi phạm" value="2,000,000" suffix="VNĐ" />
          <div className="flex flex-col gap-[6px]">
            <label className="text-[12px] font-bold text-muted uppercase tracking-wide">Quy tắc đặt cọc mặc định</label>
            <Select options={[
              {label: "2 tháng tiền phòng", value: "2"},
              {label: "1 tháng tiền phòng", value: "1"},
              {label: "3 tháng tiền phòng", value: "3"},
              {label: "Theo thỏa thuận", value: "custom"}
            ]} defaultValue="2" />
          </div>
          <div className="flex flex-col gap-[6px]">
            <label className="text-[12px] font-bold text-muted uppercase tracking-wide">Ký kết hợp đồng</label>
            <Select options={[
              {label: "Ký tay + Scan", value: "manual"},
              {label: "Chữ ký điện tử", value: "esing"},
              {label: "Bắt buộc 2 bản", value: "2copies"}
            ]} defaultValue="manual" />
          </div>
          <div className="col-span-2 flex flex-col gap-[6px]">
            <label className="text-[12px] font-bold text-muted uppercase tracking-wide">Điều khoản phạt hủy hợp đồng sớm</label>
            <Textarea rows={3} defaultValue="Trong trường hợp bên thuê chấm dứt hợp đồng trước thời hạn, bên thuê phải thông báo trước 60 ngày và chịu phí phạt bằng 2 tháng tiền phòng." />
          </div>
        </div>
        <div className="flex justify-end border-t border-border pt-[16px]">
          <Button variant="primary">Lưu quy tắc</Button>
        </div>
      </Card>
    </div>
  );
}
