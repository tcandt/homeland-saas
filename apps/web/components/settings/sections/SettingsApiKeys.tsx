"use client";

import React from "react";
import { Button } from "@/components/ui/Button";

export default function SettingsApiKeys() {
  return (
    <div className="flex flex-col gap-[20px]">
      <div className="bg-card border border-border rounded-[16px] p-[20px] shadow-sm flex flex-col gap-[16px]">
        <div className="flex items-center justify-between">
          <h3 className="font-black text-[15px] text-text">API Keys & Webhooks</h3>
          <Button className="h-[36px] px-[14px] rounded-[10px] bg-primary text-white font-bold text-[12px] hover:bg-primary/90 transition-colors">+ Tạo API Key</Button>
        </div>
        <div className="rounded-[12px] border border-dashed border-border bg-background p-[20px] text-center text-muted font-medium">
          Chưa có API key nào được tạo.
        </div>
      </div>
    </div>
  );
}
