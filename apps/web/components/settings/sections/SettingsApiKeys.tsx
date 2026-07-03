"use client";
import React from "react";
import { Button } from "@/components/ui/Button";
export default function SettingsApiKeys() {
  const keys = [
    { name: "Production API Key", key: "sk_live_**********************abc1", created: "01/06/2026", last: "Hôm nay", scope: "Full Access" },
    { name: "Webhook Secret", key: "whsec_*******************def2", created: "01/06/2026", last: "3 ngày trước", scope: "Events" },
    { name: "Mobile App Key", key: "pk_mobile_***************ghi3", created: "15/05/2026", last: "Tuần trước", scope: "Read Only" },
  ];
  return (
    <div className="flex flex-col gap-[20px]">
      <div className="bg-card border border-border rounded-[16px] p-[20px] shadow-sm flex flex-col gap-[16px]">
        <div className="flex items-center justify-between">
          <h3 className="font-black text-[15px] text-text">API Keys & Webhooks</h3>
          <Button className="h-[36px] px-[14px] rounded-[10px] bg-primary text-white font-bold text-[12px] hover:bg-primary/90 transition-colors">+ Tạo API Key</Button>
        </div>
        <div className="flex flex-col gap-[10px]">
          {keys.map((k, i) => (
            <div key={i} className="flex items-center gap-[14px] p-[14px] rounded-[10px] bg-background border border-border">
              <div className="flex-1 min-w-0">
                <div className="font-bold text-[13px] text-text">{k.name}</div>
                <div className="font-mono text-[11px] text-muted mt-[4px]">{k.key}</div>
              </div>
              <span className="text-[10px] font-bold text-primary bg-primary/10 px-[8px] py-[3px] rounded-full">{k.scope}</span>
              <span className="text-[11px] text-muted">Sử dụng: {k.last}</span>
              <Button className="h-[30px] px-[10px] rounded-[8px] bg-danger/10 text-danger font-bold text-[11px] hover:bg-danger/20 transition-colors">Thu hồi</Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
