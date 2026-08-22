"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CircleOff, Database, PlugZap, Search, ShieldCheck } from "lucide-react";
import { Input } from "@/components/ui/Input";
import SettingsSePayIntegration from "./SettingsSePayIntegration";
import SettingsZaloIntegration from "./SettingsZaloIntegration";
import SettingsEmailIntegration from "./SettingsEmailIntegration";
import SettingsTelegramIntegration from "./SettingsTelegramIntegration";
import { useSettingsSectionQuery } from "@/lib/queries/settings.queries";

type IntegrationCategory = "all" | "payment" | "messaging" | "iot";

const categories: Array<{ id: IntegrationCategory; label: string }> = [
  { id: "all", label: "Tất cả" },
  { id: "payment", label: "Thanh toán" },
  { id: "messaging", label: "Tin nhắn" },
  { id: "iot", label: "Điện & IoT" },
];

const panelMetadata = [
  { id: "sepay", category: "payment" as const, keywords: "sepay thanh toán qr webhook ngân hàng" },
  { id: "zalo", category: "messaging" as const, keywords: "zalo tin nhắn thông báo hóa đơn" },
  { id: "email", category: "messaging" as const, keywords: "email smtp thư điện tử thông báo" },
  { id: "telegram", category: "messaging" as const, keywords: "telegram bot nhóm vận hành cảnh báo" },
  { id: "hunonic", category: "iot" as const, keywords: "hunonic điện công tơ iot chỉ số" },
];

function hasSavedRecord(updatedAt?: string) {
  if (!updatedAt) return false;
  const timestamp = new Date(updatedAt).getTime();
  return Number.isFinite(timestamp) && timestamp > 0;
}

