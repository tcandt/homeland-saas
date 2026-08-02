"use client";

import React, { useTransition, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import SettingsSidebar from "@/components/settings/SettingsSidebar";
import SettingsOverview from "@/components/settings/sections/SettingsOverview";
import SettingsBusinessProfile from "@/components/settings/sections/SettingsBusinessProfile";
import SettingsAppearance from "@/components/settings/sections/SettingsAppearance";
import SettingsProfile from "@/components/settings/sections/SettingsProfile";
import SettingsSecurity from "@/components/settings/sections/SettingsSecurity";
import SettingsTeam from "@/components/settings/sections/SettingsTeam";
import SettingsPricing from "@/components/settings/sections/SettingsPricing";
import SettingsContractRules from "@/components/settings/sections/SettingsContractRules";
import SettingsInvoiceRules from "@/components/settings/sections/SettingsInvoiceRules";
import SettingsNotificationAutomation from "@/components/settings/sections/SettingsNotificationAutomation";
import SettingsAccounting from "@/components/settings/sections/SettingsAccounting";
import SettingsTemplates from "@/components/settings/sections/SettingsTemplates";
import SettingsIntegrations from "@/components/settings/sections/SettingsIntegrations";
import SettingsBackup from "@/components/settings/sections/SettingsBackup";
import { Save, Download, Clock, Database } from "lucide-react";

export type SettingsSection =
  | "overview" | "business" | "appearance"
  | "profile" | "security" | "team"
  | "pricing" | "contracts" | "invoices"
  | "notifications"
  | "accounting" | "templates" | "integrations" | "backup";

const mobileSectionOptions: Array<{ value: SettingsSection; label: string }> = [
  { value: "overview", label: "Overview & Status" },
  { value: "business", label: "Business Profile" },
  { value: "appearance", label: "Appearance & Locale" },
  { value: "profile", label: "My Profile" },
  { value: "security", label: "Account Security" },
  { value: "team", label: "Team & Roles" },
  { value: "pricing", label: "Pricing & Fees" },
  { value: "contracts", label: "Contract Rules" },
  { value: "invoices", label: "Invoice Rules" },
  { value: "notifications", label: "Notification Automation" },
  { value: "accounting", label: "Accounting Config" },
  { value: "templates", label: "Templates" },
  { value: "integrations", label: "Integration Center" },
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
      case "business": return <SettingsBusinessProfile />;
      case "appearance": return <SettingsAppearance />;
      case "profile": return <SettingsProfile />;
      case "security": return <SettingsSecurity />;
      case "team": return <SettingsTeam />;
      case "pricing": return <SettingsPricing />;
      case "contracts": return <SettingsContractRules />;
      case "invoices": return <SettingsInvoiceRules />;
      case "notifications": return <SettingsNotificationAutomation />;
      case "accounting": return <SettingsAccounting />;
      case "templates": return <SettingsTemplates />;
      case "integrations": return <SettingsIntegrations />;
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
