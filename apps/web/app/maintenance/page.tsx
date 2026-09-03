"use client";

import React, { useState } from "react";
import { MaintenanceScreen } from "@/components/settings/sections/SettingsLicense";

export default function MaintenancePage() {
  return (
    <main data-testid="maintenance-page-root" className="flex min-h-screen w-full items-center justify-center bg-slate-950 p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-4xl">
        <MaintenanceScreen isPreview={true} forcedTheme="dark" />
      </div>
    </main>
  );
}
