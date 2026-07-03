import AppShell from "@/components/layout/AppShell";
import OperationsContractKpi from "@/components/contracts/OperationsContractKpi";
import OperationsContractInsights from "@/components/contracts/OperationsContractInsights";
import OperationsContractFilters from "@/components/contracts/OperationsContractFilters";
import OperationsContractList from "@/components/contracts/OperationsContractList";
import ContractsMobileFlow from "@/components/contracts/ContractsMobileFlow";
import { Plus, Download, FileText, Filter } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function ContractsPage() {
  return (
    <AppShell>
      <div data-testid="contracts-root" className="w-full h-full">
        {/* Mobile View */}
        <div className="block md:hidden">
        <div className="mb-2">
          <div className="flex items-center justify-between">
            <h1 className="font-black text-[22px] text-text">Hợp đồng</h1>
          </div>
        </div>
        <ContractsMobileFlow />
      </div>

      {/* Desktop View */}
      <div className="hidden md:flex relative w-full min-h-full flex-col gap-6">
        {/* Decorative background blobs */}
        <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-[#6366f1]/5 rounded-full blur-[100px] -z-10 pointer-events-none" />
        <div className="absolute top-[20%] right-0 w-[400px] h-[400px] bg-[#10b981]/5 rounded-full blur-[100px] -z-10 pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/50 pb-4">
          <div>
            <h1 className="font-black text-[24px] md:text-[28px] text-text tracking-tight">Quản lý Hợp đồng</h1>
            <p className="text-[13px] font-medium text-muted mt-1">Theo dõi vòng đời hợp đồng, gia hạn, công nợ và hồ sơ ký kết</p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="secondary">
              <Filter size={16} className="mr-2" /> Bộ lọc
            </Button>
            <Button variant="secondary">
              <Download size={16} className="mr-2" /> Xuất Excel
            </Button>
            <Button variant="secondary">
              <FileText size={16} className="mr-2" /> Mẫu hợp đồng
            </Button>
            <Button variant="primary">
              <Plus size={16} className="mr-2" /> Thêm hợp đồng
            </Button>
          </div>
        </div>
        
        <OperationsContractKpi />
        <OperationsContractInsights />
        <OperationsContractFilters />
        <OperationsContractList />
      </div>
      </div>
    </AppShell>
  );
}
