"use client";

import React, { useState } from "react";
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

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState<SettingsSection>("overview");

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
      <div className="flex flex-col gap-[24px] w-full max-w-none px-[32px] pb-[80px] animate-in fade-in duration-300">

        {/* Two-Column Layout: Sidebar + Content */}
        <div className="flex gap-[24px] items-start">
          <SettingsSidebar activeSection={activeSection} onSelect={setActiveSection} />
          <div className="flex-1 min-w-0 flex flex-col gap-[24px]">
            {renderContent()}
          </div>
        </div>

      </div>
    </AppShell>
  );
}