export default function SettingsIntegrations() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<IntegrationCategory>("all");
  const sepay = useSettingsSectionQuery<Record<string, unknown>>("sepay", "TENANT");
  const zalo = useSettingsSectionQuery<Record<string, unknown>>("zalo-provider", "TENANT");
  const email = useSettingsSectionQuery<Record<string, unknown>>("email-provider", "TENANT");
  const telegram = useSettingsSectionQuery<Record<string, unknown>>("telegram-provider", "TENANT");
  const hunonic = useSettingsSectionQuery<Record<string, unknown>>("hunonic", "TENANT");
  const settingsQueries = [sepay, zalo, email, telegram, hunonic];
  const savedCount = settingsQueries.filter((item) => hasSavedRecord(item.data?.updatedAt)).length;
  const enabledCount = settingsQueries.filter((item) => item.data?.value?.enabled === true).length;
  const isHunonicSaved = hasSavedRecord(hunonic.data?.updatedAt);
  const normalizedQuery = query.trim().toLocaleLowerCase("vi-VN");
  const visiblePanelIds = useMemo(() => {
    return new Set(panelMetadata.filter((panel) => {
      const matchesCategory = activeCategory === "all" || panel.category === activeCategory;
      const matchesSearch = !normalizedQuery || panel.keywords.includes(normalizedQuery);
      return matchesCategory && matchesSearch;
    }).map((panel) => panel.id));
  }, [activeCategory, normalizedQuery]);
  const hasVisiblePanels = visiblePanelIds.size > 0;

  return (
    <div className="flex flex-col gap-[20px] p-0" data-testid="settings-integration-center">
      <div className="flex h-auto flex-col justify-between gap-[16px] border-b border-border pb-[16px] md:min-h-[64px] md:flex-row md:items-center md:pb-0">
        <div>
          <h2 className="text-[22px] font-black leading-none text-text">Trung tâm tích hợp</h2>
          <p className="text-[13px] font-medium text-muted mt-[6px]">
            Quản lý cấu hình thanh toán, thông báo và điện theo dữ liệu đã lưu của hệ thống.
          </p>
        </div>
        <div className="relative w-full shrink-0 md:w-[300px]">
          <Search size={14} className="absolute left-[12px] top-1/2 -translate-y-1/2 text-muted" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tìm SePay, Zalo, Email..."
            aria-label="Tìm tích hợp"
            className="h-[36px] w-full rounded-[8px] border border-border bg-background pl-[34px] pr-[12px] text-[13px] text-text placeholder-muted transition-colors focus:border-primary focus:outline-none"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-[12px] xl:grid-cols-4">
        <div className="flex h-[82px] flex-col justify-center rounded-[8px] border border-border bg-card p-[14px]">
          <div className="mb-[5px] flex items-center gap-[8px] text-muted">
            <PlugZap size={14} className="text-success" />
            <span className="text-[11px] font-bold">Đã lưu cấu hình</span>
          </div>
          <div className="text-[20px] font-black text-text">{savedCount}/5</div>
        </div>
        <div className="flex h-[82px] flex-col justify-center rounded-[8px] border border-border bg-card p-[14px]">
          <div className="mb-[5px] flex items-center gap-[8px] text-muted">
            <ShieldCheck size={14} className="text-primary" />
            <span className="text-[11px] font-bold">Đang bật trong cấu hình</span>
          </div>
          <div className="text-[20px] font-black text-text">{enabledCount}/5</div>
        </div>
        <div className="flex h-[82px] flex-col justify-center rounded-[8px] border border-border bg-card p-[14px]">
          <div className="mb-[5px] flex items-center gap-[8px] text-muted">
            <CircleOff size={14} className="text-warning" />
            <span className="text-[11px] font-bold">Chưa lưu cấu hình</span>
          </div>
          <div className="text-[20px] font-black text-text">{5 - savedCount}</div>
        </div>
        <div className="flex h-[82px] flex-col justify-center rounded-[8px] border border-border bg-card p-[14px]">
          <div className="mb-[5px] flex items-center gap-[8px] text-muted">
            <Database size={14} className="text-muted" />
            <span className="text-[11px] font-bold">Nguồn trạng thái</span>
          </div>
          <div className="text-[13px] font-black text-text">Cơ sở dữ liệu</div>
        </div>
      </div>

      <div className="flex items-center gap-[6px] overflow-x-auto border-b border-border pb-[10px]" role="tablist" aria-label="Nhóm tích hợp">
        {categories.map((category) => (
          <button
            key={category.id}
            type="button"
            role="tab"
            aria-selected={activeCategory === category.id}
            onClick={() => setActiveCategory(category.id)}
            className={`h-[34px] whitespace-nowrap rounded-[7px] px-[13px] text-[12px] font-bold transition-colors ${
              activeCategory === category.id ? "bg-primary text-white" : "bg-background text-muted hover:text-text"
            }`}
          >
            {category.label}
          </button>
        ))}
      </div>

      {visiblePanelIds.has("hunonic") && (
        <button
          type="button"
          onClick={() => router.replace("/settings?section=hunonic", { scroll: false })}
          className="group flex w-full items-center justify-between gap-[14px] rounded-[8px] border border-emerald-500/20 bg-card p-[16px] text-left shadow-sm transition hover:border-emerald-500/40 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
        >
          <span className="flex min-w-0 items-start gap-[12px]">
            <span className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-[8px] bg-emerald-500/10 text-emerald-600">
              <PlugZap size={19} />
            </span>
            <span className="min-w-0">
              <span className="flex flex-wrap items-center gap-[8px]">
                <span className="text-[15px] font-black text-text">Điện Hunonic</span>
                <span className={`rounded-[6px] px-[8px] py-[3px] text-[10px] font-black ${isHunonicSaved ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}>
                  {isHunonicSaved ? "ĐÃ LƯU CẤU HÌNH" : "CHƯA LƯU CẤU HÌNH"}
                </span>
              </span>
              <span className="mt-[4px] block text-[12px] font-medium leading-[18px] text-muted">
                Công tơ điện, giá điện, lịch sử chỉ số và đối soát theo phòng.
              </span>
            </span>
          </span>
          <span className="flex h-[34px] shrink-0 items-center gap-[6px] rounded-[7px] bg-emerald-500/10 px-[10px] text-[11px] font-black text-emerald-700 transition group-hover:bg-emerald-600 group-hover:text-white">
            Mở <ArrowRight size={14} />
          </span>
        </button>
      )}

      {(visiblePanelIds.has("sepay") || visiblePanelIds.has("zalo") || visiblePanelIds.has("email") || visiblePanelIds.has("telegram")) && (
        <div className="grid grid-cols-1 auto-rows-fr gap-[16px] xl:grid-cols-2 items-stretch">
          {visiblePanelIds.has("sepay") && <SettingsSePayIntegration />}
          {visiblePanelIds.has("zalo") && <SettingsZaloIntegration />}
          {visiblePanelIds.has("email") && <SettingsEmailIntegration />}
          {visiblePanelIds.has("telegram") && <SettingsTelegramIntegration />}
        </div>
      )}

      {!hasVisiblePanels && (
        <div className="rounded-[8px] border border-dashed border-border bg-card p-[28px] text-center" data-testid="integration-filter-empty">
          <CircleOff size={20} className="mx-auto text-muted" />
          <div className="mt-[9px] text-[13px] font-black text-text">Không tìm thấy tích hợp phù hợp</div>
          <div className="mt-[4px] text-[12px] font-medium text-muted">Thử từ khóa khác hoặc chọn nhóm “Tất cả”.</div>
        </div>
      )}

      <div className="rounded-[8px] border border-border bg-background px-[14px] py-[11px] text-[11px] font-medium leading-[17px] text-muted">
        Trạng thái trên trang chỉ phản ánh cấu hình đã lưu và cờ bật/tắt trong cơ sở dữ liệu, không thay thế kiểm tra kết nối trực tiếp với nhà cung cấp.
      </div>
    </div>
  );
}
