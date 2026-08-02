"use client";

import React from "react";
import AppShell from "@/components/layout/AppShell";
import SettingsProfile from "@/components/settings/sections/SettingsProfile";

export default function ProfileSettingsRoute() {
  return (
    <AppShell>
      <div className="w-full max-w-none px-[16px] sm:px-[24px] lg:px-[32px] pb-[120px] sm:pb-[96px] animate-in fade-in duration-300">
        <SettingsProfile />
      </div>
    </AppShell>
  );
}
