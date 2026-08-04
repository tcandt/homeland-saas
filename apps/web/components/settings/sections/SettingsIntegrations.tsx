"use client";

import React from "react";
import { Search, PlugZap, CloudOff, AlertCircle, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import SettingsSePayIntegration from "./SettingsSePayIntegration";
import SettingsZaloIntegration from "./SettingsZaloIntegration";
import SettingsEmailIntegration from "./SettingsEmailIntegration";
import SettingsTelegramIntegration from "./SettingsTelegramIntegration";

const tabs = ["All", "Payment", "Messaging", "Cloud", "Accounting"];

export default function SettingsIntegrations() {
  return (
    <div className="flex flex-col gap-[20px] p-0">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-[16px] h-auto md:h-[64px] border-b border-border pb-[16px] md:pb-0">
        <div>
          <h2 className="text-[22px] font-bold text-text leading-none tracking-tight">Integration Center</h2>
          <p className="text-[13px] font-medium text-muted mt-[6px]">
            Quan ly cac tich hop thanh toan va thong bao. Key va token duoc luu theo tenant trong DB, khong can sua env khi thay doi cau hinh.
          </p>
        </div>
        <div className="relative w-full md:w-[260px] shrink-0">
          <Search size={14} className="absolute left-[12px] top-1/2 -translate-y-1/2 text-muted" />
          <Input placeholder="Tim tich hop..." className="w-full h-[36px] pl-[34px] pr-[12px] bg-background border border-border rounded-[8px] text-[13px] text-text placeholder-muted focus:outline-none focus:border-primary transition-colors" />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-[16px]">
        <div className="h-[76px] bg-card border border-border rounded-[12px] p-[16px] flex flex-col justify-center">
          <div className="flex items-center gap-[8px] text-muted mb-[4px]">
            <PlugZap size={14} className="text-success" />
            <span className="text-[12px] font-bold uppercase tracking-wide">Configured</span>
          </div>
          <div className="text-[20px] font-black text-text">4</div>
        </div>
        <div className="h-[76px] bg-card border border-border rounded-[12px] p-[16px] flex flex-col justify-center">
          <div className="flex items-center gap-[8px] text-muted mb-[4px]">
            <CloudOff size={14} />
            <span className="text-[12px] font-bold uppercase tracking-wide">DB-backed</span>
          </div>
          <div className="text-[20px] font-black text-text">4</div>
        </div>
        <div className="h-[76px] bg-card border border-border rounded-[12px] p-[16px] flex flex-col justify-center">
          <div className="flex items-center gap-[8px] text-muted mb-[4px]">
            <AlertCircle size={14} className="text-danger" />
            <span className="text-[12px] font-bold uppercase tracking-wide">Needs live keys</span>
          </div>
          <div className="text-[20px] font-black text-text">3</div>
        </div>
        <div className="h-[76px] bg-card border border-border rounded-[12px] p-[16px] flex flex-col justify-center">
          <div className="flex items-center gap-[8px] text-muted mb-[4px]">
            <AlertTriangle size={14} className="text-warning" />
            <span className="text-[12px] font-bold uppercase tracking-wide">Public webhook</span>
          </div>
          <div className="text-[20px] font-black text-text">1</div>
        </div>
      </div>

      <div className="flex items-center gap-[8px] overflow-x-auto pb-[4px]">
        {tabs.map((tab) => (
          <Button key={tab} variant="outline" className="h-[36px] px-[16px] rounded-full text-[13px] font-bold whitespace-nowrap bg-background border border-border text-muted hover:bg-black/5 dark:hover:bg-card/5 hover:text-text">
            {tab}
          </Button>
        ))}
      </div>

      <SettingsSePayIntegration />
      <SettingsZaloIntegration />
      <SettingsEmailIntegration />
      <SettingsTelegramIntegration />

      <div className="bg-card border border-dashed border-border rounded-[16px] p-[24px] text-center text-muted font-medium">
        Credentials are saved per tenant in the database. Rotate keys here without changing deployment environment variables.
      </div>
    </div>
  );
}
