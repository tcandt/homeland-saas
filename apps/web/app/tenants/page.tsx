"use client";

import AppShell from "@/components/layout/AppShell";
import TenantKpi from "@/components/tenants/TenantKpi";
import TenantFilters from "@/components/tenants/TenantFilters";
import TenantGrid from "@/components/tenants/TenantGrid";
import TenantSidebar from "@/components/tenants/TenantSidebar";
import TenantsMobileFlow from "@/components/tenants/TenantsMobileFlow";

export default function TenantsPage() {
  return (
    <AppShell>
      <div data-testid="tenants-root" className="-m-4 h-[calc(100dvh-87px)] w-[calc(100%+32px)] overflow-auto bg-background md:h-[calc(100dvh-80px)] xl:overflow-hidden">
        <div className="block md:hidden">
          <TenantsMobileFlow />
        </div>

        <div className="hidden min-h-full w-full grid-cols-1 gap-2.5 p-2 md:grid md:p-3 2xl:h-full 2xl:min-h-0 2xl:grid-cols-[minmax(0,1fr)_minmax(310px,14vw)]">
          <div className="flex min-w-0 flex-col gap-2.5 2xl:min-h-0">
            <TenantKpi />
            <TenantFilters />
            <TenantGrid />
          </div>
          <TenantSidebar />
        </div>
      </div>
    </AppShell>
  );
}
