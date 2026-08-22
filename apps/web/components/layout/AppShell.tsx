"use client";

import React, { useState, useEffect } from "react";
import Sidebar from "./Sidebar";
import Header from "./Header";
import MobileBottomNav from "./MobileBottomNav";
import LoginVersionUpdateNotice from "./LoginVersionUpdateNotice";
import { MaintenanceScreen } from "@/components/settings/sections/SettingsLicense";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/lib/auth/auth-store";
import { useSettingsSectionQuery } from "@/lib/queries/settings.queries";

const SMALL_DESKTOP_COLLAPSE_WIDTH = 1536;
const BUILDINGS_COLLAPSE_WIDTH = 1280;

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);
  const accessToken = useAuthStore((state) => state.accessToken);
  const canBypassMaintenance = Boolean(user?.roles?.includes("ADMIN") || user?.permissions?.includes("setting.update"));
  const accessControl = useSettingsSectionQuery<{ maintenanceEnabled?: boolean }>("access-control", "TENANT", Boolean(accessToken));
  const isRuntimeMaintenance = Boolean(accessControl.data?.value?.maintenanceEnabled);

  useEffect(() => {
    if (typeof window !== "undefined") {
      if (pathname.startsWith("/buildings")) {
        const syncBuildingsSidebar = () => setIsSidebarCollapsed(window.innerWidth <= BUILDINGS_COLLAPSE_WIDTH);
        syncBuildingsSidebar();
        window.addEventListener("resize", syncBuildingsSidebar);
        return () => window.removeEventListener("resize", syncBuildingsSidebar);
      }

      const syncSidebar = () => {
        if (window.innerWidth <= SMALL_DESKTOP_COLLAPSE_WIDTH) {
          setIsSidebarCollapsed(true);
          return;
        }

        const persisted = localStorage.getItem("homeland_main_sidebar_collapsed");
        setIsSidebarCollapsed(persisted !== null ? persisted === "true" : false);
      };

      syncSidebar();
      window.addEventListener("resize", syncSidebar);
      return () => window.removeEventListener("resize", syncSidebar);
    }
  }, [pathname]);

  const handleToggleSidebar = () => {
    const nextVal = !isSidebarCollapsed;
    setIsSidebarCollapsed(nextVal);
    if (typeof window !== "undefined") {
      localStorage.setItem("homeland_main_sidebar_collapsed", String(nextVal));
    }
  };

  if (isRuntimeMaintenance && !canBypassMaintenance && pathname !== "/maintenance") {
    return (
      <main className="flex min-h-screen w-full items-center justify-center bg-slate-950 p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-6xl">
          <MaintenanceScreen isPreview={false} />
        </div>
      </main>
    );
  }

  return (
    <div className="flex min-h-screen bg-background text-text">
      {/* Sidebar - hidden on mobile, block on md and up */}
      <div className={`hidden md:block fixed inset-y-0 left-0 z-20 ${isSidebarCollapsed ? "w-20" : "w-[260px]"} transition-all duration-300`}>
        <Sidebar collapsed={isSidebarCollapsed} />
      </div>

      {/* Main Content Area */}
      <main className={`flex-1 min-w-0 transition-all duration-300 ${isSidebarCollapsed ? "md:ml-20" : "md:ml-[260px]"} min-h-screen flex flex-col pt-[87px] md:pt-0 pb-[90px] md:pb-0`}>
        <Header onToggleSidebar={handleToggleSidebar} />
        <LoginVersionUpdateNotice />
        <div className={pathname.startsWith("/buildings")
          ? "flex-1 p-0"
          : `md:p-[24px] ${pathname.startsWith("/rooms") || pathname === "/" ? "p-0" : "px-[16px] py-[16px] md:px-[16px] md:py-[16px]"}`}>
          {children}
        </div>
      </main>

      <MobileBottomNav />
    </div>
  );
}
