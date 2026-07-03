import AppShell from "@/components/layout/AppShell";
import SalesMobileFlow from "@/components/sales/SalesMobileFlow";
import OperationsSalesKpi from "@/components/sales/OperationsSalesKpi";
import OperationsSalesInsights from "@/components/sales/OperationsSalesInsights";
import OperationsSalesFilters from "@/components/sales/OperationsSalesFilters";
import OperationsSalesFunnel from "@/components/sales/OperationsSalesFunnel";
import OperationsSalesMain from "@/components/sales/OperationsSalesMain";
import OperationsSalesRightPanel from "@/components/sales/OperationsSalesRightPanel";
import OperationsSalesDrawer from "@/components/sales/OperationsSalesDrawer";
import { Plus, Download, Upload, Megaphone, Filter } from "lucide-react";

export default function SalesPage() {
  return (
    <AppShell>
      {/* Mobile View */}
      <div className="block md:hidden">
        <SalesMobileFlow />
      </div>

      {/* Desktop View - Full Width Operations Center */}
      <div className="hidden md:flex relative w-full min-h-full flex-col px-[32px] gap-[24px] pb-[120px]">
        {/* Decorative background blobs */}
        <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-[#6366f1]/5 rounded-full blur-[100px] -z-10 pointer-events-none" />
        <div className="absolute top-[20%] right-0 w-[400px] h-[400px] bg-[#10b981]/5 rounded-full blur-[100px] -z-10 pointer-events-none" />
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="font-black text-[24px] md:text-[28px] text-text tracking-tight">Sales CRM</h1>
            <p className="text-[13px] font-medium text-muted mt-1">Quản lý Lead, Pipeline, Chốt phòng và Hiệu suất kinh doanh</p>
          </div>
          <div className="flex items-center gap-[8px]">
            <button className="h-[36px] px-[16px] rounded-[10px] bg-card border border-border flex items-center gap-[6px] text-[13px] font-bold text-text hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
              <Filter size={14} className="text-muted" /> Bộ lọc
            </button>
            <button className="h-[36px] px-[16px] rounded-[10px] bg-card border border-border flex items-center gap-[6px] text-[13px] font-bold text-text hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
              <Megaphone size={14} className="text-purple-500" /> Marketing
            </button>
            <button className="h-[36px] px-[16px] rounded-[10px] bg-card border border-border flex items-center gap-[6px] text-[13px] font-bold text-text hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
              <Upload size={14} className="text-blue-500" /> Import
            </button>
            <button className="h-[36px] px-[16px] rounded-[10px] bg-[#10b981] hover:bg-[#059669] flex items-center gap-[6px] text-[13px] font-bold text-white transition-colors shadow-sm">
              <Plus size={16} /> Thêm Lead
            </button>
          </div>
        </div>

        {/* KPI Row */}
        <OperationsSalesKpi />

        {/* Insights Row */}
        <OperationsSalesInsights />

        {/* Quick Filters */}
        <OperationsSalesFilters />

        {/* Sales Funnel */}
        <OperationsSalesFunnel />

        {/* Main Content & Right Panel Split */}
        <div className="flex gap-[24px] relative">
          <div className="flex-1 w-0">
            <OperationsSalesMain />
          </div>
          <div className="w-[420px] shrink-0">
            <OperationsSalesRightPanel />
          </div>
        </div>

        {/* Lead Drawer */}
        <OperationsSalesDrawer />
      </div>
    </AppShell>
  );
}
