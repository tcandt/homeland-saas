"use client";

import React, { useState, useEffect } from "react";
import Sidebar from "./Sidebar";
import Header from "./Header";
import FloatingActionButton from "./FloatingActionButton";
import MobileBottomNav from "./MobileBottomNav";
import { usePathname } from "next/navigation";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window !== "undefined") {
      if (pathname.startsWith("/buildings")) {
        const syncBuildingsSidebar = () => setIsSidebarCollapsed(window.innerWidth < 1280);
        syncBuildingsSidebar();
        window.addEventListener("resize", syncBuildingsSidebar);
        return () => window.removeEventListener("resize", syncBuildingsSidebar);
      }
      const persisted = localStorage.getItem("homeland_main_sidebar_collapsed");
      if (persisted !== null) {
        setIsSidebarCollapsed(persisted === "true");
      } else {
        const checkScreenSize = () => {
          if (window.innerWidth <= 1440) {
            setIsSidebarCollapsed(true);
          } else {
            setIsSidebarCollapsed(false);
          }
        };
        checkScreenSize();
      }
    }
  }, [pathname]);

  const handleToggleSidebar = () => {
    const nextVal = !isSidebarCollapsed;
    setIsSidebarCollapsed(nextVal);
    if (typeof window !== "undefined") {
      localStorage.setItem("homeland_main_sidebar_collapsed", String(nextVal));
    }
  };


  return (
    <div className={`flex min-h-screen bg-background text-text ${pathname.startsWith("/buildings") ? "xl:h-dvh xl:overflow-hidden" : ""}`}>
      {/* Sidebar - hidden on mobile, block on md and up */}
      <div className={`hidden md:block fixed inset-y-0 left-0 z-20 ${isSidebarCollapsed ? "w-20" : "w-[260px]"} transition-all duration-300`}>
        <Sidebar collapsed={isSidebarCollapsed} />
      </div>

      {/* Main Content Area */}
      <main className={`flex-1 min-w-0 transition-all duration-300 ${isSidebarCollapsed ? "md:ml-20" : "md:ml-[260px]"} min-h-screen flex flex-col pt-[87px] md:pt-0 pb-[90px] md:pb-0 ${pathname.startsWith("/buildings") ? "xl:h-dvh xl:min-h-0 xl:overflow-hidden" : ""}`}>
        <Header onToggleSidebar={handleToggleSidebar} />
        <div className={pathname.startsWith("/buildings")
          ? "min-h-0 flex-1 p-0 xl:overflow-hidden"
          : `md:p-[24px] ${pathname.startsWith("/rooms") || pathname === "/" ? "p-0" : "px-[16px] py-[16px] md:px-[16px] md:py-[16px]"}`}>
          {children}
        </div>
      </main>

      <FloatingActionButton />
      <MobileBottomNav />
    </div>
  );
}
