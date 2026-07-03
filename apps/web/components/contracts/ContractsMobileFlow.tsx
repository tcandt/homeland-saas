"use client";

import React, { useState } from "react";
import { FileText, Clock, FileWarning, CheckCircle2, Building2, User, Calendar, MoreHorizontal, ChevronDown } from "lucide-react";
import { Card } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import OperationsContractDrawer from "./OperationsContractDrawer";

import { useContractsQuery } from "@/lib/queries/contracts.queries";
import { useContractsStore } from "@/lib/hooks/useContractsStore";
import { LoadingState } from "../ui/LoadingState";
import { ErrorState } from "../ui/ErrorState";
import { EmptyState } from "../ui/EmptyState";

function getBadgeVariant(status: string) {
  if (status === "Đang hiệu lực") return "success";
  if (status === "Sắp hết hạn") return "warning";
  if (status === "Đã chấm dứt") return "neutral";
  return "neutral";
}

export default function ContractsMobileFlow() {
  const [selectedContract, setSelectedContract] = useState<any | null>(null);
  const { search, status } = useContractsStore();

  const { data, isLoading, isError } = useContractsQuery({
    search: search || undefined,
    status: status !== 'Tất cả' && status ? status : undefined,
  });

  if (isLoading) {
    return <LoadingState message="Đang tải..." />;
  }

  if (isError) {
    return (
      <div data-testid="contracts-error-state">
        <ErrorState message="Lỗi tải dữ liệu" />
      </div>
    );
  }

  const responseData = data?.data as any;
  const contracts = responseData?.items || (Array.isArray(responseData) ? responseData : []);
  const total = responseData?.total || contracts.length;

  return (
    <div className="flex flex-col gap-[16px] w-full box-border pb-[100px] bg-background pt-2">
      
      {/* KPI Section */}
      <section data-testid="contracts-kpi-grid" className="grid grid-cols-4 gap-2 px-1">
        <Card className="p-2.5 flex flex-col items-center justify-center gap-1">
          <div className="text-[16px] font-black text-[#3b82f6]">142</div>
          <div className="text-[9px] font-bold text-muted uppercase text-center leading-tight">Tổng HĐ</div>
        </Card>
        <Card className="p-2.5 flex flex-col items-center justify-center gap-1">
          <div className="text-[16px] font-black text-[#22c55e]">128</div>
          <div className="text-[9px] font-bold text-muted uppercase text-center leading-tight">Hiệu lực</div>
        </Card>
        <Card className="bg-[#f97316]/10 border-[#f97316]/20 p-2.5 flex flex-col items-center justify-center gap-1">
          <div className="text-[16px] font-black text-[#f97316]">9</div>
          <div className="text-[9px] font-bold text-[#f97316] uppercase text-center leading-tight">Sắp hết hạn</div>
        </Card>
        <Card className="p-2.5 flex flex-col items-center justify-center gap-1">
          <div className="text-[16px] font-black text-muted">5</div>
          <div className="text-[9px] font-bold text-muted uppercase text-center leading-tight">Đã chấm dứt</div>
        </Card>
      </section>

      {/* Quick Filters */}
      <section data-testid="contracts-filter-bar" className="flex gap-2 overflow-x-auto hide-scrollbar px-1">
        <Button variant="outline" size="sm" className="bg-[#4f46e5]/10 text-[#4f46e5] border-[#4f46e5]/20 text-[11px] h-7 px-3 rounded-full shrink-0">
          Tất cả Hợp đồng
        </Button>
        <Button variant="outline" size="sm" className="text-muted text-[11px] h-7 px-3 rounded-full shrink-0">
          Sắp hết hạn (9)
        </Button>
        <Button variant="outline" size="sm" className="text-muted text-[11px] h-7 px-3 rounded-full shrink-0">
          Chờ ký (2)
        </Button>
        <Button variant="outline" size="sm" className="text-muted text-[11px] h-7 px-3 rounded-full shrink-0">
          Đã thanh lý
        </Button>
      </section>

      {/* List Section */}
      <section data-testid="contracts-list" className="flex flex-col gap-2 px-1">
        <div className="flex justify-between items-end px-1">
          <h3 className="text-[13px] font-black text-text">Danh sách ({total})</h3>
          <span className="text-[11px] font-bold text-[#4f46e5] flex items-center gap-1">Mới nhất <ChevronDown size={14} /></span>
        </div>

        <div className="flex flex-col gap-2">
          {contracts.length === 0 ? (
            <div data-testid="empty-contracts-state">
              <EmptyState title="Không có hợp đồng" message="" />
            </div>
          ) : contracts.map((item: any, i: number) => (
            <Card data-testid="contract-card" onClick={() => setSelectedContract(item)} key={i} className="p-3 flex flex-col relative overflow-hidden group active:scale-[0.98] transition-transform">
              
              {/* Status Color Bar */}
              <div className={`absolute top-0 left-0 w-1 h-full ${
                item.status === 'Đang hiệu lực' ? 'bg-[#22c55e]' : 
                item.status === 'Sắp hết hạn' ? 'bg-[#f97316]' : 'bg-muted'
              }`}></div>

              {/* Header */}
              <div className="flex justify-between items-start pl-2">
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[13px] font-black text-text">{item.customer?.name || 'Chưa rõ'}</span>
                    <Badge variant="neutral">{item.code || item.id.slice(0,8)}</Badge>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted mt-0.5">
                    <Building2 size={12} /> <span className="truncate">{item.room?.number} · {item.room?.building?.name}</span>
                  </div>
                </div>
                
                <Badge data-testid="contract-status-badge" variant={getBadgeVariant(item.status)}>
                  {item.status === 'Đang hiệu lực' ? 'Hiệu lực' : item.status === 'Sắp hết hạn' ? 'Sắp hết hạn' : 'Chấm dứt'}
                </Badge>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pl-2 mt-2 pt-2 border-t border-border/50">
                <div className="flex flex-col">
                  <span className="text-[9px] font-bold text-muted uppercase">Thời hạn</span>
                  <span className="text-[11px] font-bold text-text">{new Date(item.startDate).toLocaleDateString('vi-VN')} - {new Date(item.endDate).toLocaleDateString('vi-VN')}</span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-[9px] font-bold text-muted uppercase">Giá thuê</span>
                  <span className="text-[12px] font-black text-text">{(item.monthlyRent || 0).toLocaleString()}đ</span>
                </div>
              </div>

            </Card>
          ))}
        </div>
      </section>

      {/* Drawer */}
      <OperationsContractDrawer 
        contract={selectedContract} 
        onClose={() => setSelectedContract(null)} 
      />
    </div>
  );
}
