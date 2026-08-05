"use client";

import React from "react";
import { Button } from "@/components/ui/Button";
import { CreditCard } from "lucide-react";

export default function SettingsLicense() {
  return (
    <div className="flex flex-col gap-[20px]">
      <div className="bg-card border border-border rounded-[16px] p-[20px] shadow-sm flex flex-col gap-[20px]">
        <h3 className="font-black text-[15px] text-text border-b border-border pb-[12px]">License & Billing</h3>
        <div className="rounded-[14px] border border-dashed border-border bg-background p-[28px] text-center">
          <CreditCard size={22} className="mx-auto text-muted" />
          <div className="mt-[10px] font-black text-text">Chưa có dữ liệu license trong DB</div>
          <div className="mt-[6px] text-[13px] font-medium text-muted">
            Gói dịch vụ, hạn sử dụng, quota tòa nhà/phòng/người dùng sẽ hiển thị khi billing API được kết nối.
          </div>
        </div>
        <div className="flex justify-end">
          <Button className="h-[40px] px-[20px] rounded-[10px] bg-primary text-white font-bold text-[13px] hover:bg-primary/90 transition-colors" disabled>
            Nâng cấp gói
          </Button>
        </div>
      </div>
    </div>
  );
}
