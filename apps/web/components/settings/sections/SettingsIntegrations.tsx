"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth/auth-store";
import {
  ArrowRight,
  CircleOff,
  Database,
  Mail,
  MessageSquare,
  Plug,
  PlugZap,
  Radio,
  Search,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  WalletCards,
  Wifi,
  X,
  Zap,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import SettingsSePayIntegration from "./SettingsSePayIntegration";
import SettingsZaloIntegration from "./SettingsZaloIntegration";
import SettingsEmailIntegration from "./SettingsEmailIntegration";
import SettingsTelegramIntegration from "./SettingsTelegramIntegration";
import SettingsHunonicIntegration from "./SettingsHunonicIntegration";
import { useSettingsSectionQuery } from "@/lib/queries/settings.queries";

type IntegrationCategory = "all" | "payment" | "messaging" | "iot";

const categories: Array<{ id: IntegrationCategory; label: string; icon: React.ReactNode }> = [
  { id: "all", label: "Tất cả", icon: <Plug size={13} /> },
  { id: "payment", label: "Thanh toán", icon: <WalletCards size={13} /> },
  { id: "messaging", label: "Tin nhắn", icon: <MessageSquare size={13} /> },
  { id: "iot", label: "Điện & Smart IoT", icon: <Zap size={13} /> },
];

const panelMetadata = [
  { id: "sepay", category: "payment" as const, keywords: "sepay thanh toán qr webhook ngân hàng bank đối soát" },
  { id: "zalo", category: "messaging" as const, keywords: "zalo tin nhắn thông báo hóa đơn bot oa" },
  { id: "email", category: "messaging" as const, keywords: "email smtp thư điện tử thông báo mail" },
  { id: "telegram", category: "messaging" as const, keywords: "telegram bot nhóm vận hành cảnh báo chat" },
  { id: "hunonic", category: "iot" as const, keywords: "hunonic điện công tơ iot chỉ số" },
];

function hasSavedRecord(updatedAt?: string) {
  if (!updatedAt) return false;
  const timestamp = new Date(updatedAt).getTime();
  return Number.isFinite(timestamp) && timestamp > 0;
}

export default function SettingsIntegrations() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
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

  const userEmail = (user?.email || "").trim().toLowerCase();
  const normalizedQuery = useMemo(() => {
    const raw = query.trim().toLocaleLowerCase("vi-VN");
    if (userEmail && raw === userEmail) return "";
    return raw;
  }, [query, userEmail]);

  const visiblePanelIds = useMemo(() => {
    return new Set(
      panelMetadata
        .filter((panel) => {
          const matchesCategory = activeCategory === "all" || panel.category === activeCategory;
          const matchesSearch = !normalizedQuery || panel.keywords.includes(normalizedQuery);
          return matchesCategory && matchesSearch;
        })
        .map((panel) => panel.id),
    );
  }, [activeCategory, normalizedQuery]);

  const hasVisiblePanels = visiblePanelIds.size > 0;

  return (
    <div className="flex flex-col gap-3" data-testid="settings-integration-center">
      {/* Title & Counters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
        <div>
          <h2 className="text-base sm:text-lg font-black text-text flex items-center gap-2">
            <PlugZap size={18} className="text-primary" /> Trung tâm tích hợp
          </h2>
          <p className="text-xs text-muted mt-0.5">
            Đã lưu cấu hình{savedCount}/5 · Đang bật trong cấu hình{enabledCount}/5
          </p>
        </div>
      </div>

      {/* 4 Slim KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <Card className="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-3 shadow-2xs">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 shrink-0">
            <WalletCards size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-bold text-muted uppercase tracking-wider truncate">SePay Gateway</div>
            <div className={`font-mono font-black text-[15px] leading-tight ${hasSavedRecord(sepay.data?.updatedAt) ? "text-emerald-600" : "text-amber-600"}`}>
              {hasSavedRecord(sepay.data?.updatedAt) ? "Đã kết nối" : "Chưa kích hoạt"}
            </div>
            <div className="text-[10px] text-muted truncate mt-0.5">Tự động gạch nợ QR</div>
          </div>
        </Card>

        <Card className="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-3 shadow-2xs">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400 shrink-0">
            <MessageSquare size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-bold text-muted uppercase tracking-wider truncate">Zalo OA & ZNS</div>
            <div className={`font-mono font-black text-[15px] leading-tight ${hasSavedRecord(zalo.data?.updatedAt) ? "text-emerald-600" : "text-amber-600"}`}>
              {hasSavedRecord(zalo.data?.updatedAt) ? "Đã cấu hình" : "Chưa cấu hình"}
            </div>
            <div className="text-[10px] text-muted truncate mt-0.5">Gửi hóa đơn Zalo</div>
          </div>
        </Card>

        <Card className="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-3 shadow-2xs">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 shrink-0">
            <Mail size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-bold text-muted uppercase tracking-wider truncate">Email SMTP</div>
            <div className={`font-mono font-black text-[15px] leading-tight ${hasSavedRecord(email.data?.updatedAt) ? "text-emerald-600" : "text-amber-600"}`}>
              {hasSavedRecord(email.data?.updatedAt) ? "Đã cấu hình" : "Chưa cấu hình"}
            </div>
            <div className="text-[10px] text-muted truncate mt-0.5">Gửi thông báo & HĐĐT</div>
          </div>
        </Card>

        <Card className="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-3 shadow-2xs">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0">
            <Zap size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-bold text-muted uppercase tracking-wider truncate">Hunonic Smart IoT</div>
            <div className={`font-mono font-black text-[15px] leading-tight ${hasSavedRecord(hunonic.data?.updatedAt) ? "text-emerald-600" : "text-amber-600"}`}>
              {hasSavedRecord(hunonic.data?.updatedAt) ? "Đã kết nối" : "Chưa kích hoạt"}
            </div>
            <div className="text-[10px] text-muted truncate mt-0.5">Chốt chỉ số điện tự động</div>
          </div>
        </Card>
      </div>

      {/* Header & Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-border/70 bg-card p-3 md:p-3.5 shadow-2xs">
        {/* Category Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto" role="tablist">
          {categories.map((cat) => {
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveCategory(cat.id)}
                className={`flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-3 text-xs font-bold transition-all ${
                  isActive
                    ? "bg-primary text-white shadow-2xs"
                    : "text-muted hover:bg-muted/10 hover:text-text"
                }`}
              >
                {cat.icon}
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64 shrink-0">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
          <input
            type="search"
            aria-label="Tìm tích hợp"
            name="integration_search_query"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm cổng dịch vụ..."
            className="h-8 w-full rounded-xl border border-border/70 bg-background pl-8 pr-3 text-xs font-semibold text-text outline-none transition focus:border-primary"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-text"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Integrations Panels */}
      {!hasVisiblePanels ? (
        <div data-testid="integration-filter-empty" className="p-12 text-center text-xs font-medium text-muted rounded-xl border border-border/70 bg-card">
          Không tìm thấy dịch vụ tích hợp phù hợp với từ khóa &quot;{query}&quot;.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {visiblePanelIds.has("sepay") && <SettingsSePayIntegration />}
          {visiblePanelIds.has("zalo") && <SettingsZaloIntegration />}
          {visiblePanelIds.has("email") && <SettingsEmailIntegration />}
          {visiblePanelIds.has("telegram") && <SettingsTelegramIntegration />}
          {visiblePanelIds.has("hunonic") && hunonic.data && <SettingsHunonicIntegration />}
        </div>
      )}
    </div>
  );
}
