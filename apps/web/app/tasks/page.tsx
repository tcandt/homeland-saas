"use client";

import AppShell from "@/components/layout/AppShell";
import OperationsMobileFlow from "@/components/tasks/OperationsMobileFlow";
import OperationsKpi from "@/components/tasks/OperationsKpi";
import OperationsInsights from "@/components/tasks/OperationsInsights";
import OperationsFilters from "@/components/tasks/OperationsFilters";
import OperationsBoard from "@/components/tasks/OperationsBoard";
import OperationsRightPanel from "@/components/tasks/OperationsRightPanel";
import { Plus, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function TasksPage() {
  return (
    <AppShell>
      {/* Mobile View */}
      <div className="block md:hidden">
        <div className="mb-4">
          <div className="flex items-center justify-between">
            <h1 className="font-black text-[22px] text-text">Vận hành</h1>
          </div>
        </div>
        <OperationsMobileFlow />
      </div>

      {/* Desktop View */}
      <div className="hidden md:flex relative w-full min-h-full gap-[24px]">
        {/* Decorative background blobs */}
        <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-[#6366f1]/5 rounded-full blur-[100px] -z-10 pointer-events-none" />
        <div className="absolute top-[20%] right-0 w-[400px] h-[400px] bg-[#8b5cf6]/5 rounded-full blur-[100px] -z-10 pointer-events-none" />
        
        {/* Main Content (Left) */}
        <div className="flex-1 flex flex-col gap-[24px] min-w-0">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/50 pb-4">
            <div>
              <h1 className="font-black text-[24px] md:text-[28px] text-text tracking-tight">Vận hành & Chăm sóc Khách hàng</h1>
              <p className="text-[13px] font-medium text-muted mt-1">Theo dõi sự cố, bảo trì, tin nhắn và công việc cần xử lý</p>
            </div>
            <div className="flex items-center gap-[12px]">
              <Button variant="outline" className="h-[36px] px-[16px] flex items-center gap-[6px]">
                <CalendarClock size={14} className="text-muted" /> Lịch bảo trì
              </Button>
              <Button className="h-[36px] px-[16px] flex items-center gap-[6px]">
                <Plus size={16} /> Tạo ticket
              </Button>
            </div>
          </div>
          <OperationsKpi />
          <OperationsInsights />
          <OperationsFilters />
          <OperationsBoard />
        </div>

        {/* Right Panel */}
        <OperationsRightPanel />
      </div>
    </AppShell>
  );
}

