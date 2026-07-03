"use client";

import React from "react";
import { Building2, ShieldCheck, UserPlus, ChevronDown } from "lucide-react";
import { useDepositsQuery } from "../../lib/queries/deposits.queries";
import { UI_Deposit } from "../../lib/adapters/deposit.adapter";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { ErrorState } from "../ui/ErrorState";
import { EmptyState } from "../ui/EmptyState";
import OperationsDepositDrawer from "./OperationsDepositDrawer";

export default function DepositsMobileFlow() {
  const [selectedDeposit, setSelectedDeposit] = React.useState<any | null>(null);
  const { data, isLoading, isError } = useDepositsQuery({ page: 1, limit: 10 });
  const deposits = data?.data?.items || [];

  return (
    <div className="flex flex-col gap-[16px] w-full box-border pb-[100px] bg-background pt-2">
      
      {/* KPI Section */}
      <section data-testid="deposits-kpi-grid" className="grid grid-cols-4 gap-2 px-1">
        <Card className="p-2.5 flex flex-col items-center justify-center gap-1 bg-[#3b82f6]/10 border-[#3b82f6]/20">
          <div className="text-[14px] font-black text-[#3b82f6]">450M</div>
          <div className="text-[9px] font-bold text-[#3b82f6] uppercase text-center leading-tight">Tổng quỹ</div>
        </Card>
        <Card className="p-2.5 flex flex-col items-center justify-center gap-1">
          <div className="text-[14px] font-black text-[#22c55e]">380M</div>
          <div className="text-[9px] font-bold text-muted uppercase text-center leading-tight">Bảo đảm</div>
        </Card>
        <Card className="p-2.5 flex flex-col items-center justify-center gap-1">
          <div className="text-[14px] font-black text-[#8b5cf6]">70M</div>
          <div className="text-[9px] font-bold text-muted uppercase text-center leading-tight">Giữ chỗ</div>
        </Card>
        <Card className="p-2.5 flex flex-col items-center justify-center gap-1">
          <div className="text-[14px] font-black text-[#f97316]">15M</div>
          <div className="text-[9px] font-bold text-muted uppercase text-center leading-tight">Sắp hoàn</div>
        </Card>
      </section>

      {/* Quick Filters */}
      <section className="flex gap-2 overflow-x-auto hide-scrollbar px-1">
        <Button variant="outline" size="sm" className="bg-[#4f46e5]/10 text-[#4f46e5] border-[#4f46e5]/20 rounded-full whitespace-nowrap">
          Tất cả Phiếu
        </Button>
        <Button variant="outline" size="sm" className="rounded-full whitespace-nowrap">
          <ShieldCheck size={12} className="mr-1" /> Cọc bảo đảm
        </Button>
        <Button variant="outline" size="sm" className="rounded-full whitespace-nowrap">
          <UserPlus size={12} className="mr-1" /> Cọc giữ chỗ
        </Button>
      </section>

      {/* List Section */}
      <section data-testid="deposits-list" className="flex flex-col gap-2 px-1">
        <div className="flex justify-between items-end px-1">
          <h3 className="text-[13px] font-black text-text">Danh sách ({deposits.length})</h3>
          <span className="text-[11px] font-bold text-[#4f46e5] flex items-center gap-1">Mới nhất <ChevronDown size={14} /></span>
        </div>

        <div className="flex flex-col gap-2">
          {isLoading ? (
            <div className="p-4 text-center text-muted text-[13px]">Đang tải...</div>
          ) : isError ? (
            <div data-testid="deposits-error-state" className="p-4 text-center text-rose-500 text-[13px]"><ErrorState message="Lỗi tải dữ liệu" /></div>
          ) : deposits.length === 0 ? (
            <div data-testid="empty-deposits-state" className="p-4"><EmptyState title="Không có phiếu cọc" message="" /></div>
          ) : deposits.map((item: UI_Deposit, i: number) => {
            const isPaid = item.status === 'PAID';
            const isRefunded = item.status === 'REFUNDED';
            const isCancelled = item.status === 'CANCELLED';
            const amountStr = new Intl.NumberFormat('vi-VN').format(item.amount) + ' đ';
            const typeName = item.type === 'BOOKING' ? 'Giữ phòng' : item.type === 'SECURITY' ? 'Bảo đảm' : 'Giữ chỗ';
            
            return (
              <Card onClick={() => setSelectedDeposit(item)} data-testid="deposit-card" key={item.id} className="p-3 flex flex-col relative overflow-hidden group active:scale-[0.98] transition-transform">
                
                {/* Status Color Bar */}
                <div className={`absolute top-0 left-0 w-1 h-full ${
                  isPaid ? 'bg-[#3b82f6]' : 
                  isRefunded ? 'bg-[#22c55e]' : 'bg-muted'
                }`}></div>

                {/* Header */}
                <div className="flex justify-between items-start pl-2">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[13px] font-black text-text truncate max-w-[140px]">{item.customerName}</span>
                      <span className="text-[10px] font-bold text-muted bg-black/5 px-1.5 py-0.5 rounded-[4px]">{item.code || item.id}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted mt-0.5">
                      <Building2 size={12} /> <span className="truncate">{item.roomCode} - {item.buildingName}</span>
                    </div>
                  </div>
                  
                  {isPaid && <span data-testid="deposit-status-badge" className="px-2 py-0.5 bg-[#3b82f6]/10 text-[#3b82f6] text-[9px] font-bold rounded-[4px]">Đã thu</span>}
                  {isRefunded && <span data-testid="deposit-status-badge" className="px-2 py-0.5 bg-[#22c55e]/10 text-[#22c55e] text-[9px] font-bold rounded-[4px]">Đã hoàn</span>}
                  {isCancelled && <span data-testid="deposit-status-badge" className="px-2 py-0.5 bg-black/5 text-muted text-[9px] font-bold rounded-[4px]">Đã hủy</span>}
                  {!isPaid && !isRefunded && !isCancelled && <span data-testid="deposit-status-badge" className="px-2 py-0.5 bg-black/5 text-muted text-[9px] font-bold rounded-[4px]">{item.status}</span>}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pl-2 mt-2 pt-2 border-t border-border/50">
                  <div className="flex flex-col">
                    <span className="text-[9px] font-bold text-muted uppercase">Loại cọc • Ngày lập</span>
                    <div className="flex items-center gap-1 text-[11px] font-bold text-text">
                      {item.type === 'SECURITY' ? <ShieldCheck size={12} className="text-[#22c55e]" /> : <UserPlus size={12} className="text-[#8b5cf6]" />}
                      {typeName} <span className="text-muted font-medium ml-1">• {new Date(item.createdAt).toLocaleDateString('vi-VN')}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[9px] font-bold text-muted uppercase">Số tiền</span>
                    <span className="text-[13px] font-black text-text">{amountStr}</span>
                  </div>
                </div>

              </Card>
            );
          })}
        </div>
      </section>

      {/* Drawer */}
      <OperationsDepositDrawer 
        deposit={selectedDeposit} 
        onClose={() => setSelectedDeposit(null)} 
      />
    </div>
  );
}
