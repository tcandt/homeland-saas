"use client";

import React, { useTransition, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import SettingsSidebar from "@/components/settings/SettingsSidebar";
import SettingsOverview from "@/components/settings/sections/SettingsOverview";
import SettingsProfile from "@/components/settings/sections/SettingsProfile";
import SettingsSecurity from "@/components/settings/sections/SettingsSecurity";
import SettingsTeam from "@/components/settings/sections/SettingsTeam";
import SettingsNotificationAutomation from "@/components/settings/sections/SettingsNotificationAutomation";
import SettingsAccounting from "@/components/settings/sections/SettingsAccounting";
import SettingsTemplates from "@/components/settings/sections/SettingsTemplates";
import SettingsIntegrations from "@/components/settings/sections/SettingsIntegrations";
import SettingsHunonicIntegration from "@/components/settings/sections/SettingsHunonicIntegration";
import SettingsOwnerManagement from "@/components/settings/sections/SettingsOwnerManagement";
import SettingsBackup from "@/components/settings/sections/SettingsBackup";

export type SettingsSection =
  | "overview"
  | "profile" | "security" | "team"
  | "notifications"
  | "accounting" | "templates" | "integrations" | "owners" | "hunonic" | "backup";

const mobileSectionOptions: Array<{ value: SettingsSection; label: string }> = [
  { value: "overview", label: "Overview & Status" },
  { value: "profile", label: "My Profile" },
  { value: "security", label: "Account Security" },
  { value: "team", label: "Team & Roles" },
  { value: "notifications", label: "Notification Automation" },
  { value: "accounting", label: "Accounting Config" },
  { value: "templates", label: "Templates" },
  { value: "integrations", label: "Integration Center" },
  { value: "owners", label: "Owner Management" },
  { value: "hunonic", label: "Hunonic Electricity" },
  { value: "backup", label: "Data & Backup" },
];

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState<SettingsSection>("overview");
  const [isPending, startTransition] = useTransition();

  const changeSection = (section: SettingsSection) => {
    startTransition(() => setActiveSection(section));
  };

  const renderContent = () => {
    switch (activeSection) {
      case "overview": return <SettingsOverview />;
      case "profile": return <SettingsProfile />;
      case "security": return <SettingsSecurity />;
      case "team": return <SettingsTeam />;
      case "notifications": return <SettingsNotificationAutomation />;
      case "accounting": return <SettingsAccounting />;
      case "templates": return <SettingsTemplates />;
      case "integrations": return <SettingsIntegrations />;
      case "owners": return <SettingsOwnerManagement />;
      case "hunonic": return <SettingsHunonicIntegration />;
      case "backup": return <SettingsBackup />;
      default: return <SettingsOverview />;
    }
  };

  return (
    <AppShell>
      <div className="flex flex-col gap-[24px] w-full max-w-none px-[16px] sm:px-[24px] lg:px-[32px] pb-[120px] sm:pb-[96px] animate-in fade-in duration-300">

        <div className="lg:hidden flex flex-col gap-[10px] rounded-[16px] border border-border bg-card p-[14px] shadow-sm">
          <span className="text-[10px] font-black uppercase tracking-[0.16em] text-muted">Settings section</span>
          <select
            value={activeSection}
            onChange={(e) => changeSection(e.target.value as SettingsSection)}
            className="h-[44px] w-full rounded-[12px] border border-border bg-background px-[12px] text-[14px] font-bold text-text outline-none"
          >
            {mobileSectionOptions.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>

        {/* Two-Column Layout: Sidebar + Content */}
        <div className="flex flex-col lg:flex-row gap-[16px] lg:gap-[24px] items-stretch lg:items-start">
          <div className={`flex-1 min-w-0 flex flex-col gap-[24px] transition-all duration-200 ease-out ${isPending ? "opacity-70 translate-y-[1px]" : "opacity-100 translate-y-0"}`}>
            {renderContent()}
          </div>
          <div className="hidden lg:block">
            <SettingsSidebar activeSection={activeSection} onSelect={changeSection} />
          </div>
        </div>

      </div>
    </AppShell>
  );
}
