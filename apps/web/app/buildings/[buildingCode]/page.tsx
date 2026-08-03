"use client";

import AppShell from "@/components/layout/AppShell";
import MobilePageShell from "@/components/layout/MobilePageShell";
import MasterDetailBuildings from "@/components/buildings/MasterDetailBuildings";

export default function BuildingCodePage() {
  return (
    <AppShell>
      <MobilePageShell>
        <div className="relative flex min-h-full w-full flex-col overflow-hidden md:h-full md:min-h-0">
          <MasterDetailBuildings />
        </div>
      </MobilePageShell>
    </AppShell>
  );
}
