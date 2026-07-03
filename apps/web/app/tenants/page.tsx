import AppShell from "@/components/layout/AppShell";
import TenantKpi from "@/components/tenants/TenantKpi";
import TenantInsights from "@/components/tenants/TenantInsights";
import TenantFilters from "@/components/tenants/TenantFilters";
import TenantGrid from "@/components/tenants/TenantGrid";
import TenantsMobileFlow from "@/components/tenants/TenantsMobileFlow";

export default function TenantsPage() {
  return (
    <AppShell>
      {/* Mobile View */}
      <div className="block md:hidden">
        <TenantsMobileFlow />
      </div>

      {/* Desktop View */}
      <div data-testid="tenants-root" className="hidden md:flex relative w-full min-h-full flex-col gap-6">
        {/* Decorative background blobs */}
        <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-[#6366f1]/5 rounded-full blur-[100px] -z-10 pointer-events-none" />
        <div className="absolute top-[20%] right-0 w-[400px] h-[400px] bg-[#10b981]/5 rounded-full blur-[100px] -z-10 pointer-events-none" />
        
        <TenantKpi />
        <TenantInsights />
        <TenantFilters />
        <TenantGrid />
      </div>
    </AppShell>
  );
}
