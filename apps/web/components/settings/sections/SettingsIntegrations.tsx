"use client";

import React from "react";
import { Search, PlugZap, CloudOff, AlertCircle, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import SettingsSePayIntegration from "./SettingsSePayIntegration";
import SettingsZaloIntegration from "./SettingsZaloIntegration";
import SettingsEmailIntegration from "./SettingsEmailIntegration";
import SettingsTelegramIntegration from "./SettingsTelegramIntegration";
import { useSettingsSectionQuery } from "@/lib/queries/settings.queries";

const tabs = ["All", "Payment", "Messaging", "Cloud", "Accounting"];
const integrationKeys = ["sepay", "zalo-provider", "email-provider", "telegram-provider"];

function hasValue(value: unknown): boolean {
  if (!value) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).some((item) => {
      if (typeof item === "boolean") return item;
      if (Array.isArray(item)) return item.length > 0;
      return item !== "" && item !== null && item !== undefined;
    });
  }
  return value !== "";
}

export default function SettingsIntegrations() {
  const sepay = useSettingsSectionQuery<Record<string, unknown>>("sepay", "TENANT");
  const zalo = useSettingsSectionQuery<Record<string, unknown>>("zalo-provider", "TENANT");
  const email = useSettingsSectionQuery<Record<string, unknown>>("email-provider", "TENANT");
  const telegram = useSettingsSectionQuery<Record<string, unknown>>("telegram-provider", "TENANT");
  const configuredCount = [sepay, zalo, email, telegram].filter((query) => hasValue(query.data?.value)).length;

  return (
    <div className="flex flex-col gap-[20px] p-0">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-[16px] h-auto md:h-[64px] border-b border-border pb-[16px] md:pb-0">
        <div>
          <h2 className="text-[22px] font-bold text-text leading-none tracking-tight">Integration Center</h2>
          <p className="text-[13px] font-medium text-muted mt-[6px]">
            Quản lý tích hợp thanh toán và thông báo bằng dữ liệu lưu thật theo tenant.
          </p>
        </div>
        <div className="relative w-full md:w-[260px] shrink-0">
          <Search size={14} className="absolute left-[12px] top-1/2 -translate-y-1/2 text-muted" />
          <Input placeholder="Tìm tích hợp..." className="w-full h-[36px] pl-[34px] pr-[12px] bg-background border border-border rounded-[8px] text-[13px] text-text placeholder-muted focus:outline-none focus:border-primary transition-colors" />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-[16px]">
        <div className="h-[76px] bg-card border border-border rounded-[12px] p-[16px] flex flex-col justify-center">
          <div className="flex items-center gap-[8px] text-muted mb-[4px]">
            <PlugZap size={14} className="text-success" />
            <span className="text-[12px] font-bold uppercase tracking-wide">Configured</span>
          </div>
          <div className="text-[20px] font-black text-text">{configuredCount}</div>
        </div>
        <div className="h-[76px] bg-card border border-border rounded-[12px] p-[16px] flex flex-col justify-center">
          <div className="flex items-center gap-[8px] text-muted mb-[4px]">
            <CloudOff size={14} />
            <span className="text-[12px] font-bold uppercase tracking-wide">DB-backed</span>
          </div>
          <div className="text-[20px] font-black text-text">{integrationKeys.length}</div>
        </div>
        <div className="h-[76px] bg-card border border-border rounded-[12px] p-[16px] flex flex-col justify-center">
          <div className="flex items-center gap-[8px] text-muted mb-[4px]">
            <AlertCircle size={14} className="text-danger" />
            <span className="text-[12px] font-bold uppercase tracking-wide">Needs live keys</span>
          </div>
          <div className="text-[20px] font-black text-text">{integrationKeys.length - configuredCount}</div>
        </div>
        <div className="h-[76px] bg-card border border-border rounded-[12px] p-[16px] flex flex-col justify-center">
          <div className="flex items-center gap-[8px] text-muted mb-[4px]">
            <AlertTriangle size={14} className="text-warning" />
            <span className="text-[12px] font-bold uppercase tracking-wide">Public webhook</span>
          </div>
          <div className="text-[20px] font-black text-text">{hasValue(sepay.data?.value) ? 1 : 0}</div>
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
        Credentials are saved per tenant in the database.
      </div>
    </div>
  );
}
