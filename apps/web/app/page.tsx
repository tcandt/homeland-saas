"use client";

import React, { useEffect, useState } from "react";
import { Loader2, RefreshCcw } from "lucide-react";
import { dashboardAdapter } from "@/lib/api/dashboard.adapter";
import { DashboardDataContext } from "./dashboard-context";
import AppShell from "@/components/layout/AppShell";
import HeroSummary from "@/components/dashboard/HeroSummary";
import KpiGrid from "@/components/dashboard/KpiGrid";
import BuildingHealth from "@/components/dashboard/BuildingHealth";
import RevenueChart from "@/components/dashboard/RevenueChart";
import RoomStatus from "@/components/dashboard/RoomStatus";
import RecentActivity from "@/components/dashboard/RecentActivity";
import ForecastPanel from "@/components/dashboard/ForecastPanel";
import TaskToday from "@/components/dashboard/TaskToday";
import MobileActionList from "@/components/dashboard/MobileActionList";
import MobilePageShell from "@/components/layout/MobilePageShell";
import { usePermissions } from "@/hooks/usePermissions";
import { useRouter } from "next/navigation";

import { useDashboardQuery } from "@/lib/queries/dashboard.queries";

export default function Dashboard() {
  const { hasPermission } = usePermissions();
  const router = useRouter();

  const { data, isLoading, isError, error: queryError, refetch } = useDashboardQuery();

  if (!hasPermission('dashboard.read')) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)] gap-4">
          <div className="text-rose-500 font-medium">Bạn không có quyền truy cập Dashboard.</div>
        </div>
      </AppShell>
    );
  }

  if (isLoading) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)] gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-[#4f46e5]" />
          <div className="text-muted font-medium">Đang tải dữ liệu tổng quan...</div>
        </div>
      </AppShell>
    );
  }

  if (isError || !data) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)] gap-4">
          <div className="text-rose-500 font-medium">Không thể tải dữ liệu Dashboard. Vui lòng thử lại.</div>
          <button onClick={() => refetch()} className="flex items-center gap-2 bg-[#4f46e5] text-white px-4 py-2 rounded-lg font-bold hover:bg-[#4338ca]">
            <RefreshCcw size={16} /> Thử lại
          </button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <DashboardDataContext.Provider value={data as any}>
      <MobilePageShell>
        <div data-testid="dashboard-root" className="w-full flex flex-col gap-[16px] md:gap-[20px] pb-[0px] md:pb-[30px] lg:pb-[40px]">

        <HeroSummary />

        <div className="md:hidden mt-1">
          <MobileActionList />
        </div>

        <KpiGrid />

        <div className="grid grid-cols-1 xl:grid-cols-[2.5fr_1fr] gap-[16px] md:gap-[20px]">
          <div className="flex flex-col gap-[16px] md:gap-[20px]">
            <RevenueChart />
            <BuildingHealth />
            <RoomStatus />
          </div>
          
          <div className="flex flex-col gap-[16px] md:gap-[20px]">
            <TaskToday />
            <RecentActivity />
            <ForecastPanel />
          </div>
        </div>

        </div>
      </MobilePageShell>
      </DashboardDataContext.Provider>
    </AppShell>
  );
}
