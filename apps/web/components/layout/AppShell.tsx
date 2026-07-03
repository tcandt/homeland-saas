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
      const checkScreenSize = () => {
        if (window.innerWidth <= 1440) {
          setIsSidebarCollapsed(true);
        } else {
          setIsSidebarCollapsed(false);
        }
      };

      // Initial check on load and path change
      checkScreenSize();

      // Setup resize listener
      window.addEventListener("resize", checkScreenSize);
      return () => window.removeEventListener("resize", checkScreenSize);
    }
  }, [pathname]);

  return (
    <div className="flex min-h-screen bg-background text-text">
      {/* Sidebar - hidden on mobile, block on md and up */}
      <div className={`hidden md:block fixed inset-y-0 left-0 z-20 ${isSidebarCollapsed ? "w-20" : "w-[260px]"} transition-all duration-300`}>
        <Sidebar collapsed={isSidebarCollapsed} />
      </div>

      {/* Main Content Area */}
      <main className={`flex-1 min-w-0 transition-all duration-300 ${isSidebarCollapsed ? "md:ml-20" : "md:ml-[260px]"} min-h-screen flex flex-col pt-[87px] md:pt-0 pb-[90px] md:pb-0`}>
        <Header onToggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)} />
        <div className={`md:p-[24px] ${pathname.startsWith("/buildings") || pathname.startsWith("/rooms") || pathname === "/" ? "p-0" : "px-[16px] py-[16px] md:px-[16px] md:py-[16px]"}`}>
          {children}
        </div>
      </main>

      <FloatingActionButton />
      <MobileBottomNav />
    </div>
  );
}
