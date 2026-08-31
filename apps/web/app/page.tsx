"use client";

import React from "react";
import dynamic from "next/dynamic";
import { Loader2, RefreshCcw } from "lucide-react";
import { DashboardDataContext } from "./dashboard-context";
import AppShell from "@/components/layout/AppShell";
import HeroSummary from "@/components/dashboard/HeroSummary";
import KpiGrid from "@/components/dashboard/KpiGrid";
import MobilePageShell from "@/components/layout/MobilePageShell";
import { usePermissions } from "@/hooks/usePermissions";
import { useDashboardQuery } from "@/lib/queries/dashboard.queries";

const MobileActionList = dynamic(() => import("@/components/dashboard/MobileActionList"), {
  loading: () => <PanelSkeleton className="h-[180px] md:hidden" />,
});
const RevenueChart = dynamic(() => import("@/components/dashboard/RevenueChart"), {
  loading: () => <PanelSkeleton className="h-[320px]" />,
});
const BuildingHealth = dynamic(() => import("@/components/dashboard/BuildingHealth"), {
  loading: () => <PanelSkeleton className="h-[260px]" />,
});
const RecentActivity = dynamic(() => import("@/components/dashboard/RecentActivity"), {
  loading: () => <PanelSkeleton className="h-[240px]" />,
});
const ForecastPanel = dynamic(() => import("@/components/dashboard/ForecastPanel"), {
  loading: () => <PanelSkeleton className="h-[240px]" />,
});

function PanelSkeleton({ className = "" }: { className?: string }) {
  return <div className={`bg-card border border-border rounded-[20px] shadow-sm animate-pulse ${className}`} />;
}

export default function Dashboard() {
  const { hasPermission } = usePermissions();
  const { data, isLoading, isError, refetch } = useDashboardQuery();

  if (!hasPermission("dashboard.read")) {
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
        <MobilePageShell>
          <div className="w-full flex flex-col gap-[16px] md:gap-[20px]">
            {/* Hero Skeleton */}
            <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_3.5fr] gap-4 md:gap-5">
              <PanelSkeleton className="h-[180px] bg-gradient-to-br from-indigo-500/10 to-purple-500/10" />
              <div className="hidden xl:grid grid-cols-3 gap-4">
                <PanelSkeleton className="h-[180px]" />
                <PanelSkeleton className="h-[180px]" />
                <PanelSkeleton className="h-[180px]" />
              </div>
            </div>

            {/* KPI Grid Skeleton */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-5">
              <PanelSkeleton className="h-[100px]" />
              <PanelSkeleton className="h-[100px]" />
              <PanelSkeleton className="h-[100px]" />
              <PanelSkeleton className="h-[100px]" />
            </div>

            {/* Charts & Health Skeleton */}
            <div className="grid grid-cols-1 xl:grid-cols-[2.5fr_1fr] gap-[16px] md:gap-[20px]">
              <div className="flex flex-col gap-[16px] md:gap-[20px]">
                <PanelSkeleton className="h-[320px]" />
                <PanelSkeleton className="h-[260px]" />
              </div>
              <div className="flex flex-col gap-[16px] md:gap-[20px]">
                <PanelSkeleton className="h-[240px]" />
                <PanelSkeleton className="h-[240px]" />
              </div>
            </div>
          </div>
        </MobilePageShell>
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
              </div>

              <div className="flex flex-col gap-[16px] md:gap-[20px]">
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
