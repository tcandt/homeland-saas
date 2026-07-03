"use client";

import React, { useState } from "react";
import OperationsContractRow from "./OperationsContractRow";
import OperationsContractDrawer from "./OperationsContractDrawer";

import { useContractsQuery } from "@/lib/queries/contracts.queries";
import { useContractsStore } from "@/lib/hooks/useContractsStore";
import { LoadingState } from "../ui/LoadingState";
import { ErrorState } from "../ui/ErrorState";
import { EmptyState } from "../ui/EmptyState";

export default function OperationsContractList() {
  const [selectedContract, setSelectedContract] = useState<any | null>(null);
  const { search, status } = useContractsStore();

  const { data, isLoading, isError } = useContractsQuery({
    search: search || undefined,
    status: status !== 'Tất cả' && status ? status : undefined,
  });

  if (isLoading) {
    return <LoadingState message="Đang tải danh sách hợp đồng..." />;
  }

  if (isError) {
    return (
      <div data-testid="contracts-error-state">
        <ErrorState message="Có lỗi xảy ra khi tải danh sách hợp đồng." />
      </div>
    );
  }

  const responseData = data?.data as any;
  const contracts = responseData?.items || (Array.isArray(responseData) ? responseData : []);
  const total = responseData?.total || contracts.length;

  return (
    <div data-testid="contracts-list" className="flex flex-col gap-[16px] pb-[40px]">
      <div className="flex items-center justify-between px-[8px]">
        <h3 className="font-black text-[18px] text-text">Danh sách Hợp đồng</h3>
        <span className="text-[13px] font-bold text-muted bg-black/5 dark:bg-white/5 px-[12px] py-[4px] rounded-[8px]">Hiển thị {contracts.length} / {total}</span>
      </div>

      <div className="flex flex-col gap-[12px]">
        {contracts.length === 0 ? (
          <div data-testid="empty-contracts-state">
            <EmptyState 
              title="Không có hợp đồng" 
              message="Chưa có hợp đồng nào hoặc không có hợp đồng phù hợp với bộ lọc." 
            />
          </div>
        ) : (
          contracts.map((contract: any) => (
            <OperationsContractRow 
              key={contract.id} 
              contract={contract} 
              onClick={() => setSelectedContract(contract)} 
            />
          ))
        )}
      </div>

      <OperationsContractDrawer 
        contract={selectedContract} 
        onClose={() => setSelectedContract(null)} 
      />
    </div>
  );
}
