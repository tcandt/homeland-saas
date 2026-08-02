"use client";

import React, { useMemo, useState } from "react";
import { MoreHorizontal, Calendar, Building2, User } from "lucide-react";
import { Table, Column } from "../ui/Table";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import OperationsContractDrawer from "./OperationsContractDrawer";
import { useContractsQuery } from "@/lib/queries/contracts.queries";
import { useContractsStore } from "@/lib/hooks/useContractsStore";
import { getContractStatusConfig } from "@/lib/contracts/contract-status";

function normalizeContracts(responseData: any) {
  if (Array.isArray(responseData)) return responseData;
  if (Array.isArray(responseData?.items)) return responseData.items;
  if (Array.isArray(responseData?.data)) return responseData.data;
  return [];
}

function formatDate(value: string | undefined) {
  if (!value) return "N/A";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "N/A" : date.toLocaleDateString("vi-VN");
}

export default function ContractsList() {
  const [selectedContract, setSelectedContract] = useState<any | null>(null);
  const { search, status } = useContractsStore();
  const { data, isLoading, isError, refetch } = useContractsQuery({
    search: search || undefined,
    status: status && status !== "Tất cả" ? status : undefined,
    limit: 100,
  });

  const responseData = data?.data as any;
  const contracts = useMemo(() => normalizeContracts(responseData), [responseData]);
  const total = Number(responseData?.total || contracts.length || 0);

  const columns = useMemo<Column<any>[]>(() => [
    {
      header: "Mã HĐ",
      accessor: (row: any) => <span className="text-[13px] font-bold text-text group-hover:text-primary transition-colors">{row.code || row.id?.slice?.(0, 8) || "N/A"}</span>,
      className: "w-[120px]",
    },
    {
      header: "Khách thuê",
      accessor: (row: any) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center shrink-0 border border-primary/10">
            <User size={14} className="text-primary" />
          </div>
          <span className="text-[13px] font-bold text-text">{row.customer?.fullName || row.customer?.name || "Chưa rõ"}</span>
        </div>
      ),
    },
    {
      header: "Phòng / Tòa nhà",
      accessor: (row: any) => (
        <div className="flex items-center gap-2 text-[13px] font-medium text-text">
          <div className="p-1.5 rounded-md bg-muted/10"><Building2 size={14} className="text-muted" /></div>
          {row.room?.number || row.room?.code || "Chưa xếp phòng"} · {row.room?.building?.name || "Chưa có tòa nhà"}
        </div>
      ),
    },
    {
      header: "Thời hạn",
      accessor: (row: any) => (
        <div className="flex items-center gap-2 text-[13px] font-medium text-muted">
          <div className="p-1.5 rounded-md bg-muted/10"><Calendar size={14} className="text-muted" /></div>
          {formatDate(row.startDate)} - {formatDate(row.endDate)}
        </div>
      ),
    },
    {
      header: "Giá thuê",
      accessor: (row: any) => <span className="text-[14px] font-black text-text">{Number(row.monthlyRent || 0).toLocaleString("vi-VN")}đ</span>,
      className: "text-right",
    },
    {
      header: "Trạng thái",
      accessor: (row: any) => {
        const config = getContractStatusConfig(row.status);
        return <Badge variant={config.color}>{config.label}</Badge>;
      },
      className: "text-right w-[120px]",
    },
    {
      header: "",
      accessor: () => (
        <Button variant="ghost" size="icon" className="text-muted hover:text-text rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition-colors">
          <MoreHorizontal size={16} />
        </Button>
      ),
      className: "text-center w-[60px]",
    },
  ], []);

  return (
    <div className="flex flex-col gap-[16px]">
      <div className="flex items-center justify-between px-[8px]">
        <h3 className="font-black text-[18px] text-text">Danh sách Hợp đồng</h3>
        <span className="text-[13px] font-bold text-muted bg-black/5 dark:bg-white/5 px-[12px] py-[4px] rounded-[8px]">
          Hiển thị {contracts.length} / {total}
        </span>
      </div>

      <Table
        data-testid="contracts-list"
        columns={columns}
        data={contracts}
        isLoading={isLoading}
        isError={isError}
        onRetry={refetch}
        emptyMessage="Chưa có hợp đồng nào hoặc không có hợp đồng phù hợp với bộ lọc."
        onRowClick={(row) => setSelectedContract(row)}
      />

      <OperationsContractDrawer contract={selectedContract} onClose={() => setSelectedContract(null)} />
    </div>
  );
}
